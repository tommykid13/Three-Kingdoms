import type { DeckInstance } from "../data/types";
import type { GameState, Seat } from "./types";
import {
  getCardPlayInfo,
  getEquipmentSlot,
  getJiedaoVictimIds,
  getVisibleRole,
} from "./turn";

export type AiProviderId = "local" | "google" | "deepseek" | "glm";

export type AiProviderConfig = {
  enabled: boolean;
  provider: AiProviderId;
  apiKey: string;
  model: string;
  saveKey: boolean;
  timeoutMs: number;
};

export type AiLegalAction =
  | {
      id: "end";
      kind: "end";
      label: string;
    }
  | {
      id: "local";
      kind: "local";
      label: string;
    }
  | {
      id: string;
      kind: "play_card";
      cardInstanceId: string;
      cardName: string;
      cardId: string;
      targetSeatId?: number;
      extraTargetSeatIds?: number[];
      label: string;
    };

export type AiDecisionResult = {
  actionId: string;
  reason?: string;
  rawText?: string;
};

export const aiProviderLabels: Record<AiProviderId, string> = {
  local: "本地规则 AI",
  google: "Google Gemini",
  deepseek: "DeepSeek",
  glm: "GLM",
};

export const defaultAiModels: Record<Exclude<AiProviderId, "local">, string> = {
  google: "gemini-2.5-flash",
  deepseek: "deepseek-v4-flash",
  glm: "glm-4.7-flash",
};

export const defaultAiConfig: AiProviderConfig = {
  enabled: false,
  provider: "local",
  apiKey: "",
  model: defaultAiModels.google,
  saveKey: false,
  timeoutMs: 12000,
};

const storedConfigKey = "three-king-llm-ai-config-v1";

export const loadStoredAiConfig = (): AiProviderConfig => {
  try {
    const raw = window.localStorage.getItem(storedConfigKey);
    if (!raw) {
      return defaultAiConfig;
    }
    const parsed = JSON.parse(raw) as Partial<AiProviderConfig>;
    const provider = parsed.provider && parsed.provider in aiProviderLabels ? parsed.provider : "local";
    const providerDefaultModel =
      provider === "local" ? defaultAiConfig.model : defaultAiModels[provider];

    return {
      enabled: Boolean(parsed.enabled),
      provider,
      apiKey: parsed.saveKey ? String(parsed.apiKey ?? "") : "",
      model: String(parsed.model || providerDefaultModel),
      saveKey: Boolean(parsed.saveKey),
      timeoutMs:
        typeof parsed.timeoutMs === "number" && parsed.timeoutMs >= 4000
          ? parsed.timeoutMs
          : defaultAiConfig.timeoutMs,
    };
  } catch {
    return defaultAiConfig;
  }
};

export const saveStoredAiConfig = (config: AiProviderConfig) => {
  const persisted: AiProviderConfig = {
    ...config,
    apiKey: config.saveKey ? config.apiKey : "",
  };
  window.localStorage.setItem(storedConfigKey, JSON.stringify(persisted));
};

const cardActionId = (
  card: DeckInstance,
  targetSeatId?: number,
  extraTargetSeatIds: number[] = [],
) =>
  [
    "play",
    card.instance_id,
    targetSeatId ?? "self",
    extraTargetSeatIds.length ? extraTargetSeatIds.join("-") : "none",
  ].join(":");

export const buildAiLegalActions = (
  game: GameState,
  actorSeatId: number,
): AiLegalAction[] => {
  const actor = game.seats[actorSeatId];
  if (!actor?.alive || actor.controller !== "ai" || game.pendingAction || game.winner) {
    return [];
  }

  const actions: AiLegalAction[] = [
    {
      id: "end",
      kind: "end",
      label: "结束出牌阶段",
    },
    {
      id: "local",
      kind: "local",
      label: "交给本地规则 AI 执行一步",
    },
  ];

  const pushPlayAction = (
    card: DeckInstance,
    targetSeatId?: number,
    extraTargetSeatIds: number[] = [],
  ) => {
    const targetNames = [targetSeatId, ...extraTargetSeatIds]
      .filter((id): id is number => typeof id === "number")
      .map((id) => game.seats[id]?.general.name)
      .filter(Boolean)
      .join("、");

    actions.push({
      id: cardActionId(card, targetSeatId, extraTargetSeatIds),
      kind: "play_card",
      cardInstanceId: card.instance_id,
      cardName: card.name,
      cardId: card.card_id,
      targetSeatId,
      extraTargetSeatIds,
      label: targetNames ? `使用【${card.name}】 -> ${targetNames}` : `使用【${card.name}】`,
    });
  };

  for (const card of actor.hand) {
    const info = getCardPlayInfo(game, actorSeatId, card);
    if (!info.canPlay) {
      continue;
    }

    if (info.mode !== "target") {
      pushPlayAction(card);
      continue;
    }

    if (card.card_id === "jiedaosharen") {
      for (const weaponOwnerSeatId of info.validTargetIds.slice(0, 6)) {
        for (const victimSeatId of getJiedaoVictimIds(game, weaponOwnerSeatId).slice(0, 4)) {
          pushPlayAction(card, weaponOwnerSeatId, [victimSeatId]);
        }
      }
      continue;
    }

    if (card.card_id === "tiesuolianhuan" && info.canRecast) {
      pushPlayAction(card);
      const targetIds = info.validTargetIds.slice(0, 8);
      for (const targetSeatId of targetIds) {
        pushPlayAction(card, targetSeatId);
      }
      for (let i = 0; i < targetIds.length; i += 1) {
        for (let j = i + 1; j < targetIds.length && j < i + 4; j += 1) {
          pushPlayAction(card, targetIds[i], [targetIds[j]]);
        }
      }
      continue;
    }

    for (const targetSeatId of info.validTargetIds.slice(0, 8)) {
      pushPlayAction(card, targetSeatId);
    }
  }

  return actions.slice(0, 72);
};

