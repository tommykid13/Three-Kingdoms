import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const dataPath = path.join(root, "public", "data", "selected-generals.json");
const outputDir = path.join(root, "output", "general-art-v2.1-redraw");
const promptDir = path.join(outputDir, "prompts");
const referencePath = path.join(root, "wujiang", "曹操.png");

const factionTone = {
  魏: "deep noble blue card frame accents, clean gold trim, crisp white ink calligraphy",
  蜀: "jade green card frame accents, warm gold trim, clean heroic atmosphere",
  吴: "clear crimson card frame accents, refined gold trim, bright southern sunlight",
  群: "warm ochre and black card frame accents, antique gold trim, dramatic but clean atmosphere",
};

const identities = {
  曹操: {
    visualDNA: "commanding middle-aged ruler, square face, sharp brows, trimmed mustache and short beard, broad shoulders, blue-and-gold court armor, open-handed commanding pose",
    scene: "bright Wei banners, palace courtyard, clear sky, disciplined imperial presence",
    avoid: "do not make him youthful, soft, monk-like, or similar to Liu Bei or Yuan Shao",
  },
  司马懿: {
    visualDNA: "thin strategist in his forties, long narrow face, deep-set eyes, restrained mustache, pale composed expression, black-blue scholar robes, one hand near a hidden scroll",
    scene: "quiet Wei study, tall windows, chess board, cool daylight and controlled shadows",
    avoid: "do not reuse Cao Cao's square face; do not make him bulky, smiling, or warrior-like",
  },
  夏侯惇: {
    visualDNA: "scarred veteran general, rugged angular face, one eye covered or visibly wounded, stubble, powerful neck and shoulders, heavy dark armor, fierce forward stance",
    scene: "dusty battlefield camp, broken spear, bright sky after battle",
    avoid: "must not look like Xiahou Yuan; avoid elegant scholar traits or clean youthful face",
  },
  张辽: {
    visualDNA: "lean cavalry commander, long face, high cheekbones, narrow intense eyes, neat beard, dark blue armor with cavalry cloak, hand on saber",
    scene: "fast cavalry banners and city gate in clear morning light",
    avoid: "do not make him as broad as Dian Wei or as regal as Cao Cao",
  },
  许褚: {
    visualDNA: "massive bodyguard, round rugged face, thick neck, shaved or close-cropped hair, heavy brow, short beard, huge muscular arms, oversized armor",
    scene: "Wei guard post, stone steps, bright hard sunlight on metal",
    avoid: "do not make him slim, elegant, or similar to Zhang Fei's wild look",
  },
  郭嘉: {
    visualDNA: "young frail genius adviser, refined pale face, soft sharp eyes, slender build, loose black hair, blue-white scholar robes, holding wine cup or bamboo slips",
    scene: "airy pavilion with curtains and light breeze, clean daylight",
    avoid: "do not make him old, muscular, bearded like Cao Cao, or similar to Zhuge Liang",
  },
  甄姬: {
    visualDNA: "elegant noblewoman, oval face, calm distant eyes, delicate nose, long dark hair with Wei blue ornaments, graceful slim build, flowing blue-white dress",
    scene: "clear waterside palace terrace, gauze curtains, cool luminous light",
    avoid: "must not look like Xiao Qiao, Da Qiao, or Diao Chan; avoid seductive red styling",
  },
  刘备: {
    visualDNA: "benevolent mature lord, long earlobes, gentle but firm eyes, trimmed beard, dignified green robes over light armor, open welcoming posture",
    scene: "Shu banner in sunlit plain, people or peach garden hinted softly in background",
    avoid: "do not make him as stern as Cao Cao or as delicate as a strategist",
  },
  关羽: {
    visualDNA: "tall imposing warrior, long flowing black beard, red face tone, phoenix eyes, green robe over armor, upright halberd or long blade presence",
    scene: "windy battlefield road, green banners, clean high-contrast daylight",
    avoid: "must not resemble Zhang Fei or Huang Zhong; keep his iconic long beard unique",
  },
  张飞: {
    visualDNA: "wild powerful warrior, round fierce eyes, thick full beard, broad nose, messy hair, heavy muscular build, black armor, aggressive spear pose",
    scene: "bridge or dusty battlefield, strong sunlight and flying banners",
    avoid: "do not give him Guan Yu's long refined beard or Liu Bei's gentle face",
  },
  诸葛亮: {
    visualDNA: "calm elegant strategist, slim face, clear intelligent eyes, no heavy beard, neat scholar hat, white and pale green robes, feather fan held lightly",
    scene: "bright mountain pavilion, clouds, open sky, orderly scrolls",
    avoid: "do not make him dark, armored, elderly, or similar to Sima Yi",
  },
  赵云: {
    visualDNA: "young heroic lancer, clean handsome face, bright focused eyes, athletic build, silver-white armor with green accents, spear angled diagonally",
    scene: "sunlit cavalry field, white horse hinted, clean wind and sky",
    avoid: "do not make him rugged like Ma Chao or elderly like Huang Zhong",
  },
  马超: {
    visualDNA: "northern cavalry prince, sharp youthful face, high nose, intense eyes, long tied hair, white fur and silver-green armor, mounted or horse-side pose",
    scene: "open western steppe, dust and blue sky, cavalry banners",
    avoid: "do not make him identical to Zhao Yun; emphasize western armor and sharper features",
  },
  黄月英: {
    visualDNA: "inventive scholar woman, clever alert eyes, practical tied hair, slender build, yellow-green robes with mechanic details, holding wooden device or scroll",
    scene: "bright workshop pavilion with gears, bamboo, and clean daylight",
    avoid: "do not make her courtly like Zhen Ji or playful like Xiao Qiao",
  },
  孙权: {
    visualDNA: "young southern lord, rounded noble face, amber eyes, short trimmed beard or clean jaw, red-gold robes, confident seated or standing ruler pose",
    scene: "Jiangdong palace terrace, river light, red banners and warm sky",
    avoid: "do not make him as old as Cao Cao or as warrior-like as Taishi Ci",
  },
  甘宁: {
    visualDNA: "bold pirate-warrior, lean muscular build, angular face, mischievous fierce eyes, short beard, red-black armor, bell ornaments, curved blade",
    scene: "sunlit river dock, sails and chains, bright southern water",
    avoid: "do not make him courtly; avoid similarity to Zhou Tai's scarred survivor look",
  },
  吕蒙: {
    visualDNA: "disciplined Wu general-scholar, calm square face, tidy beard, medium build, red-green armor under scholar cloak, book and saber contrast",
    scene: "river camp with books and military maps, clean daylight",
    avoid: "do not make him wild like Gan Ning or regal like Sun Quan",
  },
  黄盖: {
    visualDNA: "elderly loyal veteran, weathered face, white or grey beard, sturdy build, heavy red-brown armor, stern but loyal expression",
    scene: "Wu naval deck, bright river wind, battle drums hinted",
    avoid: "do not make him young or similar to Huang Zhong's archer identity",
  },
  周瑜: {
    visualDNA: "elegant handsome commander, refined face, bright confident eyes, neat mustache optional, red-white robes, slender noble posture, music or command fan",
    scene: "river fleet and red sails in warm clean sunlight",
    avoid: "do not make him rough, old, or similar to Zhuge Liang's pale strategist style",
  },
  大乔: {
    visualDNA: "serene elder Qiao sister, graceful oval face, gentle composed eyes, long dark hair, refined red-white dress, reserved posture",
    scene: "Jiangdong garden bridge, clear water, soft daylight",
    avoid: "must be distinct from Xiao Qiao: calmer, more mature, less playful",
  },
  陆逊: {
    visualDNA: "young intellectual general, slim face, clear youthful eyes, neat hair, green-red scholar armor, holding scroll and command token",
    scene: "sunlit fireless strategy camp, bamboo maps, clean southern air",
    avoid: "do not make him old, bulky, or similar to Zhuge Liang",
  },
  孙尚香: {
    visualDNA: "spirited warrior princess, sharp lively eyes, youthful face, athletic build, red armor-dress, bow or paired weapons, dynamic archer stance",
    scene: "bright Wu courtyard, red banners, polished weapons",
    avoid: "do not make her soft like Da Qiao or Xiao Qiao; keep martial energy",
  },
  华佗: {
    visualDNA: "kind elderly physician, narrow gentle face, white beard, simple robe, medicine satchel, calm healing gesture",
    scene: "bright herbal clinic, bamboo shelves, clean natural light",
    avoid: "do not make him a warrior, king, or dark mystic",
  },
  吕布: {
    visualDNA: "towering unmatched warrior, heroic but dangerous face, thick brows, strong jaw, tall plume crown, red-black heavy armor, halberd presence",
    scene: "open battlefield with red banners, bright sky, controlled drama",
    avoid: "do not make him look like Zhang Fei or Dian Wei; keep noble ferocity",
  },
  貂蝉: {
    visualDNA: "graceful court dancer, delicate face, charming eyes, elegant hair ornaments, flowing red-gold dress, poised dance gesture",
    scene: "bright palace hall with silk curtains, clean warm light",
    avoid: "must not resemble Zhen Ji or Qiao sisters; keep court-dancer identity",
  },
  夏侯渊: {
    visualDNA: "swift veteran archer-general, lean weathered face, sharp eyes, short beard, blue-grey cavalry armor, bow or fast riding posture",
    scene: "clear road and cavalry dust, morning sun",
    avoid: "distinct from Xiahou Dun: no eye wound, faster and leaner silhouette",
  },
  曹仁: {
    visualDNA: "solid defensive general, broad calm face, strong jaw, short beard, square heavy armor, shield-like posture",
    scene: "fortress wall in clean daylight, Wei banners, defensive formation",
    avoid: "do not make him as regal as Cao Cao or as massive as Xu Chu",
  },
  黄忠: {
    visualDNA: "elder master archer, white beard, sharp aged eyes, lean but strong body, green-brown armor, bow drawn with steady hands",
    scene: "mountain pass, clear sun, distant target banners",
    avoid: "do not make him like Huang Gai; emphasize archer identity and Shu palette",
  },
  魏延: {
    visualDNA: "fierce rebellious general, long rugged face, intense eyes, messy hair, scar or war paint, dark green armor, forward axe/spear stance",
    scene: "wild mountain battlefield, torn banners, clean but tense daylight",
    avoid: "do not make him as orderly as Zhao Yun or as old as Huang Zhong",
  },
  小乔: {
    visualDNA: "young playful noblewoman, rounder youthful face, bright eyes, delicate smile, light red-pink dress, fan or flower gesture",
    scene: "sunlit garden with petals and water, airy southern light",
    avoid: "distinct from Da Qiao: younger, more playful, softer expression",
  },
  周泰: {
    visualDNA: "scarred survivor warrior, stern face with visible scars, shaved or short hair, muscular build, dark red armor, resilient stance",
    scene: "ship deck after battle, bright sky breaking through, scars clearly readable",
    avoid: "do not make him elegant like Zhou Yu or pirate-like like Gan Ning",
  },
  张角: {
    visualDNA: "mystic rebel prophet, gaunt face, piercing eyes, long loose hair and beard, yellow-black Daoist robes, thunder talisman gesture",
    scene: "bright storm-cleared sky, yellow banners, clean lightning motif",
    avoid: "do not make him a young warrior or copy Zhuge Liang's calm scholar face",
  },
  典韦: {
    visualDNA: "brutal close-combat guard, bald or close-shaven head, heavy brow, thick jaw, extremely muscular body, dark armor, dual halberd or axe posture",
    scene: "palace gate defense, hard daylight on armor",
    avoid: "do not make him Xu Chu round-faced; keep more angular and ferocious",
  },
  荀彧: {
    visualDNA: "refined aristocratic adviser, delicate long face, calm observant eyes, no heavy beard, elegant blue-green robes, scroll and seal",
    scene: "bright official hall, clean desk and bamboo slips",
    avoid: "do not make him youthful like Guo Jia or austere like Sima Yi",
  },
  庞统: {
    visualDNA: "unconventional strategist, darker rougher face, broad nose, messy hair, modest robe, clever sideways gaze, phoenix-themed ornament",
    scene: "mountain hermitage or rustic strategy table, warm daylight",
    avoid: "do not beautify him into Zhuge Liang; keep unique rough genius identity",
  },
  太史慈: {
    visualDNA: "righteous athletic archer-warrior, strong clean face, determined eyes, headband, red-green armor, bow and spear readiness",
    scene: "coastal training ground, bright wind and flags",
    avoid: "do not make him look like Gan Ning or Zhao Yun; emphasize disciplined archer-warrior",
  },
  袁绍: {
    visualDNA: "arrogant noble warlord, fuller mature face, proud eyes, well-groomed beard, luxurious yellow-gold robes and armor, raised command gesture",
    scene: "grand northern war tent, golden banners, clean daylight",
    avoid: "do not make him identical to Cao Cao; use warmer gold palette and more aristocratic softness",
  },
  颜良文丑: {
    visualDNA: "two distinct fierce generals in one card, one broad square face with heavy beard, one leaner long face with sharp eyes, paired armor silhouettes",
    scene: "northern battlefield, twin banners, bright dusty light",
    avoid: "do not merge them into twins with identical faces; each man must be visibly different",
  },
  庞德: {
    visualDNA: "stoic western warrior, rugged rectangular face, thick brows, short beard, white-grey armor, coffin/oath symbolism subtly present",
    scene: "western pass, bright cold sky, horse and banner hints",
    avoid: "do not make him Ma Chao; older, heavier, more stoic",
  },
  张郃: {
    visualDNA: "elegant agile general, refined narrow face, sharp eyes, stylish armor with wing-like details, graceful spear or fan-blade pose",
    scene: "ordered Wei formation, pale daylight, moving banners",
    avoid: "do not make him bulky or rugged; keep agile and ornate",
  },
  刘禅: {
    visualDNA: "young sheltered ruler, round youthful face, soft uncertain eyes, delicate robe, less martial build, awkward royal posture",
    scene: "quiet Shu palace garden, bright but enclosed atmosphere",
    avoid: "do not make him heroic like Liu Bei or Zhao Yun; keep naive princely identity",
  },
  蔡文姬: {
    visualDNA: "melancholic musician-scholar woman, slender face, sorrowful clear eyes, modest elegant robes, holding qin or scroll",
    scene: "open northern plain with soft sky, instrument and wind, clean poetic light",
    avoid: "do not make her glamorous like Diao Chan or courtly like Zhen Ji",
  },
};

