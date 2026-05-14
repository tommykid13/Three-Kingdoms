import type { DeckInstance } from "../data/types";
import type {
  ActionEffect,
  DamageType,
  EquipmentSlot,
  GameState,
  LeijiResume,
  PendingAction,
  Phase,
  Role,
  Seat,
  SkillJudgeContext,
  Winner,
} from "./types";

const phaseOrder: Phase[] = ["准备", "判定", "摸牌", "出牌", "弃牌", "结束"];
const playableShaIds = new Set(["sha", "huosha", "leisha"]);
const delayedTrickIds = new Set(["lebusishu", "bingliangcunduan", "shandian"]);
const instantTrickIds = new Set([
  "taoyuanjieyi",
  "wanjianqifa",
  "wugufengdeng",
  "wuzhongshengyou",
  "nanmanruqin",
]);
const targetedTrickIds = new Set([
  "juedou",
  "guohechaiqiao",
  "shunshouqianyang",
  "huogong",
  "jiedaosharen",
  "tiesuolianhuan",
  "lebusishu",
  "bingliangcunduan",
]);
const weaponRanges: Record<string, number> = {
  zhuge_liannu: 1,
  cixiong_shuanggujian: 2,
  qinggangjian: 2,
  qinglong_yanyuedao: 3,
  zhangba_shemao: 3,
  guanshifu: 3,
  fangtian_huaji: 4,
  qilingong: 5,
  hanbingjian: 2,
  gudingdao: 2,
  zhuque_yushan: 4,
};
const armorIds = new Set(["baguazhen", "renwangdun", "tengjia", "baiyinshizi"]);
const offensiveMountIds = new Set(["chitu", "dayuan", "zixing"]);
const defensiveMountIds = new Set(["dilu", "juahuangfeidian", "jueying", "hualiu"]);
export const GAME_LOG_LIMIT = 120;

export type CardPlayInfo = {
  canPlay: boolean;
  mode: "target" | "instant" | null;
  label: string;
  reason: string;
  validTargetIds: number[];
  minTargets?: number;
  maxTargets?: number;
  canRecast?: boolean;
};

const clonePendingAction = (pending: PendingAction | null): PendingAction | null => {
  if (!pending) {
    return null;
  }

  if (pending.type === "basic_card_response") {
    return {
      ...pending,
      remainingTargetIds: [...pending.remainingTargetIds],
    };
  }

  if (pending.type === "wuxie_response") {
    return {
      ...pending,
      remainingTargetIds: pending.remainingTargetIds
        ? [...pending.remainingTargetIds]
        : undefined,
      revealedCards: pending.revealedCards ? [...pending.revealedCards] : undefined,
      checkedSeatIds: [...pending.checkedSeatIds],
      chainSeatIds: [...pending.chainSeatIds],
    };
  }

  if (pending.type === "huogong_discard") {
    return {
      ...pending,
      discardableCardIds: [...pending.discardableCardIds],
    };
  }

  if (pending.type === "wugufengdeng_select") {
    return {
      ...pending,
      revealedCards: [...pending.revealedCards],
      remainingSeatIds: [...pending.remainingSeatIds],
    };
  }

  if (pending.type === "judge_replace_response" || pending.type === "skill_judge_replace_response") {
    return {
      ...pending,
      replaceableCardIds: [...pending.replaceableCardIds],
    };
  }

  if (pending.type === "dying_response") {
    return {
      ...pending,
      checkedSeatIds: [...pending.checkedSeatIds],
    };
  }

  if (pending.type === "liuli_response") {
    return {
      ...pending,
      validTargetIds: [...pending.validTargetIds],
    };
  }

  if (pending.type === "tianxiang_response") {
    return {
      ...pending,
      validTargetIds: [...pending.validTargetIds],
    };
  }

  if (pending.type === "beige_response") {
    return {
      ...pending,
      transmittedTargetIds: [...pending.transmittedTargetIds],
    };
  }

  if (pending.type === "fankui_response") {
    return {
      ...pending,
      transmittedTargetIds: [...pending.transmittedTargetIds],
      cardOptions: pending.cardOptions.map((option) => ({ ...option })),
    };
  }

  if (pending.type === "yiji_response" || pending.type === "jieming_response") {
    return {
      ...pending,
      transmittedTargetIds: [...pending.transmittedTargetIds],
      validTargetIds: [...pending.validTargetIds],
    };
  }

  if (pending.type === "jianxiong_response" || pending.type === "ganglie_response") {
    return {
      ...pending,
      transmittedTargetIds: [...pending.transmittedTargetIds],
    };
  }

  if (pending.type === "leiji_response") {
    return {
      ...pending,
      validTargetIds: [...pending.validTargetIds],
      resume:
        pending.resume.kind === "basic_card_response"
          ? {
              ...pending.resume,
              remainingTargetIds: [...pending.resume.remainingTargetIds],
            }
          : { ...pending.resume },
    };
  }

  if (pending.type === "tuxi_response") {
    return {
      ...pending,
      validTargetIds: [...pending.validTargetIds],
    };
  }

  if (pending.type === "guanxing_response") {
    return {
      ...pending,
      viewedCards: [...pending.viewedCards],
    };
  }

  return { ...pending };
};

const cloneWinner = (winner: Winner | null): Winner | null =>
  winner ? { ...winner } : null;

const cloneLastEffect = (effect: ActionEffect | null): ActionEffect | null =>
  effect ? { ...effect } : null;

const cloneGame = (game: GameState): GameState => ({
  ...game,
  seats: game.seats.map((seat) => ({
    ...seat,
    awakenedSkills: [...seat.awakenedSkills],
    buquMarks: [...seat.buquMarks],
    hand: [...seat.hand],
    equipment: [...seat.equipment],
    judgeArea: [...seat.judgeArea],
  })),
  piles: {
    draw: [...game.piles.draw],
    discard: [...game.piles.discard],
  },
  turn: { ...game.turn, usedSkills: [...game.turn.usedSkills] },
  pendingAction: clonePendingAction(game.pendingAction),
  winner: cloneWinner(game.winner),
  lastEffect: cloneLastEffect(game.lastEffect),
  log: [...game.log],
});

const appendLog = (game: GameState, message: string) => {
  game.log = [message, ...game.log].slice(0, GAME_LOG_LIMIT);
};

const setLastEffect = (
  game: GameState,
  actor: Seat,
  card: DeckInstance,
  message: string,
  target?: Seat,
  impactText?: string,
  effectKind: ActionEffect["effectKind"] = target ? "target" : "card",
) => {
  game.lastEffect = {
    sequence: (game.lastEffect?.sequence ?? 0) + 1,
    sourceSeatId: actor.id,
    targetSeatId: target?.id,
    effectKind,
    actorName: actor.general.name,
    targetName: target?.general.name,
    cardId: card.card_id,
    cardName: card.name,
    cardImagePath: card.imagePath,
    message,
    impactText,
  };
};

const activeSeat = (game: GameState): Seat =>
  game.seats[game.turn.activeSeatId] ?? game.seats[0];

export const isSha = (card: DeckInstance) => playableShaIds.has(card.card_id);
export const isShan = (card: DeckInstance) => card.card_id === "shan";
export const isTao = (card: DeckInstance) => card.card_id === "tao";
export const isJiu = (card: DeckInstance) => card.card_id === "jiu";
export const isWuxie = (card: DeckInstance) => card.card_id === "wuxiekeji";
export const isEquipment = (card: DeckInstance) => getEquipmentSlot(card) !== null;
export const isDelayedTrick = (card: DeckInstance) => delayedTrickIds.has(card.card_id);
export const isTrick = (card: DeckInstance) =>
  instantTrickIds.has(card.card_id) ||
  targetedTrickIds.has(card.card_id) ||
  isDelayedTrick(card) ||
  card.card_id === "wuxiekeji";

const hasSkill = (seat: Seat, skillName: string) =>
  seat.general.skills.some((skill) => skill.name === skillName);

export const getEquipmentSlot = (card: DeckInstance): EquipmentSlot | null => {
  if (card.card_id in weaponRanges) {
    return "weapon";
  }
  if (armorIds.has(card.card_id)) {
    return "armor";
  }
  if (offensiveMountIds.has(card.card_id)) {
    return "offensiveMount";
  }
  if (defensiveMountIds.has(card.card_id)) {
    return "defensiveMount";
  }
  return null;
};

const formatCard = (card: DeckInstance) => `【${card.name}】`;

const cardDamageType = (card: DeckInstance): DamageType => {
  if (card.card_id === "huosha") {
    return "fire";
  }
  if (card.card_id === "leisha") {
    return "thunder";
  }
  return "normal";
};

const damageText = (type: DamageType) => {
  if (type === "fire") {
    return "火焰";
  }
  if (type === "thunder") {
    return "雷电";
  }
  return "普通";
};

const rankNumber = (card: DeckInstance) => {
  const rank = card.rank.toUpperCase();
  if (rank === "A") return 1;
  if (rank === "J") return 11;
  if (rank === "Q") return 12;
  if (rank === "K") return 13;
  const value = Number(rank);
  return Number.isFinite(value) ? value : 0;
};

const isHeart = (card: DeckInstance) =>
  card.suit_symbol === "♥" || card.suit.includes("红桃");

const isClub = (card: DeckInstance) =>
  card.suit_symbol === "♣" || card.suit.includes("梅花");

const isDiamond = (card: DeckInstance) =>
  card.suit_symbol === "♦" || card.suit.includes("方片");

const isSpade = (card: DeckInstance) =>
  card.suit_symbol === "♠" || card.suit.includes("黑桃");

const isRed = (card: DeckInstance) => card.color === "red";
const isBlack = (card: DeckInstance) => card.color === "black";

const isEffectiveHeart = (seat: Seat, card: DeckInstance) =>
  isHeart(card) || (hasSkill(seat, "红颜") && isSpade(card));

const isEffectiveSpade = (seat: Seat, card: DeckInstance) =>
  isSpade(card) && !hasSkill(seat, "红颜");

const isEffectiveBlack = (seat: Seat, card: DeckInstance) =>
  isBlack(card) && !(hasSkill(seat, "红颜") && isSpade(card));

export const isCardUsableAsSha = (seat: Seat, card: DeckInstance) =>
  isSha(card) ||
  (hasSkill(seat, "龙胆") && isShan(card)) ||
  (hasSkill(seat, "武圣") && isRed(card));

export const isCardUsableAsShan = (seat: Seat, card: DeckInstance) =>
  isShan(card) ||
  (hasSkill(seat, "龙胆") && isSha(card)) ||
  (hasSkill(seat, "倾国") && isEffectiveBlack(seat, card));

const isCardUsableAsGuohe = (seat: Seat, card: DeckInstance) =>
  card.card_id !== "guohechaiqiao" &&
  hasSkill(seat, "奇袭") &&
  isEffectiveBlack(seat, card);

const isCardUsableAsLebu = (seat: Seat, card: DeckInstance) =>
  card.card_id !== "lebusishu" && hasSkill(seat, "国色") && isDiamond(card);

const isCardUsableAsTiesuo = (seat: Seat, card: DeckInstance) =>
  card.card_id !== "tiesuolianhuan" && hasSkill(seat, "连环") && isClub(card);

const isCardUsableAsShuangxiongDuel = (
  game: GameState,
  seat: Seat,
  card: DeckInstance,
) =>
  game.turn.activeSeatId === seat.id &&
  hasSkill(seat, "双雄") &&
  Boolean(game.turn.shuangxiongColor) &&
  card.card_id !== "juedou" &&
  card.color !== game.turn.shuangxiongColor;

const makeVirtualCard = (
  card: DeckInstance,
  cardId: string,
  name: string,
): DeckInstance => ({
  ...card,
  card_id: cardId,
  name,
});

const findCardIndex = (
  seat: Seat,
  predicate: (card: DeckInstance) => boolean,
) => seat.hand.findIndex(predicate);

const triggerLianyingIfHandEmptied = (
  game: GameState | undefined,
  seat: Seat,
  beforeCount: number,
) => {
  if (
    game &&
    beforeCount > 0 &&
    seat.hand.length === 0 &&
    seat.alive &&
    hasSkill(seat, "连营")
  ) {
    drawFromPile(game, seat, 1);
    appendLog(game, `${seat.general.name} 发动【连营】，失去最后的手牌后摸1张牌。`);
  }
};

const removeCardAt = (seat: Seat, index: number, game?: GameState) => {
  const beforeCount = seat.hand.length;
  const [card] = seat.hand.splice(index, 1);
  triggerLianyingIfHandEmptied(game, seat, beforeCount);
  return card;
};

const removeCardFromHand = (seat: Seat, instanceId: string, game?: GameState) => {
  const index = seat.hand.findIndex((card) => card.instance_id === instanceId);
  if (index < 0) {
    return null;
  }
  return removeCardAt(seat, index, game);
};

const discardCards = (game: GameState, cards: DeckInstance[]) => {
  game.piles.discard.push(...cards);
};

const createRng = (seed: number) => {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 2 ** 32;
  };
};

const shuffleCards = <T,>(items: T[], seed: number): T[] => {
  const rng = createRng(seed);
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
};

const recycleDiscardIntoDraw = (game: GameState) => {
  if (game.piles.draw.length > 0 || game.piles.discard.length === 0) {
    return false;
  }

  const seed =
    game.seed +
    game.turn.round * 997 +
    game.turn.phaseStep * 131 +
    game.piles.discard.length;
  const recycled = shuffleCards(game.piles.discard, seed);
  game.piles.discard = [];
  game.piles.draw.push(...recycled);
  appendLog(game, `摸牌堆为空，洗入弃牌堆 ${recycled.length} 张作为新的摸牌堆。`);
  return true;
};

const drawTopCards = (game: GameState, count: number) => {
  const cards: DeckInstance[] = [];
  while (cards.length < count) {
    if (game.piles.draw.length === 0 && !recycleDiscardIntoDraw(game)) {
      break;
    }
    const card = game.piles.draw.shift();
    if (!card) {
      break;
    }
    cards.push(card);
  }
  return cards;
};

const takeCardFromDiscard = (game: GameState, card: DeckInstance) => {
  const index = game.piles.discard.findIndex(
    (item) => item.instance_id === card.instance_id,
  );
  if (index < 0) {
    return null;
  }
  const [taken] = game.piles.discard.splice(index, 1);
  return taken;
};

const drawFromPile = (game: GameState, seat: Seat, count: number) => {
  const cards = drawTopCards(game, count);
  seat.hand.push(...cards);
  appendLog(game, `${seat.general.name} 摸 ${cards.length} 张牌。`);
};

const getDrawPhaseCount = (seat: Seat) => 2 + (hasSkill(seat, "英姿") ? 1 : 0);

const shouldUseLuoyi = (game: GameState, seat: Seat) => {
  if (!hasSkill(seat, "裸衣")) {
    return false;
  }

  const hasDamageCard = seat.hand.some(
    (card) => isSha(card) || card.card_id === "juedou",
  );
  if (!hasDamageCard) {
    return false;
  }

  return aliveTargets(game, seat).some(
    (target) =>
      roleEnemyRank(seat.role, target.role, game.seats.filter((item) => item.alive).length) <= 1,
  );
};

const stealOneHandCard = (fromSeat: Seat) => fromSeat.hand.shift() ?? null;

const getTuxiTargetIds = (game: GameState, seat: Seat) =>
  aliveTargets(game, seat)
    .filter((target) => target.hand.length > 0)
    .sort((a, b) => {
      const aliveCount = game.seats.filter((item) => item.alive).length;
      const rankDelta =
        roleEnemyRank(seat.role, a.role, aliveCount) -
        roleEnemyRank(seat.role, b.role, aliveCount);
      if (rankDelta !== 0) return rankDelta;
      return b.hand.length - a.hand.length;
    })
    .map((target) => target.id);

const resolveTuxiFromTargets = (
  game: GameState,
  seat: Seat,
  targetIds: number[],
) => {
  const targets = targetIds
    .map((seatId) => game.seats[seatId])
    .filter(
      (target): target is Seat =>
        Boolean(target?.alive) && target.id !== seat.id && target.hand.length > 0,
    )
    .slice(0, 2);

  if (targets.length === 0) {
    return false;
  }

  const gained = targets
    .map((target) => ({ target, card: stealOneHandCard(target) }))
    .filter((item): item is { target: Seat; card: DeckInstance } => Boolean(item.card));

  if (gained.length === 0) {
    return false;
  }

  seat.hand.push(...gained.map((item) => item.card));
  appendLog(
    game,
    `${seat.general.name} 发动【突袭】，获得 ${gained.map((item) => item.target.general.name).join("、")} 各一张手牌。`,
  );
  return true;
};

const resolveTuxi = (game: GameState, seat: Seat) => {
  if (!hasSkill(seat, "突袭")) {
    return false;
  }
  return resolveTuxiFromTargets(game, seat, getTuxiTargetIds(game, seat).slice(0, 2));
};

const healSeat = (game: GameState, seat: Seat, amount: number, reason: string) => {
  const before = seat.hp;
  seat.hp = Math.min(seat.maxHp, seat.hp + amount);
  appendLog(game, `${seat.general.name} 因${reason}回复 ${seat.hp - before} 点体力。`);
};

const canUseCardAsDyingRescue = (
  game: GameState,
  responder: Seat,
  dying: Seat,
  card: DeckInstance,
) =>
  isTao(card) ||
  (responder.id === dying.id && isJiu(card)) ||
  (hasSkill(responder, "急救") &&
    game.turn.activeSeatId !== responder.id &&
    isRed(card));

const eligibleDyingCards = (game: GameState, responder: Seat, dying: Seat) =>
  responder.hand.filter((card) => canUseCardAsDyingRescue(game, responder, dying, card));

const revealDeath = (seat: Seat) => {
  seat.alive = false;
  seat.roleVisible = true;
  seat.hp = 0;
};

const evaluateWinner = (game: GameState) => {
  const lord = game.seats.find((seat) => seat.role === "主公");
  if (!lord || !lord.alive) {
    const alive = game.seats.filter((seat) => seat.alive);
    if (alive.length === 1 && alive[0].role === "内奸") {
      game.winner = {
        side: "内奸",
        reason: "主公死亡，且场上仅剩内奸。",
      };
    } else {
      game.winner = {
        side: "反贼",
        reason: "主公死亡。",
      };
    }
    appendLog(game, `游戏结束：${game.winner.side}胜利。`);
    return;
  }

  const hasRebel = game.seats.some((seat) => seat.alive && seat.role === "反贼");
  const hasTraitor = game.seats.some((seat) => seat.alive && seat.role === "内奸");
  if (!hasRebel && !hasTraitor) {
    game.winner = {
      side: "主忠",
      reason: "所有反贼和内奸均已死亡。",
    };
    appendLog(game, "游戏结束：主公与忠臣胜利。");
  }
};

const eliminateSeat = (
  game: GameState,
  dyingSeat: Seat,
  sourceSeatId: number | null,
) => {
  if (!dyingSeat.alive) {
    return;
  }

  revealDeath(dyingSeat);
  appendLog(game, `${dyingSeat.general.name} 死亡，身份为${dyingSeat.role}。`);

  const dropped = [
    ...dyingSeat.hand,
    ...dyingSeat.equipment,
    ...dyingSeat.judgeArea,
    ...dyingSeat.buquMarks,
  ];
  dyingSeat.hand = [];
  dyingSeat.equipment = [];
  dyingSeat.judgeArea = [];
  dyingSeat.buquMarks = [];
  discardCards(game, dropped);

  const sourceSeat =
    sourceSeatId === null ? null : game.seats[sourceSeatId] ?? null;
  if (sourceSeat?.alive && hasSkill(dyingSeat, "断肠")) {
    sourceSeat.general = {
      ...sourceSeat.general,
      skills: [],
    };
    appendLog(game, `${dyingSeat.general.name} 的【断肠】令 ${sourceSeat.general.name} 失去所有武将技能。`);
  }

  if (sourceSeat?.alive && dyingSeat.role === "反贼") {
    drawFromPile(game, sourceSeat, 3);
    appendLog(game, `${sourceSeat.general.name} 击杀反贼，奖励摸三张牌。`);
  }

  if (sourceSeat?.alive && sourceSeat.role === "主公" && dyingSeat.role === "忠臣") {
    const penalty = [...sourceSeat.hand, ...sourceSeat.equipment];
    sourceSeat.hand = [];
    sourceSeat.equipment = [];
    discardCards(game, penalty);
    appendLog(game, "主公误杀忠臣，弃置所有手牌和装备。");
  }

  evaluateWinner(game);
};

const tryAiSelfSave = (game: GameState, dyingSeat: Seat) => {
  while (dyingSeat.hp <= 0) {
    const cardIndex = findCardIndex(dyingSeat, (card) =>
      canUseCardAsDyingRescue(game, dyingSeat, dyingSeat, card),
    );
    if (cardIndex < 0) {
      return;
    }
    const card = removeCardAt(dyingSeat, cardIndex, game);
    discardCards(game, [card]);
    healSeat(game, dyingSeat, 1, `${formatCard(card)}自救`);
  }
};

const orderedDyingResponders = (game: GameState) => {
  const alive = game.seats.filter((seat) => seat.alive);
  if (alive.length === 0) {
    return [];
  }
  const activeIndex = alive.findIndex((seat) => seat.id === game.turn.activeSeatId);
  const startIndex = activeIndex >= 0 ? activeIndex : 0;
  return [...alive.slice(startIndex), ...alive.slice(0, startIndex)];
};

const shouldAiRescueDying = (game: GameState, responder: Seat, dying: Seat) => {
  if (responder.id === dying.id) {
    return true;
  }
  if (dying.role === "主公") {
    if (responder.role === "忠臣" || responder.role === "主公") {
      return true;
    }
    return (
      responder.role === "内奸" &&
      game.seats.some((seat) => seat.alive && seat.role === "反贼")
    );
  }
  if (responder.role === "主公" || responder.role === "忠臣") {
    return dying.role === "忠臣";
  }
  if (responder.role === "反贼") {
    return dying.role === "反贼";
  }
  return false;
};

const useDyingRescueCard = (
  game: GameState,
  responder: Seat,
  dying: Seat,
  card: DeckInstance,
) => {
  const used = removeCardFromHand(responder, card.instance_id, game);
  if (!used) {
    return;
  }
  discardCards(game, [used]);
  setLastEffect(
    game,
    responder,
    used,
    `${responder.general.name} 对 ${dying.general.name} 使用${formatCard(used)}救援。`,
    dying,
    "+1",
  );
  healSeat(game, dying, 1, `${responder.general.name}使用${formatCard(used)}`);
  if (
    responder.id !== dying.id &&
    dying.role === "主公" &&
    hasSkill(dying, "救援") &&
    responder.general.faction === "吴"
  ) {
    healSeat(game, dying, 1, "【救援】");
    appendLog(game, `${dying.general.name} 的【救援】令本次桃额外回复1点体力。`);
  }
};

const continueDyingResponses = (
  game: GameState,
  dyingSeatId: number,
  sourceSeatId: number | null,
  checkedSeatIds: number[] = [],
) => {
  const dying = game.seats[dyingSeatId];
  if (!dying || !dying.alive) {
    game.pendingAction = null;
    return;
  }

  if (dying.hp > 0) {
    appendLog(game, `${dying.general.name} 脱离濒死。`);
    game.pendingAction = null;
    evaluateWinner(game);
    return;
  }

  const checked = new Set(checkedSeatIds);
  for (const responder of orderedDyingResponders(game)) {
    if (!responder.alive || checked.has(responder.id)) {
      continue;
    }

    appendLog(game, `${dying.general.name} 向 ${responder.general.name} 求桃。`);
    const rescueCards = eligibleDyingCards(game, responder, dying);

    if (responder.controller === "human") {
      if (rescueCards.length === 0) {
        checked.add(responder.id);
        appendLog(game, `${responder.general.name} 没有可用于救援的牌，未响应求桃。`);
        continue;
      }

      game.pendingAction = {
        type: "dying_response",
        dyingSeatId: dying.id,
        sourceSeatId,
        responderSeatId: responder.id,
        requiredHp: 1,
        checkedSeatIds: [...checked],
        message: `${dying.general.name} 濒死，正在向 ${responder.general.name} 求桃${
          responder.id === dying.id ? "或酒" : ""
        }。`,
      };
      return;
    }

    checked.add(responder.id);
    if (!shouldAiRescueDying(game, responder, dying)) {
      appendLog(game, `${responder.general.name} 未响应求桃。`);
      continue;
    }

    while (dying.hp <= 0) {
      const rescueCard = eligibleDyingCards(game, responder, dying)[0] ?? null;
      if (!rescueCard) {
        break;
      }
      useDyingRescueCard(game, responder, dying, rescueCard);
    }

    if (dying.hp > 0) {
      appendLog(game, `${dying.general.name} 脱离濒死。`);
      game.pendingAction = null;
      evaluateWinner(game);
      return;
    }
  }

  game.pendingAction = null;
  eliminateSeat(game, dying, sourceSeatId);
};

const enterDying = (
  game: GameState,
  dyingSeat: Seat,
  sourceSeatId: number | null,
) => {
  appendLog(game, `${dyingSeat.general.name} 进入濒死状态。`);

  if (hasSkill(dyingSeat, "涅槃") && !dyingSeat.awakenedSkills.includes("涅槃")) {
    dyingSeat.awakenedSkills.push("涅槃");
    const dropped = [
      ...dyingSeat.hand,
      ...dyingSeat.equipment,
      ...dyingSeat.judgeArea,
    ];
    dyingSeat.hand = [];
    dyingSeat.equipment = [];
    dyingSeat.judgeArea = [];
    dyingSeat.chained = false;
    discardCards(game, dropped);
    dyingSeat.hp = Math.min(3, dyingSeat.maxHp);
    drawFromPile(game, dyingSeat, 3);
    appendLog(game, `${dyingSeat.general.name} 发动限定技【涅槃】，弃置区域内所有牌，重置状态，回复至 ${dyingSeat.hp} 点体力并摸3张牌。`);
    return;
  }

  if (hasSkill(dyingSeat, "不屈")) {
    const mark = drawJudgeCard(game);
    if (mark) {
      dyingSeat.buquMarks.push(mark);
      const ranks = new Set(dyingSeat.buquMarks.map((card) => card.rank));
      const isUnique = ranks.size === dyingSeat.buquMarks.length;
      appendLog(
        game,
        `${dyingSeat.general.name} 发动【不屈】，展示${formatCard(mark)}作为“创”，${isUnique ? "点数不重复，暂时不会死亡" : "点数重复，仍需救援"}。`,
      );
      if (isUnique) {
        return;
      }
    }
  }

  if (dyingSeat.controller === "ai") {
    tryAiSelfSave(game, dyingSeat);
  }

  if (dyingSeat.hp > 0) {
    appendLog(game, `${dyingSeat.general.name} 脱离濒死。`);
    return;
  }

  continueDyingResponses(game, dyingSeat.id, sourceSeatId);
};

const markShaPlayedThisTurn = (game: GameState, seat: Seat) => {
  if (game.turn.activeSeatId === seat.id) {
    game.turn.shaPlayed = true;
  }
};

const hasTianyiWon = (game: GameState | undefined, seat: Seat) =>
  Boolean(game && game.turn.activeSeatId === seat.id && game.turn.tianyiState === "won");

const hasTianyiLost = (game: GameState, seat: Seat) =>
  game.turn.activeSeatId === seat.id && game.turn.tianyiState === "lost";

const getLuoyiDamageBonus = (
  game: GameState,
  sourceSeat: Seat | null | undefined,
  card: DeckInstance,
) =>
  sourceSeat?.alive &&
  game.turn.activeSeatId === sourceSeat.id &&
  game.turn.luoyiActive &&
  (isCardUsableAsSha(sourceSeat, card) || card.card_id === "juedou")
    ? 1
    : 0;

const resolveSourceDamageSkills = (
  game: GameState,
  sourceSeat: Seat | null,
  targetSeat: Seat,
  amount: number,
) => {
  if (
    sourceSeat?.alive &&
    hasSkill(sourceSeat, "狂骨") &&
    distanceBetweenSeats(game, sourceSeat, targetSeat) <= 1 &&
    sourceSeat.hp < sourceSeat.maxHp
  ) {
    healSeat(game, sourceSeat, amount, "【狂骨】");
  }
};

type DamageSkillContext = {
  sourceSeatId: number | null;
  targetSeatId: number;
  amount: number;
  damageType: DamageType;
  damageCard?: DeckInstance;
  transmittedTargetIds: number[];
};

const damagedSkillOrder = ["反馈", "遗计", "节命", "奸雄", "刚烈"] as const;

const isDamageCardInDiscard = (game: GameState, damageCard: DeckInstance | undefined) =>
  Boolean(
    damageCard &&
      game.piles.discard.some((card) => card.instance_id === damageCard.instance_id),
  );

const fankuiCardOptions = (sourceSeat: Seat) => [
  ...(sourceSeat.hand.length > 0
    ? [
        {
          key: "hand",
          zone: "手牌" as const,
          label: `随机手牌（${sourceSeat.hand.length}）`,
        },
      ]
    : []),
  ...sourceSeat.equipment.map((card) => ({
    key: `equipment:${card.instance_id}`,
    zone: "装备区" as const,
    label: card.name,
    card,
  })),
  ...sourceSeat.judgeArea.map((card) => ({
    key: `judge:${card.instance_id}`,
    zone: "判定区" as const,
    label: card.name,
    card,
  })),
];

const takeFankuiCardByKey = (game: GameState, sourceSeat: Seat, key: string) => {
  if (key === "hand") {
    const card = sourceSeat.hand.length > 0 ? removeCardAt(sourceSeat, 0, game) : null;
    return { card, zone: "手牌" };
  }

  const [zone, instanceId] = key.split(":");
  if (zone === "equipment") {
    const index = sourceSeat.equipment.findIndex((card) => card.instance_id === instanceId);
    if (index >= 0) {
      const [card] = sourceSeat.equipment.splice(index, 1);
      triggerXiaojiIfEquipmentLost(game, sourceSeat, card);
      return { card, zone: "装备区" };
    }
  }
  if (zone === "judge") {
    const index = sourceSeat.judgeArea.findIndex((card) => card.instance_id === instanceId);
    if (index >= 0) {
      const [card] = sourceSeat.judgeArea.splice(index, 1);
      return { card, zone: "判定区" };
    }
  }

  return { card: null, zone: "牌" };
};

const gainFankuiCard = (
  game: GameState,
  targetSeat: Seat,
  sourceSeat: Seat,
  optionKey: string,
) => {
  const removed = takeFankuiCardByKey(game, sourceSeat, optionKey);
  if (!removed.card) {
    appendLog(game, "反馈目标牌不存在。");
    return;
  }
  targetSeat.hand.push(removed.card);
  appendLog(
    game,
    `${targetSeat.general.name} 发动【反馈】，获得 ${sourceSeat.general.name} 的${removed.zone}${formatCard(removed.card)}。`,
  );
};

const jiemingTargetIds = (game: GameState) =>
  game.seats
    .filter((seat) => seat.alive && seat.hand.length < seat.maxHp)
    .map((seat) => seat.id);

const chooseAiJiemingTarget = (game: GameState, targetSeat: Seat) =>
  game.seats
    .filter((seat) => seat.alive && seat.hand.length < seat.maxHp)
    .sort((a, b) => {
      const aliveCount = game.seats.filter((seat) => seat.alive).length;
      const rankDelta =
        roleEnemyRank(targetSeat.role, a.role, aliveCount) -
        roleEnemyRank(targetSeat.role, b.role, aliveCount);
      if (rankDelta !== 0) return rankDelta;
      return a.hand.length - b.hand.length;
    })[0] ?? null;

