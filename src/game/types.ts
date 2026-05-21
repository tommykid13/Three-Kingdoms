import type { DeckInstance, General } from "../data/types";

export type Role = "主公" | "忠臣" | "反贼" | "内奸";
export type Controller = "human" | "ai";
export type Phase = "准备" | "判定" | "摸牌" | "出牌" | "弃牌" | "结束";
export type DamageType = "normal" | "fire" | "thunder";
export type WinnerSide = "主忠" | "反贼" | "内奸";
export type EquipmentSlot = "weapon" | "armor" | "offensiveMount" | "defensiveMount";
export type DeclaredSuit = "黑桃" | "红桃" | "梅花" | "方片";

export type ShaContinuation = {
  sourceSeatId: number;
  card: DeckInstance;
  damage: number;
  remainingTargetIds: number[];
};

export type LeijiResume =
  | {
      kind: "shan_response";
      sourceSeatId: number;
      targetSeatId: number;
      card: DeckInstance;
      cardName: string;
      damage: number;
      damageType: DamageType;
      requiredResponses: number;
      respondedResponses: number;
    }
  | {
      kind: "basic_card_response";
      sourceSeatId: number;
      targetSeatId: number;
      card: DeckInstance;
      cardName: string;
      requiredCard: "sha" | "shan";
      damage: number;
      damageType: DamageType;
      remainingTargetIds: number[];
    }
  | {
      kind: "none";
    };

export type SkillJudgeContext =
  | {
      type: "ganglie";
      sourceSeatId: number;
      targetSeatId: number;
      amount: number;
      damageType: DamageType;
      damageCard?: DeckInstance;
      transmittedTargetIds: number[];
      nextSkillIndex: number;
    }
  | {
      type: "tieqi";
      sourceSeatId: number;
      targetSeatId: number;
      card: DeckInstance;
      finalDamage: number;
      damageType: DamageType;
      cannotUseShan: boolean;
    }
  | {
      type: "leiji";
      actorSeatId: number;
      targetSeatId: number;
      resume: LeijiResume;
    }
  | {
      type: "luoshen";
      seatId: number;
      count: number;
      auto: boolean;
    }
  | {
      type: "shuangxiong";
      seatId: number;
    };

