const providerLabels = {
  google: "Google Gemini",
  deepseek: "DeepSeek",
  glm: "GLM",
};

const defaultModels = {
  google: "gemini-2.5-flash",
  deepseek: "deepseek-v4-flash",
  glm: "glm-4.7-flash",
};

const json = (body, init = {}) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...(init.headers ?? {}),
    },
  });

const extractJsonObject = (text) => {
  const trimmed = String(text ?? "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("模型没有返回 JSON。");
    }
    return JSON.parse(match[0]);
  }
};

const parseDecisionText = (text) => {
  const parsed = extractJsonObject(text);
  return {
    actionId: String(parsed.actionId ?? ""),
    reason: typeof parsed.reason === "string" ? parsed.reason : undefined,
    rawText: text,
  };
};

const apiKeyForProvider = (env, provider) => {
  if (provider === "google") return env.GOOGLE_API_KEY ?? env.GEMINI_API_KEY;
  if (provider === "deepseek") return env.DEEPSEEK_API_KEY;
  if (provider === "glm") return env.GLM_API_KEY ?? env.ZAI_API_KEY;
  return "";
};

const requestGoogleDecision = async ({ apiKey, model, payload }) => {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model,
    )}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: JSON.stringify(payload),
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Google API ${response.status}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();
  if (!text) {
    throw new Error("Google API 没有返回文本。");
  }
  return parseDecisionText(text);
};

const requestOpenAiCompatibleDecision = async ({ provider, apiKey, model, payload }) => {
  const endpoint =
    provider === "glm"
      ? "https://api.z.ai/api/paas/v4/chat/completions"
      : "https://api.deepseek.com/chat/completions";

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "你是三国杀AI。必须只从用户给定 legalActions 里选一个 actionId，并只输出 JSON。",
        },
        {
          role: "user",
          content: JSON.stringify(payload),
        },
      ],
      temperature: 0.2,
      stream: false,
      response_format: {
        type: "json_object",
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`${providerLabels[provider]} API ${response.status}`);
  }

  const data = await response.json();
  const text = String(data?.choices?.[0]?.message?.content ?? "").trim();
  if (!text) {
    throw new Error(`${providerLabels[provider]} API 没有返回文本。`);
  }
  return parseDecisionText(text);
};

export const onRequestPost = async ({ request, env }) => {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "请求体不是有效 JSON。" }, { status: 400 });
  }

  const provider = String(body?.provider ?? "");
  if (!Object.hasOwn(providerLabels, provider)) {
    return json({ error: "未知 AI 供应商。" }, { status: 400 });
  }

  const apiKey = apiKeyForProvider(env, provider);
  if (!apiKey) {
    return json(
      {
        error: `${providerLabels[provider]} 服务端 API Key 尚未配置，已 fallback 本地 AI。`,
        fallback: true,
        missingSecret: true,
      },
    );
  }

  const model = String(body?.model || defaultModels[provider]);
  const payload = body?.payload;
  if (!payload || typeof payload !== "object") {
    return json({ error: "缺少 AI 决策 payload。" }, { status: 400 });
  }

  try {
    const decision =
      provider === "google"
        ? await requestGoogleDecision({ apiKey, model, payload })
        : await requestOpenAiCompatibleDecision({ provider, apiKey, model, payload });

    return json({
      ...decision,
      provider,
      model,
    });
  } catch (error) {
    return json(
      {
        error: error instanceof Error ? error.message : String(error),
        fallback: true,
        provider,
      },
    );
  }
};

export const onRequest = () =>
  json({ error: "Method Not Allowed" }, { status: 405 });