const resolveJiemingToTarget = (game: GameState, actor: Seat, recipient: Seat) => {
  const count = recipient.maxHp - recipient.hand.length;
  if (count <= 0) {
    return;
  }
  drawFromPile(game, recipient, count);
  appendLog(game, `${actor.general.name} 发动【节命】，令 ${recipient.general.name} 将手牌摸至体力上限。`);
};

const resolveJianxiong = (game: GameState, actor: Seat, damageCard: DeckInstance) => {
  const gained = takeCardFromDiscard(game, damageCard);
  if (gained) {
    actor.hand.push(gained);
    appendLog(game, `${actor.general.name} 发动【奸雄】，获得造成伤害的${formatCard(gained)}。`);
  }
};

const resolveGanglieEffect = (game: GameState, targetSeat: Seat, sourceSeat: Seat) => {
  startSkillJudge(game, {
    type: "ganglie",
    sourceSeatId: sourceSeat.id,
    targetSeatId: targetSeat.id,
    amount: 1,
    damageType: "normal",
    transmittedTargetIds: [],
    nextSkillIndex: damagedSkillOrder.length,
  });
};

const continueDamagedSeatSkills = (
  game: GameState,
  context: DamageSkillContext,
  startIndex = 0,
) => {
  const targetSeat = game.seats[context.targetSeatId];
  const sourceSeat =
    context.sourceSeatId === null ? null : game.seats[context.sourceSeatId] ?? null;
  if (!targetSeat?.alive || game.winner) {
    return;
  }

  for (let index = startIndex; index < damagedSkillOrder.length; index += 1) {
    const skillName = damagedSkillOrder[index];

    if (skillName === "反馈" && sourceSeat?.alive && hasSkill(targetSeat, "反馈") && hasAnyZoneCard(sourceSeat)) {
      const cardOptions = fankuiCardOptions(sourceSeat);
      if (targetSeat.controller === "human") {
        game.pendingAction = {
          type: "fankui_response",
          ...context,
          sourceSeatId: sourceSeat.id,
          nextSkillIndex: index + 1,
          cardOptions,
          message: `${targetSeat.general.name} 可以发动【反馈】，选择 ${sourceSeat.general.name} 的一张牌获得。`,
        };
        appendLog(game, game.pendingAction.message);
        return;
      }
      gainFankuiCard(game, targetSeat, sourceSeat, cardOptions[0]?.key ?? "hand");
    }

    if (skillName === "遗计" && hasSkill(targetSeat, "遗计")) {
      const drawCount = Math.max(1, context.amount) * 2;
      const validTargetIds = game.seats.filter((seat) => seat.alive).map((seat) => seat.id);
      if (validTargetIds.length === 0) {
        appendLog(game, `${targetSeat.general.name} 无法发动【遗计】，场上没有存活角色。`);
        continue;
      }
      if (targetSeat.controller === "human") {
        game.pendingAction = {
          type: "yiji_response",
          ...context,
          nextSkillIndex: index + 1,
          drawCount,
          validTargetIds,
          message: `${targetSeat.general.name} 可以发动【遗计】，选择一名角色获得 ${drawCount} 张牌。`,
        };
        appendLog(game, game.pendingAction.message);
        return;
      }
      const aliveCount = game.seats.filter((item) => item.alive).length;
      const recipient =
        game.seats
          .filter((seat) => validTargetIds.includes(seat.id))
          .sort((a, b) => {
            const rankDelta =
              roleEnemyRank(targetSeat.role, a.role, aliveCount) -
              roleEnemyRank(targetSeat.role, b.role, aliveCount);
            if (rankDelta !== 0) return rankDelta;
            return a.hand.length - b.hand.length;
          })[0] ?? null;
      if (recipient) {
        drawFromPile(game, recipient, drawCount);
        appendLog(game, `${targetSeat.general.name} 发动【遗计】，令 ${recipient.general.name} 获得 ${drawCount} 张牌。`);
      }
    }

    if (skillName === "节命" && hasSkill(targetSeat, "节命")) {
      const validTargetIds = jiemingTargetIds(game);
      if (validTargetIds.length > 0) {
        if (targetSeat.controller === "human") {
          game.pendingAction = {
            type: "jieming_response",
            ...context,
            nextSkillIndex: index + 1,
            validTargetIds,
            message: `${targetSeat.general.name} 可以发动【节命】，选择一名角色将手牌摸至体力上限。`,
          };
          appendLog(game, game.pendingAction.message);
          return;
        }
        const recipient = chooseAiJiemingTarget(game, targetSeat);
        if (recipient) {
          resolveJiemingToTarget(game, targetSeat, recipient);
        }
      }
    }

    if (
      skillName === "奸雄" &&
      sourceSeat?.alive &&
      context.damageCard &&
      hasSkill(targetSeat, "奸雄") &&
      isDamageCardInDiscard(game, context.damageCard)
    ) {
      if (targetSeat.controller === "human") {
        game.pendingAction = {
          type: "jianxiong_response",
          ...context,
          damageCard: context.damageCard,
          nextSkillIndex: index + 1,
          message: `${targetSeat.general.name} 可以发动【奸雄】，获得造成伤害的${formatCard(context.damageCard)}。`,
        };
        appendLog(game, game.pendingAction.message);
        return;
      }
      resolveJianxiong(game, targetSeat, context.damageCard);
    }

    if (skillName === "刚烈" && sourceSeat?.alive && hasSkill(targetSeat, "刚烈")) {
      if (targetSeat.controller === "human") {
        game.pendingAction = {
          type: "ganglie_response",
          ...context,
          sourceSeatId: sourceSeat.id,
          nextSkillIndex: index + 1,
          message: `${targetSeat.general.name} 可以发动【刚烈】，判定后可能令 ${sourceSeat.general.name} 弃两张牌或受1点伤害。`,
        };
        appendLog(game, game.pendingAction.message);
        return;
      }
      resolveGanglieEffect(game, targetSeat, sourceSeat);
    }

    if (game.pendingAction || game.winner) {
      return;
    }
  }
};

const triggerBeigeAfterShaDamage = (
  game: GameState,
  targetSeat: Seat,
  sourceSeat: Seat | null,
  damageCard?: DeckInstance,
  amount = 1,
  damageTypeValue: DamageType = "normal",
  transmittedTargetIds: number[] = [],
) => {
  if (!damageCard || !isSha(damageCard)) {
    return false;
  }

  const singer = game.seats.find(
    (seat) =>
      seat.alive &&
      hasSkill(seat, "悲歌") &&
      seat.hand.length > 0 &&
      areStrategicAllies(seat, targetSeat),
  );
  if (!singer) {
    return false;
  }

  if (singer.controller === "human") {
    game.pendingAction = {
      type: "beige_response",
      singerSeatId: singer.id,
      targetSeatId: targetSeat.id,
      sourceSeatId: sourceSeat?.id ?? null,
      amount,
      damageType: damageTypeValue,
      damageCard,
      transmittedTargetIds,
      message: `${targetSeat.general.name} 受到【杀】造成的伤害，${singer.general.name} 可以发动【悲歌】，弃置一张手牌令其判定。`,
    };
    appendLog(game, game.pendingAction.message);
    return true;
  }

  const cost = removeCardAt(singer, 0, game);
  resolveBeigeEffect(game, singer, targetSeat, sourceSeat, cost);
  return false;
};

const resolveBeigeEffect = (
  game: GameState,
  singer: Seat,
  targetSeat: Seat,
  sourceSeat: Seat | null,
  cost: DeckInstance,
) => {
  discardCards(game, [cost]);
  let judgeCard = drawJudgeCard(game);
  if (!judgeCard) {
    appendLog(game, `${singer.general.name} 发动【悲歌】，但牌堆为空。`);
    return;
  }

  judgeCard = replaceJudgeCard(game, targetSeat, judgeCard, (replacer, candidate, current) => {
    const beigeValue = (card: DeckInstance) => {
      if (isEffectiveHeart(targetSeat, card)) return 3;
      if (isDiamond(card)) return 2;
      if (isClub(card)) return sourceSeat?.alive ? 2 : 0;
      return sourceSeat?.alive ? 1 : 0;
    };
    const targetIsAlly = areStrategicAllies(replacer, targetSeat);
    return targetIsAlly
      ? beigeValue(candidate) > beigeValue(current)
      : beigeValue(candidate) < beigeValue(current);
  });
  appendLog(
    game,
    `${singer.general.name} 发动【悲歌】，弃置${formatCard(cost)}令 ${targetSeat.general.name} 判定为${formatCard(judgeCard)}。`,
  );

  if (isEffectiveHeart(targetSeat, judgeCard)) {
    finishJudgeCard(game, targetSeat, judgeCard);
    healSeat(game, targetSeat, 1, "【悲歌】");
    return;
  }
  if (isDiamond(judgeCard)) {
    finishJudgeCard(game, targetSeat, judgeCard);
    drawFromPile(game, targetSeat, 2);
    appendLog(game, `${targetSeat.general.name} 因【悲歌】摸2张牌。`);
    return;
  }
  if (isClub(judgeCard)) {
    finishJudgeCard(game, targetSeat, judgeCard);
    if (sourceSeat?.alive) {
      const discarded = discardHandCardsFromFront(game, sourceSeat, Math.min(2, sourceSeat.hand.length));
      appendLog(game, `${sourceSeat.general.name} 因【悲歌】弃置 ${discarded.length} 张牌。`);
    }
    return;
  }

  finishJudgeCard(game, targetSeat, judgeCard);
  if (sourceSeat?.alive) {
    appendLog(game, `${sourceSeat.general.name} 因【悲歌】黑桃结果受到翻面效果；当前原型记录效果但暂未实现翻面状态。`);
  }
};

const getTianxiangTargetIds = (game: GameState, targetSeat: Seat) =>
  aliveTargets(game, targetSeat).map((seat) => seat.id);

const chooseAiTianxiangTarget = (
  game: GameState,
  sourceSeat: Seat | null,
  targetSeat: Seat,
) =>
  sourceSeat?.alive && sourceSeat.id !== targetSeat.id
    ? sourceSeat
    : aliveTargets(game, targetSeat)
        .sort((a, b) => {
          const aliveCount = game.seats.filter((item) => item.alive).length;
          const rankDelta =
            roleEnemyRank(targetSeat.role, a.role, aliveCount) -
            roleEnemyRank(targetSeat.role, b.role, aliveCount);
          if (rankDelta !== 0) return rankDelta;
          return a.hp - b.hp;
        })[0];

const continueAfterDamageAndBeige = (
  game: GameState,
  sourceSeatId: number | null,
  targetSeat: Seat,
  amount: number,
  damageTypeValue: DamageType,
  damageCard?: DeckInstance,
  transmittedTargetIds: number[] = [],
) => {
  const sourceSeat =
    sourceSeatId === null ? null : game.seats[sourceSeatId] ?? null;
  const context: DamageSkillContext = {
    sourceSeatId,
    targetSeatId: targetSeat.id,
    amount,
    damageType: damageTypeValue,
    damageCard,
    transmittedTargetIds,
  };

  resolveSourceDamageSkills(game, sourceSeat, targetSeat, amount);
  if (targetSeat.hp > 0) {
    continueDamagedSeatSkills(game, context, 0);
  }
  if (game.pendingAction || game.winner) {
    return;
  }

  finishAfterDamagedSeatSkills(game, context);
};

const finishAfterDamagedSeatSkills = (
  game: GameState,
  context: DamageSkillContext,
) => {
  const targetSeat = game.seats[context.targetSeatId];
  const sourceSeat =
    context.sourceSeatId === null ? null : game.seats[context.sourceSeatId] ?? null;
  if (!targetSeat || game.winner) {
    return;
  }

  if (targetSeat.hp <= 0) {
    enterDying(game, targetSeat, context.sourceSeatId);
  }

  if (context.transmittedTargetIds.length === 0 || game.pendingAction || game.winner) {
    return;
  }

  const [linkedTargetId, ...remainingTargetIds] = context.transmittedTargetIds;
  const linkedTarget = game.seats[linkedTargetId];
  if (!linkedTarget?.alive) {
    finishAfterDamagedSeatSkills(game, {
      ...context,
      transmittedTargetIds: remainingTargetIds,
    });
    return;
  }

  linkedTarget.chained = false;
  linkedTarget.hp -= context.amount;
  appendLog(
    game,
    `${linkedTarget.general.name} 受到铁索连环传导的 ${context.amount} 点${damageText(context.damageType)}伤害，并重置连环。`,
  );
  resolveSourceDamageSkills(game, sourceSeat, linkedTarget, context.amount);
  const nextContext: DamageSkillContext = {
    ...context,
    targetSeatId: linkedTarget.id,
    transmittedTargetIds: remainingTargetIds,
  };
  if (linkedTarget.hp > 0) {
    continueDamagedSeatSkills(game, nextContext, 0);
  }
  if (game.pendingAction || game.winner) {
    return;
  }
  finishAfterDamagedSeatSkills(game, nextContext);
};

const applyDamageInternal = (
  game: GameState,
  sourceSeatId: number | null,
  targetSeat: Seat,
  amount: number,
  damageTypeValue: DamageType,
  damageCard?: DeckInstance,
  options: { skipTianxiang?: boolean } = {},
) => {
  if (!targetSeat.alive || game.winner) {
    return;
  }
  const sourceSeat =
    sourceSeatId === null ? null : game.seats[sourceSeatId] ?? null;

  if (!options.skipTianxiang && amount > 0 && hasSkill(targetSeat, "天香")) {
    const heartIndex = findCardIndex(targetSeat, (card) =>
      isEffectiveHeart(targetSeat, card),
    );
    const validTargetIds = getTianxiangTargetIds(game, targetSeat);
    if (heartIndex >= 0 && validTargetIds.length > 0) {
      if (targetSeat.controller === "human") {
        game.pendingAction = {
          type: "tianxiang_response",
          sourceSeatId,
          targetSeatId: targetSeat.id,
          amount,
          damageType: damageTypeValue,
          damageCard,
          validTargetIds,
          message: `${targetSeat.general.name} 可以发动【天香】，弃置一张红桃牌并选择一名其他角色转移伤害。`,
        };
        appendLog(game, game.pendingAction.message);
        return;
      }

      const redirectTarget = chooseAiTianxiangTarget(game, sourceSeat, targetSeat);
      if (!redirectTarget) {
        return;
      }
      const cost = removeCardAt(targetSeat, heartIndex, game);
      discardCards(game, [cost]);
      appendLog(
        game,
        `${targetSeat.general.name} 发动【天香】，弃置红桃牌${formatCard(cost)}，将伤害转移给 ${redirectTarget.general.name}。`,
      );
      applyDamage(game, sourceSeatId, redirectTarget, amount, damageTypeValue, damageCard);
      if (!game.pendingAction && !game.winner && redirectTarget.alive) {
        const lostHp = Math.max(0, redirectTarget.maxHp - redirectTarget.hp);
        if (lostHp > 0) {
          drawFromPile(game, redirectTarget, lostHp);
          appendLog(game, `${redirectTarget.general.name} 因【天香】摸 ${lostHp} 张牌。`);
        }
      }
      return;
    }
  }

  const shouldTransmit =
    damageTypeValue !== "normal" && targetSeat.chained;
  const transmittedTargets = shouldTransmit
    ? game.seats.filter(
        (seat) => seat.alive && seat.id !== targetSeat.id && seat.chained,
      )
    : [];
  if (shouldTransmit) {
    targetSeat.chained = false;
    appendLog(game, `${targetSeat.general.name} 的铁索连环被属性伤害触发并重置。`);
  }

  targetSeat.hp -= amount;
  const sourceName =
    sourceSeatId === null ? "无来源" : game.seats[sourceSeatId]?.general.name ?? "未知来源";
  appendLog(
    game,
    `${targetSeat.general.name} 受到 ${sourceName} 造成的 ${amount} 点${damageText(damageTypeValue)}伤害。`,
  );

  if (damageCard) {
    setLastEffect(
      game,
      sourceSeat ?? targetSeat,
      damageCard,
      `${targetSeat.general.name} 受到 ${amount} 点伤害。`,
      targetSeat,
      `-${amount}`,
      "damage",
    );
  }

  const transmittedTargetIds = transmittedTargets.map((seat) => seat.id);
  if (
    triggerBeigeAfterShaDamage(
      game,
      targetSeat,
      sourceSeat,
      damageCard,
      amount,
      damageTypeValue,
      transmittedTargetIds,
    ) ||
    game.pendingAction ||
    game.winner
  ) {
    return;
  }

  continueAfterDamageAndBeige(
    game,
    sourceSeatId,
    targetSeat,
    amount,
    damageTypeValue,
    damageCard,
    transmittedTargetIds,
  );
};

const applyDamage = (
  game: GameState,
  sourceSeatId: number | null,
  targetSeat: Seat,
  amount: number,
  damageTypeValue: DamageType,
  damageCard?: DeckInstance,
) => {
  applyDamageInternal(game, sourceSeatId, targetSeat, amount, damageTypeValue, damageCard);
};

const aliveTargets = (game: GameState, actor: Seat) =>
  game.seats.filter((seat) => seat.alive && seat.id !== actor.id);

const isKongchengProtected = (target: Seat) =>
  hasSkill(target, "空城") && target.hand.length === 0;

export const getEquippedCard = (seat: Seat, slot: EquipmentSlot) =>
  seat.equipment.find((card) => getEquipmentSlot(card) === slot) ?? null;

export const getAttackRange = (seat: Seat) => {
  const weapon = getEquippedCard(seat, "weapon");
  return weapon ? weaponRanges[weapon.card_id] ?? 1 : 1;
};

const aliveSeatIdsInOrder = (game: GameState) =>
  game.seats.filter((seat) => seat.alive).map((seat) => seat.id);

const ringDistance = (game: GameState, fromSeatId: number, toSeatId: number) => {
  const aliveIds = aliveSeatIdsInOrder(game);
  const fromIndex = aliveIds.indexOf(fromSeatId);
  const toIndex = aliveIds.indexOf(toSeatId);
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
    return 0;
  }

  const clockwise = (toIndex - fromIndex + aliveIds.length) % aliveIds.length;
  const counterClockwise = (fromIndex - toIndex + aliveIds.length) % aliveIds.length;
  return Math.min(clockwise, counterClockwise);
};

export const distanceBetweenSeats = (
  game: GameState,
  fromSeat: Seat,
  toSeat: Seat,
) => {
  const base = ringDistance(game, fromSeat.id, toSeat.id);
  if (base === 0) {
    return 0;
  }
  const offensiveMount = (getEquippedCard(fromSeat, "offensiveMount") ? 1 : 0) + (hasSkill(fromSeat, "马术") ? 1 : 0);
  const defensiveMount = (getEquippedCard(toSeat, "defensiveMount") ? 1 : 0) + (hasSkill(toSeat, "飞影") ? 1 : 0);
  return Math.max(1, base - offensiveMount + defensiveMount);
};

const validShaTargetIds = (
  game: GameState,
  actor: Seat,
  options: { ignoreDistance?: boolean } = {},
) =>
  aliveTargets(game, actor)
    .filter((seat) => !isKongchengProtected(seat))
    .filter(
      (seat) =>
        options.ignoreDistance ||
        hasTianyiWon(game, actor) ||
        distanceBetweenSeats(game, actor, seat) <= getAttackRange(actor),
    )
    .map((seat) => seat.id);

export const getShensuTargetIds = (game: GameState, actorSeatId: number) => {
  const actor = game.seats[actorSeatId];
  return actor?.alive ? validShaTargetIds(game, actor, { ignoreDistance: true }) : [];
};

export const getJiedaoVictimIds = (game: GameState, weaponOwnerSeatId: number) => {
  const weaponOwner = game.seats[weaponOwnerSeatId];
  if (!weaponOwner?.alive || !getEquippedCard(weaponOwner, "weapon")) {
    return [];
  }
  return validShaTargetIds(game, weaponOwner);
};

const hasAnyZoneCard = (seat: Seat) =>
  seat.hand.length > 0 || seat.equipment.length > 0 || seat.judgeArea.length > 0;

const hasDelayedTrick = (seat: Seat, cardId: string) =>
  seat.judgeArea.some((card) => card.card_id === cardId);

const validTrickTargetIds = (game: GameState, actor: Seat, card: DeckInstance) => {
  if (card.card_id === "juedou") {
    return aliveTargets(game, actor)
      .filter((seat) => !isKongchengProtected(seat))
      .map((seat) => seat.id);
  }
  if (card.card_id === "guohechaiqiao") {
    return aliveTargets(game, actor).filter(hasAnyZoneCard).map((seat) => seat.id);
  }
  if (card.card_id === "shunshouqianyang") {
    return aliveTargets(game, actor)
      .filter(
        (seat) =>
          hasAnyZoneCard(seat) &&
          !hasSkill(seat, "谦逊") &&
          (hasSkill(actor, "奇才") || distanceBetweenSeats(game, actor, seat) <= 1),
      )
      .map((seat) => seat.id);
  }
  if (card.card_id === "huogong") {
    return aliveTargets(game, actor).filter((seat) => seat.hand.length > 0).map((seat) => seat.id);
  }
  if (card.card_id === "jiedaosharen") {
    return aliveTargets(game, actor)
      .filter(
        (seat) =>
          Boolean(getEquippedCard(seat, "weapon")) &&
          getJiedaoVictimIds(game, seat.id).length > 0,
      )
      .map((seat) => seat.id);
  }
  if (card.card_id === "tiesuolianhuan") {
    return game.seats.filter((seat) => seat.alive).map((seat) => seat.id);
  }
  if (card.card_id === "lebusishu") {
    return aliveTargets(game, actor)
      .filter((seat) => !hasSkill(seat, "谦逊") && !hasDelayedTrick(seat, card.card_id))
      .map((seat) => seat.id);
  }
  if (card.card_id === "bingliangcunduan") {
    return aliveTargets(game, actor)
      .filter(
        (seat) =>
          !hasDelayedTrick(seat, card.card_id) &&
          (hasSkill(actor, "奇才") || distanceBetweenSeats(game, actor, seat) <= 1),
      )
      .map((seat) => seat.id);
  }
  return [];
};

export const canUseUnlimitedSha = (seat: Seat, game?: GameState) =>
  getEquippedCard(seat, "weapon")?.card_id === "zhuge_liannu" ||
  hasSkill(seat, "咆哮") ||
  hasTianyiWon(game, seat);

const canUseCardNow = (game: GameState, seat: Seat) =>
  seat.alive &&
  !game.pendingAction &&
  !game.winner &&
  game.turn.activeSeatId === seat.id &&
  game.turn.phase === "出牌";

const getVirtualSkillPlayInfo = (
  game: GameState,
  seat: Seat,
  card: DeckInstance,
): CardPlayInfo | null => {
  if (isCardUsableAsGuohe(seat, card)) {
    const virtualCard = makeVirtualCard(card, "guohechaiqiao", "过河拆桥");
    const targets = validTrickTargetIds(game, seat, virtualCard);
    if (targets.length === 0) {
      return null;
    }
    return {
      canPlay: true,
      mode: "target",
      label: "当拆使用",
      reason: "【奇袭】可将黑色牌当【过河拆桥】使用。",
      validTargetIds: targets,
    };
  }

  if (isCardUsableAsLebu(seat, card)) {
    const virtualCard = makeVirtualCard(card, "lebusishu", "乐不思蜀");
    const targets = validTrickTargetIds(game, seat, virtualCard);
    if (targets.length === 0) {
      return null;
    }
    return {
      canPlay: true,
      mode: "target",
      label: "当乐使用",
      reason: "【国色】可将方片牌当【乐不思蜀】使用。",
      validTargetIds: targets,
    };
  }

  if (isCardUsableAsTiesuo(seat, card)) {
    const virtualCard = makeVirtualCard(card, "tiesuolianhuan", "铁索连环");
    const targets = validTrickTargetIds(game, seat, virtualCard);
    return {
      canPlay: true,
      mode: "target",
      label: "连环/重铸",
      reason: "【连环】可将梅花牌当【铁索连环】使用或重铸。",
      validTargetIds: targets,
      minTargets: 1,
      maxTargets: 2,
      canRecast: true,
    };
  }

  if (isCardUsableAsShuangxiongDuel(game, seat, card)) {
    const virtualCard = makeVirtualCard(card, "juedou", "决斗");
    const targets = validTrickTargetIds(game, seat, virtualCard);
    if (targets.length === 0) {
      return null;
    }
    return {
      canPlay: true,
      mode: "target",
      label: "当决斗使用",
      reason: "【双雄】可将与判定牌颜色不同的手牌当【决斗】使用。",
      validTargetIds: targets,
    };
  }

  return null;
};

export const getCardPlayInfo = (
  game: GameState,
  seatId: number,
  card: DeckInstance,
): CardPlayInfo => {
  const seat = game.seats[seatId];
  if (!seat || !canUseCardNow(game, seat)) {
    return {
      canPlay: false,
      mode: null,
      label: "不可用",
      reason: "只能在自己的出牌阶段使用。",
      validTargetIds: [],
    };
  }

  const virtualInfo = getVirtualSkillPlayInfo(game, seat, card);
  if (virtualInfo) {
    return virtualInfo;
  }

  if (isSha(card)) {
    if (hasTianyiLost(game, seat)) {
      return {
        canPlay: false,
        mode: "target",
        label: "杀",
        reason: "【天义】拼点失败，本回合不能使用杀。",
        validTargetIds: [],
      };
    }
    if (game.turn.shaPlayed && !canUseUnlimitedSha(seat, game)) {
      return {
        canPlay: false,
        mode: "target",
        label: "杀",
        reason: "本回合已经使用过杀。",
        validTargetIds: [],
      };
    }
    const targets = validShaTargetIds(game, seat);
    return {
      canPlay: targets.length > 0,
      mode: "target",
      label: isSha(card) ? "选择目标" : "当杀使用",
      reason:
        targets.length > 0
          ? `攻击范围 ${getAttackRange(seat)}，选择范围内目标。`
          : `攻击范围 ${getAttackRange(seat)} 内没有合法目标。`,
      validTargetIds: targets,
    };
  }

  if (card.card_id === "wuxiekeji") {
    return {
      canPlay: false,
      mode: null,
      label: "响应牌",
      reason: "无懈可击会在锦囊响应窗口接入，不能在出牌阶段主动使用。",
      validTargetIds: [],
    };
  }

  if (card.card_id === "shandian") {
    const canPlay = !hasDelayedTrick(seat, card.card_id);
    return {
      canPlay,
      mode: "instant",
      label: "置入判定区",
      reason: canPlay ? "将闪电置入自己的判定区。" : "你的判定区已有闪电。",
      validTargetIds: [],
    };
  }

  if (targetedTrickIds.has(card.card_id)) {
    const targets = validTrickTargetIds(game, seat, card);
    if (card.card_id === "jiedaosharen") {
      return {
        canPlay: targets.length > 0,
        mode: "target",
        label: "选持刀者",
        reason:
          targets.length > 0
            ? "先选择一名装备武器的角色，再指定其攻击范围内的第二目标。"
            : "当前没有装备武器且能出杀的借刀目标。",
        validTargetIds: targets,
        minTargets: 2,
        maxTargets: 2,
      };
    }
    if (card.card_id === "tiesuolianhuan") {
      return {
        canPlay: true,
        mode: "target",
        label: "连环/重铸",
        reason: "可选择 1 至 2 名角色横置或重置；也可以重铸摸1张牌。",
        validTargetIds: targets,
        minTargets: 1,
        maxTargets: 2,
        canRecast: true,
      };
    }
    return {
      canPlay: targets.length > 0,
      mode: "target",
      label: "选择目标",
      reason:
        targets.length > 0
          ? "选择一名符合条件的目标结算锦囊。"
          : "当前没有符合条件的锦囊目标。",
      validTargetIds: targets,
    };
  }

  if (instantTrickIds.has(card.card_id)) {
    return {
      canPlay: true,
      mode: "instant",
      label: card.card_id === "tiesuolianhuan" ? "重铸" : "使用",
      reason:
        card.card_id === "tiesuolianhuan"
          ? "当前未接横置状态，先按重铸处理：弃置后摸 1 张。"
          : "使用并自动结算锦囊效果。",
      validTargetIds: [],
    };
  }

  if (isEquipment(card)) {
    return {
      canPlay: true,
      mode: "instant",
      label: "装备",
      reason: "置入装备区；同槽位原装备进入弃牌堆。",
      validTargetIds: [],
    };
  }

  if (isTao(card) && (seat.hp < seat.maxHp || !isCardUsableAsSha(seat, card))) {
    return {
      canPlay: seat.hp < seat.maxHp,
      mode: "instant",
      label: "使用",
      reason: seat.hp < seat.maxHp ? "回复 1 点体力。" : "体力已满。",
      validTargetIds: [],
    };
  }

  if (isJiu(card) && (!game.turn.jiuUsed || !isCardUsableAsSha(seat, card))) {
    return {
      canPlay: !game.turn.jiuUsed,
      mode: "instant",
      label: "使用",
      reason: game.turn.jiuUsed ? "本回合已经使用过酒。" : "下一张杀伤害 +1。",
      validTargetIds: [],
    };
  }

  if (!isSha(card) && isCardUsableAsSha(seat, card)) {
    if (hasTianyiLost(game, seat)) {
      return {
        canPlay: false,
        mode: "target",
        label: "当杀使用",
        reason: "【天义】拼点失败，本回合不能使用杀。",
        validTargetIds: [],
      };
    }
    if (game.turn.shaPlayed && !canUseUnlimitedSha(seat, game)) {
      return {
        canPlay: false,
        mode: "target",
        label: "当杀使用",
        reason: "本回合已经使用过杀。",
        validTargetIds: [],
      };
    }
    const targets = validShaTargetIds(game, seat);
    return {
      canPlay: targets.length > 0,
      mode: "target",
      label: "当杀使用",
      reason:
        targets.length > 0
          ? `技能可将此牌当【杀】使用，攻击范围 ${getAttackRange(seat)}。`
          : `攻击范围 ${getAttackRange(seat)} 内没有合法目标。`,
      validTargetIds: targets,
    };
  }

  return {
    canPlay: false,
    mode: null,
    label: "未实现",
    reason: "这张牌的规则会在后续批次接入。",
    validTargetIds: [],
  };
};

const getLiuliTargetIds = (
  game: GameState,
  sourceSeat: Seat,
  targetSeat: Seat,
) =>
  aliveTargets(game, targetSeat)
    .filter((seat) => seat.id !== sourceSeat.id)
    .filter((seat) => !isKongchengProtected(seat))
    .filter((seat) => distanceBetweenSeats(game, targetSeat, seat) <= getAttackRange(targetSeat))
    .map((seat) => seat.id);

const resolveShaAfterLiuli = (
  game: GameState,
  sourceSeat: Seat,
  targetSeat: Seat,
  card: DeckInstance,
  damage: number,
) => {
  const damageTypeValue = cardDamageType(card);
  const finalDamage = damage + getLuoyiDamageBonus(game, sourceSeat, card);

  if (hasSkill(targetSeat, "享乐")) {
    const basicIndex = findCardIndex(
      sourceSeat,
      (cost) => isSha(cost) || isShan(cost) || isTao(cost) || isJiu(cost),
    );
    if (basicIndex < 0) {
      appendLog(game, `${targetSeat.general.name} 的【享乐】令${formatCard(card)}无效。`);
      setLastEffect(game, targetSeat, card, `${targetSeat.general.name} 触发【享乐】，${formatCard(card)}无效。`, sourceSeat, "享乐");
      return;
    }

    const cost = removeCardAt(sourceSeat, basicIndex, game);
    discardCards(game, [cost]);
    appendLog(game, `${sourceSeat.general.name} 为【享乐】弃置一张基本牌${formatCard(cost)}。`);
  }

  let cannotUseShan = false;
  if (
    hasSkill(sourceSeat, "烈弓") &&
    (targetSeat.hand.length >= sourceSeat.hp || targetSeat.hand.length <= getAttackRange(sourceSeat))
  ) {
    cannotUseShan = true;
    appendLog(game, `${sourceSeat.general.name} 的【烈弓】令 ${targetSeat.general.name} 不能使用【闪】响应。`);
  }

  if (hasSkill(sourceSeat, "铁骑")) {
    startSkillJudge(game, {
      type: "tieqi",
      sourceSeatId: sourceSeat.id,
      targetSeatId: targetSeat.id,
      card,
      finalDamage,
      damageType: damageTypeValue,
      cannotUseShan,
    });
    return;
  }

  continueShaDefenseAfterTieqi(
    game,
    sourceSeat,
    targetSeat,
    card,
    finalDamage,
    damageTypeValue,
    cannotUseShan,
  );
};