const describeSeatForAi = (seat: Seat, actor: Seat) => ({
  seatId: seat.id,
  general: seat.general.name,
  faction: seat.general.faction,
  role: seat.role,
  visibleRole: getVisibleRole(seat),
  relation:
    seat.id === actor.id
      ? "self"
      : seat.role === actor.role ||
          (actor.role !== "反贼" && seat.role !== "反贼" && seat.role !== "内奸")
        ? "likely_ally"
        : "likely_enemy",
  hp: seat.hp,
  maxHp: seat.maxHp,
  alive: seat.alive,
  chained: seat.chained,
  handCount: seat.hand.length,
  equipment: seat.equipment.map((card) => ({
    name: card.name,
    slot: getEquipmentSlot(card),
  })),
  judgeArea: seat.judgeArea.map((card) => card.name),
});

export const buildAiDecisionPayload = (
  game: GameState,
  actorSeatId: number,
  actions: AiLegalAction[],
) => {
  const actor = game.seats[actorSeatId];
  return {
    game: "Sanguosha 8-player identity mode",
    instruction:
      "Choose exactly one actionId from legalActions. Prefer actions that help your hidden role win. Return JSON only.",
    responseSchema: {
      actionId: "one legalActions[].id",
      reason: "short Chinese reason",
    },
    turn: {
      round: game.turn.round,
      phase: game.turn.phase,
      shaPlayed: game.turn.shaPlayed,
      jiuUsed: game.turn.jiuUsed,
      drunkShaBonus: game.turn.drunkShaBonus,
      tianyiState: game.turn.tianyiState,
      shuangxiongColor: game.turn.shuangxiongColor,
    },
    self: actor
      ? {
          seatId: actor.id,
          general: actor.general.name,
          role: actor.role,
          hp: actor.hp,
          maxHp: actor.maxHp,
          skills: actor.general.skills.map((skill) => skill.name),
          hand: actor.hand.map((card) => ({
            instanceId: card.instance_id,
            cardId: card.card_id,
            name: card.name,
            suit: card.suit_symbol,
            rank: card.rank,
          })),
        }
      : null,
    seats: actor ? game.seats.map((seat) => describeSeatForAi(seat, actor)) : [],
    legalActions: actions.map((action) => ({
      id: action.id,
      label: action.label,
      kind: action.kind,
      cardName: action.kind === "play_card" ? action.cardName : undefined,
      targetSeatId: action.kind === "play_card" ? action.targetSeatId : undefined,
      extraTargetSeatIds: action.kind === "play_card" ? action.extraTargetSeatIds : undefined,
    })),
  };
};

const extractJsonObject = (text: string): Record<string, unknown> => {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("模型没有返回 JSON。");
    }
    return JSON.parse(match[0]) as Record<string, unknown>;
  }
};

const parseDecisionText = (text: string): AiDecisionResult => {
  const parsed = extractJsonObject(text);
  return {
    actionId: String(parsed.actionId ?? ""),
    reason: typeof parsed.reason === "string" ? parsed.reason : undefined,
    rawText: text,
  };
};

const fetchWithTimeout = async (
  url: string,
  init: RequestInit,
  timeoutMs: number,
) => {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timer);
  }
};

const requestGoogleDecision = async (
  config: AiProviderConfig,
  payload: unknown,
) => {
  const model = config.model || defaultAiModels.google;
  const response = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model,
    )}:generateContent?key=${encodeURIComponent(config.apiKey)}`,
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
    config.timeoutMs,
  );

  if (!response.ok) {
    throw new Error(`Google API ${response.status}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts
    ?.map((part: { text?: string }) => part.text ?? "")
    .join("")
    .trim();
  if (!text) {
    throw new Error("Google API 没有返回文本。");
  }
  return parseDecisionText(text);
};

const requestOpenAiCompatibleDecision = async (
  config: AiProviderConfig,
  payload: unknown,
) => {
  const isGlm = config.provider === "glm";
  const baseUrl = isGlm
    ? "https://api.z.ai/api/paas/v4/chat/completions"
    : "https://api.deepseek.com/chat/completions";
  const model =
    config.model || (isGlm ? defaultAiModels.glm : defaultAiModels.deepseek);

  const response = await fetchWithTimeout(
    baseUrl,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
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
    },
    config.timeoutMs,
  );

  if (!response.ok) {
    throw new Error(`${aiProviderLabels[config.provider]} API ${response.status}`);
  }

  const data = await response.json();
  const text = String(data?.choices?.[0]?.message?.content ?? "").trim();
  if (!text) {
    throw new Error(`${aiProviderLabels[config.provider]} API 没有返回文本。`);
  }
  return parseDecisionText(text);
};

export const requestAiDecision = async (
  config: AiProviderConfig,
  payload: unknown,
): Promise<AiDecisionResult> => {
  if (!config.enabled || config.provider === "local") {
    throw new Error("外部 AI 未启用。");
  }
  if (!config.apiKey.trim()) {
    throw new Error("未填写 API Key。");
  }

  if (config.provider === "google") {
    return requestGoogleDecision(config, payload);
  }
  if (config.provider === "deepseek" || config.provider === "glm") {
    return requestOpenAiCompatibleDecision(config, payload);
  }
  throw new Error("未知 AI 供应商。");
};