export type PendingAction =
  | {
      type: "shan_response";
      sourceSeatId: number;
      targetSeatId: number;
      card: DeckInstance;
      cardName: string;
      damage: number;
      damageType: DamageType;
      requiredResponses: number;
      respondedResponses: number;
      canRespond: boolean;
      message: string;
    }
  | {
      type: "basic_card_response";
      sourceSeatId: number;
      targetSeatId: number;
      card: DeckInstance;
      cardName: string;
      cardImagePath: string | null;
      requiredCard: "sha" | "shan";
      damage: number;
      damageType: DamageType;
      remainingTargetIds: number[];
      canRespond: boolean;
      canWuxie: boolean;
      message: string;
    }
  | {
      type: "wuxie_response";
      sourceSeatId: number;
      targetSeatId: number;
      secondaryTargetSeatId?: number;
      originalTargetSeatId: number;
      responderSeatId: number;
      card: DeckInstance;
      effect:
        | "targeted_trick"
        | "mass_damage"
        | "wuzhong_draw"
        | "taoyuan_heal"
        | "wugu_gain"
        | "tiesuo_toggle"
        | "delayed_trick"
        | "delayed_skip_draw"
        | "delayed_skip_play"
        | "delayed_damage";
      damage?: number;
      damageType?: DamageType;
      remainingTargetIds?: number[];
      revealedCards?: DeckInstance[];
      requiredCard?: "sha" | "shan";
      discardOnCancel?: boolean;
      nullified: boolean;
      checkedSeatIds: number[];
      chainSeatIds: number[];
      message: string;
    }
  | {
      type: "duel_sha_response";
      sourceSeatId: number;
      targetSeatId: number;
      currentSeatId: number;
      opponentSeatId: number;
      card: DeckInstance;
      rounds: number;
      requiredResponses: number;
      respondedResponses: number;
      canRespond: boolean;
      message: string;
    }
  | {
      type: "guanshi_force_response";
      sourceSeatId: number;
      targetSeatId: number;
      card: DeckInstance;
      damage: number;
      damageType: DamageType;
      discardableCards: DeckInstance[];
      message: string;
    }
  | {
      type: "xiangle_response";
      sourceSeatId: number;
      targetSeatId: number;
      card: DeckInstance;
      damage: number;
      damageType: DamageType;
      basicCardIds: string[];
      message: string;
    }
  | {
      type: "qiangxi_cost_response";
      sourceSeatId: number;
      targetSeatId: number;
      weaponOptions: Array<{
        key: string;
        zone: "手牌" | "装备区";
        card: DeckInstance;
      }>;
      message: string;
    }
  | {
      type: "qinglong_followup_response";
      sourceSeatId: number;
      targetSeatId: number;
      previousCard: DeckInstance;
      shaCardIds: string[];
      message: string;
    }
  | {
      type: "cixiong_response";
      sourceSeatId: number;
      targetSeatId: number;
      card: DeckInstance;
      damage: number;
      handCardIds: string[];
      message: string;
    }
  | {
      type: "hanbing_response";
      sourceSeatId: number;
      targetSeatId: number;
      card: DeckInstance;
      damage: number;
      damageType: DamageType;
      options: Array<{
        key: string;
        zone: "手牌" | "装备区" | "判定区";
        label: string;
        card?: DeckInstance;
      }>;
      message: string;
    }
  | {
      type: "qilingong_response";
      sourceSeatId: number;
      targetSeatId: number;
      amount: number;
      damageType: DamageType;
      damageCard: DeckInstance;
      transmittedTargetIds: number[];
      mountOptions: Array<{
        key: string;
        slot: "offensiveMount" | "defensiveMount";
        card: DeckInstance;
      }>;
      message: string;
    }
  | {
      type: "guohe_select_response";
      sourceSeatId: number;
      targetSeatId: number;
      card: DeckInstance;
      options: Array<{
        key: string;
        zone: "手牌" | "装备区" | "判定区";
        label: string;
        card?: DeckInstance;
      }>;
      message: string;
    }
  | {
      type: "shunshou_select_response";
      sourceSeatId: number;
      targetSeatId: number;
      card: DeckInstance;
      options: Array<{
        key: string;
        zone: "手牌" | "装备区" | "判定区";
        label: string;
        card?: DeckInstance;
      }>;
      message: string;
    }
  | {
      type: "mengjin_response";
      sourceSeatId: number;
      targetSeatId: number;
      card: DeckInstance;
      damage: number;
      damageType: DamageType;
      options: Array<{
        key: string;
        zone: "手牌" | "装备区" | "判定区";
        label: string;
        card?: DeckInstance;
      }>;
      message: string;
    }
  | {
      type: "huogong_discard";
      sourceSeatId: number;
      targetSeatId: number;
      card: DeckInstance;
      revealedCard: DeckInstance;
      discardableCardIds: string[];
      message: string;
    }
  | {
      type: "jiedao_sha_response";
      sourceSeatId: number;
      weaponOwnerSeatId: number;
      victimSeatId: number;
      card: DeckInstance;
      weapon: DeckInstance;
      canRespond: boolean;
      message: string;
    }
  | {
      type: "qihu_sha_response";
      sourceSeatId: number;
      forcedSeatId: number;
      victimSeatId: number;
      card: DeckInstance;
      canRespond: boolean;
      message: string;
    }
  | {
      type: "wugufengdeng_select";
      sourceSeatId: number;
      responderSeatId: number;
      card: DeckInstance;
      revealedCards: DeckInstance[];
      remainingSeatIds: number[];
      message: string;
    }
  | {
      type: "judge_replace_response";
      judgeOwnerSeatId: number;
      replacerSeatId: number;
      trick: DeckInstance;
      judgeCard: DeckInstance;
      replaceableCardIds: string[];
      message: string;
    }
  | {
      type: "skill_judge_replace_response";
      judgeOwnerSeatId: number;
      replacerSeatId: number;
      skillName: string;
      judgeCard: DeckInstance;
      replaceableCardIds: string[];
      context: SkillJudgeContext;
      message: string;
    }
  | {
      type: "tiandu_response";
      judgeOwnerSeatId: number;
      trick: DeckInstance;
      judgeCard: DeckInstance;
      result:
        | "lebusishu_hit"
        | "lebusishu_pass"
        | "bingliangcunduan_hit"
        | "bingliangcunduan_pass"
        | "shandian_hit"
        | "shandian_pass"
        | "unknown";
      message: string;
    }
  | {
      type: "skill_tiandu_response";
      judgeOwnerSeatId: number;
      skillName: string;
      judgeCard: DeckInstance;
      context: SkillJudgeContext;
      message: string;
    }
  | {
      type: "dying_response";
      dyingSeatId: number;
      sourceSeatId: number | null;
      responderSeatId: number;
      requiredHp: number;
      checkedSeatIds: number[];
      message: string;
    }
  | {
      type: "discard_cards";
      seatId: number;
      requiredCount: number;
      message: string;
    }
  | {
      type: "liuli_response";
      sourceSeatId: number;
      targetSeatId: number;
      card: DeckInstance;
      damage: number;
      validTargetIds: number[];
      message: string;
    }
  | {
      type: "tianxiang_response";
      sourceSeatId: number | null;
      targetSeatId: number;
      amount: number;
      damageType: DamageType;
      damageCard?: DeckInstance;
      validTargetIds: number[];
      message: string;
    }
  | {
      type: "beige_response";
      singerSeatId: number;
      targetSeatId: number;
      sourceSeatId: number | null;
      amount: number;
      damageType: DamageType;
      damageCard: DeckInstance;
      transmittedTargetIds: number[];
      message: string;
    }
  | {
      type: "beige_club_discard_response";
      singerSeatId: number;
      targetSeatId: number;
      sourceSeatId: number;
      amount: number;
      damageType: DamageType;
      damageCard: DeckInstance;
      transmittedTargetIds: number[];
      discardableCardIds: string[];
      requiredCount: number;
      message: string;
    }
  | {
      type: "fankui_response";
      targetSeatId: number;
      sourceSeatId: number;
      amount: number;
      damageType: DamageType;
      damageCard?: DeckInstance;
      transmittedTargetIds: number[];
      nextSkillIndex: number;
      cardOptions: Array<{
        key: string;
        zone: "手牌" | "装备区" | "判定区";
        label: string;
        card?: DeckInstance;
      }>;
      message: string;
    }
  | {
      type: "yiji_response";
      targetSeatId: number;
      sourceSeatId: number | null;
      amount: number;
      damageType: DamageType;
      damageCard?: DeckInstance;
      transmittedTargetIds: number[];
      nextSkillIndex: number;
      drawCount: number;
      validTargetIds: number[];
      revealedCards?: DeckInstance[];
      message: string;
    }
  | {
      type: "jieming_response";
      targetSeatId: number;
      sourceSeatId: number | null;
      amount: number;
      damageType: DamageType;
      damageCard?: DeckInstance;
      transmittedTargetIds: number[];
      nextSkillIndex: number;
      validTargetIds: number[];
      message: string;
    }
  | {
      type: "jianxiong_response";
      targetSeatId: number;
      sourceSeatId: number | null;
      amount: number;
      damageType: DamageType;
      damageCard: DeckInstance;
      transmittedTargetIds: number[];
      nextSkillIndex: number;
      message: string;
    }
  | {
      type: "ganglie_response";
      targetSeatId: number;
      sourceSeatId: number;
      amount: number;
      damageType: DamageType;
      damageCard?: DeckInstance;
      transmittedTargetIds: number[];
      nextSkillIndex: number;
      message: string;
    }
  | {
      type: "ganglie_cost_response";
      targetSeatId: number;
      sourceSeatId: number;
      amount: number;
      damageType: DamageType;
      damageCard?: DeckInstance;
      transmittedTargetIds: number[];
      nextSkillIndex: number;
      discardableCardIds: string[];
      message: string;
    }
  | {
      type: "fanjian_suit_response";
      sourceSeatId: number;
      targetSeatId: number;
      card: DeckInstance;
      message: string;
    }
  | {
      type: "xiaoji_response";
      seatId: number;
      card: DeckInstance;
      message: string;
    }
  | {
      type: "leiji_response";
      actorSeatId: number;
      validTargetIds: number[];
      resume: LeijiResume;
      message: string;
    }
  | {
      type: "draw_skill_response";
      seatId: number;
      skillName: "双雄" | "裸衣";
      nextSkillIndex: number;
      message: string;
    }
  | {
      type: "tuxi_response";
      seatId: number;
      validTargetIds: number[];
      nextSkillIndex: number;
      message: string;
    }
  | {
      type: "keji_response";
      seatId: number;
      message: string;
    }
  | {
      type: "end_skill_response";
      seatId: number;
      skillName: "据守" | "闭月";
      nextSkillIndex: number;
      message: string;
    }
  | {
      type: "guanxing_response";
      seatId: number;
      viewedCards: DeckInstance[];
      message: string;
    }
  | {
      type: "luoshen_response";
      seatId: number;
      count: number;
      message: string;
    }
  | {
      type: "qiaobian_phase";
      seatId: number;
      phase: "摸牌" | "出牌" | "弃牌";
      message: string;
    }
  | {
      type: "qiaobian_draw_targets";
      seatId: number;
      message: string;
    }
  | {
      type: "qiaobian_play_move";
      seatId: number;
      message: string;
    }
  | {
      type: "shensu_response";
      seatId: number;
      mode: "skip_judge_draw" | "skip_play";
      validTargetIds: number[];
      equipmentCardIds: string[];
      message: string;
    }
  | {
      type: "fangquan_play_response";
      seatId: number;
      message: string;
    }
  | {
      type: "fangquan_end_response";
      seatId: number;
      validTargetIds: number[];
      discardableCardIds: string[];
      message: string;
    };