const continueShaDefenseAfterTieqi = (
  game: GameState,
  sourceSeat: Seat,
  targetSeat: Seat,
  card: DeckInstance,
  finalDamage: number,
  damageTypeValue: DamageType,
  cannotUseShan: boolean,
) => {
  const requiredResponses = hasSkill(sourceSeat, "无双") ? 2 : 1;
  if (requiredResponses > 1 && !cannotUseShan) {
    appendLog(game, `${sourceSeat.general.name} 的【无双】令 ${targetSeat.general.name} 需要连续打出 ${requiredResponses} 张【闪】。`);
  }

  if (targetSeat.controller === "human") {
    game.pendingAction = {
      type: "shan_response",
      sourceSeatId: sourceSeat.id,
      targetSeatId: targetSeat.id,
      card,
      cardName: card.name,
      damage: finalDamage,
      damageType: damageTypeValue,
      requiredResponses,
      respondedResponses: 0,
      canRespond:
        !cannotUseShan &&
        (targetSeat.hand.some((item) => isCardUsableAsShan(targetSeat, item)) ||
          canUseLordResponse(game, targetSeat, "shan")),
      message: cannotUseShan
        ? `${targetSeat.general.name} 成为${formatCard(card)}目标，当前不能使用【闪】响应。`
        : `${targetSeat.general.name} 成为${formatCard(card)}目标，需要打出${requiredResponses > 1 ? `${requiredResponses} 张` : ""}【闪】。`,
    };
    return;
  }

  const shanCards: DeckInstance[] = [];
  if (!cannotUseShan) {
    for (let count = 0; count < requiredResponses; count += 1) {
      const shanIndex = findCardIndex(targetSeat, (item) => isCardUsableAsShan(targetSeat, item));
      const shan =
        shanIndex >= 0
          ? removeCardAt(targetSeat, shanIndex, game)
          : playLordResponseCard(game, targetSeat, "shan");
      if (!shan) {
        break;
      }
      if (shanIndex >= 0) {
        discardCards(game, [shan]);
      }
      shanCards.push(shan);
      if (shanIndex >= 0) {
        triggerLeijiAfterShan(game, targetSeat);
      }
      if (game.pendingAction || game.winner) {
        return;
      }
    }
  }

  if (shanCards.length >= requiredResponses) {
    const message = `${targetSeat.general.name} 打出 ${shanCards.length} 张【闪】，抵消${formatCard(card)}。`;
    appendLog(game, message);
    setLastEffect(game, targetSeat, shanCards[shanCards.length - 1], message, sourceSeat, "闪");
    if (hasSkill(sourceSeat, "猛进") && hasAnyZoneCard(targetSeat)) {
      const removed = removeFirstZoneCard(targetSeat, game);
      if (removed.card) {
        discardCards(game, [removed.card]);
        appendLog(
          game,
          `${sourceSeat.general.name} 发动【猛进】，弃置 ${targetSeat.general.name} 的${removed.zone}${formatCard(removed.card)}。`,
        );
      }
    }
    return;
  }

  if (shanCards.length > 0) {
    appendLog(game, `${targetSeat.general.name} 未能凑齐【无双】所需的【闪】。`);
  }
  applyDamage(game, sourceSeat.id, targetSeat, finalDamage, damageTypeValue, card);
};

const resolveShaAgainstTarget = (
  game: GameState,
  sourceSeat: Seat,
  targetSeat: Seat,
  card: DeckInstance,
  damage: number,
) => {
  const finalDamage = damage + getLuoyiDamageBonus(game, sourceSeat, card);
  const message = `${sourceSeat.general.name} 对 ${targetSeat.general.name} 使用${formatCard(card)}。`;
  appendLog(game, message);
  setLastEffect(game, sourceSeat, card, message, targetSeat, "目标", "target");

  if (hasSkill(targetSeat, "流离") && targetSeat.hand.length > 0) {
    const validTargetIds = getLiuliTargetIds(game, sourceSeat, targetSeat);
    if (validTargetIds.length > 0) {
      if (targetSeat.controller === "human") {
        game.pendingAction = {
          type: "liuli_response",
          sourceSeatId: sourceSeat.id,
          targetSeatId: targetSeat.id,
          card,
          damage,
          validTargetIds,
          message: `${targetSeat.general.name} 可以发动【流离】，弃置一张手牌并选择一名攻击范围内角色转移${formatCard(card)}。`,
        };
        appendLog(game, game.pendingAction.message);
        return;
      }

      const redirectTarget = validTargetIds
        .map((seatId) => game.seats[seatId])
        .filter((seat): seat is Seat => Boolean(seat?.alive))
        .sort((a, b) => {
          const aliveCount = game.seats.filter((item) => item.alive).length;
          const rankDelta =
            roleEnemyRank(targetSeat.role, a.role, aliveCount) -
            roleEnemyRank(targetSeat.role, b.role, aliveCount);
          if (rankDelta !== 0) return rankDelta;
          return a.hp - b.hp;
        })[0];
      if (redirectTarget) {
        const cost = removeCardAt(targetSeat, 0, game);
        discardCards(game, [cost]);
        appendLog(
          game,
          `${targetSeat.general.name} 发动【流离】，弃置${formatCard(cost)}，将${formatCard(card)}转移给 ${redirectTarget.general.name}。`,
        );
        resolveShaAgainstTarget(game, sourceSeat, redirectTarget, card, damage);
        return;
      }
    }
  }

  resolveShaAfterLiuli(game, sourceSeat, targetSeat, card, damage);
};

const equipCard = (game: GameState, seat: Seat, card: DeckInstance) => {
  const slot = getEquipmentSlot(card);
  if (!slot) {
    return;
  }

  const oldIndex = seat.equipment.findIndex(
    (equipment) => getEquipmentSlot(equipment) === slot,
  );
  if (oldIndex >= 0) {
    const [oldCard] = seat.equipment.splice(oldIndex, 1);
    discardCards(game, [oldCard]);
    appendLog(game, `${seat.general.name} 替换装备，弃置${formatCard(oldCard)}。`);
    triggerXiaojiIfEquipmentLost(game, seat, oldCard);
  }

  seat.equipment.push(card);
  const message = `${seat.general.name} 装备${formatCard(card)}。`;
  appendLog(game, message);
  setLastEffect(game, seat, card, message);
};

const drawJudgeCard = (game: GameState) => {
  return drawTopCards(game, 1)[0] ?? null;
};

const canUseJudgeReplacementCard = (seat: Seat, card: DeckInstance) =>
  hasSkill(seat, "鬼才") || (hasSkill(seat, "鬼道") && isBlack(card));

const judgeReplacementSkillName = (seat: Seat, card: DeckInstance) =>
  hasSkill(seat, "鬼道") && isBlack(card) ? "鬼道" : "鬼才";

const replaceJudgeCard = (
  game: GameState,
  judgeOwner: Seat,
  judgeCard: DeckInstance,
  shouldReplace: (replacer: Seat, candidate: DeckInstance, current: DeckInstance) => boolean,
  options: { skipHuman?: boolean } = {},
) => {
  for (const replacer of game.seats) {
    if (
      !replacer.alive ||
      replacer.hand.length === 0 ||
      (options.skipHuman && replacer.controller === "human")
    ) {
      continue;
    }

    const cardIndex = replacer.hand.findIndex(
      (card) =>
        canUseJudgeReplacementCard(replacer, card) &&
        shouldReplace(replacer, card, judgeCard),
    );
    if (cardIndex < 0) {
      continue;
    }

    const replacement = removeCardAt(replacer, cardIndex, game);
    discardCards(game, [judgeCard]);
    appendLog(
      game,
      `${replacer.general.name} 发动【${judgeReplacementSkillName(replacer, replacement)}】，用${formatCard(replacement)}替换 ${judgeOwner.general.name} 的判定牌${formatCard(judgeCard)}。`,
    );
    setLastEffect(game, replacer, replacement, `${replacer.general.name} 替换判定牌。`, judgeOwner, "改判");
    return replacement;
  }

  return judgeCard;
};

const finishJudgeCard = (game: GameState, judgeOwner: Seat, judgeCard: DeckInstance) => {
  if (hasSkill(judgeOwner, "天妒")) {
    judgeOwner.hand.push(judgeCard);
    appendLog(game, `${judgeOwner.general.name} 发动【天妒】，获得判定牌${formatCard(judgeCard)}。`);
    return;
  }

  discardCards(game, [judgeCard]);
};

const skillJudgeOwner = (game: GameState, context: SkillJudgeContext) => {
  if (context.type === "ganglie") return game.seats[context.targetSeatId] ?? null;
  if (context.type === "tieqi") return game.seats[context.sourceSeatId] ?? null;
  if (context.type === "leiji") return game.seats[context.targetSeatId] ?? null;
  return game.seats[context.seatId] ?? null;
};

const skillJudgeName = (context: SkillJudgeContext) => {
  if (context.type === "ganglie") return "刚烈";
  if (context.type === "tieqi") return "铁骑";
  if (context.type === "leiji") return "雷击";
  if (context.type === "luoshen") return "洛神";
  return "双雄";
};

const skillJudgeShouldReplace =
  (game: GameState, context: SkillJudgeContext) =>
  (replacer: Seat, candidate: DeckInstance, current: DeckInstance) => {
    if (context.type === "ganglie") {
      const owner = game.seats[context.targetSeatId];
      const currentHit = !isEffectiveHeart(owner, current);
      const candidateHit = !isEffectiveHeart(owner, candidate);
      return areStrategicAllies(replacer, owner)
        ? !currentHit && candidateHit
        : currentHit && !candidateHit;
    }
    if (context.type === "tieqi") {
      const source = game.seats[context.sourceSeatId];
      const currentHit = current.color === "red";
      const candidateHit = candidate.color === "red";
      return areStrategicAllies(replacer, source)
        ? !currentHit && candidateHit
        : currentHit && !candidateHit;
    }
    if (context.type === "leiji") {
      const actor = game.seats[context.actorSeatId];
      const target = game.seats[context.targetSeatId];
      const currentHit = isEffectiveSpade(target, current);
      const candidateHit = isEffectiveSpade(target, candidate);
      return areStrategicAllies(replacer, actor)
        ? !currentHit && candidateHit
        : currentHit && !candidateHit;
    }
    if (context.type === "luoshen") {
      const seat = game.seats[context.seatId];
      const currentHit = isEffectiveBlack(seat, current);
      const candidateHit = isEffectiveBlack(seat, candidate);
      return areStrategicAllies(replacer, seat)
        ? !currentHit && candidateHit
        : currentHit && !candidateHit;
    }

    const seat = game.seats[context.seatId];
    const hasOppositeCandidate = (color: DeckInstance["color"]) =>
      seat.hand.some((card) => card.color !== color);
    const targetIsAlly = areStrategicAllies(replacer, seat);
    return targetIsAlly
      ? !hasOppositeCandidate(current.color) && hasOppositeCandidate(candidate.color)
      : hasOppositeCandidate(current.color) && !hasOppositeCandidate(candidate.color);
  };

const beginSkillJudgeReplacementPrompt = (
  game: GameState,
  context: SkillJudgeContext,
  judgeCard: DeckInstance,
) => {
  const judgeOwner = skillJudgeOwner(game, context);
  if (!judgeOwner) {
    return false;
  }
  const replacer = game.seats.find(
    (seat) =>
      seat.alive &&
      seat.controller === "human" &&
      seat.hand.some((card) => canUseJudgeReplacementCard(seat, card)),
  );
  if (!replacer) {
    return false;
  }
  const replaceableCardIds = replacer.hand
    .filter((card) => canUseJudgeReplacementCard(replacer, card))
    .map((card) => card.instance_id);
  const firstReplacement =
    replacer.hand.find((card) => replaceableCardIds.includes(card.instance_id)) ?? judgeCard;
  game.pendingAction = {
    type: "skill_judge_replace_response",
    judgeOwnerSeatId: judgeOwner.id,
    replacerSeatId: replacer.id,
    skillName: skillJudgeName(context),
    judgeCard,
    replaceableCardIds,
    context,
    message: `${judgeOwner.general.name} 的【${skillJudgeName(context)}】判定牌为${formatCard(judgeCard)}，${replacer.general.name}可以发动【${judgeReplacementSkillName(replacer, firstReplacement)}】改判。`,
  };
  appendLog(game, game.pendingAction.message);
  return true;
};

const finishSkillJudgeCard = (
  game: GameState,
  context: SkillJudgeContext,
  judgeCard: DeckInstance,
) => {
  const judgeOwner = skillJudgeOwner(game, context);
  if (!judgeOwner) {
    discardCards(game, [judgeCard]);
    return false;
  }
  if (judgeOwner.controller === "human" && hasSkill(judgeOwner, "天妒")) {
    game.pendingAction = {
      type: "skill_tiandu_response",
      judgeOwnerSeatId: judgeOwner.id,
      skillName: skillJudgeName(context),
      judgeCard,
      context,
      message: `${judgeOwner.general.name} 可以发动【天妒】，获得【${skillJudgeName(context)}】的判定牌${formatCard(judgeCard)}。`,
    };
    appendLog(game, game.pendingAction.message);
    return true;
  }
  finishJudgeCard(game, judgeOwner, judgeCard);
  return false;
};

const continueAfterSkillJudgeDisposition = (
  game: GameState,
  context: SkillJudgeContext,
  judgeCard: DeckInstance,
) => {
  if (context.type === "ganglie") {
    const targetSeat = game.seats[context.targetSeatId];
    const sourceSeat = game.seats[context.sourceSeatId];
    const hit = !isEffectiveHeart(targetSeat, judgeCard);
    if (hit && sourceSeat?.alive) {
      if (sourceSeat.hand.length >= 2) {
        const discarded = sourceSeat.hand.splice(0, 2);
        discardCards(game, discarded);
        appendLog(game, `${sourceSeat.general.name} 因【刚烈】弃置两张手牌。`);
      } else {
        appendLog(game, `${sourceSeat.general.name} 无法弃置两张手牌，受到【刚烈】1点伤害。`);
        setLastEffect(
          game,
          targetSeat,
          judgeCard,
          `${sourceSeat.general.name} 受到【刚烈】1点伤害。`,
          sourceSeat,
          "-1",
          "damage",
        );
        applyDamage(game, targetSeat.id, sourceSeat, 1, "normal");
      }
    }
    const pending = {
      ...context,
      type: "ganglie_response" as const,
      message: "【刚烈】判定结算后继续伤害后技能。",
    };
    if (!game.pendingAction && !game.winner) {
      continueAfterDamageSkillPending(game, pending);
    }
    evaluateWinner(game);
    return;
  }

  if (context.type === "tieqi") {
    const sourceSeat = game.seats[context.sourceSeatId];
    const targetSeat = game.seats[context.targetSeatId];
    const hit = judgeCard.color === "red";
    continueShaDefenseAfterTieqi(
      game,
      sourceSeat,
      targetSeat,
      context.card,
      context.finalDamage,
      context.damageType,
      context.cannotUseShan || hit,
    );
    return;
  }

  if (context.type === "leiji") {
    const actor = game.seats[context.actorSeatId];
    const target = game.seats[context.targetSeatId];
    const hit = isEffectiveSpade(target, judgeCard);
    if (hit) {
      setLastEffect(
        game,
        actor,
        judgeCard,
        `${target.general.name} 受到【雷击】2点雷电伤害。`,
        target,
        "-2",
        "damage",
      );
      applyDamage(game, actor.id, target, 2, "thunder");
      evaluateWinner(game);
    }
    if (!game.pendingAction && !game.winner) {
      resumeAfterLeiji(game, context.resume);
    }
    return;
  }

  if (context.type === "luoshen") {
    const seat = game.seats[context.seatId];
    const nextCount = context.count + 1;
    if (isEffectiveBlack(seat, judgeCard)) {
      seat.hand.push(judgeCard);
      appendLog(game, `${seat.general.name} 发动【洛神】，判定为${formatCard(judgeCard)}，获得之。`);
      if (nextCount >= 20) {
        appendLog(game, `${seat.general.name} 的【洛神】连续获得 20 张牌，自动停止。`);
        if (!context.auto) {
          advanceToNextPhase(game);
        }
        return;
      }
      if (context.auto) {
        resolveLuoshenAuto(game, seat, nextCount);
      } else {
        game.pendingAction = {
          type: "luoshen_response",
          seatId: seat.id,
          count: nextCount,
          message: `${seat.general.name} 的【洛神】已获得 ${nextCount} 张牌，是否继续判定？`,
        };
        appendLog(game, game.pendingAction.message);
      }
      return;
    }

    discardCards(game, [judgeCard]);
    appendLog(game, `${seat.general.name} 发动【洛神】，判定为${formatCard(judgeCard)}，洛神结束。`);
    if (!context.auto) {
      advanceToNextPhase(game);
    }
    return;
  }

  const seat = game.seats[context.seatId];
  seat.hand.push(judgeCard);
  game.turn.shuangxiongColor = judgeCard.color;
  appendLog(
    game,
    `${seat.general.name} 发动【双雄】，放弃摸牌并获得判定牌${formatCard(judgeCard)}；本回合可将${judgeCard.color === "red" ? "黑色" : "红色"}手牌当【决斗】使用。`,
  );
  setLastEffect(game, seat, judgeCard, `${seat.general.name} 发动【双雄】。`, seat, "双雄");
  if (!game.pendingAction && !game.winner) {
    advanceToNextPhase(game);
  }
};

const resolveSkillJudgeResult = (
  game: GameState,
  context: SkillJudgeContext,
  judgeCard: DeckInstance,
) => {
  if (context.type === "ganglie") {
    const targetSeat = game.seats[context.targetSeatId];
    const hit = !isEffectiveHeart(targetSeat, judgeCard);
    appendLog(
      game,
      `${targetSeat.general.name} 发动【刚烈】，判定为${formatCard(judgeCard)}，${hit ? "生效" : "未生效"}。`,
    );
    if (finishSkillJudgeCard(game, context, judgeCard)) return;
    continueAfterSkillJudgeDisposition(game, context, judgeCard);
    return;
  }

  if (context.type === "tieqi") {
    const sourceSeat = game.seats[context.sourceSeatId];
    const hit = judgeCard.color === "red";
    appendLog(
      game,
      `${sourceSeat.general.name} 发动【铁骑】，判定为${formatCard(judgeCard)}，${hit ? "目标不能闪避" : "未命中"}。`,
    );
    if (finishSkillJudgeCard(game, context, judgeCard)) return;
    continueAfterSkillJudgeDisposition(game, context, judgeCard);
    return;
  }

  if (context.type === "leiji") {
    const actor = game.seats[context.actorSeatId];
    const target = game.seats[context.targetSeatId];
    const hit = isEffectiveSpade(target, judgeCard);
    appendLog(
      game,
      `${actor.general.name} 发动【雷击】，令 ${target.general.name} 判定为${formatCard(judgeCard)}，${hit ? "命中" : "未命中"}。`,
    );
    if (finishSkillJudgeCard(game, context, judgeCard)) return;
    continueAfterSkillJudgeDisposition(game, context, judgeCard);
    return;
  }

  continueAfterSkillJudgeDisposition(game, context, judgeCard);
};

const startSkillJudge = (game: GameState, context: SkillJudgeContext) => {
  let judgeCard = drawJudgeCard(game);
  if (!judgeCard) {
    appendLog(game, `${skillJudgeName(context)}判定因牌堆为空取消。`);
    if (context.type === "ganglie") {
      const pending = {
        ...context,
        type: "ganglie_response" as const,
        message: "【刚烈】判定取消后继续伤害后技能。",
      };
      continueAfterDamageSkillPending(game, pending);
    } else if (context.type === "tieqi") {
      continueShaDefenseAfterTieqi(
        game,
        game.seats[context.sourceSeatId],
        game.seats[context.targetSeatId],
        context.card,
        context.finalDamage,
        context.damageType,
        context.cannotUseShan,
      );
    } else if (context.type === "leiji") {
      resumeAfterLeiji(game, context.resume);
    } else if (context.type === "luoshen" && !context.auto) {
      advanceToNextPhase(game);
    } else if (context.type === "shuangxiong") {
      advanceToNextPhase(game);
    }
    return;
  }
  if (beginSkillJudgeReplacementPrompt(game, context, judgeCard)) {
    return;
  }
  const owner = skillJudgeOwner(game, context);
  if (owner) {
    judgeCard = replaceJudgeCard(
      game,
      owner,
      judgeCard,
      skillJudgeShouldReplace(game, context),
    );
  }
  resolveSkillJudgeResult(game, context, judgeCard);
};

const triggerXiaojiIfEquipmentLost = (game: GameState, seat: Seat, card: DeckInstance | null) => {
  if (card && hasSkill(seat, "枭姬") && getEquipmentSlot(card)) {
    if (seat.controller === "human" && !game.pendingAction) {
      game.pendingAction = {
        type: "xiaoji_response",
        seatId: seat.id,
        card,
        message: `${seat.general.name} 失去装备${formatCard(card)}，可以发动【枭姬】摸2张牌。`,
      };
      appendLog(game, game.pendingAction.message);
      return;
    }
    drawFromPile(game, seat, 2);
    appendLog(game, `${seat.general.name} 发动【枭姬】，失去装备后摸2张牌。`);
  }
};

const removeFirstZoneCard = (seat: Seat, game?: GameState) => {
  if (seat.judgeArea.length > 0) {
    return { card: seat.judgeArea.shift() ?? null, zone: "判定区" };
  }
  if (seat.equipment.length > 0) {
    const card = seat.equipment.shift() ?? null;
    if (game) {
      triggerXiaojiIfEquipmentLost(game, seat, card);
    }
    return { card, zone: "装备区" };
  }
  if (seat.hand.length > 0) {
    return { card: seat.hand.shift() ?? null, zone: "手牌" };
  }
  return { card: null, zone: "" };
};

const lordResponseSkillInfo = (seat: Seat, requiredCard: "sha" | "shan") => {
  if (requiredCard === "shan" && seat.role === "主公" && hasSkill(seat, "护驾")) {
    return { skillName: "护驾", faction: "魏" };
  }
  if (requiredCard === "sha" && seat.role === "主公" && hasSkill(seat, "激将")) {
    return { skillName: "激将", faction: "蜀" };
  }
  return null;
};

const findLordResponseProvider = (
  game: GameState,
  requester: Seat,
  requiredCard: "sha" | "shan",
) => {
  const info = lordResponseSkillInfo(requester, requiredCard);
  if (!info) {
    return null;
  }
  const predicate =
    requiredCard === "shan"
      ? (seat: Seat, card: DeckInstance) => isCardUsableAsShan(seat, card)
      : (seat: Seat, card: DeckInstance) => isCardUsableAsSha(seat, card);

  for (const provider of game.seats) {
    if (
      !provider.alive ||
      provider.id === requester.id ||
      provider.controller !== "ai" ||
      provider.general.faction !== info.faction
    ) {
      continue;
    }
    const cardIndex = provider.hand.findIndex((card) => predicate(provider, card));
    if (cardIndex >= 0) {
      return { provider, cardIndex, skillName: info.skillName };
    }
  }
  return null;
};

const canUseLordResponse = (
  game: GameState,
  requester: Seat,
  requiredCard: "sha" | "shan",
) => Boolean(findLordResponseProvider(game, requester, requiredCard));

const playLordResponseCard = (
  game: GameState,
  requester: Seat,
  requiredCard: "sha" | "shan",
) => {
  const response = findLordResponseProvider(game, requester, requiredCard);
  if (!response) {
    return null;
  }
  const card = removeCardAt(response.provider, response.cardIndex, game);
  discardCards(game, [card]);
  if (requiredCard === "sha") {
    markShaPlayedThisTurn(game, response.provider);
  }
  const cardName = requiredCard === "shan" ? "闪" : "杀";
  appendLog(
    game,
    `${requester.general.name} 发动【${response.skillName}】，${response.provider.general.name} 替其打出${formatCard(card)}。`,
  );
  setLastEffect(game, response.provider, card, `${response.provider.general.name} 响应【${response.skillName}】打出【${cardName}】。`, requester, cardName);
  if (requiredCard === "shan") {
    triggerLeijiAfterShan(game, response.provider);
  }
  return card;
};

const continueDuel = (
  game: GameState,
  sourceSeatId: number,
  targetSeatId: number,
  card: DeckInstance,
  currentSeatId: number,
  opponentSeatId: number,
  rounds: number,
) => {
  const current = game.seats[currentSeatId];
  const opponent = game.seats[opponentSeatId];
  if (!current?.alive || !opponent?.alive || game.winner) {
    return;
  }

  if (rounds >= 40) {
    appendLog(game, `${formatCard(card)}响应过长，本次决斗按僵持处理。`);
    return;
  }

  const requiredResponses = hasSkill(opponent, "无双") ? 2 : 1;
  if (requiredResponses > 1) {
    appendLog(game, `${opponent.general.name} 的【无双】令 ${current.general.name} 需要连续打出 ${requiredResponses} 张【杀】。`);
  }

  if (current.controller === "human") {
    const availableResponses = current.hand.filter((item) =>
      isCardUsableAsSha(current, item),
    ).length;
    game.pendingAction = {
      type: "duel_sha_response",
      sourceSeatId,
      targetSeatId,
      currentSeatId: current.id,
      opponentSeatId: opponent.id,
      card,
      rounds,
      requiredResponses,
      respondedResponses: 0,
      canRespond: availableResponses > 0 || canUseLordResponse(game, current, "sha"),
      message: `${current.general.name} 需要在${formatCard(card)}中打出${requiredResponses > 1 ? `${requiredResponses} 张` : ""}【杀】，否则受到 ${opponent.general.name} 造成的1点伤害。`,
    };
    return;
  }

  const responseCards: DeckInstance[] = [];
  for (let count = 0; count < requiredResponses; count += 1) {
    const shaIndex = findCardIndex(current, (item) => isCardUsableAsSha(current, item));
    const sha =
      shaIndex >= 0
        ? removeCardAt(current, shaIndex, game)
        : playLordResponseCard(game, current, "sha");
    if (!sha) {
      break;
    }
    if (shaIndex >= 0) {
      discardCards(game, [sha]);
    }
    responseCards.push(sha);
    markShaPlayedThisTurn(game, current);
    if (game.pendingAction || game.winner) {
      return;
    }
  }

  if (responseCards.length < requiredResponses) {
    appendLog(game, `${current.general.name} 未能打出【杀】，决斗失败。`);
    const damage =
      1 + (opponent.id === sourceSeatId ? getLuoyiDamageBonus(game, opponent, card) : 0);
    applyDamage(game, opponent.id, current, damage, "normal", card);
    evaluateWinner(game);
    return;
  }

  const latestSha = responseCards[responseCards.length - 1];
  appendLog(game, `${current.general.name} 在决斗中打出 ${responseCards.length} 张【杀】。`);
  setLastEffect(game, current, latestSha, `${current.general.name} 在决斗中响应${formatCard(card)}。`, opponent, "杀");
  continueDuel(
    game,
    sourceSeatId,
    targetSeatId,
    card,
    opponent.id,
    current.id,
    rounds + 1,
  );
};

const resolveDuel = (
  game: GameState,
  actor: Seat,
  target: Seat,
  card: DeckInstance,
) => {
  const message = `${actor.general.name} 对 ${target.general.name} 使用${formatCard(card)}。`;
  appendLog(game, message);
  setLastEffect(game, actor, card, message, target, "决斗");
  continueDuel(game, actor.id, target.id, card, target.id, actor.id, 0);
};

const responsePredicate = (requiredCard: "sha" | "shan") =>
  requiredCard === "shan" ? isShan : isSha;

const responsePredicateForSeat = (seat: Seat, requiredCard: "sha" | "shan") =>
  requiredCard === "shan"
    ? (card: DeckInstance) => isCardUsableAsShan(seat, card)
    : (card: DeckInstance) => isCardUsableAsSha(seat, card);

const responseCardName = (requiredCard: "sha" | "shan") =>
  requiredCard === "shan" ? "闪" : "杀";

type WuxiePending = Extract<PendingAction, { type: "wuxie_response" }>;
type WuxieEffect = WuxiePending["effect"];

const areStrategicAllies = (seat: Seat, target: Seat) => {
  if (seat.id === target.id) {
    return true;
  }
  if (seat.role === "内奸" || target.role === "内奸") {
    return false;
  }
  const lordTeam = new Set<Role>(["主公", "忠臣"]);
  if (lordTeam.has(seat.role) && lordTeam.has(target.role)) {
    return true;
  }
  return seat.role === "反贼" && target.role === "反贼";
};

const orderedAliveSeatIdsFrom = (game: GameState, startSeatId: number) => {
  const aliveIds = aliveSeatIdsInOrder(game);
  const startIndex = aliveIds.indexOf(startSeatId);
  if (startIndex < 0) {
    return aliveIds;
  }
  return [...aliveIds.slice(startIndex), ...aliveIds.slice(0, startIndex)];
};

const makeWuxiePromptMessage = (game: GameState, pending: WuxiePending, responder: Seat) => {
  const target = game.seats[pending.originalTargetSeatId] ?? game.seats[pending.targetSeatId];
  const latestSeatId = pending.chainSeatIds[pending.chainSeatIds.length - 1];
  const latestSeat = latestSeatId === undefined ? null : game.seats[latestSeatId];
  if (pending.nullified) {
    return `${latestSeat?.general.name ?? "上一名角色"} 的【无懈可击】正在抵消${formatCard(pending.card)}，${responder.general.name} 可以再使用【无懈可击】令原效果继续生效。`;
  }
  if (pending.effect === "mass_damage") {
    return `${target.general.name} 受到${formatCard(pending.card)}影响，可以使用【无懈可击】先抵消此效果。`;
  }
  if (pending.effect === "wuzhong_draw") {
    return `${target.general.name} 的${formatCard(pending.card)}即将摸2张牌，可以使用【无懈可击】抵消。`;
  }
  if (pending.effect === "taoyuan_heal") {
    return `${target.general.name} 即将因${formatCard(pending.card)}回复体力，可以使用【无懈可击】抵消。`;
  }
  if (pending.effect === "wugu_gain") {
    return `${target.general.name} 即将从${formatCard(pending.card)}获得一张牌，可以使用【无懈可击】抵消。`;
  }
  if (pending.effect === "tiesuo_toggle") {
    return `${target.general.name} 即将被${formatCard(pending.card)}改变连环状态，可以使用【无懈可击】抵消。`;
  }
  return `${target.general.name} 成为${formatCard(pending.card)}目标，可以使用【无懈可击】抵消。`;
};

const isHelpfulWuxieEffectForTarget = (
  effect: WuxieEffect,
  target: Seat,
) =>
  effect === "wuzhong_draw" ||
  effect === "taoyuan_heal" ||
  effect === "wugu_gain" ||
  (effect === "tiesuo_toggle" && target.chained);