const globalStyle = (general) => `
Use the attached reference image "${path.relative(root, referencePath).replaceAll("\\", "/")}" only as the art-direction benchmark: clean high-end Sanguosha card, bright daylight, readable Chinese card UI, clear facial planes, premium but not dirty.
Create a full vertical Chinese 三国杀 general card for ${general.name}. Keep the complete card layout: faction emblem, vertical name plaque, HP plaque, skill text box, quote line, ornate border, and readable simplified Chinese text.
Faction/card color direction: ${factionTone[general.faction] ?? "clean antique card frame with faction color accents"}.
The image should feel freshly redrawn, not color-adjusted: clean brush rendering, lower grime texture, fewer crushed black shadows, controlled highlights, transparent air, crisp edges on face and costume, no over-rendered dirty noise.
`.trim();

const negativePrompt = `
Do not reuse the same face across generals. Do not clone the Cao Cao reference face. No generic handsome identical faces. No muddy black shadows, no excessive bloom, no oily over-rendering, no dirty grey fog, no unreadable text, no modern clothing, no anime, no photorealistic camera artifact, no watermark, no extra limbs, no duplicate name plaque, no broken Chinese characters.
`.trim();

const promptFor = (general) => {
  const identity = identities[general.name];
  const skills = general.skills.map((skill) => `【${skill.name}】${skill.description}`).join("；");
  if (!identity) {
    return null;
  }
  return {
    id: general.id,
    name: general.name,
    faction: general.faction,
    maxHp: general.maxHp,
    visualDNA: identity.visualDNA,
    scene: identity.scene,
    uniquenessGuard: identity.avoid,
    positivePrompt: [
      globalStyle(general),
      `Unique character identity: ${identity.visualDNA}.`,
      `Scene and symbolism: ${identity.scene}.`,
      `Text content: name "${general.name}", faction "${general.faction}", HP "${general.maxHp}体力", skills ${skills}.`,
      `Uniqueness rule: ${identity.avoid}. This character must remain visually distinct from every other Three Kingdoms general.`,
    ].join("\n\n"),
    negativePrompt,
    qaChecklist: [
      "人物脸型、年龄、体型和发型是否与其他武将明显不同",
      "是否保留该武将标志性服饰/武器/场景符号",
      "是否符合参考曹操的清爽、明亮、干净、高级卡牌质感",
      "是否避免重阴影、脏纹理、过度厚涂和黑压画面",
      "中文姓名、势力、体力、技能区是否可读",
    ],
  };
};

