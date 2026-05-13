export const trickAnimationClassByCardId = {
  taoyuanjieyi: "effect-card-taoyuanjieyi",
  wanjianqifa: "effect-card-wanjianqifa",
  wugufengdeng: "effect-card-wugufengdeng",
  juedou: "effect-card-juedou",
  guohechaiqiao: "effect-card-guohechaiqiao",
  shunshouqianyang: "effect-card-shunshouqianyang",
  wuzhongshengyou: "effect-card-wuzhongshengyou",
  wuxiekeji: "effect-card-wuxiekeji",
  nanmanruqin: "effect-card-nanmanruqin",
  jiedaosharen: "effect-card-jiedaosharen",
  huogong: "effect-card-huogong",
  tiesuolianhuan: "effect-card-tiesuolianhuan",
  lebusishu: "effect-card-lebusishu",
  shandian: "effect-card-shandian",
  bingliangcunduan: "effect-card-bingliangcunduan",
} as const;

export type AnimatedTrickCardId = keyof typeof trickAnimationClassByCardId;

export const trickAnimationIds = Object.keys(
  trickAnimationClassByCardId,
) as AnimatedTrickCardId[];

export const getTrickAnimationClass = (cardId: string) =>
  trickAnimationClassByCardId[cardId as AnimatedTrickCardId] ?? null;