const shouldAiUseWuxie = (game: GameState, seat: Seat, pending: WuxiePending) => {
  const target = game.seats[pending.originalTargetSeatId] ?? game.seats[pending.targetSeatId];
  if (!target?.alive || !seat.hand.some(isWuxie)) {
    return false;
  }
  const targetIsAlly = areStrategicAllies(seat, target);
  const targetEffectHelpful = isHelpfulWuxieEffectForTarget(pending.effect, target);
  const wantsEffect =
    (targetEffectHelpful && targetIsAlly) || (!targetEffectHelpful && !targetIsAlly);
  return pending.nullified ? wantsEffect : !wantsEffect;
};

const playWuxieIntoChain = (
  game: GameState,
  pending: WuxiePending,
  responder: Seat,
): WuxiePending | null => {
  const wuxieIndex = findCardIndex(responder, isWuxie);
  if (wuxieIndex < 0) {
    return null;
  }

  const previousNullified = pending.nullified;
  const wuxie = removeCardAt(responder, wuxieIndex, game);
  discardCards(game, [wuxie]);
  const newNullified = !previousNullified;
  const sourceSeat = game.seats[pending.sourceSeatId];
  const latestSeatId = pending.chainSeatIds[pending.chainSeatIds.length - 1];
  const latestSeat = latestSeatId === undefined ? sourceSeat : game.seats[latestSeatId];
  const message = previousNullified
    ? `${responder.general.name} 使用${formatCard(wuxie)}反制无懈，令${formatCard(pending.card)}继续生效。`
    : `${responder.general.name} 使用${formatCard(wuxie)}，抵消${formatCard(pending.card)}。`;
  appendLog(game, message);
  setLastEffect(
    game,
    responder,
    wuxie,
    message,
    latestSeat,
    previousNullified ? "反无懈" : "无懈",
  );

  return {
    ...pending,
    responderSeatId: responder.id,
    nullified: newNullified,
    checkedSeatIds: [responder.id],
    chainSeatIds: [...pending.chainSeatIds, responder.id],
    message,
  };
};

const finalizeWuxiePending = (game: GameState, pending: WuxiePending) => {
  const target = game.seats[pending.originalTargetSeatId] ?? game.seats[pending.targetSeatId];
  const sourceSeat = game.seats[pending.sourceSeatId];
  game.pendingAction = null;

  if (!target?.alive || game.winner) {
    return;
  }

  if (pending.nullified) {
    if (pending.discardOnCancel) {
      discardCards(game, [pending.card]);
    }
    appendLog(game, `${target.general.name} 受到的${formatCard(pending.card)}效果被无懈抵消。`);
    if (pending.effect === "mass_damage") {
      continueMassResponseTrick(
        game,
        pending.sourceSeatId,
        pending.card,
        pending.requiredCard ?? "shan",
        pending.remainingTargetIds ?? [],
        pending.damage ?? 1,
        pending.damageType ?? "normal",
      );
    }
    if (pending.effect === "taoyuan_heal") {
      continueTaoyuanHeal(
        game,
        pending.sourceSeatId,
        pending.card,
        pending.remainingTargetIds ?? [],
      );
    }
    if (pending.effect === "wugu_gain") {
      continueWuguDistribution(
        game,
        pending.sourceSeatId,
        pending.card,
        pending.remainingTargetIds ?? [],
        pending.revealedCards ?? [],
      );
    }
    if (pending.effect === "tiesuo_toggle") {
      continueTiesuoTargets(
        game,
        pending.sourceSeatId,
        pending.card,
        pending.remainingTargetIds ?? [],
      );
    }
    return;
  }

  if (pending.effect === "mass_damage") {
    resolveMassTargetRequirement(
      game,
      pending.sourceSeatId,
      pending.card,
      pending.requiredCard ?? "shan",
      target,
      pending.remainingTargetIds ?? [],
      pending.damage ?? 1,
      pending.damageType ?? "normal",
    );
    return;
  }

  if (pending.effect === "targeted_trick") {
    if (sourceSeat) {
      const secondaryTarget =
        pending.secondaryTargetSeatId === undefined
          ? null
          : game.seats[pending.secondaryTargetSeatId] ?? null;
      resolveTargetedTrick(
        game,
        sourceSeat,
        pending.card,
        target,
        false,
        secondaryTarget ? [secondaryTarget] : [],
      );
      evaluateWinner(game);
    }
    return;
  }

  if (pending.effect === "wuzhong_draw") {
    const message = `${target.general.name} 的${formatCard(pending.card)}生效，摸2张牌。`;
    appendLog(game, message);
    setLastEffect(game, target, pending.card, message, target, "+2");
    drawFromPile(game, target, 2);
    return;
  }

  if (pending.effect === "taoyuan_heal") {
    healSeat(game, target, 1, formatCard(pending.card));
    setLastEffect(
      game,
      sourceSeat ?? target,
      pending.card,
      `${target.general.name} 因${formatCard(pending.card)}回复1点体力。`,
      target,
      "+1",
    );
    continueTaoyuanHeal(
      game,
      pending.sourceSeatId,
      pending.card,
      pending.remainingTargetIds ?? [],
    );
    return;
  }

  if (pending.effect === "wugu_gain") {
    resolveWuguGain(game, pending);
    return;
  }

  if (pending.effect === "tiesuo_toggle") {
    target.chained = !target.chained;
    const message = `${target.general.name} 被${formatCard(pending.card)}${target.chained ? "横置连环" : "重置连环"}。`;
    appendLog(game, message);
    setLastEffect(game, sourceSeat ?? target, pending.card, message, target, target.chained ? "连环" : "解环");
    continueTiesuoTargets(
      game,
      pending.sourceSeatId,
      pending.card,
      pending.remainingTargetIds ?? [],
    );
    return;
  }

  if (pending.effect === "delayed_skip_draw") {
    game.turn.skipDraw = true;
    appendLog(game, `${target.general.name} 受到${formatCard(pending.card)}影响，跳过摸牌阶段。`);
    setLastEffect(game, target, pending.card, `${target.general.name} 结算${formatCard(pending.card)}。`, target, "跳摸牌");
    return;
  }

  if (pending.effect === "delayed_skip_play") {
    game.turn.skipPlay = true;
    appendLog(game, `${target.general.name} 受到${formatCard(pending.card)}影响，跳过出牌阶段。`);
    setLastEffect(game, target, pending.card, `${target.general.name} 结算${formatCard(pending.card)}。`, target, "跳出牌");
    return;
  }

  if (pending.effect === "delayed_damage") {
    applyDamage(
      game,
      null,
      target,
      pending.damage ?? 3,
      pending.damageType ?? "thunder",
      pending.card,
    );
    evaluateWinner(game);
  }
};

const continueWuxieContest = (
  game: GameState,
  pending: WuxiePending,
  startSeatId: number,
) => {
  const checked = new Set(pending.checkedSeatIds);
  let nextPending: WuxiePending = {
    ...pending,
    checkedSeatIds: [...checked],
  };

  for (const seatId of orderedAliveSeatIdsFrom(game, startSeatId)) {
    if (checked.has(seatId)) {
      continue;
    }
    const seat = game.seats[seatId];
    if (!seat?.alive) {
      continue;
    }

    const wuxieIndex = findCardIndex(seat, isWuxie);
    if (wuxieIndex < 0) {
      checked.add(seatId);
      nextPending = {
        ...nextPending,
        checkedSeatIds: [...checked],
      };
      continue;
    }

    if (seat.controller === "human") {
      game.pendingAction = {
        ...nextPending,
        responderSeatId: seat.id,
        checkedSeatIds: [...checked],
        message: makeWuxiePromptMessage(game, nextPending, seat),
      };
      return;
    }

    if (shouldAiUseWuxie(game, seat, nextPending)) {
      const usedPending = playWuxieIntoChain(game, nextPending, seat);
      if (!usedPending) {
        checked.add(seatId);
        nextPending = {
          ...nextPending,
          checkedSeatIds: [...checked],
        };
        continue;
      }
      continueWuxieContest(game, usedPending, nextAliveSeatId(game, seat.id));
      return;
    }

    checked.add(seatId);
    nextPending = {
      ...nextPending,
      checkedSeatIds: [...checked],
    };
  }

  finalizeWuxiePending(game, nextPending);
};

const beginWuxieContest = (
  game: GameState,
  params: {
    sourceSeatId: number;
    targetSeatId: number;
    secondaryTargetSeatId?: number;
    card: DeckInstance;
    effect: WuxieEffect;
    damage?: number;
    damageType?: DamageType;
    remainingTargetIds?: number[];
    revealedCards?: DeckInstance[];
    requiredCard?: "sha" | "shan";
    discardOnCancel?: boolean;
  },
) => {
  const pending: WuxiePending = {
    type: "wuxie_response",
    sourceSeatId: params.sourceSeatId,
    targetSeatId: params.targetSeatId,
    secondaryTargetSeatId: params.secondaryTargetSeatId,
    originalTargetSeatId: params.targetSeatId,
    responderSeatId: params.targetSeatId,
    card: params.card,
    effect: params.effect,
    damage: params.damage,
    damageType: params.damageType,
    remainingTargetIds: params.remainingTargetIds,
    revealedCards: params.revealedCards,
    requiredCard: params.requiredCard,
    discardOnCancel: params.discardOnCancel,
    nullified: false,
    checkedSeatIds: [],
    chainSeatIds: [],
    message: "",
  };
  continueWuxieContest(game, pending, params.targetSeatId);
};

const continueTaoyuanHeal = (
  game: GameState,
  sourceSeatId: number,
  card: DeckInstance,
  targetIds: number[],
) => {
  for (let index = 0; index < targetIds.length; index += 1) {
    const target = game.seats[targetIds[index]];
    if (!target?.alive || target.hp >= target.maxHp) {
      continue;
    }
    beginWuxieContest(game, {
      sourceSeatId,
      targetSeatId: target.id,
      card,
      effect: "taoyuan_heal",
      remainingTargetIds: targetIds.slice(index + 1),
    });
    return;
  }
  const sourceSeat = game.seats[sourceSeatId] ?? activeSeat(game);
  const message = `${formatCard(card)}结算完毕，所有受伤角色的回复均已结算。`;
  appendLog(game, message);
  setLastEffect(game, sourceSeat, card, message, undefined, "完成", "card");
};

const chooseAiWuguCard = (seat: Seat, cards: DeckInstance[]) => {
  if (seat.hp < seat.maxHp) {
    return cards.find(isTao) ?? cards[0] ?? null;
  }
  return (
    cards.find(isEquipment) ??
    cards.find(isSha) ??
    cards.find((card) => card.card_id !== "wuxiekeji") ??
    cards[0] ??
    null
  );
};

const finishWuguDistribution = (
  game: GameState,
  sourceSeatId: number,
  card: DeckInstance,
  revealedCards: DeckInstance[],
) => {
  if (revealedCards.length > 0) {
    discardCards(game, revealedCards);
    appendLog(game, `${formatCard(card)}剩余 ${revealedCards.length} 张亮出牌进入弃牌堆。`);
  }
  const sourceSeat = game.seats[sourceSeatId] ?? activeSeat(game);
  const message = `${formatCard(card)}结算完毕，所有可获得亮出牌的角色均已结算。`;
  appendLog(game, message);
  setLastEffect(game, sourceSeat, card, message, undefined, "完成", "card");
};

const continueWuguDistribution = (
  game: GameState,
  sourceSeatId: number,
  card: DeckInstance,
  targetIds: number[],
  revealedCards: DeckInstance[],
) => {
  for (let index = 0; index < targetIds.length; index += 1) {
    const target = game.seats[targetIds[index]];
    if (!target?.alive) {
      continue;
    }
    beginWuxieContest(game, {
      sourceSeatId,
      targetSeatId: target.id,
      card,
      effect: "wugu_gain",
      remainingTargetIds: targetIds.slice(index + 1),
      revealedCards,
    });
    return;
  }

  finishWuguDistribution(game, sourceSeatId, card, revealedCards);
};

const resolveWuguGain = (game: GameState, pending: WuxiePending) => {
  const target = game.seats[pending.originalTargetSeatId] ?? game.seats[pending.targetSeatId];
  const revealedCards = [...(pending.revealedCards ?? [])];
  const remainingSeatIds = pending.remainingTargetIds ?? [];
  if (!target?.alive || revealedCards.length === 0) {
    continueWuguDistribution(
      game,
      pending.sourceSeatId,
      pending.card,
      remainingSeatIds,
      revealedCards,
    );
    return;
  }

  if (target.controller === "human") {
    game.pendingAction = {
      type: "wugufengdeng_select",
      sourceSeatId: pending.sourceSeatId,
      responderSeatId: target.id,
      card: pending.card,
      revealedCards,
      remainingSeatIds,
      message: `${target.general.name} 结算${formatCard(pending.card)}，请选择一张亮出的牌获得。`,
    };
    return;
  }

  const gained = chooseAiWuguCard(target, revealedCards);
  if (!gained) {
    continueWuguDistribution(
      game,
      pending.sourceSeatId,
      pending.card,
      remainingSeatIds,
      revealedCards,
    );
    return;
  }

  const rest = revealedCards.filter((item) => item.instance_id !== gained.instance_id);
  target.hand.push(gained);
  const message = `${target.general.name} 从${formatCard(pending.card)}获得${formatCard(gained)}。`;
  appendLog(game, message);
  setLastEffect(game, target, pending.card, message, target, "+牌");
  continueWuguDistribution(
    game,
    pending.sourceSeatId,
    pending.card,
    remainingSeatIds,
    rest,
  );
};

const continueTiesuoTargets = (
  game: GameState,
  sourceSeatId: number,
  card: DeckInstance,
  targetIds: number[],
) => {
  for (let index = 0; index < targetIds.length; index += 1) {
    const target = game.seats[targetIds[index]];
    if (!target?.alive) {
      continue;
    }
    beginWuxieContest(game, {
      sourceSeatId,
      targetSeatId: target.id,
      card,
      effect: "tiesuo_toggle",
      remainingTargetIds: targetIds.slice(index + 1),
    });
    return;
  }
};

const resolveTiesuoTargets = (
  game: GameState,
  actor: Seat,
  card: DeckInstance,
  targets: Seat[],
) => {
  const targetIds = [...new Set(targets.filter((target) => target.alive).map((target) => target.id))];
  if (targetIds.length === 0) {
    return;
  }

  const names = targetIds.map((seatId) => game.seats[seatId].general.name).join("、");
  const message = `${actor.general.name} 使用${formatCard(card)}，指定 ${names} 进入连环结算。`;
  appendLog(game, message);
  setLastEffect(game, actor, card, message, game.seats[targetIds[0]], "连环");
  continueTiesuoTargets(game, actor.id, card, targetIds);
};

const resolveMassTargetRequirement = (
  game: GameState,
  sourceSeatId: number,
  card: DeckInstance,
  requiredCard: "sha" | "shan",
  target: Seat,
  remainingTargetIds: number[],
  damage: number,
  damageType: DamageType,
) => {
  const sourceSeat = game.seats[sourceSeatId];
  if (!target?.alive || !sourceSeat) {
    return;
  }

  setLastEffect(
    game,
    sourceSeat,
    card,
    `${target.general.name} 成为${formatCard(card)}的目标。`,
    target,
    responseCardName(requiredCard),
    "target",
  );

  const predicate = responsePredicateForSeat(target, requiredCard);
  if (target.controller === "human") {
    game.pendingAction = {
      type: "basic_card_response",
      sourceSeatId,
      targetSeatId: target.id,
      card,
      cardName: card.name,
      cardImagePath: card.imagePath,
      requiredCard,
      damage,
      damageType,
      remainingTargetIds,
      canRespond:
        target.hand.some(predicate) || canUseLordResponse(game, target, requiredCard),
      canWuxie: target.hand.some(isWuxie),
      message: `${target.general.name} 受到【${card.name}】影响，需要打出【${responseCardName(requiredCard)}】。`,
    };
    return;
  }

  const responseIndex = findCardIndex(target, predicate);
  const response =
    responseIndex >= 0
      ? removeCardAt(target, responseIndex, game)
      : playLordResponseCard(game, target, requiredCard);
  if (response) {
    if (responseIndex >= 0) {
      discardCards(game, [response]);
    }
    if (requiredCard === "sha") {
      markShaPlayedThisTurn(game, target);
    }
    appendLog(game, `${target.general.name} 打出${formatCard(response)}响应【${card.name}】。`);
  } else {
    appendLog(game, `${target.general.name} 未能响应【${card.name}】。`);
    applyDamage(game, sourceSeatId, target, damage, damageType, card);
    evaluateWinner(game);
    if (game.pendingAction || game.winner) {
      return;
    }
  }

  continueMassResponseTrick(
    game,
    sourceSeatId,
    card,
    requiredCard,
    remainingTargetIds,
    damage,
    damageType,
  );
};

const continueMassResponseTrick = (
  game: GameState,
  sourceSeatId: number,
  card: DeckInstance,
  requiredCard: "sha" | "shan",
  targetIds: number[],
  damage: number,
  damageType: DamageType,
) => {
  const actor = game.seats[sourceSeatId];
  if (!actor) {
    return;
  }

  for (let index = 0; index < targetIds.length; index += 1) {
    const target = game.seats[targetIds[index]];
    if (!target?.alive) {
      continue;
    }

    const remainingTargetIds = targetIds.slice(index + 1);
    beginWuxieContest(
      game,
      {
        sourceSeatId,
        targetSeatId: target.id,
        card,
        effect: "mass_damage",
        requiredCard,
        damage,
        damageType,
        remainingTargetIds,
      },
    );
    return;
  }

  const message = `${formatCard(card)}结算完毕，所有目标均已响应或承受效果。`;
  appendLog(game, message);
  setLastEffect(game, actor, card, message, undefined, "完成", "card");
};

const resolveMassResponseTrick = (
  game: GameState,
  actor: Seat,
  card: DeckInstance,
  requiredName: string,
  predicate: (card: DeckInstance) => boolean,
) => {
  const message = `${actor.general.name} 使用${formatCard(card)}。`;
  appendLog(game, message);
  setLastEffect(game, actor, card, message, undefined, requiredName);

  continueMassResponseTrick(
    game,
    actor.id,
    card,
    requiredName === "闪" ? "shan" : "sha",
    aliveTargets(game, actor).map((target) => target.id),
    1,
    "normal",
  );
};

const resolveHuogongDiscard = (
  game: GameState,
  actor: Seat,
  card: DeckInstance,
  target: Seat,
) => {
  const revealed = target.hand[0] ?? null;
  if (!revealed) {
    const message = `${actor.general.name} 火攻 ${target.general.name}，但目标没有手牌。`;
    appendLog(game, message);
    setLastEffect(game, actor, card, message, target, "无效");
    return;
  }

  const discardableCards = actor.hand.filter((candidate) => candidate.suit === revealed.suit);
  appendLog(game, `${target.general.name} 因${formatCard(card)}展示${formatCard(revealed)}。`);
  if (discardableCards.length === 0) {
    const message = `${actor.general.name} 火攻 ${target.general.name}，但没有可弃置的同花色手牌。`;
    appendLog(game, message);
    setLastEffect(game, actor, card, message, target, "无效");
    return;
  }

  if (actor.controller === "human") {
    game.pendingAction = {
      type: "huogong_discard",
      sourceSeatId: actor.id,
      targetSeatId: target.id,
      card,
      revealedCard: revealed,
      discardableCardIds: discardableCards.map((item) => item.instance_id),
      message: `${target.general.name} 展示${formatCard(revealed)}，请选择是否弃置一张同花色手牌令${formatCard(card)}造成火焰伤害。`,
    };
    return;
  }

  const cost = removeCardFromHand(actor, discardableCards[0].instance_id, game);
  if (!cost) {
    return;
  }
  discardCards(game, [cost]);
  const message = `${actor.general.name} 火攻 ${target.general.name}，弃置同花色${formatCard(cost)}，造成1点火焰伤害。`;
  appendLog(game, message);
  setLastEffect(game, actor, card, message, target, "-1");
  applyDamage(game, actor.id, target, 1, "fire", card);
};

const giveWeaponToSource = (
  game: GameState,
  source: Seat,
  weaponOwner: Seat,
  card: DeckInstance,
  weapon: DeckInstance,
) => {
  const weaponIndex = weaponOwner.equipment.findIndex(
    (equipment) => equipment.instance_id === weapon.instance_id,
  );
  if (weaponIndex < 0) {
    appendLog(game, `${weaponOwner.general.name} 已没有可交出的武器。`);
    return;
  }
  const [removedWeapon] = weaponOwner.equipment.splice(weaponIndex, 1);
  source.hand.push(removedWeapon);
  const message = `${weaponOwner.general.name} 未按${formatCard(card)}出杀，将武器${formatCard(removedWeapon)}交给 ${source.general.name}。`;
  appendLog(game, message);
  setLastEffect(game, source, card, message, weaponOwner, "得武器");
};

const resolveJiedaoSha = (
  game: GameState,
  actor: Seat,
  card: DeckInstance,
  weaponOwner: Seat,
  specifiedVictim?: Seat | null,
) => {
  const weapon = getEquippedCard(weaponOwner, "weapon");
  if (!weapon) {
    appendLog(game, `${weaponOwner.general.name} 没有武器，${formatCard(card)}无效。`);
    return;
  }

  const victimIds = getJiedaoVictimIds(game, weaponOwner.id);
  const victim =
    specifiedVictim && victimIds.includes(specifiedVictim.id)
      ? specifiedVictim
      : (chooseAiTargetFromIds(game, actor, victimIds) ??
        victimIds.map((seatId) => game.seats[seatId]).find((seat) => seat?.alive));
  if (!victim) {
    giveWeaponToSource(game, actor, weaponOwner, card, weapon);
    return;
  }

  appendLog(
    game,
    `${actor.general.name} 使用${formatCard(card)}，令 ${weaponOwner.general.name} 对 ${victim.general.name} 出【杀】，否则交出武器。`,
  );

  const shaIndex = findCardIndex(weaponOwner, isSha);
  if (weaponOwner.controller === "human") {
    game.pendingAction = {
      type: "jiedao_sha_response",
      sourceSeatId: actor.id,
      weaponOwnerSeatId: weaponOwner.id,
      victimSeatId: victim.id,
      card,
      weapon,
      canRespond: shaIndex >= 0,
      message: `${weaponOwner.general.name} 需对 ${victim.general.name} 打出【杀】，否则将${formatCard(weapon)}交给 ${actor.general.name}。`,
    };
    return;
  }

  if (shaIndex < 0) {
    giveWeaponToSource(game, actor, weaponOwner, card, weapon);
    return;
  }

  const sha = removeCardAt(weaponOwner, shaIndex, game);
  discardCards(game, [sha]);
  const message = `${weaponOwner.general.name} 响应${formatCard(card)}，对 ${victim.general.name} 使用${formatCard(sha)}。`;
  appendLog(game, message);
  setLastEffect(game, weaponOwner, sha, message, victim, "借刀杀");
  resolveShaAgainstTarget(game, weaponOwner, victim, sha, 1);
};

const resolveTargetedTrick = (
  game: GameState,
  actor: Seat,
  card: DeckInstance,
  target: Seat,
  allowWuxie = true,
  extraTargets: Seat[] = [],
) => {
  if (card.card_id === "tiesuolianhuan") {
    resolveTiesuoTargets(game, actor, card, [target, ...extraTargets].slice(0, 2));
    return;
  }

  if (allowWuxie) {
    const targetNames = [target, ...extraTargets]
      .filter((item): item is Seat => Boolean(item?.alive))
      .map((item) => item.general.name)
      .join("、");
    const message = targetNames
      ? `${actor.general.name} 使用${formatCard(card)}，指定 ${targetNames}。`
      : `${actor.general.name} 使用${formatCard(card)}。`;
    appendLog(game, message);
    setLastEffect(game, actor, card, message, target, card.name, "target");
    beginWuxieContest(game, {
      sourceSeatId: actor.id,
      targetSeatId: target.id,
      secondaryTargetSeatId: extraTargets[0]?.id,
      card,
      effect: "targeted_trick",
      discardOnCancel: isDelayedTrick(card),
    });
    return;
  }

  if (card.card_id === "juedou") {
    resolveDuel(game, actor, target, card);
    return;
  }

  if (card.card_id === "guohechaiqiao") {
    const removed = removeFirstZoneCard(target, game);
    if (removed.card) {
      discardCards(game, [removed.card]);
      const message = `${actor.general.name} 对 ${target.general.name} 使用${formatCard(card)}，弃置其${removed.zone}${formatCard(removed.card)}。`;
      appendLog(game, message);
      setLastEffect(game, actor, card, message, target, "拆");
    }
    return;
  }

  if (card.card_id === "shunshouqianyang") {
    const removed = removeFirstZoneCard(target, game);
    if (removed.card) {
      actor.hand.push(removed.card);
      const message = `${actor.general.name} 对 ${target.general.name} 使用${formatCard(card)}，获得其${removed.zone}${formatCard(removed.card)}。`;
      appendLog(game, message);
      setLastEffect(game, actor, card, message, target, "拿");
    }
    return;
  }

  if (card.card_id === "huogong") {
    resolveHuogongDiscard(game, actor, card, target);
    return;
  }

  if (card.card_id === "jiedaosharen") {
    resolveJiedaoSha(game, actor, card, target, extraTargets[0]);
    return;
  }

  if (isDelayedTrick(card)) {
    target.judgeArea.push(card);
    const message = `${actor.general.name} 将${formatCard(card)}置入 ${target.general.name} 的判定区。`;
    appendLog(game, message);
    setLastEffect(game, actor, card, message, target, "判定");
  }
};

const resolveInstantTrick = (game: GameState, actor: Seat, card: DeckInstance) => {
  if (card.card_id === "wuzhongshengyou") {
    const message = `${actor.general.name} 使用${formatCard(card)}，准备摸2张牌。`;
    appendLog(game, message);
    setLastEffect(game, actor, card, message, actor, "+2");
    beginWuxieContest(game, {
      sourceSeatId: actor.id,
      targetSeatId: actor.id,
      card,
      effect: "wuzhong_draw",
    });
    return;
  }

  if (card.card_id === "taoyuanjieyi") {
    const targetIds = aliveSeatIdsInOrder(game).filter((seatId) => {
      const seat = game.seats[seatId];
      return seat.alive && seat.hp < seat.maxHp;
    });
    const message = `${actor.general.name} 使用${formatCard(card)}，受伤角色依次回复1点体力。`;
    appendLog(game, message);
    setLastEffect(game, actor, card, message, undefined, "+1");
    continueTaoyuanHeal(game, actor.id, card, targetIds);
    return;
  }

  if (card.card_id === "wugufengdeng") {
    const aliveIds = aliveSeatIdsInOrder(game);
    const start = aliveIds.indexOf(actor.id);
    const ordered = [...aliveIds.slice(start), ...aliveIds.slice(0, start)];
    const revealed = drawTopCards(game, ordered.length);
    const message = `${actor.general.name} 使用${formatCard(card)}，亮出 ${revealed.length} 张牌并依次选择。`;
    appendLog(game, message);
    setLastEffect(game, actor, card, message, undefined, "五谷");
    continueWuguDistribution(game, actor.id, card, ordered, revealed);
    return;
  }

  if (card.card_id === "wanjianqifa") {
    resolveMassResponseTrick(game, actor, card, "闪", isShan);
    return;
  }

  if (card.card_id === "nanmanruqin") {
    resolveMassResponseTrick(game, actor, card, "杀", isSha);
    return;
  }

  if (card.card_id === "tiesuolianhuan") {
    const message = `${actor.general.name} 重铸${formatCard(card)}，摸1张牌。`;
    appendLog(game, message);
    setLastEffect(game, actor, card, message, undefined, "+1");
    drawFromPile(game, actor, 1);
    return;
  }

  if (card.card_id === "shandian") {
    actor.judgeArea.push(card);
    const message = `${actor.general.name} 将${formatCard(card)}置入自己的判定区。`;
    appendLog(game, message);
    setLastEffect(game, actor, card, message, actor, "闪电");
  }
};

const askWuxieForDelayed = (
  game: GameState,
  seat: Seat,
  trick: DeckInstance,
  effect: "delayed_skip_draw" | "delayed_skip_play" | "delayed_damage",
  _message: string,
  damage?: number,
  damageType?: DamageType,
) => {
  beginWuxieContest(game, {
    sourceSeatId: seat.id,
    targetSeatId: seat.id,
    card: trick,
    effect,
    damage,
    damageType,
  });
  return Boolean(game.pendingAction);
};

const resolveRuoyu = (game: GameState, seat: Seat) => {
  if (
    hasSkill(seat, "若愚") &&
    seat.role === "主公" &&
    !seat.awakenedSkills.includes("若愚")
  ) {
    const minHp = Math.min(...game.seats.filter((item) => item.alive).map((item) => item.hp));
    if (seat.hp <= minHp) {
      seat.awakenedSkills.push("若愚");
      seat.maxHp += 1;
      healSeat(game, seat, 1, "【若愚】觉醒");
      if (!hasSkill(seat, "激将")) {
        seat.general = {
          ...seat.general,
          skills: [
            ...seat.general.skills,
            {
              name: "激将",
              description: "主公技。需要使用或打出杀时，可令其他蜀势力角色替你打出一张杀。",
            },
          ],
        };
      }
      appendLog(game, `${seat.general.name} 觉醒【若愚】，增加1点体力上限并获得【激将】。`);
    }
  }
};

const resolveLuoshenAuto = (game: GameState, seat: Seat, initialCount = 0) => {
  let count = initialCount;
  while (count < 20) {
    startSkillJudge(game, {
      type: "luoshen",
      seatId: seat.id,
      count,
      auto: true,
    });
    return;
  }

  appendLog(game, `${seat.general.name} 的【洛神】连续获得 20 张牌，自动停止。`);
};

type PreparePhaseSkillName = "观星" | "若愚" | "洛神";
const preparePhaseSkillOrder: PreparePhaseSkillName[] = ["观星", "若愚", "洛神"];

const continuePreparePhaseSkills = (
  game: GameState,
  seat: Seat,
  startIndex = 0,
) => {
  for (let index = startIndex; index < preparePhaseSkillOrder.length; index += 1) {
    const skillName = preparePhaseSkillOrder[index];

    if (skillName === "观星" && hasSkill(seat, "观星")) {
      if (seat.controller === "human") {
        recycleDiscardIntoDraw(game);
        const count = Math.min(5, game.seats.filter((item) => item.alive).length, game.piles.draw.length);
        if (count <= 0) {
          appendLog(game, `${seat.general.name} 发动【观星】，但牌堆为空。`);
          continue;
        }
        const viewedCards = drawTopCards(game, count);
        game.pendingAction = {
          type: "guanxing_response",
          seatId: seat.id,
          viewedCards,
          message: `${seat.general.name} 可以发动【观星】，点击牌决定置于牌堆顶的顺序，未选择的牌置于牌堆底。`,
        };
        appendLog(game, game.pendingAction.message);
        return;
      }
      resolveGuanxing(game, seat);
    }

    if (skillName === "若愚") {
      resolveRuoyu(game, seat);
    }

    if (skillName === "洛神" && hasSkill(seat, "洛神")) {
      if (seat.controller === "human") {
        game.pendingAction = {
          type: "luoshen_response",
          seatId: seat.id,
          count: 0,
          message: `${seat.general.name} 可以发动【洛神】，进行判定；若为黑色，获得判定牌并可继续。`,
        };
        appendLog(game, game.pendingAction.message);
        return;
      }
      resolveLuoshenAuto(game, seat);
    }
  }
};

type DrawPhaseSkillName = "双雄" | "突袭" | "裸衣";
const drawPhaseSkillOrder: DrawPhaseSkillName[] = ["双雄", "突袭", "裸衣"];

const resolveShuangxiong = (game: GameState, seat: Seat) => {
  startSkillJudge(game, {
    type: "shuangxiong",
    seatId: seat.id,
  });
};