export type Winner = {
  side: WinnerSide;
  reason: string;
};

export type ActionEffect = {
  sequence: number;
  sourceSeatId: number;
  targetSeatId?: number;
  effectKind?: "card" | "target" | "damage" | "heal" | "response";
  actorName: string;
  targetName?: string;
  cardId: string;
  cardName: string;
  cardImagePath: string | null;
  message: string;
  impactText?: string;
};

export type Seat = {
  id: number;
  controller: Controller;
  role: Role;
  roleVisible: boolean;
  general: General;
  hp: number;
  maxHp: number;
  alive: boolean;
  chained: boolean;
  turnedOver: boolean;
  awakenedSkills: string[];
  buquMarks: DeckInstance[];
  hand: DeckInstance[];
  equipment: DeckInstance[];
  judgeArea: DeckInstance[];
};

export type Piles = {
  draw: DeckInstance[];
  discard: DeckInstance[];
};

export type TurnState = {
  round: number;
  activeSeatId: number;
  phase: Phase;
  phaseStep: number;
  shaPlayed: boolean;
  shaUsedCount?: number;
  jiuUsed: boolean;
  drunkShaBonus: number;
  luoyiActive: boolean;
  skipDraw: boolean;
  skipPlay: boolean;
  usedSkills: string[];
  rendeGivenCount: number;
  rendeRecovered: boolean;
  tianyiState?: "won" | "lost" | null;
  shuangxiongColor?: "red" | "black" | null;
  fangquanTargetSeatId?: number | null;
  fangquanCostCardId?: string | null;
  fangquanResolved?: boolean;
  extraTurnReturnSeatId?: number | null;
  extraTurnReturnRound?: number | null;
};

export type GameState = {
  seed: number;
  seats: Seat[];
  piles: Piles;
  turn: TurnState;
  shaContinuation: ShaContinuation | null;
  pendingAction: PendingAction | null;
  winner: Winner | null;
  lastEffect: ActionEffect | null;
  log: string[];
  paused: boolean;
};

export type PublicSeatSnapshot = {
  id: number;
  controller: Controller;
  visibleRole: Role | "暗置";
  actualRole: Role;
  general: string;
  faction: string;
  hp: number;
  maxHp: number;
  chained: boolean;
  handCount: number;
  equipmentCount: number;
  judgeCount: number;
  active: boolean;
};