const writeText = async (filePath, content) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${content.trim()}\n`, "utf8");
};

const main = async () => {
  const generals = JSON.parse(await fs.readFile(dataPath, "utf8"));
  const prompts = generals.map(promptFor).filter(Boolean);
  const missing = generals.filter((general) => !identities[general.name]).map((general) => general.name);

  await fs.mkdir(promptDir, { recursive: true });
  await fs.writeFile(path.join(outputDir, "general-redraw-prompts.json"), `${JSON.stringify(prompts, null, 2)}\n`, "utf8");
  await fs.writeFile(path.join(outputDir, "missing-identity.json"), `${JSON.stringify(missing, null, 2)}\n`, "utf8");

  const guide = [
    "# 2.1 武将重绘提示词",
    "",
    `风格参考：${path.relative(root, referencePath).replaceAll("\\", "/")}`,
    "",
    "原则：统一清爽高级卡牌质感，但每名武将必须拥有独立人物 DNA，不能撞脸。",
    "",
    ...prompts.map(
      (prompt) => [
        `## ${prompt.name}`,
        "",
        "### 正向提示词",
        prompt.positivePrompt,
        "",
        "### 反向提示词",
        prompt.negativePrompt,
        "",
        "### 检查",
        prompt.qaChecklist.map((item) => `- ${item}`).join("\n"),
      ].join("\n"),
    ),
  ].join("\n\n");
  await writeText(path.join(outputDir, "general-redraw-prompts.md"), guide);

  for (const prompt of prompts) {
    await writeText(
      path.join(promptDir, `${prompt.name}.md`),
      [
        `# ${prompt.name}`,
        "",
        "## 正向提示词",
        prompt.positivePrompt,
        "",
        "## 反向提示词",
        prompt.negativePrompt,
        "",
        "## 检查",
        prompt.qaChecklist.map((item) => `- ${item}`).join("\n"),
      ].join("\n\n"),
    );
  }

  console.log(
    JSON.stringify(
      {
        prompts: prompts.length,
        missing,
        outputDir: path.relative(root, outputDir),
        reference: path.relative(root, referencePath),
      },
      null,
      2,
    ),
  );
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