const drawNormalPhaseCards = (
  game: GameState,
  seat: Seat,
  useLuoyi = false,
) => {
  let count = getDrawPhaseCount(seat);
  if (hasSkill(seat, "英姿")) {
    appendLog(game, `${seat.general.name} 的【英姿】令摸牌数 +1。`);
  }

  if (useLuoyi) {
    count = Math.max(0, count - 1);
    game.turn.luoyiActive = true;
    appendLog(game, `${seat.general.name} 发动【裸衣】，少摸1张；本回合杀和决斗伤害 +1。`);
  }

  drawFromPile(game, seat, count);
};

const continueDrawPhaseSkills = (
  game: GameState,
  seat: Seat,
  startIndex = 0,
) => {
  for (let index = startIndex; index < drawPhaseSkillOrder.length; index += 1) {
    const skillName = drawPhaseSkillOrder[index];

    if (skillName === "双雄" && hasSkill(seat, "双雄")) {
      if (seat.controller === "human") {
        game.pendingAction = {
          type: "draw_skill_response",
          seatId: seat.id,
          skillName,
          nextSkillIndex: index + 1,
          message: `${seat.general.name} 可以发动【双雄】，放弃摸牌并进行判定，获得判定牌。`,
        };
        appendLog(game, game.pendingAction.message);
        return;
      }
      resolveShuangxiong(game, seat);
      return;
    }

    if (skillName === "突袭" && hasSkill(seat, "突袭")) {
      const validTargetIds = getTuxiTargetIds(game, seat);
      if (validTargetIds.length > 0) {
        if (seat.controller === "human") {
          game.pendingAction = {
            type: "tuxi_response",
            seatId: seat.id,
            validTargetIds,
            nextSkillIndex: index + 1,
            message: `${seat.general.name} 可以发动【突袭】，选择至多两名有手牌的角色，各获得其一张手牌。`,
          };
          appendLog(game, game.pendingAction.message);
          return;
        }
        if (resolveTuxiFromTargets(game, seat, validTargetIds.slice(0, 2))) {
          return;
        }
      }
    }

    if (skillName === "裸衣" && hasSkill(seat, "裸衣")) {
      if (seat.controller === "human") {
        game.pendingAction = {
          type: "draw_skill_response",
          seatId: seat.id,
          skillName,
          nextSkillIndex: index + 1,
          message: `${seat.general.name} 可以发动【裸衣】，少摸一张牌，本回合【杀】和【决斗】伤害 +1。`,
        };
        appendLog(game, game.pendingAction.message);
        return;
      }
      drawNormalPhaseCards(game, seat, shouldUseLuoyi(game, seat));
      return;
    }
  }

  drawNormalPhaseCards(game, seat);
};

const resolveGuanxing = (game: GameState, seat: Seat) => {
  if (!hasSkill(seat, "观星")) {
    return;
  }

  recycleDiscardIntoDraw(game);
  const count = Math.min(5, game.seats.filter((item) => item.alive).length, game.piles.draw.length);
  if (count <= 0) {
    appendLog(game, `${seat.general.name} 发动【观星】，但牌堆为空。`);
    return;
  }

  const viewed = drawTopCards(game, count);
  const priority = (card: DeckInstance) => {
    if (seat.hp < seat.maxHp && isTao(card)) return 0;
    if (isSha(card) || card.card_id === "juedou") return 1;
    if (isTrick(card) && card.card_id !== "wuxiekeji") return 2;
    if (isEquipment(card)) return 3;
    if (isShan(card)) return 4;
    return 5;
  };
  viewed.sort((a, b) => priority(a) - priority(b));
  game.piles.draw.unshift(...viewed);
  appendLog(game, `${seat.general.name} 发动【观星】，调整牌堆顶 ${count} 张牌。`);
};

type EndPhaseSkillName = "据守" | "闭月";
const endPhaseSkillOrder: EndPhaseSkillName[] = ["据守", "闭月"];

const resolveEndPhaseSkillEffect = (
  game: GameState,
  seat: Seat,
  skillName: EndPhaseSkillName,
) => {
  if (skillName === "据守") {
    drawFromPile(game, seat, 3);
    appendLog(game, `${seat.general.name} 发动【据守】，摸3张牌。`);
    return;
  }

  if (skillName === "闭月") {
    drawFromPile(game, seat, 1);
    appendLog(game, `${seat.general.name} 发动【闭月】，摸1张牌。`);
  }
};

const continueEndPhaseSkills = (
  game: GameState,
  seat: Seat,
  startIndex = 0,
) => {
  for (let index = startIndex; index < endPhaseSkillOrder.length; index += 1) {
    const skillName = endPhaseSkillOrder[index];
    if (!hasSkill(seat, skillName)) {
      continue;
    }

    if (seat.controller === "human" && skillName !== "闭月") {
      game.pendingAction = {
        type: "end_skill_response",
        seatId: seat.id,
        skillName,
        nextSkillIndex: index + 1,
        message:
          skillName === "据守"
            ? `${seat.general.name} 可以发动【据守】，摸3张牌。`
            : `${seat.general.name} 可以发动【闭月】，摸1张牌。`,
      };
      appendLog(game, game.pendingAction.message);
      return true;
    }

    resolveEndPhaseSkillEffect(game, seat, skillName);
  }
  return false;
};

const triggerJizhi = (game: GameState, seat: Seat, card: DeckInstance) => {
  if (hasSkill(seat, "集智") && isTrick(card) && !isDelayedTrick(card)) {
    drawFromPile(game, seat, 1);
    appendLog(game, `${seat.general.name} 发动【集智】，摸1张牌。`);
  }
};

type DelayedJudgeResult = Extract<PendingAction, { type: "tiandu_response" }>["result"];
type DelayedJudgeContext = {
  judgeOwnerSeatId: number;
  trick: DeckInstance;
  result: DelayedJudgeResult;
};

const delayedJudgeShouldReplace =
  (trick: DeckInstance, judgeOwner: Seat) =>
  (replacer: Seat, candidate: DeckInstance, current: DeckInstance) => {
    const targetIsAlly = areStrategicAllies(replacer, judgeOwner);
    if (trick.card_id === "lebusishu") {
      const currentHit = !isEffectiveHeart(judgeOwner, current);
      const candidateHit = !isEffectiveHeart(judgeOwner, candidate);
      return targetIsAlly ? currentHit && !candidateHit : !currentHit && candidateHit;
    }
    if (trick.card_id === "bingliangcunduan") {
      const currentHit = !isClub(current);
      const candidateHit = !isClub(candidate);
      return targetIsAlly ? currentHit && !candidateHit : !currentHit && candidateHit;
    }
    if (trick.card_id === "shandian") {
      const isLightningHit = (card: DeckInstance) =>
        isEffectiveSpade(judgeOwner, card) && rankNumber(card) >= 2 && rankNumber(card) <= 9;
      const currentHit = isLightningHit(current);
      const candidateHit = isLightningHit(candidate);
      return targetIsAlly ? currentHit && !candidateHit : !currentHit && candidateHit;
    }
    return false;
  };

const beginJudgeReplacementPrompt = (
  game: GameState,
  judgeOwner: Seat,
  trick: DeckInstance,
  judgeCard: DeckInstance,
) => {
  const replacer = game.seats.find(
    (seat) =>
      seat.alive &&
      seat.controller === "human" &&
      seat.hand.some((card) => canUseJudgeReplacementCard(seat, card)),
  );
  if (!replacer) {
    return false;
  }

  const replaceableCardIds = replacer.hand
    .filter((card) => canUseJudgeReplacementCard(replacer, card))
    .map((card) => card.instance_id);
  game.pendingAction = {
    type: "judge_replace_response",
    judgeOwnerSeatId: judgeOwner.id,
    replacerSeatId: replacer.id,
    trick,
    judgeCard,
    replaceableCardIds,
    message: `${judgeOwner.general.name} 的${formatCard(trick)}判定牌为${formatCard(judgeCard)}，${replacer.general.name}可以发动【${judgeReplacementSkillName(replacer, replacer.hand.find((card) => replaceableCardIds.includes(card.instance_id)) ?? judgeCard)}】改判。`,
  };
  appendLog(game, game.pendingAction.message);
  return true;
};

const finishJudgeCardForDelayed = (
  game: GameState,
  judgeOwner: Seat,
  judgeCard: DeckInstance,
  context: DelayedJudgeContext,
) => {
  if (judgeOwner.controller === "human" && hasSkill(judgeOwner, "天妒")) {
    game.pendingAction = {
      type: "tiandu_response",
      judgeOwnerSeatId: judgeOwner.id,
      trick: context.trick,
      judgeCard,
      result: context.result,
      message: `${judgeOwner.general.name} 可以发动【天妒】，获得判定牌${formatCard(judgeCard)}。`,
    };
    appendLog(game, game.pendingAction.message);
    return true;
  }

  finishJudgeCard(game, judgeOwner, judgeCard);
  return false;
};

const continueAfterDelayedJudgeResult = (
  game: GameState,
  context: DelayedJudgeContext,
  shouldContinueJudgeArea: boolean,
) => {
  const seat = game.seats[context.judgeOwnerSeatId];
  if (!seat?.alive || game.pendingAction || game.winner) {
    return;
  }

  if (context.result === "lebusishu_hit") {
    askWuxieForDelayed(
      game,
      seat,
      context.trick,
      "delayed_skip_play",
      `${seat.general.name} 的${formatCard(context.trick)}判定生效，可以使用【无懈可击】抵消跳过出牌。`,
    );
  } else if (context.result === "bingliangcunduan_hit") {
    askWuxieForDelayed(
      game,
      seat,
      context.trick,
      "delayed_skip_draw",
      `${seat.general.name} 的${formatCard(context.trick)}判定生效，可以使用【无懈可击】抵消跳过摸牌。`,
    );
  } else if (context.result === "shandian_hit") {
    askWuxieForDelayed(
      game,
      seat,
      context.trick,
      "delayed_damage",
      `${seat.general.name} 的${formatCard(context.trick)}判定命中，可以使用【无懈可击】抵消雷电伤害。`,
      3,
      "thunder",
    );
  } else if (context.result.endsWith("_pass")) {
    setLastEffect(game, seat, context.trick, `${seat.general.name} 结算${formatCard(context.trick)}。`, seat, "通过");
  }

  if (!game.pendingAction && !game.winner && shouldContinueJudgeArea) {
    processJudgeArea(game, seat);
  }
};

const resolveDelayedTrickJudge = (
  game: GameState,
  seat: Seat,
  trick: DeckInstance,
  judgeCard: DeckInstance,
  shouldContinueJudgeArea: boolean,
) => {
  let result: DelayedJudgeResult = "unknown";
  if (trick.card_id === "lebusishu") {
    discardCards(game, [trick]);
    const hit = !isEffectiveHeart(seat, judgeCard);
    result = hit ? "lebusishu_hit" : "lebusishu_pass";
    appendLog(game, `${seat.general.name} 的${formatCard(trick)}判定为${formatCard(judgeCard)}，${hit ? "效果生效" : "不生效"}。`);
  } else if (trick.card_id === "bingliangcunduan") {
    discardCards(game, [trick]);
    const hit = !isClub(judgeCard);
    result = hit ? "bingliangcunduan_hit" : "bingliangcunduan_pass";
    appendLog(game, `${seat.general.name} 的${formatCard(trick)}判定为${formatCard(judgeCard)}，${hit ? "效果生效" : "不生效"}。`);
  } else if (trick.card_id === "shandian") {
    const hit = isEffectiveSpade(seat, judgeCard) && rankNumber(judgeCard) >= 2 && rankNumber(judgeCard) <= 9;
    result = hit ? "shandian_hit" : "shandian_pass";
    if (hit) {
      discardCards(game, [trick]);
      appendLog(game, `${seat.general.name} 的${formatCard(trick)}判定为${formatCard(judgeCard)}，闪电命中。`);
    } else {
      const nextSeat = game.seats[nextAliveSeatId(game, seat.id)];
      nextSeat.judgeArea.push(trick);
      appendLog(game, `${seat.general.name} 的${formatCard(trick)}判定为${formatCard(judgeCard)}，移动给 ${nextSeat.general.name}。`);
      setLastEffect(game, seat, trick, `${formatCard(trick)}移动给 ${nextSeat.general.name}。`, nextSeat, "传递");
    }
  } else {
    discardCards(game, [trick]);
    appendLog(game, `${seat.general.name} 的${formatCard(trick)}判定为${formatCard(judgeCard)}。`);
  }

  const context = { judgeOwnerSeatId: seat.id, trick, result };
  if (finishJudgeCardForDelayed(game, seat, judgeCard, context)) {
    return;
  }
  continueAfterDelayedJudgeResult(game, context, shouldContinueJudgeArea);
};

const processJudgeArea = (game: GameState, seat: Seat) => {
  if (seat.judgeArea.length === 0) {
    appendLog(game, `${seat.general.name} 判定区为空。`);
    return;
  }

  while (seat.judgeArea.length > 0) {
    const trick = seat.judgeArea.shift();
    if (!trick) {
      break;
    }
    let judgeCard = drawJudgeCard(game);
    if (!judgeCard) {
      discardCards(game, [trick]);
      appendLog(game, `${seat.general.name} 的${formatCard(trick)}因牌堆为空直接弃置。`);
      continue;
    }

    if (beginJudgeReplacementPrompt(game, seat, trick, judgeCard)) {
      return;
    }

    judgeCard = replaceJudgeCard(
      game,
      seat,
      judgeCard,
      delayedJudgeShouldReplace(trick, seat),
    );
    resolveDelayedTrickJudge(game, seat, trick, judgeCard, false);

    if (game.pendingAction || game.winner) {
      return;
    }
  }
};

export const playCardFromHand = (
  source: GameState,
  actorSeatId: number,
  cardInstanceId: string,
  targetSeatId?: number,
  extraTargetSeatIds: number[] = [],
): GameState => {
  const game = cloneGame(source);
  const actor = game.seats[actorSeatId];
  if (!actor) {
    return game;
  }

  const card = actor.hand.find((item) => item.instance_id === cardInstanceId);
  if (!card) {
    appendLog(game, "手牌不存在，无法使用。");
    return game;
  }

  const info = getCardPlayInfo(game, actorSeatId, card);
  if (!info.canPlay) {
    appendLog(game, info.reason);
    return game;
  }

  if (isSha(card)) {
    const target = targetSeatId === undefined ? null : game.seats[targetSeatId];
    if (!target || !info.validTargetIds.includes(target.id)) {
      appendLog(game, "请选择一名合法的杀目标。");
      return game;
    }

    const used = removeCardFromHand(actor, cardInstanceId, game);
    if (!used) {
      return game;
    }
    discardCards(game, [used]);
    const damage = 1 + game.turn.drunkShaBonus;
    markShaPlayedThisTurn(game, actor);
    game.turn.drunkShaBonus = 0;
    resolveShaAgainstTarget(game, actor, target, used, damage);
    evaluateWinner(game);
    return game;
  }

  if (isTao(card) && (actor.hp < actor.maxHp || !isCardUsableAsSha(actor, card))) {
    const used = removeCardFromHand(actor, cardInstanceId, game);
    if (!used) {
      return game;
    }
    discardCards(game, [used]);
    setLastEffect(game, actor, used, `${actor.general.name} 使用${formatCard(used)}，回复 1 点体力。`, undefined, "+1");
    healSeat(game, actor, 1, formatCard(used));
    return game;
  }

  if (isJiu(card) && (!game.turn.jiuUsed || !isCardUsableAsSha(actor, card))) {
    const used = removeCardFromHand(actor, cardInstanceId, game);
    if (!used) {
      return game;
    }
    discardCards(game, [used]);
    game.turn.jiuUsed = true;
    game.turn.drunkShaBonus = 1;
    const message = `${actor.general.name} 使用${formatCard(used)}，本回合下一张杀伤害 +1。`;
    appendLog(game, message);
    setLastEffect(game, actor, used, message, undefined, "+杀");
    return game;
  }

  if (
    (card.card_id === "tiesuolianhuan" || isCardUsableAsTiesuo(actor, card)) &&
    targetSeatId === undefined
  ) {
    const used = removeCardFromHand(actor, cardInstanceId, game);
    if (!used) {
      return game;
    }
    const playedCard =
      used.card_id === "tiesuolianhuan"
        ? used
        : makeVirtualCard(used, "tiesuolianhuan", "铁索连环");
    discardCards(game, [playedCard]);
    const message = `${actor.general.name} 重铸${formatCard(playedCard)}，摸1张牌。`;
    appendLog(game, message);
    setLastEffect(game, actor, playedCard, message, undefined, "+1");
    drawFromPile(game, actor, 1);
    return game;
  }

  const virtualTargetedCard =
    isCardUsableAsGuohe(actor, card)
      ? makeVirtualCard(card, "guohechaiqiao", "过河拆桥")
      : isCardUsableAsLebu(actor, card)
        ? makeVirtualCard(card, "lebusishu", "乐不思蜀")
        : isCardUsableAsTiesuo(actor, card)
          ? makeVirtualCard(card, "tiesuolianhuan", "铁索连环")
          : isCardUsableAsShuangxiongDuel(game, actor, card)
            ? makeVirtualCard(card, "juedou", "决斗")
            : null;
  const effectiveTargetedCard = virtualTargetedCard ?? card;

  if (targetedTrickIds.has(card.card_id) || virtualTargetedCard) {
    const target = targetSeatId === undefined ? null : game.seats[targetSeatId];
    if (!target || !info.validTargetIds.includes(target.id)) {
      appendLog(game, "请选择一名合法的锦囊目标。");
      return game;
    }

    const extraTargets = extraTargetSeatIds
      .map((seatId) => game.seats[seatId])
      .filter((seat): seat is Seat => Boolean(seat?.alive));
    if (effectiveTargetedCard.card_id === "jiedaosharen") {
      const victim = extraTargets[0] ?? null;
      if (!victim || !getJiedaoVictimIds(game, target.id).includes(victim.id)) {
        appendLog(game, "请选择借刀杀人的第二目标。");
        return game;
      }
    }
    if (effectiveTargetedCard.card_id === "tiesuolianhuan") {
      const targetIds = [...new Set([target.id, ...extraTargets.map((seat) => seat.id)])];
      if (targetIds.length < 1 || targetIds.length > 2) {
        appendLog(game, "铁索连环需要选择 1 至 2 名目标，或选择重铸。");
        return game;
      }
      if (!targetIds.every((seatId) => info.validTargetIds.includes(seatId))) {
        appendLog(game, "铁索连环目标不合法。");
        return game;
      }
    }

    const used = removeCardFromHand(actor, cardInstanceId, game);
    if (!used) {
      return game;
    }
    const playedCard = virtualTargetedCard
      ? makeVirtualCard(used, virtualTargetedCard.card_id, virtualTargetedCard.name)
      : used;
    if (!isDelayedTrick(playedCard)) {
      discardCards(game, [playedCard]);
    }
    resolveTargetedTrick(game, actor, playedCard, target, true, extraTargets);
    if (!isDelayedTrick(playedCard)) {
      triggerJizhi(game, actor, playedCard);
    }
    evaluateWinner(game);
    return game;
  }

  if (instantTrickIds.has(card.card_id) || card.card_id === "shandian") {
    const used = removeCardFromHand(actor, cardInstanceId, game);
    if (!used) {
      return game;
    }
    if (used.card_id !== "shandian") {
      discardCards(game, [used]);
    }
    resolveInstantTrick(game, actor, used);
    if (used.card_id !== "shandian") {
      triggerJizhi(game, actor, used);
    }
    evaluateWinner(game);
    return game;
  }

  if (isEquipment(card)) {
    const used = removeCardFromHand(actor, cardInstanceId, game);
    if (!used) {
      return game;
    }
    equipCard(game, actor, used);
    return game;
  }

  if (!isSha(card) && isCardUsableAsSha(actor, card)) {
    const target = targetSeatId === undefined ? null : game.seats[targetSeatId];
    if (!target || !info.validTargetIds.includes(target.id)) {
      appendLog(game, "请选择一名合法的杀目标。");
      return game;
    }

    const used = removeCardFromHand(actor, cardInstanceId, game);
    if (!used) {
      return game;
    }
    discardCards(game, [used]);
    const damage = 1 + game.turn.drunkShaBonus;
    markShaPlayedThisTurn(game, actor);
    game.turn.drunkShaBonus = 0;
    appendLog(game, `${actor.general.name} 将${formatCard(used)}当【杀】使用。`);
    resolveShaAgainstTarget(game, actor, target, used, damage);
    evaluateWinner(game);
    return game;
  }

  appendLog(game, "这张牌的效果尚未接入。");
  return game;
};

export const respondToSha = (source: GameState, useShan: boolean): GameState => {
  const game = cloneGame(source);
  const pending = game.pendingAction;
  if (!pending || pending.type !== "shan_response") {
    return game;
  }

  const target = game.seats[pending.targetSeatId];
  if (!target?.alive) {
    game.pendingAction = null;
    return game;
  }

  game.pendingAction = null;

  if (useShan && pending.canRespond) {
    const shanIndex = findCardIndex(target, (card) => isCardUsableAsShan(target, card));
    const shan =
      shanIndex >= 0
        ? removeCardAt(target, shanIndex, game)
        : playLordResponseCard(game, target, "shan");
    if (shan) {
      if (shanIndex >= 0) {
        discardCards(game, [shan]);
      }
      const respondedResponses = pending.respondedResponses + 1;
      const remainingResponses = pending.requiredResponses - respondedResponses;
      const message =
        remainingResponses > 0
          ? `${target.general.name} 打出【闪】，还需 ${remainingResponses} 张【闪】才能抵消【${pending.cardName}】。`
          : `${target.general.name} 打出【闪】，抵消【${pending.cardName}】。`;
      appendLog(game, message);
      setLastEffect(game, target, shan, message, game.seats[pending.sourceSeatId], "闪");
      if (shanIndex >= 0) {
        triggerLeijiAfterShan(game, target, {
          kind: "shan_response",
          sourceSeatId: pending.sourceSeatId,
          targetSeatId: pending.targetSeatId,
          card: pending.card,
          cardName: pending.cardName,
          damage: pending.damage,
          damageType: pending.damageType,
          requiredResponses: pending.requiredResponses,
          respondedResponses,
        });
      }
      if (game.pendingAction || game.winner) {
        return game;
      }
      if (remainingResponses > 0) {
        game.pendingAction = {
          ...pending,
          respondedResponses,
          canRespond:
            target.hand.some((card) => isCardUsableAsShan(target, card)) ||
            canUseLordResponse(game, target, "shan"),
          message,
        };
        return game;
      }
      const sourceSeat = game.seats[pending.sourceSeatId];
      if (sourceSeat?.alive && hasSkill(sourceSeat, "猛进") && hasAnyZoneCard(target)) {
        const removed = removeFirstZoneCard(target, game);
        if (removed.card) {
          discardCards(game, [removed.card]);
          appendLog(
            game,
            `${sourceSeat.general.name} 发动【猛进】，弃置 ${target.general.name} 的${removed.zone}${formatCard(removed.card)}。`,
          );
        }
      }
      return game;
    }
    appendLog(game, `${target.general.name} 没有【闪】。`);
  }

  game.pendingAction = null;
  applyDamage(
    game,
    pending.sourceSeatId,
    target,
    pending.damage,
    pending.damageType,
    pending.card,
  );
  evaluateWinner(game);
  return game;
};

export const respondToLiuli = (
  source: GameState,
  cardInstanceId: string | null,
  redirectSeatId: number | null,
): GameState => {
  const game = cloneGame(source);
  const pending = game.pendingAction;
  if (!pending || pending.type !== "liuli_response") {
    return game;
  }

  const sourceSeat = game.seats[pending.sourceSeatId];
  const targetSeat = game.seats[pending.targetSeatId];
  game.pendingAction = null;
  if (!sourceSeat?.alive || !targetSeat?.alive) {
    return game;
  }

  if (
    cardInstanceId &&
    redirectSeatId !== null &&
    pending.validTargetIds.includes(redirectSeatId)
  ) {
    const redirectTarget = game.seats[redirectSeatId];
    const cost = removeCardFromHand(targetSeat, cardInstanceId, game);
    if (redirectTarget?.alive && cost) {
      discardCards(game, [cost]);
      appendLog(
        game,
        `${targetSeat.general.name} 发动【流离】，弃置${formatCard(cost)}，将${formatCard(pending.card)}转移给 ${redirectTarget.general.name}。`,
      );
      resolveShaAgainstTarget(game, sourceSeat, redirectTarget, pending.card, pending.damage);
      evaluateWinner(game);
      return game;
    }
  }

  appendLog(game, `${targetSeat.general.name} 不发动【流离】。`);
  resolveShaAfterLiuli(game, sourceSeat, targetSeat, pending.card, pending.damage);
  evaluateWinner(game);
  return game;
};

export const respondToTianxiang = (
  source: GameState,
  cardInstanceId: string | null,
  redirectSeatId: number | null,
): GameState => {
  const game = cloneGame(source);
  const pending = game.pendingAction;
  if (!pending || pending.type !== "tianxiang_response") {
    return game;
  }

  const targetSeat = game.seats[pending.targetSeatId];
  game.pendingAction = null;
  if (!targetSeat?.alive) {
    return game;
  }

  if (
    cardInstanceId &&
    redirectSeatId !== null &&
    pending.validTargetIds.includes(redirectSeatId)
  ) {
    const redirectTarget = game.seats[redirectSeatId];
    const cost = targetSeat.hand.find((card) => card.instance_id === cardInstanceId);
    if (redirectTarget?.alive && cost && isEffectiveHeart(targetSeat, cost)) {
      removeCardFromHand(targetSeat, cardInstanceId, game);
      discardCards(game, [cost]);
      appendLog(
        game,
        `${targetSeat.general.name} 发动【天香】，弃置红桃牌${formatCard(cost)}，将伤害转移给 ${redirectTarget.general.name}。`,
      );
      applyDamage(
        game,
        pending.sourceSeatId,
        redirectTarget,
        pending.amount,
        pending.damageType,
        pending.damageCard,
      );
      if (!game.pendingAction && !game.winner && redirectTarget.alive) {
        const lostHp = Math.max(0, redirectTarget.maxHp - redirectTarget.hp);
        if (lostHp > 0) {
          drawFromPile(game, redirectTarget, lostHp);
          appendLog(game, `${redirectTarget.general.name} 因【天香】摸 ${lostHp} 张牌。`);
        }
      }
      evaluateWinner(game);
      return game;
    }
  }

  appendLog(game, `${targetSeat.general.name} 不发动【天香】。`);
  applyDamageInternal(
    game,
    pending.sourceSeatId,
    targetSeat,
    pending.amount,
    pending.damageType,
    pending.damageCard,
    { skipTianxiang: true },
  );
  evaluateWinner(game);
  return game;
};

export const respondToBeige = (
  source: GameState,
  cardInstanceId: string | null,
): GameState => {
  const game = cloneGame(source);
  const pending = game.pendingAction;
  if (!pending || pending.type !== "beige_response") {
    return game;
  }

  const singer = game.seats[pending.singerSeatId];
  const targetSeat = game.seats[pending.targetSeatId];
  const sourceSeat =
    pending.sourceSeatId === null ? null : game.seats[pending.sourceSeatId] ?? null;
  game.pendingAction = null;
  if (!targetSeat?.alive) {
    return game;
  }

  const cost = singer?.alive && cardInstanceId
    ? removeCardFromHand(singer, cardInstanceId, game)
    : null;
  if (singer?.alive && cost) {
    resolveBeigeEffect(game, singer, targetSeat, sourceSeat, cost);
  } else {
    appendLog(game, `${singer?.general.name ?? "蔡文姬"} 不发动【悲歌】。`);
  }

  if (!game.pendingAction && !game.winner) {
    continueAfterDamageAndBeige(
      game,
      pending.sourceSeatId,
      targetSeat,
      pending.amount,
      pending.damageType,
      pending.damageCard,
      pending.transmittedTargetIds,
    );
  }
  evaluateWinner(game);
  return game;
};

type DamageSkillPending = Extract<
  PendingAction,
  {
    type:
      | "fankui_response"
      | "yiji_response"
      | "jieming_response"
      | "jianxiong_response"
      | "ganglie_response";
  }
>;

const contextFromDamagePending = (pending: DamageSkillPending): DamageSkillContext => ({
  sourceSeatId: pending.sourceSeatId,
  targetSeatId: pending.targetSeatId,
  amount: pending.amount,
  damageType: pending.damageType,
  damageCard: pending.damageCard,
  transmittedTargetIds: [...pending.transmittedTargetIds],
});

const continueAfterDamageSkillPending = (
  game: GameState,
  pending: DamageSkillPending,
) => {
  const context = contextFromDamagePending(pending);
  const targetSeat = game.seats[pending.targetSeatId];
  if (targetSeat?.alive && targetSeat.hp > 0) {
    continueDamagedSeatSkills(game, context, pending.nextSkillIndex);
  }
  if (!game.pendingAction && !game.winner) {
    finishAfterDamagedSeatSkills(game, context);
  }
};

export const respondToFankui = (
  source: GameState,
  optionKey: string | null,
): GameState => {
  const game = cloneGame(source);
  const pending = game.pendingAction;
  if (!pending || pending.type !== "fankui_response") {
    return game;
  }

  const targetSeat = game.seats[pending.targetSeatId];
  const sourceSeat = game.seats[pending.sourceSeatId];
  game.pendingAction = null;
  if (!targetSeat?.alive || !sourceSeat?.alive) {
    return game;
  }

  if (optionKey && pending.cardOptions.some((option) => option.key === optionKey)) {
    gainFankuiCard(game, targetSeat, sourceSeat, optionKey);
  } else {
    appendLog(game, `${targetSeat.general.name} 不发动【反馈】。`);
  }

  continueAfterDamageSkillPending(game, pending);
  evaluateWinner(game);
  return game;
};

export const respondToYiji = (
  source: GameState,
  recipientSeatId: number | null,
): GameState => {
  const game = cloneGame(source);
  const pending = game.pendingAction;
  if (!pending || pending.type !== "yiji_response") {
    return game;
  }

  const targetSeat = game.seats[pending.targetSeatId];
  game.pendingAction = null;
  if (!targetSeat?.alive) {
    return game;
  }

  if (recipientSeatId !== null && pending.validTargetIds.includes(recipientSeatId)) {
    const recipient = game.seats[recipientSeatId];
    if (recipient?.alive) {
      drawFromPile(game, recipient, pending.drawCount);
      appendLog(game, `${targetSeat.general.name} 发动【遗计】，令 ${recipient.general.name} 获得 ${pending.drawCount} 张牌。`);
    }
  } else {
    appendLog(game, `${targetSeat.general.name} 不发动【遗计】。`);
  }

  continueAfterDamageSkillPending(game, pending);
  evaluateWinner(game);
  return game;
};

export const respondToJieming = (
  source: GameState,
  recipientSeatId: number | null,
): GameState => {
  const game = cloneGame(source);
  const pending = game.pendingAction;
  if (!pending || pending.type !== "jieming_response") {
    return game;
  }

  const targetSeat = game.seats[pending.targetSeatId];
  game.pendingAction = null;
  if (!targetSeat?.alive) {
    return game;
  }

  if (recipientSeatId !== null && pending.validTargetIds.includes(recipientSeatId)) {
    const recipient = game.seats[recipientSeatId];
    if (recipient?.alive) {
      resolveJiemingToTarget(game, targetSeat, recipient);
    }
  } else {
    appendLog(game, `${targetSeat.general.name} 不发动【节命】。`);
  }

  continueAfterDamageSkillPending(game, pending);
  evaluateWinner(game);
  return game;
};

export const respondToJianxiong = (
  source: GameState,
  useSkill: boolean,
): GameState => {
  const game = cloneGame(source);
  const pending = game.pendingAction;
  if (!pending || pending.type !== "jianxiong_response") {
    return game;
  }

  const targetSeat = game.seats[pending.targetSeatId];
  game.pendingAction = null;
  if (!targetSeat?.alive) {
    return game;
  }

  if (useSkill && isDamageCardInDiscard(game, pending.damageCard)) {
    resolveJianxiong(game, targetSeat, pending.damageCard);
  } else {
    appendLog(game, `${targetSeat.general.name} 不发动【奸雄】。`);
  }

  continueAfterDamageSkillPending(game, pending);
  evaluateWinner(game);
  return game;
};

export const respondToGanglie = (
  source: GameState,
  useSkill: boolean,
): GameState => {
  const game = cloneGame(source);
  const pending = game.pendingAction;
  if (!pending || pending.type !== "ganglie_response") {
    return game;
  }

  const targetSeat = game.seats[pending.targetSeatId];
  const sourceSeat = game.seats[pending.sourceSeatId];
  game.pendingAction = null;
  if (!targetSeat?.alive || !sourceSeat?.alive) {
    return game;
  }

  if (useSkill) {
    startSkillJudge(game, {
      type: "ganglie",
      sourceSeatId: pending.sourceSeatId,
      targetSeatId: pending.targetSeatId,
      amount: pending.amount,
      damageType: pending.damageType,
      damageCard: pending.damageCard,
      transmittedTargetIds: [...pending.transmittedTargetIds],
      nextSkillIndex: pending.nextSkillIndex,
    });
  } else {
    appendLog(game, `${targetSeat.general.name} 不发动【刚烈】。`);
  }

  if (!useSkill && !game.pendingAction && !game.winner) {
    continueAfterDamageSkillPending(game, pending);
  }
  evaluateWinner(game);
  return game;
};

export const respondToXiaoji = (
  source: GameState,
  useSkill: boolean,
): GameState => {
  const game = cloneGame(source);
  const pending = game.pendingAction;
  if (!pending || pending.type !== "xiaoji_response") {
    return game;
  }

  const seat = game.seats[pending.seatId];
  game.pendingAction = null;
  if (!seat?.alive) {
    return game;
  }

  if (useSkill) {
    drawFromPile(game, seat, 2);
    appendLog(game, `${seat.general.name} 发动【枭姬】，失去装备${formatCard(pending.card)}后摸2张牌。`);
  } else {
    appendLog(game, `${seat.general.name} 不发动【枭姬】。`);
  }
  return game;
};

export const respondToLeiji = (
  source: GameState,
  targetSeatId: number | null,
): GameState => {
  const game = cloneGame(source);
  const pending = game.pendingAction;
  if (!pending || pending.type !== "leiji_response") {
    return game;
  }

  const actor = game.seats[pending.actorSeatId];
  game.pendingAction = null;
  if (!actor?.alive) {
    return game;
  }

  if (targetSeatId !== null && pending.validTargetIds.includes(targetSeatId)) {
    const target = game.seats[targetSeatId];
    if (target?.alive) {
      resolveLeijiAgainstTarget(game, actor, target, pending.resume);
    }
  } else {
    appendLog(game, `${actor.general.name} 不发动【雷击】。`);
  }

  if (targetSeatId === null && !game.pendingAction && !game.winner) {
    resumeAfterLeiji(game, pending.resume);
  }
  evaluateWinner(game);
  return game;
};

export const respondToBasicCard = (
  source: GameState,
  action: "card" | "wuxie" | "pass",
): GameState => {
  const game = cloneGame(source);
  const pending = game.pendingAction;
  if (!pending || pending.type !== "basic_card_response") {
    return game;
  }

  const target = game.seats[pending.targetSeatId];
  if (!target?.alive || !game.seats[pending.sourceSeatId]) {
    game.pendingAction = null;
    return game;
  }

  game.pendingAction = null;

  if (action === "wuxie") {
    const wuxiePending: WuxiePending = {
      type: "wuxie_response",
      sourceSeatId: pending.sourceSeatId,
      targetSeatId: target.id,
      originalTargetSeatId: target.id,
      responderSeatId: target.id,
      card: pending.card,
      effect: "mass_damage",
      damage: pending.damage,
      damageType: pending.damageType,
      remainingTargetIds: pending.remainingTargetIds,
      requiredCard: pending.requiredCard,
      nullified: false,
      checkedSeatIds: [],
      chainSeatIds: [],
      message: pending.message,
    };
    const usedPending = playWuxieIntoChain(game, wuxiePending, target);
    if (usedPending) {
      continueWuxieContest(game, usedPending, nextAliveSeatId(game, target.id));
      return game;
    }
    action = "pass";
  }

  if (action === "card") {
    const responseIndex = findCardIndex(
      target,
      responsePredicateForSeat(target, pending.requiredCard),
    );
    const response =
      responseIndex >= 0
        ? removeCardAt(target, responseIndex, game)
        : playLordResponseCard(game, target, pending.requiredCard);
    if (response) {
      if (responseIndex >= 0) {
        discardCards(game, [response]);
      }
      if (pending.requiredCard === "sha") {
        markShaPlayedThisTurn(game, target);
      }
      const message = `${target.general.name} 打出${formatCard(response)}响应【${pending.cardName}】。`;
      appendLog(game, message);
      setLastEffect(game, target, response, message, game.seats[pending.sourceSeatId], responseCardName(pending.requiredCard));
      if (pending.requiredCard === "shan" && responseIndex >= 0) {
        triggerLeijiAfterShan(game, target, {
          kind: "basic_card_response",
          sourceSeatId: pending.sourceSeatId,
          targetSeatId: pending.targetSeatId,
          card: pending.card,
          cardName: pending.cardName,
          requiredCard: pending.requiredCard,
          damage: pending.damage,
          damageType: pending.damageType,
          remainingTargetIds: [...pending.remainingTargetIds],
        });
        if (game.pendingAction || game.winner) {
          return game;
        }
      }
    } else {
      action = "pass";
    }
  }

  if (action === "pass") {
    appendLog(game, `${target.general.name} 未能响应【${pending.cardName}】。`);
    applyDamage(game, pending.sourceSeatId, target, pending.damage, pending.damageType, pending.card);
    evaluateWinner(game);
  }

  if (!game.pendingAction && !game.winner) {
    continueMassResponseTrick(
      game,
      pending.sourceSeatId,
      pending.card,
      pending.requiredCard,
      pending.remainingTargetIds,
      pending.damage,
      pending.damageType,
    );
  }

  return game;
};

export const respondToWuxie = (
  source: GameState,
  useWuxie: boolean,
): GameState => {
  const game = cloneGame(source);
  const pending = game.pendingAction;
  if (!pending || pending.type !== "wuxie_response") {
    return game;
  }

  const responder = game.seats[pending.responderSeatId];
  if (!responder?.alive) {
    game.pendingAction = null;
    return game;
  }

  game.pendingAction = null;

  if (useWuxie) {
    const usedPending = playWuxieIntoChain(game, pending, responder);
    if (usedPending) {
      continueWuxieContest(game, usedPending, nextAliveSeatId(game, responder.id));
      return game;
    }
  }

  continueWuxieContest(
    game,
    {
      ...pending,
      checkedSeatIds: [...new Set([...pending.checkedSeatIds, responder.id])],
    },
    nextAliveSeatId(game, responder.id),
  );

  return game;
};

export const respondToDuelSha = (
  source: GameState,
  useShaCard: boolean,
): GameState => {
  const game = cloneGame(source);
  const pending = game.pendingAction;
  if (!pending || pending.type !== "duel_sha_response") {
    return game;
  }

  const current = game.seats[pending.currentSeatId];
  const opponent = game.seats[pending.opponentSeatId];
  if (!current?.alive || !opponent?.alive) {
    game.pendingAction = null;
    return game;
  }

  game.pendingAction = null;
  if (useShaCard) {
    const shaIndex = findCardIndex(current, (card) => isCardUsableAsSha(current, card));
    const sha =
      shaIndex >= 0
        ? removeCardAt(current, shaIndex, game)
        : playLordResponseCard(game, current, "sha");
    if (sha) {
      if (shaIndex >= 0) {
        discardCards(game, [sha]);
      }
      markShaPlayedThisTurn(game, current);
      const respondedResponses = pending.respondedResponses + 1;
      const remainingResponses = pending.requiredResponses - respondedResponses;
      const message =
        remainingResponses > 0
          ? `${current.general.name} 在${formatCard(pending.card)}中打出${formatCard(sha)}，还需 ${remainingResponses} 张【杀】。`
          : `${current.general.name} 在${formatCard(pending.card)}中打出${formatCard(sha)}。`;
      appendLog(game, message);
      setLastEffect(game, current, sha, message, opponent, "杀");
      if (remainingResponses > 0) {
        game.pendingAction = {
          ...pending,
          respondedResponses,
          canRespond:
            current.hand.some((card) => isCardUsableAsSha(current, card)) ||
            canUseLordResponse(game, current, "sha"),
          message,
        };
        return game;
      }
      continueDuel(
        game,
        pending.sourceSeatId,
        pending.targetSeatId,
        pending.card,
        opponent.id,
        current.id,
        pending.rounds + 1,
      );
      return game;
    }
    appendLog(game, `${current.general.name} 没有可用于决斗的【杀】。`);
  }

  appendLog(game, `${current.general.name} 未能在${formatCard(pending.card)}中打出【杀】。`);
  const damage =
    1 + (opponent.id === pending.sourceSeatId ? getLuoyiDamageBonus(game, opponent, pending.card) : 0);
  applyDamage(game, opponent.id, current, damage, "normal", pending.card);
  evaluateWinner(game);
  return game;
};

export const respondToHuogongDiscard = (
  source: GameState,
  cardInstanceId: string | null,
): GameState => {
  const game = cloneGame(source);
  const pending = game.pendingAction;
  if (!pending || pending.type !== "huogong_discard") {
    return game;
  }

  const actor = game.seats[pending.sourceSeatId];
  const target = game.seats[pending.targetSeatId];
  if (!actor?.alive || !target?.alive) {
    game.pendingAction = null;
    return game;
  }

  game.pendingAction = null;
  if (!cardInstanceId) {
    appendLog(game, `${actor.general.name} 放弃弃置同花色牌，${formatCard(pending.card)}不造成伤害。`);
    return game;
  }

  if (!pending.discardableCardIds.includes(cardInstanceId)) {
    appendLog(game, "请选择一张可用于火攻的同花色手牌。");
    return game;
  }

  const cost = removeCardFromHand(actor, cardInstanceId, game);
  if (!cost) {
    appendLog(game, "火攻弃牌不存在。");
    return game;
  }
  discardCards(game, [cost]);
  const message = `${actor.general.name} 弃置同花色${formatCard(cost)}，${formatCard(pending.card)}对 ${target.general.name} 造成1点火焰伤害。`;
  appendLog(game, message);
  setLastEffect(game, actor, pending.card, message, target, "-1");
  applyDamage(game, actor.id, target, 1, "fire", pending.card);
  evaluateWinner(game);
  return game;
};

export const respondToJiedaoSha = (
  source: GameState,
  useShaCard: boolean,
): GameState => {
  const game = cloneGame(source);
  const pending = game.pendingAction;
  if (!pending || pending.type !== "jiedao_sha_response") {
    return game;
  }

  const actor = game.seats[pending.sourceSeatId];
  const weaponOwner = game.seats[pending.weaponOwnerSeatId];
  const victim = game.seats[pending.victimSeatId];
  if (!actor?.alive || !weaponOwner?.alive || !victim?.alive) {
    game.pendingAction = null;
    return game;
  }

  game.pendingAction = null;
  if (useShaCard) {
    const shaIndex = findCardIndex(weaponOwner, (card) =>
      isCardUsableAsSha(weaponOwner, card),
    );
    if (shaIndex >= 0) {
      const sha = removeCardAt(weaponOwner, shaIndex, game);
      discardCards(game, [sha]);
      markShaPlayedThisTurn(game, weaponOwner);
      const message = `${weaponOwner.general.name} 响应${formatCard(pending.card)}，对 ${victim.general.name} 使用${formatCard(sha)}。`;
      appendLog(game, message);
      setLastEffect(game, weaponOwner, sha, message, victim, "借刀杀");
      resolveShaAgainstTarget(game, weaponOwner, victim, sha, 1);
      evaluateWinner(game);
      return game;
    }
    appendLog(game, `${weaponOwner.general.name} 没有【杀】可响应${formatCard(pending.card)}。`);
  }

  giveWeaponToSource(game, actor, weaponOwner, pending.card, pending.weapon);
  return game;
};

export const respondToWuguSelect = (
  source: GameState,
  cardInstanceId: string,
): GameState => {
  const game = cloneGame(source);
  const pending = game.pendingAction;
  if (!pending || pending.type !== "wugufengdeng_select") {
    return game;
  }

  const responder = game.seats[pending.responderSeatId];
  if (!responder?.alive) {
    game.pendingAction = null;
    continueWuguDistribution(
      game,
      pending.sourceSeatId,
      pending.card,
      pending.remainingSeatIds,
      pending.revealedCards,
    );
    return game;
  }

  const selectedIndex = pending.revealedCards.findIndex(
    (card) => card.instance_id === cardInstanceId,
  );
  if (selectedIndex < 0) {
    appendLog(game, "请选择一张五谷丰登亮出的牌。");
    return game;
  }

  const revealedCards = [...pending.revealedCards];
  const [gained] = revealedCards.splice(selectedIndex, 1);
  responder.hand.push(gained);
  game.pendingAction = null;
  const message = `${responder.general.name} 从${formatCard(pending.card)}获得${formatCard(gained)}。`;
  appendLog(game, message);
  setLastEffect(game, responder, pending.card, message, responder, "+牌");
  continueWuguDistribution(
    game,
    pending.sourceSeatId,
    pending.card,
    pending.remainingSeatIds,
    revealedCards,
  );
  return game;
};

export const playDyingCard = (
  source: GameState,
  cardInstanceId: string,
): GameState => {
  const game = cloneGame(source);
  const pending = game.pendingAction;
  if (!pending || pending.type !== "dying_response") {
    return game;
  }

  const responder = game.seats[pending.responderSeatId];
  const dying = game.seats[pending.dyingSeatId];
  if (!responder?.alive || !dying) {
    game.pendingAction = null;
    return game;
  }

  const card = responder.hand.find((item) => item.instance_id === cardInstanceId);
  if (!card || !canUseCardAsDyingRescue(game, responder, dying, card)) {
    appendLog(game, "这张牌不能用于当前濒死结算。");
    return game;
  }

  useDyingRescueCard(game, responder, dying, card);

  if (dying.hp > 0) {
    appendLog(game, `${dying.general.name} 脱离濒死。`);
    game.pendingAction = null;
    evaluateWinner(game);
    return game;
  }

  const remaining = eligibleDyingCards(game, responder, dying);
  continueDyingResponses(
    game,
    dying.id,
    pending.sourceSeatId,
    remaining.length > 0
      ? pending.checkedSeatIds
      : [...pending.checkedSeatIds, responder.id],
  );
  return game;
};

export const passDyingResponse = (source: GameState): GameState => {
  const game = cloneGame(source);
  const pending = game.pendingAction;
  if (!pending || pending.type !== "dying_response") {
    return game;
  }

  continueDyingResponses(game, pending.dyingSeatId, pending.sourceSeatId, [
    ...pending.checkedSeatIds,
    pending.responderSeatId,
  ]);
  return game;
};

export const getHandLimit = (seat: Seat, game?: GameState) => {
  const base = Math.max(0, seat.hp);
  if (!game || seat.role !== "主公" || !hasSkill(seat, "血裔")) {
    return base;
  }

  const qunAllies = game.seats.filter(
    (other) =>
      other.alive &&
      other.id !== seat.id &&
      other.general.faction === "群",
  ).length;
  return base + qunAllies * 2;
};

export const getDiscardOverflow = (seat: Seat, game?: GameState) =>
  Math.max(0, seat.hand.length - getHandLimit(seat, game));

const autoDiscardToHandLimit = (game: GameState, seat: Seat) => {
  const overflow = getDiscardOverflow(seat, game);
  if (overflow === 0) {
    appendLog(game, `${seat.general.name} 无需弃牌。`);
    return;
  }

  const discarded = seat.hand.splice(seat.hand.length - overflow, overflow);
  game.piles.discard.push(...discarded);
  appendLog(game, `${seat.general.name} 弃 ${discarded.length} 张牌至手牌上限。`);
};

const advanceFromDiscardToEnd = (game: GameState) => {
  game.turn.phase = "结束";
  game.turn.phaseStep += 1;
};

type QiaobianPhase = Extract<PendingAction, { type: "qiaobian_phase" }>["phase"];

const qiaobianPromptKey = (phase: QiaobianPhase) => `巧变询问-${phase}`;

const advanceToNextPhase = (game: GameState) => {
  const currentPhaseIndex = phaseOrder.indexOf(game.turn.phase);
  game.turn.phase = phaseOrder[currentPhaseIndex + 1] ?? "结束";
  game.turn.phaseStep += 1;
};

const canOfferQiaobianPhase = (game: GameState, seat: Seat, phase: QiaobianPhase) =>
  seat.alive &&
  seat.controller === "human" &&
  hasSkill(seat, "巧变") &&
  seat.hand.length > 0 &&
  !game.turn.usedSkills.includes(qiaobianPromptKey(phase));

const beginQiaobianPhasePrompt = (
  game: GameState,
  seat: Seat,
  phase: QiaobianPhase,
) => {
  if (!canOfferQiaobianPhase(game, seat, phase)) {
    return false;
  }
  markSkillUsedThisTurn(game, qiaobianPromptKey(phase));
  game.pendingAction = {
    type: "qiaobian_phase",
    seatId: seat.id,
    phase,
    message: `${seat.general.name} 可以发动【巧变】，弃置一张手牌并跳过${phase}阶段。`,
  };
  appendLog(game, game.pendingAction.message);
  return true;
};

export const offerQiaobianPhase = (
  source: GameState,
  seatId: number,
  phase: QiaobianPhase,
): GameState => {
  const game = cloneGame(source);
  if (game.pendingAction || game.winner || game.turn.phase !== phase) {
    return game;
  }
  const seat = game.seats[seatId];
  if (seat?.id === game.turn.activeSeatId) {
    beginQiaobianPhasePrompt(game, seat, phase);
  }
  return game;
};

const resolveDrawPhaseNormally = (game: GameState, seat: Seat) => {
  if (game.turn.skipDraw) {
    appendLog(game, `${seat.general.name} 跳过摸牌阶段。`);
    return;
  }
  continueDrawPhaseSkills(game, seat);
};

const resolveDiscardOverflow = (game: GameState, seat: Seat) => {
  const overflow = getDiscardOverflow(seat, game);
  if (seat.controller === "human" && overflow > 0) {
    game.pendingAction = {
      type: "discard_cards",
      seatId: seat.id,
      requiredCount: overflow,
      message: `${seat.general.name} 需要弃置 ${overflow} 张手牌。`,
    };
    appendLog(game, game.pendingAction.message);
    return;
  }

  autoDiscardToHandLimit(game, seat);
  advanceFromDiscardToEnd(game);
};

const resolveDiscardPhaseNormally = (game: GameState, seat: Seat) => {
  if (hasSkill(seat, "克己") && !game.turn.shaPlayed) {
    appendLog(game, `${seat.general.name} 发动【克己】，跳过弃牌阶段。`);
    advanceFromDiscardToEnd(game);
    return;
  }

  resolveDiscardOverflow(game, seat);
};

const enterDiscardAfterQiaobianPlay = (game: GameState, seat: Seat) => {
  advanceToNextPhase(game);
  if (game.turn.phase !== "弃牌" || game.pendingAction || game.winner) {
    return;
  }
  if (beginQiaobianPhasePrompt(game, seat, "弃牌")) {
    return;
  }
  resolveDiscardPhaseNormally(game, seat);
};

const removeQiaobianFieldCard = (
  seat: Seat,
  cardInstanceId: string,
  game?: GameState,
) => {
  const equipmentIndex = seat.equipment.findIndex(
    (card) => card.instance_id === cardInstanceId,
  );
  if (equipmentIndex >= 0) {
    const [card] = seat.equipment.splice(equipmentIndex, 1);
    if (game) {
      triggerXiaojiIfEquipmentLost(game, seat, card);
    }
    return { card, zone: "装备区" };
  }

  const judgeIndex = seat.judgeArea.findIndex(
    (card) => card.instance_id === cardInstanceId,
  );
  if (judgeIndex >= 0) {
    const [card] = seat.judgeArea.splice(judgeIndex, 1);
    return { card, zone: "判定区" };
  }

  return { card: null, zone: "" };
};

const canMoveQiaobianFieldCard = (
  target: Seat,
  sourceSeatId: number,
  card: DeckInstance,
) => {
  if (!target.alive || target.id === sourceSeatId) {
    return false;
  }
  const slot = getEquipmentSlot(card);
  if (slot) {
    return !getEquippedCard(target, slot);
  }
  if (isDelayedTrick(card)) {
    return !hasDelayedTrick(target, card.card_id);
  }
  return false;
};

export const respondToQiaobianPhase = (
  source: GameState,
  cardInstanceId: string | null,
): GameState => {
  const game = cloneGame(source);
  const pending = game.pendingAction;
  if (!pending || pending.type !== "qiaobian_phase") {
    return game;
  }
  const seat = game.seats[pending.seatId];
  if (!seat?.alive) {
    game.pendingAction = null;
    return game;
  }

  if (!cardInstanceId) {
    game.pendingAction = null;
    appendLog(game, `${seat.general.name} 不发动【巧变】。`);
    if (pending.phase === "摸牌") {
      resolveDrawPhaseNormally(game, seat);
      if (!game.pendingAction && !game.winner) {
        advanceToNextPhase(game);
      }
    } else if (pending.phase === "出牌") {
      appendLog(game, `${seat.general.name} 进入出牌阶段。`);
    } else {
      resolveDiscardPhaseNormally(game, seat);
    }
    return game;
  }

  const cost = removeCardFromHand(seat, cardInstanceId, game);
  if (!cost) {
    appendLog(game, "【巧变】选择的手牌已经不在手中。");
    return game;
  }

  discardCards(game, [cost]);
  const message = `${seat.general.name} 发动【巧变】，弃置${formatCard(cost)}并跳过${pending.phase}阶段。`;
  appendLog(game, message);
  setLastEffect(game, seat, cost, message, undefined, "巧变");

  if (pending.phase === "摸牌") {
    game.pendingAction = {
      type: "qiaobian_draw_targets",
      seatId: seat.id,
      message: "【巧变】跳过摸牌阶段：可以选择至多两名其他角色，各获得其一张手牌。",
    };
    appendLog(game, game.pendingAction.message);
    return game;
  }

  if (pending.phase === "出牌") {
    game.pendingAction = {
      type: "qiaobian_play_move",
      seatId: seat.id,
      message: "【巧变】跳过出牌阶段：可以移动场上的一张装备牌或判定牌。",
    };
    appendLog(game, game.pendingAction.message);
    return game;
  }

  game.pendingAction = null;
  advanceFromDiscardToEnd(game);
  return game;
};

export const respondToQiaobianDrawTargets = (
  source: GameState,
  targetSeatIds: number[],
): GameState => {
  const game = cloneGame(source);
  const pending = game.pendingAction;
  if (!pending || pending.type !== "qiaobian_draw_targets") {
    return game;
  }
  const seat = game.seats[pending.seatId];
  if (!seat?.alive) {
    game.pendingAction = null;
    advanceToNextPhase(game);
    return game;
  }

  const targets = [...new Set(targetSeatIds)]
    .map((id) => game.seats[id])
    .filter(
      (target): target is Seat =>
        Boolean(target?.alive && target.id !== seat.id && target.hand.length > 0),
    )
    .slice(0, 2);

  game.pendingAction = null;
  if (targets.length === 0) {
    appendLog(game, `${seat.general.name} 不通过【巧变】获得手牌。`);
    advanceToNextPhase(game);
    return game;
  }

  const gained: DeckInstance[] = [];
  for (const target of targets) {
    const card = removeCardAt(target, 0, game);
    seat.hand.push(card);
    gained.push(card);
    appendLog(game, `${seat.general.name} 通过【巧变】获得 ${target.general.name} 的一张手牌。`);
  }
  if (gained.length > 0) {
    setLastEffect(game, seat, gained[0], `${seat.general.name} 通过【巧变】获得 ${gained.length} 张手牌。`, targets[0], `+${gained.length}`);
  }
  advanceToNextPhase(game);
  return game;
};

export const respondToQiaobianPlayMove = (
  source: GameState,
  sourceSeatId: number | null,
  cardInstanceId: string | null,
  targetSeatId: number | null,
): GameState => {
  const game = cloneGame(source);
  const pending = game.pendingAction;
  if (!pending || pending.type !== "qiaobian_play_move") {
    return game;
  }
  const actor = game.seats[pending.seatId];
  if (!actor?.alive) {
    game.pendingAction = null;
    advanceToNextPhase(game);
    return game;
  }

  if (sourceSeatId === null || cardInstanceId === null || targetSeatId === null) {
    game.pendingAction = null;
    appendLog(game, `${actor.general.name} 不通过【巧变】移动场上的牌。`);
    enterDiscardAfterQiaobianPlay(game, actor);
    return game;
  }

  const sourceSeat = game.seats[sourceSeatId];
  const targetSeat = game.seats[targetSeatId];
  const selectedCard =
    sourceSeat?.equipment.find((card) => card.instance_id === cardInstanceId) ??
    sourceSeat?.judgeArea.find((card) => card.instance_id === cardInstanceId) ??
    null;
  if (!sourceSeat?.alive || !targetSeat?.alive || !selectedCard) {
    appendLog(game, "【巧变】选择的移动牌或目标已经失效。");
    return game;
  }
  if (!canMoveQiaobianFieldCard(targetSeat, sourceSeat.id, selectedCard)) {
    appendLog(game, "【巧变】这张场上牌不能移动到所选目标。");
    return game;
  }

  const moved = removeQiaobianFieldCard(sourceSeat, cardInstanceId, game);
  if (!moved.card) {
    appendLog(game, "【巧变】选择的场上牌已经不在原区域。");
    return game;
  }

  if (getEquipmentSlot(moved.card)) {
    targetSeat.equipment.push(moved.card);
  } else {
    targetSeat.judgeArea.push(moved.card);
  }
  game.pendingAction = null;
  const message = `${actor.general.name} 通过【巧变】将 ${sourceSeat.general.name} 的${moved.zone}${formatCard(moved.card)}移动给 ${targetSeat.general.name}。`;
  appendLog(game, message);
  setLastEffect(game, actor, moved.card, message, targetSeat, "移动");
  enterDiscardAfterQiaobianPlay(game, actor);
  return game;
};

export const confirmDiscard = (
  source: GameState,
  cardInstanceIds: string[],
): GameState => {
  const game = cloneGame(source);
  const pending = game.pendingAction;
  if (!pending || pending.type !== "discard_cards") {
    return game;
  }

  const seat = game.seats[pending.seatId];
  if (!seat?.alive) {
    game.pendingAction = null;
    advanceFromDiscardToEnd(game);
    return game;
  }

  const uniqueIds = [...new Set(cardInstanceIds)];
  if (uniqueIds.length !== pending.requiredCount) {
    appendLog(game, `需要弃置 ${pending.requiredCount} 张牌。`);
    return game;
  }

  if (!uniqueIds.every((id) => seat.hand.some((card) => card.instance_id === id))) {
    appendLog(game, "弃牌选择中包含不存在的手牌。");
    return game;
  }

  const cards = uniqueIds
    .map((id) => removeCardFromHand(seat, id, game))
    .filter((card): card is DeckInstance => Boolean(card));
  discardCards(game, cards);
  game.pendingAction = null;
  appendLog(game, `${seat.general.name} 弃置 ${cards.length} 张手牌。`);
  advanceFromDiscardToEnd(game);
  return game;
};

const nextAliveSeatId = (game: GameState, fromSeatId: number) => {
  for (let offset = 1; offset <= game.seats.length; offset += 1) {
    const id = (fromSeatId + offset) % game.seats.length;
    if (game.seats[id].alive) {
      return id;
    }
  }

  return fromSeatId;
};

const roleEnemyRank = (actorRole: Role, targetRole: Role, aliveCount: number) => {
  if (actorRole === "反贼") {
    if (targetRole === "主公") return 0;
    if (targetRole === "忠臣") return 1;
    return 2;
  }

  if (actorRole === "主公" || actorRole === "忠臣") {
    if (targetRole === "反贼") return 0;
    if (targetRole === "内奸") return 1;
    return 3;
  }

  if (targetRole === "内奸") return 4;
  if (targetRole === "主公" && aliveCount > 2) return 3;
  if (targetRole === "反贼") return 0;
  if (targetRole === "忠臣") return 1;
  return 2;
};

const validLeijiTargetIds = (game: GameState, actor: Seat) =>
  aliveTargets(game, actor).map((seat) => seat.id);

const chooseLeijiTarget = (game: GameState, actor: Seat) => {
  const alive = game.seats.filter((seat) => seat.alive);
  return aliveTargets(game, actor)
    .sort((a, b) => {
      const rankDelta =
        roleEnemyRank(actor.role, a.role, alive.length) -
        roleEnemyRank(actor.role, b.role, alive.length);
      if (rankDelta !== 0) return rankDelta;
      return a.hp - b.hp;
    })[0];
};

const resolveLeijiAgainstTarget = (
  game: GameState,
  actor: Seat,
  target: Seat,
  resume: LeijiResume = { kind: "none" },
) => {
  startSkillJudge(game, {
    type: "leiji",
    actorSeatId: actor.id,
    targetSeatId: target.id,
    resume,
  });
};

const resumeAfterLeiji = (game: GameState, resume: LeijiResume) => {
  if (game.pendingAction || game.winner || resume.kind === "none") {
    return;
  }

  if (resume.kind === "shan_response") {
    const target = game.seats[resume.targetSeatId];
    if (!target?.alive) {
      return;
    }
    const remainingResponses = resume.requiredResponses - resume.respondedResponses;
    if (remainingResponses > 0) {
      game.pendingAction = {
        type: "shan_response",
        sourceSeatId: resume.sourceSeatId,
        targetSeatId: resume.targetSeatId,
        card: resume.card,
        cardName: resume.cardName,
        damage: resume.damage,
        damageType: resume.damageType,
        requiredResponses: resume.requiredResponses,
        respondedResponses: resume.respondedResponses,
        canRespond:
          target.hand.some((card) => isCardUsableAsShan(target, card)) ||
          canUseLordResponse(game, target, "shan"),
        message: `${target.general.name} 还需 ${remainingResponses} 张【闪】才能抵消【${resume.cardName}】。`,
      };
      return;
    }

    const sourceSeat = game.seats[resume.sourceSeatId];
    if (sourceSeat?.alive && hasSkill(sourceSeat, "猛进") && hasAnyZoneCard(target)) {
      const removed = removeFirstZoneCard(target, game);
      if (removed.card) {
        discardCards(game, [removed.card]);
        appendLog(
          game,
          `${sourceSeat.general.name} 发动【猛进】，弃置 ${target.general.name} 的${removed.zone}${formatCard(removed.card)}。`,
        );
      }
    }
    return;
  }

  continueMassResponseTrick(
    game,
    resume.sourceSeatId,
    resume.card,
    resume.requiredCard,
    resume.remainingTargetIds,
    resume.damage,
    resume.damageType,
  );
};

const triggerLeijiAfterShan = (
  game: GameState,
  actor: Seat,
  resume: LeijiResume = { kind: "none" },
) => {
  if (!actor.alive || !hasSkill(actor, "雷击")) {
    return;
  }

  const validTargetIds = validLeijiTargetIds(game, actor);
  if (validTargetIds.length === 0) {
    return;
  }

  if (actor.controller === "human") {
    game.pendingAction = {
      type: "leiji_response",
      actorSeatId: actor.id,
      validTargetIds,
      resume,
      message: `${actor.general.name} 打出【闪】后可以发动【雷击】，选择一名其他角色进行判定。`,
    };
    appendLog(game, game.pendingAction.message);
    return;
  }

  const target = chooseLeijiTarget(game, actor);
  if (target) {
    resolveLeijiAgainstTarget(game, actor, target, resume);
  }
};

const chooseAiTarget = (game: GameState, actor: Seat) => {
  const alive = game.seats.filter((seat) => seat.alive);
  const validTargetIds = new Set(validShaTargetIds(game, actor));
  return aliveTargets(game, actor)
    .filter((seat) => validTargetIds.has(seat.id))
    .sort((a, b) => {
      const rankDelta =
        roleEnemyRank(actor.role, a.role, alive.length) -
        roleEnemyRank(actor.role, b.role, alive.length);
      if (rankDelta !== 0) return rankDelta;
      return a.hp - b.hp;
    })[0];
};

const chooseAiTargetFromIds = (game: GameState, actor: Seat, targetIds: number[]) => {
  const alive = game.seats.filter((seat) => seat.alive);
  const validTargetIds = new Set(targetIds);
  return aliveTargets(game, actor)
    .filter((seat) => validTargetIds.has(seat.id))
    .sort((a, b) => {
      const rankDelta =
        roleEnemyRank(actor.role, a.role, alive.length) -
        roleEnemyRank(actor.role, b.role, alive.length);
      if (rankDelta !== 0) return rankDelta;
      return a.hp - b.hp;
    })[0];
};

const hasUsedSkillThisTurn = (game: GameState, skillName: string) =>
  game.turn.usedSkills.includes(skillName);

const markSkillUsedThisTurn = (game: GameState, skillName: string) => {
  if (!hasUsedSkillThisTurn(game, skillName)) {
    game.turn.usedSkills.push(skillName);
  }
};

const chooseSkillEnemy = (game: GameState, actor: Seat, targetIds?: number[]) => {
  const ids = targetIds ?? aliveTargets(game, actor).map((seat) => seat.id);
  return chooseAiTargetFromIds(game, actor, ids);
};

const chooseSkillAlly = (game: GameState, actor: Seat, includeSelf = false) =>
  game.seats
    .filter((seat) => seat.alive && (includeSelf || seat.id !== actor.id))
    .filter((seat) => areStrategicAllies(actor, seat))
    .sort((a, b) => {
      const hurtDelta = b.maxHp - b.hp - (a.maxHp - a.hp);
      if (hurtDelta !== 0) return hurtDelta;
      return a.hand.length - b.hand.length;
    })[0];

const discardHandCardsFromFront = (
  game: GameState,
  seat: Seat,
  count: number,
) => {
  const cards: DeckInstance[] = [];
  for (let index = 0; index < count; index += 1) {
    if (seat.hand.length === 0) {
      break;
    }
    cards.push(removeCardAt(seat, 0, game));
  }
  discardCards(game, cards);
  return cards;
};

const loseHp = (game: GameState, seat: Seat, amount: number, reason: string) => {
  seat.hp -= amount;
  appendLog(game, `${seat.general.name} 因${reason}失去 ${amount} 点体力。`);
  if (seat.hp <= 0) {
    enterDying(game, seat, null);
  }
};

const activateRende = (game: GameState, seat: Seat) => {
  if (seat.hand.length === 0) {
    appendLog(game, `${seat.general.name} 没有手牌，不能发动【仁德】。`);
    return;
  }
  const recipient = chooseSkillAlly(game, seat) ?? aliveTargets(game, seat)[0];
  if (!recipient) {
    appendLog(game, `${seat.general.name} 没有可交给手牌的目标。`);
    return;
  }
  const count = Math.min(seat.hand.length, seat.hp < seat.maxHp ? 2 : 1);
  const cards: DeckInstance[] = [];
  for (let index = 0; index < count; index += 1) {
    cards.push(removeCardAt(seat, 0, game));
  }
  recipient.hand.push(...cards);
  appendLog(game, `${seat.general.name} 发动【仁德】，交给 ${recipient.general.name} ${cards.length} 张手牌。`);
  if (count >= 2 && seat.hp < seat.maxHp) {
    healSeat(game, seat, 1, "【仁德】");
  }
};

const activateZhiheng = (game: GameState, seat: Seat) => {
  if (hasUsedSkillThisTurn(game, "制衡")) {
    appendLog(game, `${seat.general.name} 本回合已经发动过【制衡】。`);
    return;
  }
  const count = Math.min(2, seat.hand.length);
  if (count === 0) {
    appendLog(game, `${seat.general.name} 没有手牌，不能发动【制衡】。`);
    return;
  }
  const discarded = discardHandCardsFromFront(game, seat, count);
  drawFromPile(game, seat, discarded.length);
  markSkillUsedThisTurn(game, "制衡");
  appendLog(game, `${seat.general.name} 发动【制衡】，弃 ${discarded.length} 张牌并摸等量牌。`);
};

const activateKurou = (game: GameState, seat: Seat) => {
  if (seat.hp <= 0) {
    return;
  }
  loseHp(game, seat, 1, "【苦肉】");
  if (!seat.alive || game.pendingAction || game.winner) {
    return;
  }
  drawFromPile(game, seat, 2);
  appendLog(game, `${seat.general.name} 发动【苦肉】，摸2张牌。`);
};

const activateFanjian = (game: GameState, seat: Seat) => {
  if (hasUsedSkillThisTurn(game, "反间")) {
    appendLog(game, `${seat.general.name} 本回合已经发动过【反间】。`);
    return;
  }
  if (seat.hand.length === 0) {
    appendLog(game, `${seat.general.name} 没有手牌，不能发动【反间】。`);
    return;
  }
  const target = chooseSkillEnemy(game, seat);
  if (!target) {
    appendLog(game, `${seat.general.name} 没有可发动【反间】的目标。`);
    return;
  }
  const card = removeCardAt(seat, 0, game);
  target.hand.push(card);
  markSkillUsedThisTurn(game, "反间");
  appendLog(game, `${seat.general.name} 发动【反间】，令 ${target.general.name} 获得一张手牌并声明红桃。`);
  if (!isEffectiveHeart(target, card)) {
    appendLog(game, `${target.general.name} 获得的牌不是红桃，受到【反间】伤害。`);
    applyDamage(game, seat.id, target, 1, "normal");
    evaluateWinner(game);
  }
};

const activateQingnang = (game: GameState, seat: Seat) => {
  if (hasUsedSkillThisTurn(game, "青囊")) {
    appendLog(game, `${seat.general.name} 本回合已经发动过【青囊】。`);
    return;
  }
  if (seat.hand.length === 0) {
    appendLog(game, `${seat.general.name} 没有手牌，不能发动【青囊】。`);
    return;
  }
  const target =
    game.seats
      .filter((item) => item.alive && item.hp < item.maxHp)
      .sort((a, b) => {
        const allyDelta = Number(areStrategicAllies(seat, b)) - Number(areStrategicAllies(seat, a));
        if (allyDelta !== 0) return allyDelta;
        return b.maxHp - b.hp - (a.maxHp - a.hp);
      })[0] ?? null;
  if (!target) {
    appendLog(game, `${seat.general.name} 没有可治疗的角色。`);
    return;
  }
  const cost = removeCardAt(seat, 0, game);
  discardCards(game, [cost]);
  healSeat(game, target, 1, "【青囊】");
  markSkillUsedThisTurn(game, "青囊");
  appendLog(game, `${seat.general.name} 发动【青囊】，弃置一张手牌令 ${target.general.name} 回复1点体力。`);
};

const activateQiangxi = (game: GameState, seat: Seat) => {
  if (hasUsedSkillThisTurn(game, "强袭")) {
    appendLog(game, `${seat.general.name} 本回合已经发动过【强袭】。`);
    return;
  }
  const target = chooseSkillEnemy(
    game,
    seat,
    aliveTargets(game, seat)
      .filter((item) => distanceBetweenSeats(game, seat, item) <= getAttackRange(seat))
      .map((item) => item.id),
  );
  if (!target) {
    appendLog(game, `${seat.general.name} 攻击范围内没有【强袭】目标。`);
    return;
  }
  const equippedWeaponIndex = seat.equipment.findIndex(
    (card) => getEquipmentSlot(card) === "weapon",
  );
  if (equippedWeaponIndex >= 0) {
    const [weapon] = seat.equipment.splice(equippedWeaponIndex, 1);
    discardCards(game, [weapon]);
    triggerXiaojiIfEquipmentLost(game, seat, weapon);
    appendLog(game, `${seat.general.name} 发动【强袭】，弃置武器${formatCard(weapon)}。`);
  } else {
    loseHp(game, seat, 1, "【强袭】");
    if (!seat.alive || game.pendingAction || game.winner) {
      return;
    }
  }
  markSkillUsedThisTurn(game, "强袭");
  applyDamage(game, seat.id, target, 1, "normal");
  evaluateWinner(game);
};

const activateLuanji = (game: GameState, seat: Seat) => {
  const bySuit = new Map<string, DeckInstance[]>();
  for (const card of seat.hand) {
    const items = bySuit.get(card.suit) ?? [];
    items.push(card);
    bySuit.set(card.suit, items);
  }
  const pair = [...bySuit.values()].find((cards) => cards.length >= 2)?.slice(0, 2) ?? [];
  if (pair.length < 2) {
    appendLog(game, `${seat.general.name} 没有两张同花色手牌，不能发动【乱击】。`);
    return;
  }
  const first = removeCardFromHand(seat, pair[0].instance_id, game);
  const second = removeCardFromHand(seat, pair[1].instance_id, game);
  if (!first || !second) {
    return;
  }
  const wanjian = makeVirtualCard(first, "wanjianqifa", "万箭齐发");
  discardCards(game, [wanjian, second]);
  appendLog(game, `${seat.general.name} 发动【乱击】，将两张同花色牌当【万箭齐发】使用。`);
  resolveInstantTrick(game, seat, wanjian);
};

const activateLijian = (game: GameState, seat: Seat) => {
  if (hasUsedSkillThisTurn(game, "离间")) {
    appendLog(game, `${seat.general.name} 本回合已经发动过【离间】。`);
    return;
  }
  if (seat.hand.length === 0) {
    appendLog(game, `${seat.general.name} 没有手牌，不能发动【离间】。`);
    return;
  }
  const targets = aliveTargets(game, seat)
    .sort((a, b) => {
      const aliveCount = game.seats.filter((item) => item.alive).length;
      const rankDelta =
        roleEnemyRank(seat.role, a.role, aliveCount) -
        roleEnemyRank(seat.role, b.role, aliveCount);
      if (rankDelta !== 0) return rankDelta;
      return a.hp - b.hp;
    })
    .slice(0, 2);
  if (targets.length < 2) {
    appendLog(game, `${seat.general.name} 没有足够目标发动【离间】。`);
    return;
  }
  const cost = removeCardAt(seat, 0, game);
  const duel = makeVirtualCard(cost, "juedou", "决斗");
  discardCards(game, [duel]);
  markSkillUsedThisTurn(game, "离间");
  appendLog(game, `${seat.general.name} 发动【离间】，令 ${targets[0].general.name} 与 ${targets[1].general.name} 决斗。`);
  resolveDuel(game, targets[0], targets[1], duel);
};

const activateQihu = (game: GameState, seat: Seat) => {
  if (hasUsedSkillThisTurn(game, "驱虎")) {
    appendLog(game, `${seat.general.name} 本回合已经发动过【驱虎】。`);
    return;
  }
  if (seat.hand.length === 0) {
    appendLog(game, `${seat.general.name} 没有手牌，不能发动【驱虎】。`);
    return;
  }

  const target =
    aliveTargets(game, seat)
      .filter((item) => item.hp > seat.hp && item.hand.length > 0)
      .sort((a, b) => {
        const aliveCount = game.seats.filter((item) => item.alive).length;
        const rankDelta =
          roleEnemyRank(seat.role, a.role, aliveCount) -
          roleEnemyRank(seat.role, b.role, aliveCount);
        if (rankDelta !== 0) return rankDelta;
        return b.hp - a.hp;
      })[0] ?? null;
  if (!target) {
    appendLog(game, `${seat.general.name} 没有体力值更高且有手牌的【驱虎】目标。`);
    return;
  }

  const victim =
    game.seats
      .filter(
        (item) =>
          item.alive &&
          item.id !== target.id &&
          distanceBetweenSeats(game, target, item) <= getAttackRange(target),
      )
      .sort((a, b) => {
        const aliveCount = game.seats.filter((item) => item.alive).length;
        const rankDelta =
          roleEnemyRank(seat.role, a.role, aliveCount) -
          roleEnemyRank(seat.role, b.role, aliveCount);
        if (rankDelta !== 0) return rankDelta;
        return a.hp - b.hp;
      })[0] ?? null;
  if (!victim) {
    appendLog(game, `${target.general.name} 攻击范围内没有可被【驱虎】指定的目标。`);
    return;
  }

  const actorCard = removeCardAt(seat, 0, game);
  const targetCard = removeCardAt(target, 0, game);
  discardCards(game, [actorCard, targetCard]);
  markSkillUsedThisTurn(game, "驱虎");
  const actorWins = rankNumber(actorCard) > rankNumber(targetCard);
  appendLog(
    game,
    `${seat.general.name} 发动【驱虎】，与 ${target.general.name} 拼点：${formatCard(actorCard)} 对 ${formatCard(targetCard)}，${actorWins ? "获胜" : "失败"}。`,
  );
  setLastEffect(game, seat, actorCard, `${seat.general.name} 发动【驱虎】。`, target, "拼点");
  if (actorWins) {
    appendLog(game, `${target.general.name} 因【驱虎】对 ${victim.general.name} 造成1点伤害。`);
    applyDamage(game, target.id, victim, 1, "normal");
  } else {
    appendLog(game, `${target.general.name} 因【驱虎】对 ${seat.general.name} 造成1点伤害。`);
    applyDamage(game, target.id, seat, 1, "normal");
  }
  evaluateWinner(game);
};

const makeSkillShaCard = (base: DeckInstance, name = "杀") =>
  makeVirtualCard(base, "sha", name);

const activateShensu = (game: GameState, seat: Seat, selectedTarget?: Seat | null) => {
  if (hasUsedSkillThisTurn(game, "神速")) {
    appendLog(game, `${seat.general.name} 本回合已经发动过【神速】。`);
    return;
  }
  const equipmentIndex = seat.equipment.findIndex((card) => getEquipmentSlot(card));
  if (equipmentIndex < 0) {
    appendLog(game, `${seat.general.name} 没有装备牌，不能发动【神速】第二项。`);
    return;
  }
  const validTargetIds = validShaTargetIds(game, seat, { ignoreDistance: true });
  const target =
    selectedTarget && validTargetIds.includes(selectedTarget.id)
      ? selectedTarget
      : chooseSkillEnemy(game, seat, validTargetIds);
  if (!target) {
    appendLog(game, `${seat.general.name} 没有可被【神速】指定的杀目标。`);
    return;
  }
  const [cost] = seat.equipment.splice(equipmentIndex, 1);
  discardCards(game, [cost]);
  triggerXiaojiIfEquipmentLost(game, seat, cost);
  const virtualSha = makeSkillShaCard(cost);
  game.turn.skipPlay = true;
  markShaPlayedThisTurn(game, seat);
  markSkillUsedThisTurn(game, "神速");
  appendLog(game, `${seat.general.name} 发动【神速】，弃置装备${formatCard(cost)}，视为对 ${target.general.name} 使用【杀】，并跳过出牌阶段。`);
  setLastEffect(game, seat, virtualSha, `${seat.general.name} 发动【神速】。`, target, "神速杀");
  resolveShaAgainstTarget(game, seat, target, virtualSha, 1);
  evaluateWinner(game);
};

const tryShensuSkipJudgeDraw = (game: GameState, seat: Seat) => {
  if (
    !hasSkill(seat, "神速") ||
    hasUsedSkillThisTurn(game, "神速") ||
    seat.controller !== "ai"
  ) {
    return false;
  }

  const target = chooseSkillEnemy(game, seat, validShaTargetIds(game, seat, { ignoreDistance: true }));
  const baseCard = game.piles.draw[0] ?? game.piles.discard[0] ?? seat.hand[0] ?? null;
  if (!target || !baseCard) {
    return false;
  }

  const virtualSha = makeSkillShaCard(baseCard);
  game.turn.skipDraw = true;
  markShaPlayedThisTurn(game, seat);
  markSkillUsedThisTurn(game, "神速");
  appendLog(game, `${seat.general.name} 发动【神速】，跳过判定阶段和摸牌阶段，视为对 ${target.general.name} 使用一张无距离限制的【杀】。`);
  setLastEffect(game, seat, virtualSha, `${seat.general.name} 发动【神速】。`, target, "神速杀");
  resolveShaAgainstTarget(game, seat, target, virtualSha, 1);
  evaluateWinner(game);
  return true;
};

const canActivateHuangtianAsProvider = (game: GameState, seat: Seat) =>
  seat.alive &&
  seat.general.faction === "群" &&
  game.seats.some(
    (item) =>
      item.alive && item.id !== seat.id && item.role === "主公" && hasSkill(item, "黄天"),
  );

const activateHuangtian = (game: GameState, seat: Seat, selectedCardId?: string | null) => {
  if (hasUsedSkillThisTurn(game, "黄天")) {
    appendLog(game, `${seat.general.name} 本回合已经发动过【黄天】。`);
    return;
  }
  const lord = game.seats.find(
    (item) => item.alive && item.role === "主公" && hasSkill(item, "黄天"),
  );
  if (!lord || lord.id === seat.id || !canActivateHuangtianAsProvider(game, seat)) {
    appendLog(game, `${seat.general.name} 没有可响应【黄天】的主公。`);
    return;
  }
  const cardIndex = selectedCardId
    ? seat.hand.findIndex(
        (card) =>
          card.instance_id === selectedCardId &&
          (isShan(card) || card.card_id === "shandian"),
      )
    : findCardIndex(seat, (card) => isShan(card) || card.card_id === "shandian");
  if (cardIndex < 0) {
    appendLog(game, `${seat.general.name} 需要选择【闪】或【闪电】交给 ${lord.general.name}。`);
    return;
  }
  const card = removeCardAt(seat, cardIndex, game);
  lord.hand.push(card);
  markSkillUsedThisTurn(game, "黄天");
  appendLog(game, `${seat.general.name} 发动【黄天】，将${formatCard(card)}交给 ${lord.general.name}。`);
  setLastEffect(game, seat, card, `${seat.general.name} 发动【黄天】。`, lord, "+牌");
};

const activateTianyi = (game: GameState, seat: Seat) => {
  if (hasUsedSkillThisTurn(game, "天义")) {
    appendLog(game, `${seat.general.name} 本回合已经发动过【天义】。`);
    return;
  }
  if (seat.hand.length === 0) {
    appendLog(game, `${seat.general.name} 没有手牌，不能发动【天义】。`);
    return;
  }
  const target =
    aliveTargets(game, seat)
      .filter((item) => item.hand.length > 0)
      .sort((a, b) => {
        const aliveCount = game.seats.filter((item) => item.alive).length;
        const rankDelta =
          roleEnemyRank(seat.role, a.role, aliveCount) -
          roleEnemyRank(seat.role, b.role, aliveCount);
        if (rankDelta !== 0) return rankDelta;
        return b.hand.length - a.hand.length;
      })[0] ?? null;
  if (!target) {
    appendLog(game, `${seat.general.name} 没有可拼点的【天义】目标。`);
    return;
  }
  const actorCard = removeCardAt(seat, 0, game);
  const targetCard = removeCardAt(target, 0, game);
  discardCards(game, [actorCard, targetCard]);
  const actorWins = rankNumber(actorCard) > rankNumber(targetCard);
  game.turn.tianyiState = actorWins ? "won" : "lost";
  markSkillUsedThisTurn(game, "天义");
  appendLog(
    game,
    `${seat.general.name} 发动【天义】，与 ${target.general.name} 拼点：${formatCard(actorCard)} 对 ${formatCard(targetCard)}，${actorWins ? "获胜，本回合杀无距离限制且可多次使用" : "失败，本回合不能使用杀"}。`,
  );
  setLastEffect(game, seat, actorCard, `${seat.general.name} 发动【天义】。`, target, actorWins ? "天义胜" : "天义败");
};

const activateFangquan = (
  game: GameState,
  seat: Seat,
  selectedTarget?: Seat | null,
  selectedCostCardId?: string | null,
) => {
  if (hasUsedSkillThisTurn(game, "放权")) {
    appendLog(game, `${seat.general.name} 本回合已经发动过【放权】。`);
    return;
  }
  const target =
    selectedTarget && selectedTarget.alive && selectedTarget.id !== seat.id
      ? selectedTarget
      : chooseSkillAlly(game, seat) ?? aliveTargets(game, seat)[0] ?? null;
  if (!target) {
    appendLog(game, `${seat.general.name} 没有可获得额外回合的【放权】目标。`);
    return;
  }
  if (selectedCostCardId && !seat.hand.some((card) => card.instance_id === selectedCostCardId)) {
    appendLog(game, "【放权】选择的弃置手牌已经不在手中。");
    return;
  }
  game.turn.skipPlay = true;
  game.turn.fangquanTargetSeatId = target.id;
  game.turn.fangquanCostCardId = selectedCostCardId ?? null;
  markSkillUsedThisTurn(game, "放权");
  appendLog(game, `${seat.general.name} 发动【放权】，跳过出牌阶段；回合结束时可弃一张手牌令 ${target.general.name} 获得额外回合。`);
  const visualCard =
    (selectedCostCardId
      ? seat.hand.find((card) => card.instance_id === selectedCostCardId)
      : null) ??
    seat.hand[0] ??
    game.piles.discard[0] ??
    game.piles.draw[0] ??
    null;
  if (visualCard) {
    setLastEffect(game, seat, visualCard, `${seat.general.name} 发动【放权】。`, target, "额外回合");
  }
};

const activateJieyin = (game: GameState, seat: Seat) => {
  if (hasUsedSkillThisTurn(game, "结姻")) {
    appendLog(game, `${seat.general.name} 本回合已经发动过【结姻】。`);
    return;
  }
  if (seat.hand.length < 2) {
    appendLog(game, `${seat.general.name} 手牌不足，不能发动【结姻】。`);
    return;
  }
  const target =
    aliveTargets(game, seat)
      .filter((item) => item.hp < item.maxHp)
      .sort((a, b) => Number(areStrategicAllies(seat, b)) - Number(areStrategicAllies(seat, a)))[0] ?? null;
  if (!target || (seat.hp >= seat.maxHp && target.hp >= target.maxHp)) {
    appendLog(game, `${seat.general.name} 没有合适的【结姻】目标。`);
    return;
  }
  const discarded = discardHandCardsFromFront(game, seat, 2);
  if (discarded.length < 2) {
    return;
  }
  healSeat(game, seat, 1, "【结姻】");
  healSeat(game, target, 1, "【结姻】");
  markSkillUsedThisTurn(game, "结姻");
  appendLog(game, `${seat.general.name} 发动【结姻】，与 ${target.general.name} 各回复1点体力。`);
};

export const activateSkillWithSelection = (
  source: GameState,
  seatId: number,
  skillName: string,
  targetSeatIds: number[] = [],
  cardInstanceIds: string[] = [],
): GameState => {
  const game = cloneGame(source);
  const seat = game.seats[seatId];
  if (!seat?.alive) {
    return game;
  }
  if (
    !hasSkill(seat, skillName) &&
    !(skillName === "黄天" && canActivateHuangtianAsProvider(game, seat))
  ) {
    return game;
  }
  if (!canUseCardNow(game, seat)) {
    appendLog(game, `【${skillName}】需要在自己的出牌阶段发动。`);
    return game;
  }

  const uniqueCardIds = [...new Set(cardInstanceIds)];
  const selectedTargets = targetSeatIds
    .map((id) => game.seats[id])
    .filter((target): target is Seat => Boolean(target?.alive));

  if (skillName === "仁德") {
    const recipient = selectedTargets[0];
    if (!recipient || recipient.id === seat.id) {
      appendLog(game, "【仁德】需要选择一名其他角色。");
      return game;
    }
    if (uniqueCardIds.length === 0) {
      appendLog(game, "【仁德】需要选择至少一张手牌。");
      return game;
    }
    const cards = uniqueCardIds
      .map((id) => removeCardFromHand(seat, id, game))
      .filter((card): card is DeckInstance => Boolean(card));
    if (cards.length === 0) {
      appendLog(game, "【仁德】选择的手牌已经不在手中。");
      return game;
    }
    recipient.hand.push(...cards);
    const message = `${seat.general.name} 发动【仁德】，交给 ${recipient.general.name} ${cards.length} 张手牌。`;
    appendLog(game, message);
    setLastEffect(game, seat, cards[0], message, recipient, `+${cards.length}`);
    if (cards.length >= 2 && seat.hp < seat.maxHp) {
      healSeat(game, seat, 1, "【仁德】");
    }
    return game;
  }

  if (skillName === "反间") {
    if (hasUsedSkillThisTurn(game, "反间")) {
      appendLog(game, `${seat.general.name} 本回合已经发动过【反间】。`);
      return game;
    }
    const target = selectedTargets[0];
    if (!target || target.id === seat.id) {
      appendLog(game, "【反间】需要选择一名其他角色。");
      return game;
    }
    const cardId = uniqueCardIds[0];
    if (!cardId) {
      appendLog(game, "【反间】需要选择一张手牌交给目标。");
      return game;
    }
    const card = removeCardFromHand(seat, cardId, game);
    if (!card) {
      appendLog(game, "【反间】选择的手牌已经不在手中。");
      return game;
    }
    target.hand.push(card);
    markSkillUsedThisTurn(game, "反间");
    const message = `${seat.general.name} 发动【反间】，令 ${target.general.name} 获得${formatCard(card)}并声明红桃。`;
    appendLog(game, message);
    setLastEffect(game, seat, card, message, target, "反间");
    if (!isEffectiveHeart(target, card)) {
      appendLog(game, `${target.general.name} 获得的牌不是红桃，受到【反间】伤害。`);
      applyDamage(game, seat.id, target, 1, "normal");
      evaluateWinner(game);
    }
    return game;
  }

  if (skillName === "离间") {
    if (hasUsedSkillThisTurn(game, "离间")) {
      appendLog(game, `${seat.general.name} 本回合已经发动过【离间】。`);
      return game;
    }
    if (selectedTargets.length < 2 || selectedTargets.some((target) => target.id === seat.id)) {
      appendLog(game, "【离间】需要选择两名其他角色。");
      return game;
    }
    const costId = uniqueCardIds[0];
    if (!costId) {
      appendLog(game, "【离间】需要选择一张手牌作为代价。");
      return game;
    }
    const cost = removeCardFromHand(seat, costId, game);
    if (!cost) {
      appendLog(game, "【离间】选择的手牌已经不在手中。");
      return game;
    }
    const duel = makeVirtualCard(cost, "juedou", "决斗");
    discardCards(game, [duel]);
    markSkillUsedThisTurn(game, "离间");
    appendLog(game, `${seat.general.name} 发动【离间】，令 ${selectedTargets[0].general.name} 与 ${selectedTargets[1].general.name} 决斗。`);
    resolveDuel(game, selectedTargets[0], selectedTargets[1], duel);
    return game;
  }

  if (skillName === "驱虎") {
    if (hasUsedSkillThisTurn(game, "驱虎")) {
      appendLog(game, `${seat.general.name} 本回合已经发动过【驱虎】。`);
      return game;
    }
    const target = selectedTargets[0];
    const victim = selectedTargets[1];
    if (!target || target.id === seat.id || target.hp <= seat.hp || target.hand.length === 0) {
      appendLog(game, "【驱虎】需要选择一名体力值大于你且有手牌的其他角色拼点。");
      return game;
    }
    if (
      !victim ||
      victim.id === target.id ||
      !victim.alive ||
      distanceBetweenSeats(game, target, victim) > getAttackRange(target)
    ) {
      appendLog(game, "【驱虎】需要再选择一名位于拼点目标攻击范围内的角色。");
      return game;
    }
    const cardId = uniqueCardIds[0];
    if (!cardId) {
      appendLog(game, "【驱虎】需要选择一张手牌用于拼点。");
      return game;
    }
    const actorCard = removeCardFromHand(seat, cardId, game);
    if (!actorCard) {
      appendLog(game, "【驱虎】选择的手牌已经不在手中。");
      return game;
    }
    const targetCard = removeCardAt(target, 0, game);
    discardCards(game, [actorCard, targetCard]);
    markSkillUsedThisTurn(game, "驱虎");
    const actorWins = rankNumber(actorCard) > rankNumber(targetCard);
    appendLog(
      game,
      `${seat.general.name} 发动【驱虎】，与 ${target.general.name} 拼点：${formatCard(actorCard)} 对 ${formatCard(targetCard)}，${actorWins ? "获胜" : "失败"}。`,
    );
    setLastEffect(game, seat, actorCard, `${seat.general.name} 发动【驱虎】。`, target, "拼点");
    if (actorWins) {
      appendLog(game, `${target.general.name} 因【驱虎】对 ${victim.general.name} 造成1点伤害。`);
      applyDamage(game, target.id, victim, 1, "normal");
    } else {
      appendLog(game, `${target.general.name} 因【驱虎】对 ${seat.general.name} 造成1点伤害。`);
      applyDamage(game, target.id, seat, 1, "normal");
    }
    evaluateWinner(game);
    return game;
  }

  if (skillName === "神速") {
    const target = selectedTargets[0];
    if (!target || !getShensuTargetIds(game, seat.id).includes(target.id)) {
      appendLog(game, "【神速】需要选择一名合法的杀目标。");
      return game;
    }
    activateShensu(game, seat, target);
    return game;
  }

  if (skillName === "黄天") {
    const cardId = uniqueCardIds[0];
    if (!cardId) {
      appendLog(game, "【黄天】需要选择一张【闪】或【闪电】。");
      return game;
    }
    activateHuangtian(game, seat, cardId);
    return game;
  }

  if (skillName === "天义") {
    if (hasUsedSkillThisTurn(game, "天义")) {
      appendLog(game, `${seat.general.name} 本回合已经发动过【天义】。`);
      return game;
    }
    const target = selectedTargets[0];
    if (!target || target.id === seat.id || target.hand.length === 0) {
      appendLog(game, "【天义】需要选择一名有手牌的其他角色拼点。");
      return game;
    }
    const cardId = uniqueCardIds[0];
    if (!cardId) {
      appendLog(game, "【天义】需要选择一张手牌用于拼点。");
      return game;
    }
    const actorCard = removeCardFromHand(seat, cardId, game);
    if (!actorCard) {
      appendLog(game, "【天义】选择的拼点牌已经不在手中。");
      return game;
    }
    const targetCard = removeCardAt(target, 0, game);
    discardCards(game, [actorCard, targetCard]);
    const actorWins = rankNumber(actorCard) > rankNumber(targetCard);
    game.turn.tianyiState = actorWins ? "won" : "lost";
    markSkillUsedThisTurn(game, "天义");
    appendLog(
      game,
      `${seat.general.name} 发动【天义】，与 ${target.general.name} 拼点：${formatCard(actorCard)} 对 ${formatCard(targetCard)}，${actorWins ? "获胜，本回合杀无距离限制且可多次使用" : "失败，本回合不能使用杀"}。`,
    );
    setLastEffect(game, seat, actorCard, `${seat.general.name} 发动【天义】。`, target, actorWins ? "天义胜" : "天义败");
    return game;
  }

  if (skillName === "放权") {
    const target = selectedTargets[0];
    if (!target || target.id === seat.id) {
      appendLog(game, "【放权】需要选择一名其他角色获得额外回合。");
      return game;
    }
    const cardId = uniqueCardIds[0];
    if (!cardId) {
      appendLog(game, "【放权】需要选择一张手牌，回合结束时将弃置它。");
      return game;
    }
    activateFangquan(game, seat, target, cardId);
    return game;
  }

  appendLog(game, `技能【${skillName}】暂不支持手动选择。`);
  return game;
};

export const activateSkill = (
  source: GameState,
  seatId: number,
  skillName: string,
): GameState => {
  const game = cloneGame(source);
  const seat = game.seats[seatId];
  if (!seat?.alive) {
    return game;
  }
  if (
    !hasSkill(seat, skillName) &&
    !(skillName === "黄天" && canActivateHuangtianAsProvider(game, seat))
  ) {
    return game;
  }
  if (!canUseCardNow(game, seat)) {
    appendLog(game, `【${skillName}】需要在自己的出牌阶段发动。`);
    return game;
  }

  switch (skillName) {
    case "仁德":
      activateRende(game, seat);
      break;
    case "制衡":
      activateZhiheng(game, seat);
      break;
    case "苦肉":
      activateKurou(game, seat);
      break;
    case "反间":
      activateFanjian(game, seat);
      break;
    case "青囊":
      activateQingnang(game, seat);
      break;
    case "强袭":
      activateQiangxi(game, seat);
      break;
    case "乱击":
      activateLuanji(game, seat);
      break;
    case "离间":
      activateLijian(game, seat);
      break;
    case "驱虎":
      activateQihu(game, seat);
      break;
    case "神速":
      activateShensu(game, seat);
      break;
    case "黄天":
      activateHuangtian(game, seat);
      break;
    case "天义":
      activateTianyi(game, seat);
      break;
    case "放权":
      activateFangquan(game, seat);
      break;
    case "结姻":
      activateJieyin(game, seat);
      break;
    default:
      appendLog(game, `技能【${skillName}】已接入，会在对应时机自动触发或作为响应牌生效。`);
      break;
  }

  return game;
};

const tryAiActiveSkill = (game: GameState, seat: Seat) => {
  if (hasSkill(seat, "青囊") && seat.hand.length > 0) {
    const woundedAlly = game.seats.some(
      (item) => item.alive && item.hp < item.maxHp && areStrategicAllies(seat, item),
    );
    if (woundedAlly) {
      activateQingnang(game, seat);
      return true;
    }
  }

  if (hasSkill(seat, "制衡") && seat.hand.length >= 5) {
    activateZhiheng(game, seat);
    return true;
  }

  if (hasSkill(seat, "仁德") && seat.hand.length >= 5 && chooseSkillAlly(game, seat)) {
    activateRende(game, seat);
    return true;
  }

  if (hasSkill(seat, "乱击")) {
    const hasPair = seat.hand.some((card, index) =>
      seat.hand.some((other, otherIndex) => otherIndex !== index && other.suit === card.suit),
    );
    if (hasPair && aliveTargets(game, seat).length > 1) {
      activateLuanji(game, seat);
      return true;
    }
  }

  if (hasSkill(seat, "离间") && seat.hand.length > 0 && aliveTargets(game, seat).length >= 2) {
    activateLijian(game, seat);
    return true;
  }

  if (hasSkill(seat, "反间") && seat.hand.length > 1 && chooseSkillEnemy(game, seat)) {
    activateFanjian(game, seat);
    return true;
  }

  if (
    canActivateHuangtianAsProvider(game, seat) &&
    !hasUsedSkillThisTurn(game, "黄天") &&
    seat.hand.some((card) => isShan(card) || card.card_id === "shandian")
  ) {
    activateHuangtian(game, seat);
    if (hasUsedSkillThisTurn(game, "黄天")) {
      return true;
    }
  }

  if (
    hasSkill(seat, "天义") &&
    seat.hand.length > 0 &&
    !hasUsedSkillThisTurn(game, "天义") &&
    aliveTargets(game, seat).some((item) => item.hand.length > 0)
  ) {
    activateTianyi(game, seat);
    return true;
  }

  if (hasSkill(seat, "驱虎") && seat.hand.length > 0 && !hasUsedSkillThisTurn(game, "驱虎")) {
    const hasTarget = aliveTargets(game, seat).some(
      (item) =>
        item.hp > seat.hp &&
        item.hand.length > 0 &&
        game.seats.some(
          (victim) =>
            victim.alive &&
            victim.id !== item.id &&
            distanceBetweenSeats(game, item, victim) <= getAttackRange(item),
        ),
    );
    if (hasTarget) {
      activateQihu(game, seat);
      return true;
    }
  }

  if (
    hasSkill(seat, "结姻") &&
    seat.hand.length >= 2 &&
    game.seats.some((item) => item.alive && item.id !== seat.id && item.hp < item.maxHp)
  ) {
    activateJieyin(game, seat);
    return true;
  }

  if (
    hasSkill(seat, "强袭") &&
    chooseSkillEnemy(
      game,
      seat,
      aliveTargets(game, seat)
        .filter((item) => distanceBetweenSeats(game, seat, item) <= getAttackRange(seat))
        .map((item) => item.id),
    )
  ) {
    activateQiangxi(game, seat);
    return true;
  }

  if (
    hasSkill(seat, "神速") &&
    !hasUsedSkillThisTurn(game, "神速") &&
    seat.equipment.some((card) => getEquipmentSlot(card)) &&
    chooseSkillEnemy(game, seat, validShaTargetIds(game, seat, { ignoreDistance: true }))
  ) {
    activateShensu(game, seat);
    return true;
  }

  if (
    hasSkill(seat, "放权") &&
    !hasUsedSkillThisTurn(game, "放权") &&
    chooseSkillAlly(game, seat)
  ) {
    activateFangquan(game, seat);
    return true;
  }

  if (hasSkill(seat, "苦肉") && seat.hp > 2 && seat.hand.length <= 2) {
    activateKurou(game, seat);
    return true;
  }

  return false;
};

const performAiPlay = (game: GameState, seat: Seat) => {
  const equipmentIndex = findCardIndex(seat, isEquipment);
  if (equipmentIndex >= 0) {
    const equipment = removeCardAt(seat, equipmentIndex, game);
    equipCard(game, seat, equipment);
    return;
  }

  if (seat.hp < seat.maxHp) {
    const taoIndex = findCardIndex(seat, isTao);
    if (taoIndex >= 0) {
      const tao = removeCardAt(seat, taoIndex, game);
      discardCards(game, [tao]);
      setLastEffect(game, seat, tao, `${seat.general.name} 使用${formatCard(tao)}，回复 1 点体力。`, undefined, "+1");
      healSeat(game, seat, 1, formatCard(tao));
      return;
    }
  }

  if (tryAiActiveSkill(game, seat)) {
    return;
  }

  const trickIndex = findCardIndex(
    seat,
    (card) => isTrick(card) && card.card_id !== "wuxiekeji" && getCardPlayInfo(game, seat.id, card).canPlay,
  );
  if (trickIndex >= 0) {
    const trick = seat.hand[trickIndex];
    const info = getCardPlayInfo(game, seat.id, trick);
    const target =
      info.mode === "target"
        ? chooseAiTargetFromIds(game, seat, info.validTargetIds)
        : null;
    if (info.mode === "target" && !target) {
      appendLog(game, `${seat.general.name} 暂不使用${formatCard(trick)}。`);
      return;
    }
    const used = removeCardAt(seat, trickIndex, game);
    if (info.mode === "target" && target) {
      if (!isDelayedTrick(used)) {
        discardCards(game, [used]);
      }
      resolveTargetedTrick(game, seat, used, target);
      if (!isDelayedTrick(used)) {
        triggerJizhi(game, seat, used);
      }
    } else {
      if (used.card_id !== "shandian") {
        discardCards(game, [used]);
      }
      resolveInstantTrick(game, seat, used);
      if (used.card_id !== "shandian") {
        triggerJizhi(game, seat, used);
      }
    }
    evaluateWinner(game);
    return;
  }

  const shaIndex = findCardIndex(seat, (card) => isCardUsableAsSha(seat, card));
  const target = chooseAiTarget(game, seat);
  if (
    shaIndex >= 0 &&
    target &&
    !hasTianyiLost(game, seat) &&
    (!game.turn.shaPlayed || canUseUnlimitedSha(seat, game))
  ) {
    const jiuIndex = findCardIndex(seat, isJiu);
    if (jiuIndex >= 0 && !game.turn.jiuUsed) {
      const jiu = removeCardAt(seat, jiuIndex, game);
      discardCards(game, [jiu]);
      game.turn.jiuUsed = true;
      game.turn.drunkShaBonus = 1;
      const message = `${seat.general.name} 使用【酒】，准备加强杀。`;
      appendLog(game, message);
      setLastEffect(game, seat, jiu, message, undefined, "+杀");
    }
    const sha = removeCardAt(seat, shaIndex > jiuIndex && jiuIndex >= 0 ? shaIndex - 1 : shaIndex, game);
    discardCards(game, [sha]);
    const damage = 1 + game.turn.drunkShaBonus;
    markShaPlayedThisTurn(game, seat);
    game.turn.drunkShaBonus = 0;
    resolveShaAgainstTarget(game, seat, target, sha, damage);
    return;
  }

  appendLog(game, `${seat.general.name} 暂不出牌。`);
};

export const performLocalAiPlayStep = (source: GameState): GameState => {
  const game = cloneGame(source);
  if (game.pendingAction || game.winner) {
    return game;
  }

  const seat = activeSeat(game);
  if (!seat?.alive || seat.controller !== "ai" || game.turn.phase !== "出牌") {
    return game;
  }

  performAiPlay(game, seat);
  return game;
};

export const finishAiPlayPhase = (source: GameState): GameState => {
  const game = cloneGame(source);
  if (game.pendingAction || game.winner) {
    return game;
  }

  const seat = activeSeat(game);
  if (!seat?.alive || seat.controller !== "ai" || game.turn.phase !== "出牌") {
    return game;
  }

  appendLog(game, `${seat.general.name} 结束出牌阶段。`);
  game.turn.phase = "弃牌";
  game.turn.phaseStep += 1;
  return game;
};

const resetTurnFlags = (game: GameState) => {
  game.turn.shaPlayed = false;
  game.turn.jiuUsed = false;
  game.turn.drunkShaBonus = 0;
  game.turn.luoyiActive = false;
  game.turn.skipDraw = false;
  game.turn.skipPlay = false;
  game.turn.usedSkills = [];
  game.turn.tianyiState = null;
  game.turn.shuangxiongColor = null;
  game.turn.fangquanTargetSeatId = null;
  game.turn.fangquanCostCardId = null;
  game.turn.extraTurnReturnSeatId = null;
  game.turn.extraTurnReturnRound = null;
};

const startTurnForSeat = (game: GameState, seatId: number) => {
  game.turn.activeSeatId = seatId;
  game.turn.phase = "准备";
  game.turn.phaseStep += 1;
  resetTurnFlags(game);
};

const resolveExtraTurnReturn = (game: GameState, seat: Seat) => {
  const returnSeatId = game.turn.extraTurnReturnSeatId;
  if (returnSeatId === null || returnSeatId === undefined) {
    return false;
  }

  const returnRound = game.turn.extraTurnReturnRound ?? game.turn.round;
  const nextSeatId = game.seats[returnSeatId]?.alive
    ? returnSeatId
    : nextAliveSeatId(game, returnSeatId);
  appendLog(game, `${seat.general.name} 的额外回合结束，回到正常回合顺序。`);
  startTurnForSeat(game, nextSeatId);
  game.turn.round = returnRound;
  return true;
};

const resolveFangquanExtraTurn = (game: GameState, seat: Seat) => {
  const targetSeatId = game.turn.fangquanTargetSeatId;
  if (targetSeatId === null || targetSeatId === undefined) {
    return false;
  }

  const target = game.seats[targetSeatId];
  if (!target?.alive) {
    appendLog(game, `${seat.general.name} 的【放权】目标已离场，不能获得额外回合。`);
    return false;
  }

  if (seat.hand.length === 0) {
    appendLog(game, `${seat.general.name} 没有手牌可为【放权】弃置，额外回合取消。`);
    return false;
  }

  const selectedCostIndex =
    game.turn.fangquanCostCardId === null || game.turn.fangquanCostCardId === undefined
      ? -1
      : seat.hand.findIndex((card) => card.instance_id === game.turn.fangquanCostCardId);
  const cost = removeCardAt(seat, selectedCostIndex >= 0 ? selectedCostIndex : 0, game);
  discardCards(game, [cost]);
  const returnSeatId = nextAliveSeatId(game, seat.id);
  appendLog(game, `${seat.general.name} 为【放权】弃置${formatCard(cost)}，令 ${target.general.name} 获得一个额外回合。`);
  setLastEffect(game, seat, cost, `${seat.general.name} 结算【放权】。`, target, "额外回合");
  startTurnForSeat(game, target.id);
  game.turn.extraTurnReturnSeatId = returnSeatId;
  game.turn.extraTurnReturnRound = game.turn.round;
  return true;
};

const finalizeEndPhase = (game: GameState, seat: Seat) => {
  appendLog(game, `${seat.general.name} 的回合结束。`);
  if (resolveExtraTurnReturn(game, seat)) {
    return;
  }
  if (resolveFangquanExtraTurn(game, seat)) {
    return;
  }
  const nextSeatId = nextAliveSeatId(game, seat.id);
  startTurnForSeat(game, nextSeatId);
  if (nextSeatId <= seat.id) {
    game.turn.round += 1;
  }
};

const finishDiscardPhaseIfReady = (game: GameState, seat: Seat) => {
  if (!game.pendingAction && !game.winner && game.turn.phase === "结束") {
    if (continueEndPhaseSkills(game, seat)) {
      return;
    }
    finalizeEndPhase(game, seat);
  }
};

const finishJudgePhaseIfReady = (game: GameState, seatId: number) => {
  if (
    !game.pendingAction &&
    !game.winner &&
    game.turn.phase === "判定" &&
    game.turn.activeSeatId === seatId
  ) {
    advanceToNextPhase(game);
  }
};

export const respondToJudgeReplace = (
  source: GameState,
  replacementCardId: string | null,
): GameState => {
  const game = cloneGame(source);
  const pending = game.pendingAction;
  if (!pending || pending.type !== "judge_replace_response") {
    return game;
  }

  const judgeOwner = game.seats[pending.judgeOwnerSeatId];
  const replacer = game.seats[pending.replacerSeatId];
  game.pendingAction = null;
  if (!judgeOwner?.alive || !replacer?.alive) {
    return game;
  }

  let judgeCard = pending.judgeCard;
  if (replacementCardId && pending.replaceableCardIds.includes(replacementCardId)) {
    const replacement = removeCardFromHand(replacer, replacementCardId, game);
    if (replacement && canUseJudgeReplacementCard(replacer, replacement)) {
      discardCards(game, [judgeCard]);
      const skillName = judgeReplacementSkillName(replacer, replacement);
      appendLog(
        game,
        `${replacer.general.name} 发动【${skillName}】，用${formatCard(replacement)}替换 ${judgeOwner.general.name} 的判定牌${formatCard(judgeCard)}。`,
      );
      setLastEffect(game, replacer, replacement, `${replacer.general.name} 替换判定牌。`, judgeOwner, "改判", "response");
      judgeCard = replacement;
    }
  } else {
    appendLog(game, `${replacer.general.name} 不发动【鬼才/鬼道】。`);
  }

  judgeCard = replaceJudgeCard(
    game,
    judgeOwner,
    judgeCard,
    delayedJudgeShouldReplace(pending.trick, judgeOwner),
    { skipHuman: true },
  );
  resolveDelayedTrickJudge(game, judgeOwner, pending.trick, judgeCard, true);
  finishJudgePhaseIfReady(game, judgeOwner.id);
  return game;
};

export const respondToTiandu = (
  source: GameState,
  useSkill: boolean,
): GameState => {
  const game = cloneGame(source);
  const pending = game.pendingAction;
  if (!pending || pending.type !== "tiandu_response") {
    return game;
  }

  const judgeOwner = game.seats[pending.judgeOwnerSeatId];
  game.pendingAction = null;
  if (!judgeOwner?.alive) {
    return game;
  }

  if (useSkill) {
    judgeOwner.hand.push(pending.judgeCard);
    appendLog(game, `${judgeOwner.general.name} 发动【天妒】，获得判定牌${formatCard(pending.judgeCard)}。`);
    setLastEffect(game, judgeOwner, pending.judgeCard, `${judgeOwner.general.name} 发动【天妒】。`, judgeOwner, "+判定", "response");
  } else {
    discardCards(game, [pending.judgeCard]);
    appendLog(game, `${judgeOwner.general.name} 不发动【天妒】，判定牌${formatCard(pending.judgeCard)}进入弃牌堆。`);
  }

  continueAfterDelayedJudgeResult(
    game,
    {
      judgeOwnerSeatId: pending.judgeOwnerSeatId,
      trick: pending.trick,
      result: pending.result,
    },
    true,
  );
  finishJudgePhaseIfReady(game, judgeOwner.id);
  return game;
};

export const respondToSkillJudgeReplace = (
  source: GameState,
  replacementCardId: string | null,
): GameState => {
  const game = cloneGame(source);
  const pending = game.pendingAction;
  if (!pending || pending.type !== "skill_judge_replace_response") {
    return game;
  }

  const judgeOwner = game.seats[pending.judgeOwnerSeatId];
  const replacer = game.seats[pending.replacerSeatId];
  game.pendingAction = null;
  if (!judgeOwner?.alive || !replacer?.alive) {
    return game;
  }

  let judgeCard = pending.judgeCard;
  if (replacementCardId && pending.replaceableCardIds.includes(replacementCardId)) {
    const replacement = removeCardFromHand(replacer, replacementCardId, game);
    if (replacement && canUseJudgeReplacementCard(replacer, replacement)) {
      discardCards(game, [judgeCard]);
      const skillName = judgeReplacementSkillName(replacer, replacement);
      appendLog(
        game,
        `${replacer.general.name} 发动【${skillName}】，用${formatCard(replacement)}替换 ${judgeOwner.general.name} 的【${pending.skillName}】判定牌${formatCard(judgeCard)}。`,
      );
      setLastEffect(game, replacer, replacement, `${replacer.general.name} 替换判定牌。`, judgeOwner, "改判", "response");
      judgeCard = replacement;
    }
  } else {
    appendLog(game, `${replacer.general.name} 不发动【鬼才/鬼道】。`);
  }

  judgeCard = replaceJudgeCard(
    game,
    judgeOwner,
    judgeCard,
    skillJudgeShouldReplace(game, pending.context),
    { skipHuman: true },
  );
  resolveSkillJudgeResult(game, pending.context, judgeCard);
  return game;
};

export const respondToSkillTiandu = (
  source: GameState,
  useSkill: boolean,
): GameState => {
  const game = cloneGame(source);
  const pending = game.pendingAction;
  if (!pending || pending.type !== "skill_tiandu_response") {
    return game;
  }

  const judgeOwner = game.seats[pending.judgeOwnerSeatId];
  game.pendingAction = null;
  if (!judgeOwner?.alive) {
    return game;
  }

  if (useSkill) {
    judgeOwner.hand.push(pending.judgeCard);
    appendLog(game, `${judgeOwner.general.name} 发动【天妒】，获得【${pending.skillName}】判定牌${formatCard(pending.judgeCard)}。`);
    setLastEffect(game, judgeOwner, pending.judgeCard, `${judgeOwner.general.name} 发动【天妒】。`, judgeOwner, "+判定", "response");
  } else {
    discardCards(game, [pending.judgeCard]);
    appendLog(game, `${judgeOwner.general.name} 不发动【天妒】，判定牌${formatCard(pending.judgeCard)}进入弃牌堆。`);
  }

  continueAfterSkillJudgeDisposition(game, pending.context, pending.judgeCard);
  return game;
};

export const respondToDrawSkill = (
  source: GameState,
  useSkill: boolean,
): GameState => {
  const game = cloneGame(source);
  const pending = game.pendingAction;
  if (!pending || pending.type !== "draw_skill_response") {
    return game;
  }

  const seat = game.seats[pending.seatId];
  game.pendingAction = null;
  if (!seat?.alive || game.turn.activeSeatId !== seat.id || game.turn.phase !== "摸牌") {
    return game;
  }

  if (pending.skillName === "双雄") {
    if (useSkill) {
      resolveShuangxiong(game, seat);
      return game;
    } else {
      appendLog(game, `${seat.general.name} 不发动【双雄】。`);
      continueDrawPhaseSkills(game, seat, pending.nextSkillIndex);
    }
  } else if (pending.skillName === "裸衣") {
    drawNormalPhaseCards(game, seat, useSkill);
    if (!useSkill) {
      appendLog(game, `${seat.general.name} 不发动【裸衣】。`);
    }
  }

  if (!game.pendingAction && !game.winner) {
    advanceToNextPhase(game);
  }
  return game;
};

export const respondToTuxi = (
  source: GameState,
  targetSeatIds: number[],
): GameState => {
  const game = cloneGame(source);
  const pending = game.pendingAction;
  if (!pending || pending.type !== "tuxi_response") {
    return game;
  }

  const seat = game.seats[pending.seatId];
  game.pendingAction = null;
  if (!seat?.alive || game.turn.activeSeatId !== seat.id || game.turn.phase !== "摸牌") {
    return game;
  }

  const selectedTargetIds = targetSeatIds
    .filter((seatId) => pending.validTargetIds.includes(seatId))
    .slice(0, 2);
  if (selectedTargetIds.length > 0) {
    resolveTuxiFromTargets(game, seat, selectedTargetIds);
  } else {
    appendLog(game, `${seat.general.name} 不发动【突袭】。`);
    continueDrawPhaseSkills(game, seat, pending.nextSkillIndex);
  }

  if (!game.pendingAction && !game.winner) {
    advanceToNextPhase(game);
  }
  return game;
};

export const respondToKeji = (
  source: GameState,
  useSkill: boolean,
): GameState => {
  const game = cloneGame(source);
  const pending = game.pendingAction;
  if (!pending || pending.type !== "keji_response") {
    return game;
  }

  const seat = game.seats[pending.seatId];
  game.pendingAction = null;
  if (!seat?.alive || game.turn.activeSeatId !== seat.id || game.turn.phase !== "弃牌") {
    return game;
  }

  if (useSkill) {
    appendLog(game, `${seat.general.name} 发动【克己】，跳过弃牌阶段。`);
    advanceFromDiscardToEnd(game);
  } else {
    appendLog(game, `${seat.general.name} 不发动【克己】。`);
    resolveDiscardOverflow(game, seat);
  }

  finishDiscardPhaseIfReady(game, seat);
  return game;
};

export const respondToEndSkill = (
  source: GameState,
  useSkill: boolean,
): GameState => {
  const game = cloneGame(source);
  const pending = game.pendingAction;
  if (!pending || pending.type !== "end_skill_response") {
    return game;
  }

  const seat = game.seats[pending.seatId];
  game.pendingAction = null;
  if (!seat?.alive || game.turn.activeSeatId !== seat.id || game.turn.phase !== "结束") {
    return game;
  }

  if (useSkill) {
    resolveEndPhaseSkillEffect(game, seat, pending.skillName);
  } else {
    appendLog(game, `${seat.general.name} 不发动【${pending.skillName}】。`);
  }

  if (continueEndPhaseSkills(game, seat, pending.nextSkillIndex)) {
    return game;
  }
  finalizeEndPhase(game, seat);
  return game;
};

export const respondToGuanxing = (
  source: GameState,
  topCardIds: string[],
): GameState => {
  const game = cloneGame(source);
  const pending = game.pendingAction;
  if (!pending || pending.type !== "guanxing_response") {
    return game;
  }

  const seat = game.seats[pending.seatId];
  game.pendingAction = null;
  if (!seat?.alive || game.turn.activeSeatId !== seat.id || game.turn.phase !== "准备") {
    game.piles.draw.unshift(...pending.viewedCards);
    return game;
  }

  const byId = new Map(pending.viewedCards.map((card) => [card.instance_id, card]));
  const topCards: DeckInstance[] = [];
  for (const instanceId of topCardIds) {
    const card = byId.get(instanceId);
    if (card && !topCards.some((item) => item.instance_id === card.instance_id)) {
      topCards.push(card);
    }
  }
  const bottomCards = pending.viewedCards.filter(
    (card) => !topCards.some((item) => item.instance_id === card.instance_id),
  );
  game.piles.draw.unshift(...topCards);
  game.piles.draw.push(...bottomCards);
  appendLog(
    game,
    `${seat.general.name} 发动【观星】，将 ${topCards.length} 张置于牌堆顶，${bottomCards.length} 张置于牌堆底。`,
  );

  continuePreparePhaseSkills(game, seat, 1);
  if (!game.pendingAction && !game.winner) {
    advanceToNextPhase(game);
  }
  return game;
};

export const respondToLuoshen = (
  source: GameState,
  useSkill: boolean,
): GameState => {
  const game = cloneGame(source);
  const pending = game.pendingAction;
  if (!pending || pending.type !== "luoshen_response") {
    return game;
  }

  const seat = game.seats[pending.seatId];
  game.pendingAction = null;
  if (!seat?.alive || game.turn.activeSeatId !== seat.id || game.turn.phase !== "准备") {
    return game;
  }

  if (!useSkill) {
    appendLog(
      game,
      pending.count > 0
        ? `${seat.general.name} 停止【洛神】。`
        : `${seat.general.name} 不发动【洛神】。`,
    );
    advanceToNextPhase(game);
    return game;
  }

  startSkillJudge(game, {
    type: "luoshen",
    seatId: seat.id,
    count: pending.count,
    auto: false,
  });
  return game;
};

export const advanceGame = (source: GameState): GameState => {
  const game = cloneGame(source);
  if (game.pendingAction || game.winner) {
    return game;
  }

  let seat = activeSeat(game);
  if (!seat.alive) {
    game.turn.activeSeatId = nextAliveSeatId(game, seat.id);
    seat = activeSeat(game);
  }

  const currentPhaseIndex = phaseOrder.indexOf(game.turn.phase);

  if (game.turn.phase === "准备") {
    game.turn.skipDraw = false;
    game.turn.skipPlay = false;
    game.turn.luoyiActive = false;
    appendLog(game, `第 ${game.turn.round} 轮：${seat.general.name} 的回合开始。`);
    continuePreparePhaseSkills(game, seat);
    if (game.pendingAction || game.winner) {
      return game;
    }
  }

  if (game.turn.phase === "判定") {
    if (game.turn.skipDraw && hasUsedSkillThisTurn(game, "神速")) {
      appendLog(game, `${seat.general.name} 因【神速】跳过判定阶段。`);
    } else if (!tryShensuSkipJudgeDraw(game, seat)) {
      processJudgeArea(game, seat);
    }
    if (game.pendingAction || game.winner) {
      return game;
    }
  }

  if (game.turn.phase === "摸牌") {
    if (beginQiaobianPhasePrompt(game, seat, "摸牌")) {
      return game;
    }
    resolveDrawPhaseNormally(game, seat);
    if (game.pendingAction || game.winner) {
      return game;
    }
  }

  if (game.turn.phase === "出牌") {
    if (beginQiaobianPhasePrompt(game, seat, "出牌")) {
      return game;
    }
    if (game.turn.skipPlay) {
      appendLog(game, `${seat.general.name} 跳过出牌阶段。`);
    } else if (seat.controller === "ai") {
      performAiPlay(game, seat);
      if (game.pendingAction || game.winner) {
        return game;
      }
    } else {
      appendLog(game, "玩家结束出牌阶段。");
    }
  }

  if (game.turn.phase === "弃牌") {
    if (beginQiaobianPhasePrompt(game, seat, "弃牌")) {
      return game;
    }
    resolveDiscardPhaseNormally(game, seat);
    return game;
  }

  if (game.turn.phase === "结束") {
    if (continueEndPhaseSkills(game, seat)) {
      return game;
    }
    finalizeEndPhase(game, seat);
    return game;
  }

  game.turn.phase = phaseOrder[currentPhaseIndex + 1] ?? "结束";
  game.turn.phaseStep += 1;
  return game;
};

export const setPaused = (source: GameState, paused: boolean): GameState => ({
  ...source,
  paused,
  log: [`AI 自动推进${paused ? "已暂停" : "已继续"}。`, ...source.log].slice(0, GAME_LOG_LIMIT),
});

export const getVisibleRole = (seat: Seat) => (seat.roleVisible ? seat.role : "暗置");

export const getDyingCards = (game: GameState) => {
  const pending = game.pendingAction;
  if (!pending || pending.type !== "dying_response") {
    return [];
  }
  const responder = game.seats[pending.responderSeatId];
  const dying = game.seats[pending.dyingSeatId];
  if (!responder || !dying) {
    return [];
  }
  return eligibleDyingCards(game, responder, dying);
};

export const summarizeState = (game: GameState) => ({
  mode: "肥喵多尼的AI三国杀",
  coordinateSystem: "CSS absolute seat ring; seat 0 at bottom center, clockwise around table",
  seed: game.seed,
  round: game.turn.round,
  phase: game.turn.phase,
  activeSeatId: game.turn.activeSeatId,
  activeGeneral: activeSeat(game).general.name,
  activeController: activeSeat(game).controller,
  drawPile: game.piles.draw.length,
  discardPile: game.piles.discard.length,
  pendingAction: game.pendingAction,
  winner: game.winner,
  lastEffect: game.lastEffect,
  log: game.log.slice(0, 30),
  turnFlags: {
    shaPlayed: game.turn.shaPlayed,
    jiuUsed: game.turn.jiuUsed,
    drunkShaBonus: game.turn.drunkShaBonus,
    luoyiActive: game.turn.luoyiActive,
    skipDraw: game.turn.skipDraw,
    skipPlay: game.turn.skipPlay,
    usedSkills: game.turn.usedSkills,
    tianyiState: game.turn.tianyiState,
    shuangxiongColor: game.turn.shuangxiongColor,
    fangquanTargetSeatId: game.turn.fangquanTargetSeatId,
    fangquanCostCardId: game.turn.fangquanCostCardId,
    extraTurnReturnSeatId: game.turn.extraTurnReturnSeatId,
  },
  paused: game.paused,
  playerHand: game.seats
    .find((seat) => seat.controller === "human")
    ?.hand.map((card) => ({
      id: card.instance_id,
      cardId: card.card_id,
      name: card.name,
      suit: card.suit_symbol,
      rank: card.rank,
    })) ?? [],
  seats: game.seats.map((seat) => ({
    id: seat.id,
    controller: seat.controller,
    visibleRole: getVisibleRole(seat),
    actualRole: seat.role,
    general: seat.general.name,
    faction: seat.general.faction,
    hp: seat.hp,
    maxHp: seat.maxHp,
    chained: seat.chained,
    buquMarks: seat.buquMarks.map((card) => ({
      id: card.instance_id,
      rank: card.rank,
      name: card.name,
    })),
    handCount: seat.hand.length,
    equipmentCount: seat.equipment.length,
    equipment: seat.equipment.map((card) => ({
      id: card.instance_id,
      cardId: card.card_id,
      name: card.name,
      slot: getEquipmentSlot(card),
    })),
    attackRange: getAttackRange(seat),
    distanceFromPlayer:
      game.seats[0] && seat.id !== 0
        ? distanceBetweenSeats(game, game.seats[0], seat)
        : 0,
    judgeCount: seat.judgeArea.length,
    judgeArea: seat.judgeArea.map((card) => ({
      id: card.instance_id,
      cardId: card.card_id,
      name: card.name,
    })),
    alive: seat.alive,
    active: seat.id === game.turn.activeSeatId,
  })),
});

