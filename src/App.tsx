import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getDisplayAssetPath,
  loadGameData,
  summarizeDeckPacks,
  summarizeGeneralPacks,
} from "./data/gameData";
import type { DeckInstance, GameData, General } from "./data/types";
import { createInitialGame, roleCounts } from "./game/setup";
import { getTrickAnimationClass } from "./game/trickAnimations";
import {
  advanceGame,
  activateSkill,
  activateSkillWithSelection,
  continuePendingShaTargets,
  confirmDiscard,
  distanceBetweenSeats,
  finishAiPlayPhase,
  GAME_LOG_LIMIT,
  getCardPlayInfo,
  getDyingCards,
  getDiscardOverflow,
  getHandLimit,
  getAttackRange,
  getEquipmentSlot,
  getGuoseTargetIds,
  getJiedaoVictimIds,
  getLianhuanTargetIds,
  getLongdanTargetIds,
  getLongdanTargetLimit,
  getQixiTargetIds,
  getShensuTargetIds,
  getShuangxiongTargetIds,
  getWushengTargetIds,
  getWushengTargetLimit,
  getZhangbaPlayInfo,
  getVisibleRole,
  isMaleSeat,
  canUseGuoseCard,
  canUseLianhuanCard,
  canUseLongdanShaCard,
  canUseQixiCard,
  canUseShuangxiongCard,
  canUseWushengCard,
  canUseZhangbaSha,
  isCardUsableAsSha,
  isCardUsableAsShan,
  isWuxie,
  offerHumanPlayPhaseOpeningPrompt,
  offerQiaobianPhase,
  passDyingResponse,
  playCardFromHand,
  playZhangbaShaFromHand,
  playDyingCard,
  respondToQiaobianDrawTargets,
  respondToQiaobianPhase,
  respondToQiaobianPlayMove,
  respondToQinglongFollowup,
  respondToBasicCard,
  respondToCixiongSword,
  respondToDuelSha,
  respondToDrawSkill,
  respondToEndSkill,
  respondToFangquanEnd,
  respondToFangquanPlay,
  respondToFankui,
  respondToFanjianSuit,
  respondToGanglie,
  respondToGanglieCost,
  respondToGuanshiForce,
  respondToGuoheSelect,
  respondToHanbingSword,
  respondToHuogongDiscard,
  respondToJiedaoSha,
  respondToJudgeReplace,
  respondToMengjin,
  respondToQilingong,
  respondToQihuSha,
  respondToQiangxiCost,
  respondToSkillJudgeReplace,
  respondToBeige,
  respondToBeigeClubDiscard,
  respondToJianxiong,
  respondToJieming,
  respondToKeji,
  respondToGuanxing,
  respondToLeiji,
  respondToLiuli,
  respondToLuoshen,
  respondToSha,
  respondToShensu,
  respondToShunshouSelect,
  respondToTianxiang,
  respondToTiandu,
  respondToSkillTiandu,
  respondToTuxi,
  respondToWuguSelect,
  respondToWuxie,
  respondToXiangle,
  respondToXiaoji,
  respondToYiji,
  setPaused,
  summarizeState,
} from "./game/turn";
import {
  aiProviderLabels,
  buildAiDecisionPayload,
  buildAiLegalActions,
  defaultAiModels,
  loadStoredAiConfig,
  requestAiDecision,
  saveStoredAiConfig,
  type AiLegalAction,
  type AiProviderConfig,
  type AiProviderId,
} from "./game/llmAi";
import type { DeclaredSuit, GameState, PendingAction, Role, Seat } from "./game/types";
import type { YijiAssignment } from "./game/turn";
import "./styles.css";

declare global {
  interface Window {
    render_game_to_text?: () => string;
    advanceTime?: (ms: number) => void;
  }
}

const phaseOrder = ["准备", "判定", "摸牌", "出牌", "弃牌", "结束"];
const identityDeck: Role[] = [
  "主公",
  "忠臣",
  "忠臣",
  "反贼",
  "反贼",
  "反贼",
  "反贼",
  "内奸",
];

const autoHumanPhases = new Set(["准备", "判定", "摸牌"]);

const implementedSkillNames = new Set([
  "英姿",
  "马术",
  "咆哮",
  "空城",
  "谦逊",
  "奇才",
  "血裔",
  "克己",
  "闭月",
  "突袭",
  "裸衣",
  "洛神",
  "天妒",
  "红颜",
  "狂骨",
  "反馈",
  "遗计",
  "节命",
  "刚烈",
  "享乐",
  "烈弓",
  "铁骑",
  "集智",
  "武圣",
  "龙胆",
  "倾国",
  "急救",
  "救援",
  "据守",
  "断肠",
  "枭姬",
  "猛进",
  "奸雄",
  "无双",
  "雷击",
  "若愚",
  "连营",
  "奇袭",
  "国色",
  "连环",
  "观星",
  "流离",
  "天香",
  "悲歌",
  "涅槃",
  "不屈",
  "仁德",
  "制衡",
  "苦肉",
  "反间",
  "青囊",
  "强袭",
  "乱击",
  "离间",
  "驱虎",
  "巧变",
  "结姻",
  "护驾",
  "鬼才",
  "激将",
  "神速",
  "鬼道",
  "黄天",
  "天义",
  "双雄",
  "放权",
]);

const isSkillImplemented = (skillName: string) =>
  implementedSkillNames.has(skillName);

const activeSkillNames = new Set([
  "仁德",
  "制衡",
  "苦肉",
  "反间",
  "青囊",
  "强袭",
  "乱击",
  "离间",
  "驱虎",
  "结姻",
  "放权",
  "黄天",
  "天义",
]);

const manualSkillNames = new Set([
  "武圣",
  "奇袭",
  "国色",
  "连环",
  "双雄",
  "龙胆",
  "仁德",
  "制衡",
  "反间",
  "青囊",
  "强袭",
  "乱击",
  "离间",
  "驱虎",
  "结姻",
  "放权",
  "黄天",
  "天义",
]);

const manualSkillCardLimit = (skillName: string | null) =>
  skillName === "仁德" || skillName === "制衡"
    ? Number.POSITIVE_INFINITY
    : skillName === "乱击" || skillName === "结姻"
      ? 2
      : skillName === "强袭"
        ? 0
        : 1;

const isManualSkillCardSelectable = (
  skillName: string | null,
  card: DeckInstance,
  seat?: Seat | null,
  game?: GameState | null,
) => {
  if (!skillName || skillName === "强袭") return false;
  if (skillName === "神速") {
    return Boolean(
      seat?.equipment.some(
        (equipment) => equipment.instance_id === card.instance_id && getEquipmentSlot(equipment),
      ),
    );
  }
  if (skillName === "武圣") return Boolean(seat && canUseWushengCard(seat, card));
  if (skillName === "奇袭") return Boolean(seat && canUseQixiCard(seat, card));
  if (skillName === "国色") return Boolean(seat && canUseGuoseCard(seat, card));
  if (skillName === "连环") return Boolean(seat && canUseLianhuanCard(seat, card));
  if (skillName === "双雄") return Boolean(game && seat && canUseShuangxiongCard(game, seat, card));
  if (skillName === "龙胆") return Boolean(seat && canUseLongdanShaCard(seat, card));
  if (skillName === "黄天") return card.card_id === "shan" || card.card_id === "shandian";
  return true;
};

const manualSkillCardLabel = (
  skillName: string | null,
  selected: boolean,
) => {
  if (!skillName) return undefined;
  if (selected) return "已选";
  if (skillName === "武圣") return "当杀";
  if (skillName === "奇袭") return "当拆";
  if (skillName === "国色") return "当乐";
  if (skillName === "连环") return "连环";
  if (skillName === "双雄") return "决斗";
  if (skillName === "龙胆") return "当杀";
  if (skillName === "仁德") return "交给";
  if (skillName === "驱虎" || skillName === "天义") return "拼点";
  if (skillName === "黄天") return "交给";
  if (skillName === "放权") return "回合末弃";
  return "弃置";
};

const isHeartCard = (card: DeckInstance) =>
  card.suit_symbol === "♥" || card.suit.includes("红桃");

const isSpadeCard = (card: DeckInstance) =>
  card.suit_symbol === "♠" || card.suit.includes("黑桃");

const hasSkillByName = (seat: Seat, skillName: string) =>
  seat.general.skills.some((skill) => skill.name === skillName);

const isEffectiveHeartCardForSeat = (seat: Seat, card: DeckInstance) =>
  isHeartCard(card) || (hasSkillByName(seat, "红颜") && isSpadeCard(card));

const hasSelectableZoneCard = (seat: Seat) =>
  seat.hand.length > 0 || seat.equipment.length > 0 || seat.judgeArea.length > 0;

const getQiaobianFieldCards = (seat: Seat) => [...seat.equipment, ...seat.judgeArea];

const getPlayerOwnedCard = (seat: Seat | null, cardInstanceId: string | null) =>
  cardInstanceId && seat
    ? seat.hand.find((card) => card.instance_id === cardInstanceId) ??
      seat.equipment.find((card) => card.instance_id === cardInstanceId) ??
      null
    : null;

const getPlayerShaResponseCards = (seat: Seat | null) =>
  seat
    ? [
        ...seat.hand.filter((card) => isCardUsableAsSha(seat, card)),
        ...seat.equipment.filter((card) => isCardUsableAsSha(seat, card)),
      ]
    : [];

const naturalShaCardIds = new Set(["sha", "huosha", "leisha"]);

const isLongdanAsShanCard = (seat: Seat, card: DeckInstance) =>
  hasSkillByName(seat, "龙胆") && naturalShaCardIds.has(card.card_id);

const isLongdanAsShaCard = (seat: Seat, card: DeckInstance) =>
  hasSkillByName(seat, "龙胆") && card.card_id === "shan";

const getShanResponseCardsForMode = (
  seat: Seat | null,
  useLongdan: boolean,
) =>
  seat
    ? seat.hand.filter(
        (card) =>
          isCardUsableAsShan(seat, card) &&
          (useLongdan ? isLongdanAsShanCard(seat, card) : !isLongdanAsShanCard(seat, card)),
      )
    : [];

const getShaResponseCardsForMode = (
  seat: Seat | null,
  useLongdan: boolean,
) =>
  seat
    ? getPlayerShaResponseCards(seat).filter(
        (card) =>
          useLongdan ? isLongdanAsShaCard(seat, card) : !isLongdanAsShaCard(seat, card),
      )
    : [];

const canMoveQiaobianCardToSeat = (
  sourceSeat: Seat,
  targetSeat: Seat,
  card: DeckInstance,
) => {
  if (!targetSeat.alive || targetSeat.id === sourceSeat.id) {
    return false;
  }
  const slot = getEquipmentSlot(card);
  if (slot) {
    return !targetSeat.equipment.some((item) => getEquipmentSlot(item) === slot);
  }
  if (card.card_id === "lebusishu" || card.card_id === "bingliangcunduan" || card.card_id === "shandian") {
    if (card.card_id === "lebusishu" && hasSkillByName(targetSeat, "谦逊")) {
      return false;
    }
    return !targetSeat.judgeArea.some((item) => item.card_id === card.card_id);
  }
  return false;
};

const continueAfterQiaobianIfReady = (game: GameState) =>
  !game.pendingAction && !game.winner && game.turn.phase === "结束"
    ? advanceGame(game)
    : game;

type SetupDraft = {
  seed: number;
  assignedRole: Role;
  generalIds: string[];
  selectedGeneralId: string;
};

const factionClassName = (faction: General["faction"]) =>
  `faction faction-${faction}`;

const roleToneClass = (role: Role | "暗置") => {
  if (role === "主公") return "is-lord";
  if (role === "忠臣") return "is-loyalist";
  if (role === "反贼") return "is-rebel";
  if (role === "内奸") return "is-traitor";
  return "is-hidden";
};

const equipmentSlotLabel = (slot: ReturnType<typeof getEquipmentSlot>) => {
  if (slot === "weapon") return "武器";
  if (slot === "armor") return "防具";
  if (slot === "offensiveMount") return "-1马";
  if (slot === "defensiveMount") return "+1马";
  return "装备";
};

const Stat = ({
  label,
  value,
  note,
}: {
  label: string;
  value: string | number;
  note?: string;
}) => (
  <div className="stat">
    <span className="stat-label">{label}</span>
    <strong>{value}</strong>
    {note ? <span className="stat-note">{note}</span> : null}
  </div>
);

const initialSeedFromUrl = () => {
  const params = new URLSearchParams(window.location.search);
  const seed = Number(params.get("seed"));
  return Number.isFinite(seed) && seed > 0 ? seed : undefined;
};

const makeSetupSeed = () =>
  initialSeedFromUrl() ?? Date.now() + Math.floor(Math.random() * 100000);

const createRng = (seed: number) => {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 2 ** 32;
  };
};

const shuffleBySeed = <T,>(items: T[], seed: number): T[] => {
  const rng = createRng(seed);
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

const createSetupDraft = (data: GameData, seed = makeSetupSeed()): SetupDraft => {
  const assignedRole = shuffleBySeed(identityDeck, seed)[0];
  const generalIds = shuffleBySeed(data.generals, seed + 17)
    .slice(0, 5)
    .map((general) => general.id);

  return {
    seed,
    assignedRole,
    generalIds,
    selectedGeneralId: generalIds[0] ?? data.generals[0]?.id ?? "",
  };
};

const seatAnchors: Record<number, { x: number; y: number }> = {
  0: { x: 50, y: 84 },
  1: { x: 20, y: 74 },
  2: { x: 11, y: 50 },
  3: { x: 20, y: 27 },
  4: { x: 50, y: 18 },
  5: { x: 80, y: 27 },
  6: { x: 89, y: 50 },
  7: { x: 80, y: 74 },
};

const MiniCard = ({
  card,
  disabled,
  selected,
  label,
  reason,
  onClick,
}: {
  card: DeckInstance;
  disabled?: boolean;
  selected?: boolean;
  label?: string;
  reason?: string;
  onClick?: () => void;
}) => {
  const imageSrc = getDisplayAssetPath(card.imagePath);

  return (
    <button
      type="button"
      className={`mini-card mini-card-${card.color}${selected ? " is-selected" : ""}`}
      disabled={disabled}
      title={reason}
      onClick={onClick}
      data-testid={`hand-card-${card.instance_id}`}
    >
      {imageSrc ? <img src={imageSrc} alt={card.name} /> : null}
      <span className="mini-card-corner">
        {card.suit_symbol}
        {card.rank}
      </span>
      <span className="mini-card-name">{card.name}</span>
      {label ? <em>{label}</em> : null}
    </button>
  );
};

const HealthHearts = ({ hp, maxHp }: { hp: number; maxHp: number }) => (
  <span className="health-hearts" aria-label={`${hp}/${maxHp} 体力`}>
    {Array.from({ length: maxHp }, (_, index) => (
      <span key={index} className={index < hp ? "is-filled" : "is-empty"}>
        ♥
      </span>
    ))}
  </span>
);

const ZoneCardChip = ({
  card,
  label,
  tone,
}: {
  card: DeckInstance;
  label?: string;
  tone?: "equipment" | "judge";
}) => {
  const imageSrc = getDisplayAssetPath(card.imagePath);

  return (
    <span
      className={`seat-card-chip${tone ? ` is-${tone}` : ""}`}
      title={label ? `${label}：${card.name}` : card.name}
    >
      {imageSrc ? <img src={imageSrc} alt="" /> : null}
      <span>{label ? `${label}：` : ""}{card.name}</span>
    </span>
  );
};

const judgeMarkerText = (cardId: string) => {
  if (cardId === "lebusishu") return "乐";
  if (cardId === "bingliangcunduan") return "兵";
  if (cardId === "shandian") return "雷";
  return "判";
};

const JudgeMarker = ({ card }: { card: DeckInstance }) => {
  const imageSrc = getDisplayAssetPath(card.imagePath);

  return (
    <span className={`judge-marker judge-marker-${card.card_id}`} title={card.name}>
      {imageSrc ? <img src={imageSrc} alt="" /> : null}
      <strong>{judgeMarkerText(card.card_id)}</strong>
    </span>
  );
};

type SeatEffectPulse = {
  kind: "target" | "damage";
  label: string;
  sequence: number;
};

const SeatPanel = ({
  seat,
  active,
  targetable,
  targetSelected,
  needsAction,
  effectPulse,
  onTarget,
  onPreviewGeneral,
  attackRange,
  distanceFromPlayer,
}: {
  seat: Seat;
  active: boolean;
  targetable?: boolean;
  targetSelected?: boolean;
  needsAction?: boolean;
  effectPulse?: SeatEffectPulse | null;
  attackRange: number;
  distanceFromPlayer: number;
  onTarget?: () => void;
  onPreviewGeneral?: (general: General) => void;
}) => (
  <article
    className={`seat-panel seat-${seat.id}${seat.role === "主公" ? " is-lord-seat" : ""}${active ? " is-active" : ""}${targetable ? " is-targetable" : ""}${targetSelected ? " is-target-selected" : ""}${needsAction ? " is-needs-action" : ""}${seat.turnedOver ? " is-turned-over" : ""}${!seat.alive ? " is-dead" : ""}`}
    onClick={targetable ? onTarget : undefined}
    data-testid={`seat-${seat.id}`}
  >
    {effectPulse ? (
      <div
        key={effectPulse.sequence}
        className={`seat-effect-pulse is-${effectPulse.kind}`}
        aria-hidden="true"
      >
        {effectPulse.label}
      </div>
    ) : null}
    {seat.role === "主公" ? (
      <div className="lord-ribbon" aria-label="主公">
        主公
      </div>
    ) : null}
    {seat.judgeArea.length > 0 ? (
      <div className="seat-judge-markers" aria-label={`${seat.general.name}判定牌`}>
        {seat.judgeArea.map((card) => (
          <JudgeMarker key={card.instance_id} card={card} />
        ))}
      </div>
    ) : null}
    <button
      type="button"
      className="seat-portrait"
      onClick={(event) => {
        event.stopPropagation();
        onPreviewGeneral?.(seat.general);
      }}
      aria-label={`查看${seat.general.name}武将图`}
    >
      <img
        src={getDisplayAssetPath(seat.general.image.path) ?? ""}
        alt={seat.general.name}
      />
    </button>
    <div className="seat-body">
      <div className="seat-title">
        <div>
          <span>{seat.id + 1}号位 · {seat.controller === "human" ? "玩家" : "AI"}</span>
          <h3>{seat.general.name}</h3>
        </div>
        <div className={factionClassName(seat.general.faction)}>
          {seat.general.faction}
        </div>
      </div>
      <div className="seat-meta">
        <span className={`role role-${getVisibleRole(seat)}`}>{getVisibleRole(seat)}</span>
        <span className="hp-chip"><HealthHearts hp={seat.hp} maxHp={seat.maxHp} /></span>
        <span className="count-chip">{seat.hand.length} 手牌</span>
      </div>
      <div className="zone-row">
        <span>范围 {attackRange}</span>
        <span>距玩家 {distanceFromPlayer}</span>
        <span>判定 {seat.judgeArea.length}</span>
        {seat.chained ? <span className="chain-chip">连环</span> : null}
        {seat.turnedOver ? <span className="turned-over-chip">翻面</span> : null}
      </div>
      {seat.equipment.length > 0 ? (
        <div className="seat-zone equipment-zone is-filled">
          <div className="seat-zone-title">装备区</div>
          <div className="seat-zone-cards">
            {seat.equipment.map((card) => (
              <ZoneCardChip
                key={card.instance_id}
                card={card}
                label={equipmentSlotLabel(getEquipmentSlot(card))}
                tone="equipment"
              />
            ))}
          </div>
        </div>
      ) : null}
      {seat.judgeArea.length > 0 ? (
        <div className="seat-zone judge-zone is-filled">
          <div className="seat-zone-title">判定区</div>
          <div className="seat-zone-cards">
            {seat.judgeArea.map((card) => (
              <ZoneCardChip key={card.instance_id} card={card} tone="judge" />
            ))}
          </div>
        </div>
      ) : null}
      <div className="skill-row" aria-label={`${seat.general.name}技能`}>
        {seat.general.skills.length > 0 ? (
          seat.general.skills.map((skill) => {
            const live = isSkillImplemented(skill.name);
            return (
              <span
                key={`${seat.general.id}-${skill.name}`}
                className={`skill-chip${live ? " is-live" : ""}`}
                title={`${live ? "已接入" : "待接入"}：${skill.description}`}
                data-tooltip={`${live ? "已接入" : "待接入"}：${skill.description}`}
              >
                {skill.name}
              </span>
            );
          })
        ) : (
          <span className="skill-chip is-empty">无技能</span>
        )}
      </div>
      {targetable ? (
        <button
          type="button"
          className="target-button"
          onClick={(event) => {
            event.stopPropagation();
            onTarget?.();
          }}
          data-testid={`target-seat-${seat.id}`}
        >
          {targetSelected ? "已选择" : "选择目标"}
        </button>
      ) : null}
    </div>
  </article>
);

const PhaseTrack = ({ current }: { current: string }) => (
  <ol className="phase-track" aria-label="回合阶段">
    {phaseOrder.map((phase) => (
      <li key={phase} className={phase === current ? "active" : ""}>
        {phase}
      </li>
    ))}
  </ol>
);

const TableActionOverlay = ({ effect }: { effect: GameState["lastEffect"] }) => {
  if (!effect) {
    return null;
  }

  const from = seatAnchors[effect.sourceSeatId] ?? seatAnchors[0];
  const to =
    effect.targetSeatId === undefined
      ? from
      : seatAnchors[effect.targetSeatId] ?? from;
  const imageSrc = getDisplayAssetPath(effect.cardImagePath);
  const trickClass = getTrickAnimationClass(effect.cardId);
  const isTrickEffect = Boolean(trickClass);
  const particleIndexes = Array.from({ length: 14 }, (_, index) => index);
  const streakIndexes = Array.from({ length: 9 }, (_, index) => index);
  const ringIndexes = Array.from({ length: 3 }, (_, index) => index);
  const style = {
    "--from-x": `${from.x}%`,
    "--from-y": `${from.y}%`,
    "--to-x": `${to.x}%`,
    "--to-y": `${to.y}%`,
  } as CSSProperties;

  return (
    <div
      className={`table-action-overlay${effect.targetSeatId === undefined ? " is-self" : ""}${isTrickEffect ? " is-trick-effect" : ""}${trickClass ? ` ${trickClass}` : ""}`}
      style={style}
      data-testid="table-action-overlay"
      data-effect-card-id={effect.cardId}
      key={effect.sequence}
    >
      {effect.targetSeatId !== undefined ? (
        <svg className="target-line" viewBox="0 0 100 100" preserveAspectRatio="none">
          <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
        </svg>
      ) : null}
      {isTrickEffect ? (
        <div className="trick-effect-stage" aria-hidden="true">
          <div className="trick-aura" />
          <div className="trick-rings">
            {ringIndexes.map((index) => (
              <span key={index} />
            ))}
          </div>
          <div className="trick-particles">
            {particleIndexes.map((index) => (
              <span key={index} />
            ))}
          </div>
          <div className="trick-streaks">
            {streakIndexes.map((index) => (
              <span key={index} />
            ))}
          </div>
          <div className="trick-symbol">
            <span />
            <span />
            <span />
          </div>
        </div>
      ) : null}
      {imageSrc ? (
        <div className="flying-card">
          <img src={imageSrc} alt={effect.cardName} />
        </div>
      ) : null}
      <div className="impact-float">{effect.impactText ?? effect.cardName}</div>
    </div>
  );
};

const SetupScreen = ({
  data,
  draft,
  selectedGeneralId,
  onGeneralChange,
  onReroll,
  onStart,
}: {
  data: GameData;
  draft: SetupDraft;
  selectedGeneralId: string;
  onGeneralChange: (generalId: string) => void;
  onReroll: () => void;
  onStart: () => void;
}) => {
  const selectedGeneral =
    data.generals.find((general) => general.id === selectedGeneralId) ?? data.generals[0];
  const generalChoices = draft.generalIds
    .map((id) => data.generals.find((general) => general.id === id))
    .filter((general): general is General => Boolean(general));
  const selectedGeneralImage = selectedGeneral
    ? getDisplayAssetPath(selectedGeneral.image.path)
    : null;

  return (
    <main className="setup-shell" data-testid="setup-screen">
      <section className="setup-hero">
        <div>
          <p className="eyebrow">开局设置</p>
          <h1>随机身份，五将选一</h1>
          <p>
            身份由牌堆随机分配，武将从 42 个可用武将中随机抽 5 个候选。AI 默认暂停，开局后由你决定何时推进。
          </p>
        </div>
        <div className="setup-selected">
          <img
            src={selectedGeneralImage ?? ""}
            alt={selectedGeneral?.name ?? "武将"}
          />
          <div>
            <span>随机身份：{draft.assignedRole}</span>
            <strong>{selectedGeneral?.name}</strong>
            <small>
              {selectedGeneral?.faction} · {selectedGeneral?.maxHp} 体力
            </small>
          </div>
        </div>
      </section>

      <section className="setup-panel">
        <div className="setup-role-card" data-testid="assigned-role">
          <span>你的身份</span>
          <strong>{draft.assignedRole}</strong>
          <small>本局随机分配，不可手动选择。</small>
          <button type="button" onClick={onReroll} data-testid="reroll-setup">
            重新随机
          </button>
        </div>

        <div className="setup-general-grid" aria-label="武将选择">
          {generalChoices.map((general) => (
            <button
              type="button"
              key={general.id}
              className={general.id === selectedGeneralId ? "is-selected" : ""}
              onClick={() => onGeneralChange(general.id)}
              data-testid={`setup-general-${general.id}`}
            >
              <img
                src={getDisplayAssetPath(general.image.path) ?? ""}
                alt={general.name}
              />
              <span>{general.name}</span>
              <small>
                {general.faction} · {general.maxHp}
              </small>
              <div className="setup-general-skills" aria-label={`${general.name}技能`}>
                {general.skills.length > 0
                  ? general.skills.map((skill) => (
                      <em key={`${general.id}-${skill.name}`} title={skill.description}>
                        {skill.name}
                      </em>
                    ))
                  : <em>无技能</em>}
              </div>
            </button>
          ))}
        </div>

        <button
          type="button"
          className="start-game-button"
          onClick={onStart}
          data-testid="start-game"
        >
          开始身份局
        </button>
      </section>
    </main>
  );
};

const AiSettingsPanel = ({
  config,
  status,
  onChange,
  onClose,
}: {
  config: AiProviderConfig;
  status: string;
  onChange: (config: AiProviderConfig) => void;
  onClose: () => void;
}) => {
  const providerOptions: AiProviderId[] = ["local", "google", "deepseek", "glm"];
  const usesExternalProvider = config.provider !== "local";
  const updateProvider = (provider: AiProviderId) => {
    onChange({
      ...config,
      provider,
      enabled: provider === "local" ? false : config.enabled,
      model:
        provider === "local"
          ? config.model
          : defaultAiModels[provider] ?? config.model,
    });
  };

  return (
    <section className="ai-settings-panel" data-testid="ai-settings-panel">
      <div className="ai-settings-card">
        <div className="ai-settings-heading">
          <div>
            <p className="eyebrow">AI 1.1</p>
          <h2>外部 AI 决策</h2>
          <p className="settings-note">
            API Key 只从 Cloudflare 环境变量读取，不会进入浏览器。
          </p>
        </div>
          <button type="button" onClick={onClose}>
            关闭
          </button>
        </div>

        <label className="settings-toggle">
          <input
            type="checkbox"
            checked={config.enabled}
            disabled={!usesExternalProvider}
            onChange={(event) =>
              onChange({
                ...config,
                enabled: event.currentTarget.checked,
              })
            }
          />
          <span>启用外部模型参与 AI 出牌</span>
        </label>

        <div className="settings-grid">
          <label>
            <span>供应商</span>
            <select
              value={config.provider}
              onChange={(event) => updateProvider(event.currentTarget.value as AiProviderId)}
            >
              {providerOptions.map((provider) => (
                <option key={provider} value={provider}>
                  {aiProviderLabels[provider]}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>模型</span>
            <input
              value={config.model}
              disabled={!usesExternalProvider}
              onChange={(event) =>
                onChange({
                  ...config,
                  model: event.currentTarget.value,
                })
              }
            />
          </label>

          <label>
            <span>超时</span>
            <select
              value={config.timeoutMs}
              disabled={!usesExternalProvider}
              onChange={(event) =>
                onChange({
                  ...config,
                  timeoutMs: Number(event.currentTarget.value),
                })
              }
            >
              <option value={8000}>8 秒</option>
              <option value={12000}>12 秒</option>
              <option value={18000}>18 秒</option>
            </select>
          </label>
        </div>

        <div className="ai-settings-status">
          <strong>状态</strong>
          <span>{status}</span>
        </div>
      </div>
    </section>
  );
};

const actionRequiredSeatId = (pending: PendingAction | null): number | null => {
  if (!pending || pending.type === "wuxie_response") {
    return null;
  }

  switch (pending.type) {
    case "shan_response":
    case "basic_card_response":
      return pending.targetSeatId;
    case "huogong_discard":
      return pending.sourceSeatId;
    case "guanshi_force_response":
    case "xiangle_response":
    case "qiangxi_cost_response":
    case "qinglong_followup_response":
    case "guohe_select_response":
    case "shunshou_select_response":
    case "mengjin_response":
    case "hanbing_response":
    case "qilingong_response":
      return pending.sourceSeatId;
    case "cixiong_response":
      return pending.targetSeatId;
    case "fanjian_suit_response":
      return pending.targetSeatId;
    case "wugufengdeng_select":
      return pending.responderSeatId;
    case "judge_replace_response":
      return pending.replacerSeatId;
    case "skill_judge_replace_response":
      return pending.replacerSeatId;
    case "tiandu_response":
      return pending.judgeOwnerSeatId;
    case "skill_tiandu_response":
      return pending.judgeOwnerSeatId;
    case "duel_sha_response":
      return pending.currentSeatId;
    case "jiedao_sha_response":
      return pending.weaponOwnerSeatId;
    case "qihu_sha_response":
      return pending.forcedSeatId;
    case "dying_response":
      return pending.responderSeatId;
    case "discard_cards":
    case "draw_skill_response":
    case "tuxi_response":
    case "keji_response":
    case "end_skill_response":
    case "guanxing_response":
    case "luoshen_response":
    case "qiaobian_phase":
    case "qiaobian_draw_targets":
    case "qiaobian_play_move":
    case "shensu_response":
    case "fangquan_play_response":
    case "fangquan_end_response":
    case "xiaoji_response":
      return pending.seatId;
    case "liuli_response":
    case "tianxiang_response":
    case "fankui_response":
    case "yiji_response":
    case "jieming_response":
    case "jianxiong_response":
    case "ganglie_response":
      return pending.targetSeatId;
    case "beige_response":
      return pending.singerSeatId;
    case "beige_club_discard_response":
      return pending.sourceSeatId;
    case "ganglie_cost_response":
      return pending.sourceSeatId;
    case "leiji_response":
      return pending.actorSeatId;
    default:
      return null;
  }
};

function App() {
  const [data, setData] = useState<GameData | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiConfig, setAiConfig] = useState<AiProviderConfig>(() => loadStoredAiConfig());
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false);
  const [aiStatus, setAiStatus] = useState("本地规则 AI");
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [selectedTargetIds, setSelectedTargetIds] = useState<number[]>([]);
  const [selectedDiscardIds, setSelectedDiscardIds] = useState<string[]>([]);
  const [selectedSkillName, setSelectedSkillName] = useState<string | null>(null);
  const [selectedSkillCardIds, setSelectedSkillCardIds] = useState<string[]>([]);
  const [yijiAssignments, setYijiAssignments] = useState<Record<string, number | null>>({});
  const [selectedWeaponAction, setSelectedWeaponAction] = useState<"zhangba" | null>(null);
  const [selectedQiaobianMoveCardId, setSelectedQiaobianMoveCardId] = useState<string | null>(null);
  const [setupDraft, setSetupDraft] = useState<SetupDraft | null>(null);
  const [generalPreview, setGeneralPreview] = useState<General | null>(null);
  const aiRequestKeyRef = useRef("");

  useEffect(() => {
    loadGameData()
      .then((loaded) => {
        setData(loaded);
        setSetupDraft(createSetupDraft(loaded));
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : String(reason));
      });
  }, []);

  useEffect(() => {
    saveStoredAiConfig(aiConfig);
  }, [aiConfig]);

  useEffect(() => {
    if (!game?.shaContinuation || game.pendingAction || game.winner) {
      return;
    }
    const timer = window.setTimeout(() => {
      setGame((current) =>
        current?.shaContinuation && !current.pendingAction && !current.winner
          ? continuePendingShaTargets(current)
          : current,
      );
    }, 120);
    return () => window.clearTimeout(timer);
  }, [game]);

  const generalPacks = useMemo(
    () => (data ? summarizeGeneralPacks(data.generals) : {}),
    [data],
  );
  const deckPacks = useMemo(
    () => (data ? summarizeDeckPacks(data.deckInstances) : {}),
    [data],
  );

  const activeSeat = game ? game.seats[game.turn.activeSeatId] : null;
  const playerSeat = game?.seats.find((seat) => seat.controller === "human") ?? null;
  const selectedCard = getPlayerOwnedCard(playerSeat, selectedCardId);
  const selectedInfo =
    game && playerSeat && selectedCard
      ? getCardPlayInfo(game, playerSeat.id, selectedCard)
      : null;
  const zhangbaInfo =
    game && playerSeat ? getZhangbaPlayInfo(game, playerSeat.id) : null;
  const canUseSelectedWeaponAction =
    Boolean(game && playerSeat && selectedWeaponAction === "zhangba") &&
    Boolean(zhangbaInfo?.canPlay) &&
    selectedSkillCardIds.length === 2 &&
    selectedTargetIds.length === 1;
  const hasGrantedHuangtian =
    Boolean(game && playerSeat && playerSeat.general.faction === "群") &&
    Boolean(
      game?.seats.some(
        (seat) =>
          seat.alive &&
          seat.id !== playerSeat?.id &&
          seat.role === "主公" &&
          seat.general.skills.some((skill) => skill.name === "黄天"),
      ),
    );
  const canUseManualSkill =
    Boolean(game && playerSeat && selectedSkillName) &&
    game?.turn.activeSeatId === playerSeat?.id &&
    game?.turn.phase === "出牌" &&
    !game?.pendingAction &&
    !game?.winner;
  const selectedTargetNames =
    game && selectedTargetIds.length > 0
      ? selectedTargetIds
          .map((seatId) => game.seats[seatId]?.general.name)
          .filter(Boolean)
          .join("、")
      : "";
  const pending = game?.pendingAction ?? null;
  const requiredSeatId = actionRequiredSeatId(pending);
  const targetableSeatIds = useMemo(() => {
    if (game && playerSeat && pending?.type === "liuli_response" && pending.targetSeatId === playerSeat.id) {
      return new Set(pending.validTargetIds);
    }

    if (game && playerSeat && pending?.type === "tianxiang_response" && pending.targetSeatId === playerSeat.id) {
      return new Set(pending.validTargetIds);
    }

    if (game && playerSeat && pending?.type === "jieming_response" && pending.targetSeatId === playerSeat.id) {
      return new Set(pending.validTargetIds);
    }

    if (game && playerSeat && pending?.type === "leiji_response" && pending.actorSeatId === playerSeat.id) {
      return new Set(pending.validTargetIds);
    }

    if (game && playerSeat && pending?.type === "tuxi_response" && pending.seatId === playerSeat.id) {
      return new Set(pending.validTargetIds);
    }

    if (game && playerSeat && pending?.type === "qiaobian_draw_targets" && pending.seatId === playerSeat.id) {
      return new Set(
        game.seats
          .filter((seat) => seat.alive && seat.id !== playerSeat.id && seat.hand.length > 0)
          .map((seat) => seat.id),
      );
    }

    if (game && pending?.type === "qiaobian_play_move" && pending.seatId === playerSeat?.id) {
      const sourceSeat = selectedTargetIds.length > 0 ? game.seats[selectedTargetIds[0]] : null;
      const selectedMoveCard = selectedQiaobianMoveCardId && sourceSeat
        ? getQiaobianFieldCards(sourceSeat).find((card) => card.instance_id === selectedQiaobianMoveCardId) ?? null
        : null;
      if (!sourceSeat || !selectedMoveCard) {
        return new Set(
          game.seats
            .filter((seat) => seat.alive && getQiaobianFieldCards(seat).length > 0)
            .map((seat) => seat.id),
        );
      }
      return new Set(
        game.seats
          .filter((seat) => canMoveQiaobianCardToSeat(sourceSeat, seat, selectedMoveCard))
          .map((seat) => seat.id),
      );
    }

    if (
      game &&
      playerSeat &&
      pending?.type === "shensu_response" &&
      pending.seatId === playerSeat.id
    ) {
      return new Set(pending.validTargetIds);
    }

    if (
      game &&
      playerSeat &&
      pending?.type === "fangquan_end_response" &&
      pending.seatId === playerSeat.id
    ) {
      return new Set(pending.validTargetIds);
    }

    if (game && playerSeat && selectedSkillName && canUseManualSkill) {
      if (selectedSkillName === "武圣") {
        const cardId = selectedSkillCardIds[0];
        return new Set(cardId ? getWushengTargetIds(game, playerSeat.id, cardId) : []);
      }
      if (selectedSkillName === "奇袭") {
        const cardId = selectedSkillCardIds[0];
        return new Set(cardId ? getQixiTargetIds(game, playerSeat.id, cardId) : []);
      }
      if (selectedSkillName === "国色") {
        const cardId = selectedSkillCardIds[0];
        return new Set(cardId ? getGuoseTargetIds(game, playerSeat.id, cardId) : []);
      }
      if (selectedSkillName === "连环") {
        const cardId = selectedSkillCardIds[0];
        return new Set(cardId ? getLianhuanTargetIds(game, playerSeat.id, cardId) : []);
      }
      if (selectedSkillName === "双雄") {
        const cardId = selectedSkillCardIds[0];
        return new Set(cardId ? getShuangxiongTargetIds(game, playerSeat.id, cardId) : []);
      }
      if (selectedSkillName === "龙胆") {
        const cardId = selectedSkillCardIds[0];
        return new Set(cardId ? getLongdanTargetIds(game, playerSeat.id, cardId) : []);
      }
      const otherAliveSeats = game.seats.filter(
        (seat) => seat.alive && seat.id !== playerSeat.id,
      );
      if (selectedSkillName === "仁德" || selectedSkillName === "反间") {
        return new Set(otherAliveSeats.map((seat) => seat.id));
      }
      if (selectedSkillName === "青囊") {
        return new Set(
          game.seats
            .filter((seat) => seat.alive && seat.hp < seat.maxHp)
            .map((seat) => seat.id),
        );
      }
      if (selectedSkillName === "强袭") {
        return new Set(
          otherAliveSeats
            .filter((seat) => distanceBetweenSeats(game, playerSeat, seat) <= getAttackRange(playerSeat))
            .map((seat) => seat.id),
        );
      }
      if (selectedSkillName === "离间") {
        return new Set(otherAliveSeats.filter(isMaleSeat).map((seat) => seat.id));
      }
      if (selectedSkillName === "驱虎") {
        if (selectedTargetIds.length === 0) {
          return new Set(
            otherAliveSeats
              .filter((seat) => seat.hp > playerSeat.hp && seat.hand.length > 0)
              .map((seat) => seat.id),
          );
        }
        const tiger = game.seats[selectedTargetIds[0]];
        if (!tiger?.alive) {
          return new Set<number>();
        }
        return new Set(
          game.seats
            .filter(
              (seat) =>
                seat.alive &&
                seat.id !== tiger.id &&
                distanceBetweenSeats(game, tiger, seat) <= getAttackRange(tiger),
            )
            .map((seat) => seat.id),
        );
      }
      if (selectedSkillName === "巧变") {
        return new Set(
          otherAliveSeats.filter(hasSelectableZoneCard).map((seat) => seat.id),
        );
      }
      if (selectedSkillName === "天义") {
        return new Set(otherAliveSeats.filter((seat) => seat.hand.length > 0).map((seat) => seat.id));
      }
      if (selectedSkillName === "放权") {
        return new Set(otherAliveSeats.map((seat) => seat.id));
      }
      if (selectedSkillName === "结姻") {
        return new Set(
          otherAliveSeats
            .filter((seat) => isMaleSeat(seat) && seat.hp < seat.maxHp)
            .map((seat) => seat.id),
        );
      }
      if (selectedSkillName === "神速") {
        return new Set(
          playerSeat.equipment.some((card) => getEquipmentSlot(card))
            ? getShensuTargetIds(game, playerSeat.id)
            : [],
        );
      }
    }
    if (game && playerSeat && selectedWeaponAction === "zhangba" && zhangbaInfo?.canPlay) {
      return new Set(zhangbaInfo.validTargetIds);
    }
    if (!game || !selectedCard || !selectedInfo) {
      return new Set<number>();
    }
    if (selectedCard.card_id === "jiedaosharen" && selectedTargetIds.length === 1) {
      return new Set(getJiedaoVictimIds(game, selectedTargetIds[0]));
    }
    return new Set(selectedInfo.validTargetIds);
  }, [
    canUseManualSkill,
    game,
    pending,
    playerSeat,
    selectedCard,
    selectedInfo,
    selectedQiaobianMoveCardId,
    selectedSkillCardIds,
    selectedSkillName,
    selectedWeaponAction,
    selectedTargetIds,
    zhangbaInfo,
  ]);
  const selectedSkillReady = useMemo(() => {
    if (!canUseManualSkill || !selectedSkillName) {
      return false;
    }
    if (selectedSkillName === "武圣") {
      const cardId = selectedSkillCardIds[0];
      if (!game || !playerSeat || !cardId) {
        return false;
      }
      const validTargetIds = new Set(getWushengTargetIds(game, playerSeat.id, cardId));
      const maxTargets = getWushengTargetLimit(game, playerSeat.id, cardId);
      return (
        selectedSkillCardIds.length === 1 &&
        selectedTargetIds.length >= 1 &&
        selectedTargetIds.length <= maxTargets &&
        selectedTargetIds.every((seatId) => validTargetIds.has(seatId))
      );
    }
    if (selectedSkillName === "奇袭") {
      const cardId = selectedSkillCardIds[0];
      return Boolean(
        game &&
          playerSeat &&
          cardId &&
          selectedSkillCardIds.length === 1 &&
          selectedTargetIds.length === 1 &&
          getQixiTargetIds(game, playerSeat.id, cardId).includes(selectedTargetIds[0]),
      );
    }
    if (selectedSkillName === "国色") {
      const cardId = selectedSkillCardIds[0];
      return Boolean(
        game &&
          playerSeat &&
          cardId &&
          selectedSkillCardIds.length === 1 &&
          selectedTargetIds.length === 1 &&
          getGuoseTargetIds(game, playerSeat.id, cardId).includes(selectedTargetIds[0]),
      );
    }
    if (selectedSkillName === "连环") {
      const cardId = selectedSkillCardIds[0];
      if (!game || !playerSeat || !cardId || selectedSkillCardIds.length !== 1) {
        return false;
      }
      const validTargetIds = new Set(getLianhuanTargetIds(game, playerSeat.id, cardId));
      return (
        selectedTargetIds.length <= 2 &&
        selectedTargetIds.every((seatId) => validTargetIds.has(seatId))
      );
    }
    if (selectedSkillName === "双雄") {
      const cardId = selectedSkillCardIds[0];
      return Boolean(
        game &&
          playerSeat &&
          cardId &&
          selectedSkillCardIds.length === 1 &&
          selectedTargetIds.length === 1 &&
          getShuangxiongTargetIds(game, playerSeat.id, cardId).includes(selectedTargetIds[0]),
      );
    }
    if (selectedSkillName === "龙胆") {
      const cardId = selectedSkillCardIds[0];
      if (!game || !playerSeat || !cardId) {
        return false;
      }
      const validTargetIds = new Set(getLongdanTargetIds(game, playerSeat.id, cardId));
      const maxTargets = getLongdanTargetLimit(game, playerSeat.id, cardId);
      return (
        selectedSkillCardIds.length === 1 &&
        selectedTargetIds.length >= 1 &&
        selectedTargetIds.length <= maxTargets &&
        selectedTargetIds.every((seatId) => validTargetIds.has(seatId))
      );
    }
    if (selectedSkillName === "仁德") {
      return selectedSkillCardIds.length >= 1 && selectedTargetIds.length === 1;
    }
    if (selectedSkillName === "制衡") {
      return selectedSkillCardIds.length >= 1;
    }
    if (selectedSkillName === "青囊") {
      return selectedSkillCardIds.length === 1 && selectedTargetIds.length === 1;
    }
    if (selectedSkillName === "强袭") {
      return selectedTargetIds.length === 1;
    }
    if (selectedSkillName === "乱击") {
      if (selectedSkillCardIds.length !== 2 || !playerSeat) {
        return false;
      }
      const [firstId, secondId] = selectedSkillCardIds;
      const first = playerSeat.hand.find((card) => card.instance_id === firstId);
      const second = playerSeat.hand.find((card) => card.instance_id === secondId);
      return Boolean(first && second && first.suit === second.suit);
    }
    if (selectedSkillName === "结姻") {
      return selectedSkillCardIds.length === 2 && selectedTargetIds.length === 1;
    }
    if (selectedSkillName === "离间") {
      return selectedSkillCardIds.length === 1 && selectedTargetIds.length === 2;
    }
    if (selectedSkillName === "驱虎") {
      return selectedSkillCardIds.length === 1 && selectedTargetIds.length === 2;
    }
    if (selectedSkillName === "反间" || selectedSkillName === "巧变") {
      return selectedSkillCardIds.length === 1 && selectedTargetIds.length === 1;
    }
    if (selectedSkillName === "天义" || selectedSkillName === "放权") {
      return selectedSkillCardIds.length === 1 && selectedTargetIds.length === 1;
    }
    if (selectedSkillName === "黄天") {
      return selectedSkillCardIds.length === 1;
    }
    if (selectedSkillName === "神速") {
      return selectedSkillCardIds.length === 1 && selectedTargetIds.length === 1;
    }
    return false;
  }, [canUseManualSkill, game, playerSeat, selectedSkillCardIds, selectedSkillName, selectedTargetIds]);
  const selectedSkillHint = useMemo(() => {
    if (!selectedSkillName) {
      return "";
    }
    if (selectedSkillName === "武圣") {
      return selectedTargetNames
        ? `武圣：将1张红色手牌或装备牌当【杀】，目标 ${selectedTargetNames}`
        : "武圣：先选择1张红色手牌或装备牌，再选择杀目标";
    }
    if (selectedSkillName === "奇袭") {
      return selectedTargetNames
        ? `奇袭：将1张黑色手牌或装备牌当【过河拆桥】，目标 ${selectedTargetNames}`
        : "奇袭：先选择1张黑色手牌或装备牌，再选择有牌的其他角色";
    }
    if (selectedSkillName === "国色") {
      return selectedTargetNames
        ? `国色：将1张方片手牌当【乐不思蜀】，目标 ${selectedTargetNames}`
        : "国色：先选择1张方片手牌，再选择乐不思蜀目标";
    }
    if (selectedSkillName === "连环") {
      if (selectedTargetNames) {
        return `连环：将1张梅花手牌当【铁索连环】，目标 ${selectedTargetNames}`;
      }
      return selectedSkillCardIds.length === 1
        ? "连环：不选目标将重铸摸1张；也可选择1至2名目标"
        : "连环：选择1张梅花手牌，再选择目标或直接确认重铸";
    }
    if (selectedSkillName === "双雄") {
      return selectedTargetNames
        ? `双雄：将1张异色手牌当【决斗】，目标 ${selectedTargetNames}`
        : "双雄：先选择与判定牌颜色不同的手牌，再选择决斗目标";
    }
    if (selectedSkillName === "龙胆") {
      return selectedTargetNames
        ? `龙胆：将1张【闪】当【杀】，目标 ${selectedTargetNames}`
        : "龙胆：先选择1张【闪】，再选择杀目标";
    }
    if (selectedSkillName === "仁德") {
      return selectedTargetNames
        ? `仁德：已选择 ${selectedSkillCardIds.length} 张手牌，交给 ${selectedTargetNames}`
        : `仁德：选择1张或多张手牌，再选择1名其他角色`;
    }
    if (selectedSkillName === "制衡") {
      return `制衡：已选择 ${selectedSkillCardIds.length} 张手牌/装备牌，确认后弃置并摸等量牌`;
    }
    if (selectedSkillName === "青囊") {
      return selectedTargetNames
        ? `青囊：弃1张手牌，令 ${selectedTargetNames} 回复1点体力`
        : "青囊：选择1张手牌和1名已受伤角色";
    }
    if (selectedSkillName === "强袭") {
      return selectedTargetNames
        ? `强袭：对 ${selectedTargetNames} 造成1点伤害`
        : "强袭：选择1名攻击范围内的角色";
    }
    if (selectedSkillName === "乱击") {
      return selectedSkillCardIds.length === 2
        ? "乱击：已选择两张同花色手牌，确认后视为使用【万箭齐发】"
        : "乱击：选择两张同花色手牌";
    }
    if (selectedSkillName === "反间") {
      return selectedTargetNames
        ? `反间：选择1张手牌交给 ${selectedTargetNames}`
        : "反间：选择1张手牌和1名其他角色";
    }
    if (selectedSkillName === "离间") {
      return selectedTargetNames
        ? `离间：弃1张手牌，令 ${selectedTargetNames} 决斗`
        : "离间：选择1张手牌和2名男性其他角色";
    }
    if (selectedSkillName === "驱虎") {
      if (selectedTargetIds.length === 0) {
        return "驱虎：选择1张拼点牌，再选体力值大于你的角色";
      }
      if (selectedTargetIds.length === 1) {
        return `驱虎：已选拼点目标 ${selectedTargetNames}，再选其攻击范围内的受伤害目标`;
      }
      return `驱虎：弃1张拼点牌，目标链路为 ${selectedTargetNames}`;
    }
    if (selectedSkillName === "巧变") {
      return selectedTargetNames
        ? `巧变：弃1张手牌，获得 ${selectedTargetNames} 的一张牌`
        : "巧变：选择1张手牌和1名有牌的其他角色";
    }
    if (selectedSkillName === "天义") {
      return selectedTargetNames
        ? `天义：选择1张拼点牌，与 ${selectedTargetNames} 拼点`
        : "天义：选择1张手牌和1名有手牌的其他角色";
    }
    if (selectedSkillName === "黄天") {
      return "黄天：选择1张【闪】或【闪电】交给拥有【黄天】的主公";
    }
    if (selectedSkillName === "放权") {
      return selectedTargetNames
        ? `放权：跳过出牌，回合结束时弃所选手牌，令 ${selectedTargetNames} 获得额外回合`
        : "放权：选择1张回合末弃置的手牌，再选择1名其他角色";
    }
    if (selectedSkillName === "神速") {
      return selectedTargetNames
        ? `神速：弃置一张装备，视为对 ${selectedTargetNames} 使用无距离限制的【杀】`
        : "神速：选择1名目标，弃置装备并视为无距离【杀】";
    }
    if (selectedSkillName === "结姻") {
      return selectedTargetNames
        ? `结姻：弃2张手牌，与 ${selectedTargetNames} 各回复1点体力`
        : "结姻：选择2张手牌和1名已受伤的男性其他角色";
    }
    return "";
  }, [selectedSkillCardIds.length, selectedSkillName, selectedTargetNames, selectedTargetIds.length]);
  const wuxieResponderSeatId =
    pending?.type === "wuxie_response" ? pending.responderSeatId : null;
  const discardPending =
    pending?.type === "discard_cards" && pending.seatId === playerSeat?.id
      ? pending
      : null;
  const longdanResponseMode =
    playerSeat &&
    hasSkillByName(playerSeat, "龙胆") &&
    (
      (pending?.type === "shan_response" && pending.targetSeatId === playerSeat.id) ||
      (pending?.type === "basic_card_response" &&
        pending.targetSeatId === playerSeat.id &&
        pending.requiredCard === "shan")
    )
      ? "shan"
      : playerSeat &&
          hasSkillByName(playerSeat, "龙胆") &&
          (
            (pending?.type === "basic_card_response" &&
              pending.targetSeatId === playerSeat.id &&
              pending.requiredCard === "sha") ||
            (pending?.type === "duel_sha_response" && pending.currentSeatId === playerSeat.id) ||
            (pending?.type === "jiedao_sha_response" && pending.weaponOwnerSeatId === playerSeat.id) ||
            (pending?.type === "qihu_sha_response" && pending.forcedSeatId === playerSeat.id)
          )
        ? "sha"
        : null;
  const isLongdanResponseSelected =
    selectedSkillName === "龙胆" && Boolean(longdanResponseMode);
  const shanCards = getShanResponseCardsForMode(
    playerSeat,
    isLongdanResponseSelected && longdanResponseMode === "shan",
  );
  const guanshiDiscardCards =
    pending?.type === "guanshi_force_response" && pending.sourceSeatId === playerSeat?.id
      ? pending.discardableCards
      : [];
  const xiangleBasicCards =
    pending?.type === "xiangle_response" && pending.sourceSeatId === playerSeat?.id
      ? (playerSeat?.hand.filter((card) => pending.basicCardIds.includes(card.instance_id)) ?? [])
      : [];
  const ganglieDiscardCards =
    pending?.type === "ganglie_cost_response" && pending.sourceSeatId === playerSeat?.id
      ? (playerSeat?.hand.filter((card) => pending.discardableCardIds.includes(card.instance_id)) ?? [])
      : [];
  const qiangxiWeaponOptions =
    pending?.type === "qiangxi_cost_response" && pending.sourceSeatId === playerSeat?.id
      ? pending.weaponOptions
      : [];
  const qinglongShaCards =
    pending?.type === "qinglong_followup_response" && pending.sourceSeatId === playerSeat?.id && playerSeat
      ? getPlayerShaResponseCards(playerSeat).filter((card) => pending.shaCardIds.includes(card.instance_id))
      : [];
  const cixiongCards =
    pending?.type === "cixiong_response" && pending.targetSeatId === playerSeat?.id
      ? (playerSeat?.hand.filter((card) => pending.handCardIds.includes(card.instance_id)) ?? [])
      : [];
  const hanbingOptions =
    pending?.type === "hanbing_response" && pending.sourceSeatId === playerSeat?.id
      ? pending.options
      : [];
  const guoheOptions =
    pending?.type === "guohe_select_response" && pending.sourceSeatId === playerSeat?.id
      ? pending.options
      : [];
  const shunshouOptions =
    pending?.type === "shunshou_select_response" && pending.sourceSeatId === playerSeat?.id
      ? pending.options
      : [];
  const mengjinOptions =
    pending?.type === "mengjin_response" && pending.sourceSeatId === playerSeat?.id
      ? pending.options
      : [];
  const qilingongMountOptions =
    pending?.type === "qilingong_response" && pending.sourceSeatId === playerSeat?.id
      ? pending.mountOptions
      : [];
  const shensuEquipmentCards =
    pending?.type === "shensu_response" &&
    pending.mode === "skip_play" &&
    pending.seatId === playerSeat?.id
      ? (playerSeat?.equipment.filter((card) => pending.equipmentCardIds.includes(card.instance_id)) ?? [])
      : [];
  const fangquanDiscardCards =
    pending?.type === "fangquan_end_response" && pending.seatId === playerSeat?.id
      ? (playerSeat?.hand.filter((card) => pending.discardableCardIds.includes(card.instance_id)) ?? [])
      : [];
  const basicResponseCards =
    pending?.type === "basic_card_response" && playerSeat
      ? pending.requiredCard === "shan"
        ? getShanResponseCardsForMode(
            playerSeat,
            isLongdanResponseSelected && longdanResponseMode === "shan",
          )
        : getShaResponseCardsForMode(
            playerSeat,
            isLongdanResponseSelected && longdanResponseMode === "sha",
          )
      : [];
  const canUseZhangbaForBasicResponse =
    pending?.type === "basic_card_response" &&
    pending.requiredCard === "sha" &&
    Boolean(playerSeat && canUseZhangbaSha(playerSeat));
  const duelShaCards =
    pending?.type === "duel_sha_response" && playerSeat
      ? getShaResponseCardsForMode(
          playerSeat,
          isLongdanResponseSelected && longdanResponseMode === "sha",
        )
      : [];
  const canUseZhangbaForDuel =
    pending?.type === "duel_sha_response" &&
    Boolean(playerSeat && canUseZhangbaSha(playerSeat));
  const canUseZhangbaForJiedao =
    pending?.type === "jiedao_sha_response" &&
    pending.weaponOwnerSeatId === playerSeat?.id &&
    Boolean(playerSeat && canUseZhangbaSha(playerSeat));
  const jiedaoShaCards =
    pending?.type === "jiedao_sha_response" && pending.weaponOwnerSeatId === playerSeat?.id
      ? getShaResponseCardsForMode(
          playerSeat,
          isLongdanResponseSelected && longdanResponseMode === "sha",
        )
      : [];
  const canUseZhangbaForQihu =
    pending?.type === "qihu_sha_response" &&
    pending.forcedSeatId === playerSeat?.id &&
    Boolean(playerSeat && canUseZhangbaSha(playerSeat));
  const qihuShaCards =
    pending?.type === "qihu_sha_response" && pending.forcedSeatId === playerSeat?.id
      ? getShaResponseCardsForMode(
          playerSeat,
          isLongdanResponseSelected && longdanResponseMode === "sha",
        )
      : [];
  const huogongDiscardCards =
    pending?.type === "huogong_discard" && playerSeat
      ? playerSeat.hand.filter((card) =>
          pending.discardableCardIds.includes(card.instance_id),
        )
      : [];
  const wuxieCards = playerSeat?.hand.filter(isWuxie) ?? [];
  const liuliCards =
    pending?.type === "liuli_response" && pending.targetSeatId === playerSeat?.id
      ? ([...(playerSeat?.hand ?? []), ...(playerSeat?.equipment ?? [])])
      : [];
  const tianxiangCards =
    pending?.type === "tianxiang_response" && pending.targetSeatId === playerSeat?.id
      ? (playerSeat?.hand.filter((card) => isEffectiveHeartCardForSeat(playerSeat, card)) ?? [])
      : [];
  const beigeCards =
    pending?.type === "beige_response" && pending.singerSeatId === playerSeat?.id
      ? ([...(playerSeat?.hand ?? []), ...(playerSeat?.equipment ?? [])])
      : [];
  const beigeClubDiscardCards =
    pending?.type === "beige_club_discard_response" && pending.sourceSeatId === playerSeat?.id
      ? ([...(playerSeat?.hand ?? []), ...(playerSeat?.equipment ?? [])].filter((card) =>
          pending.discardableCardIds.includes(card.instance_id),
        ))
      : [];
  const pendingTriggerSkill =
    pending?.type === "liuli_response" && pending.targetSeatId === playerSeat?.id
      ? "流离"
      : pending?.type === "tianxiang_response" && pending.targetSeatId === playerSeat?.id
        ? "天香"
        : pending?.type === "beige_response" && pending.singerSeatId === playerSeat?.id
          ? "悲歌"
          : null;
  const isPendingTriggerCardSelectable = (card: DeckInstance) => {
    if (!pendingTriggerSkill || !playerSeat) return false;
    if (pendingTriggerSkill === "天香") {
      return isEffectiveHeartCardForSeat(playerSeat, card);
    }
    return true;
  };
  const wuguCards = pending?.type === "wugufengdeng_select" ? pending.revealedCards : [];
  const judgeReplaceCards =
    pending?.type === "judge_replace_response" && pending.replacerSeatId === playerSeat?.id
      ? ([...(playerSeat?.hand ?? []), ...(playerSeat?.equipment ?? [])].filter((card) =>
          pending.replaceableCardIds.includes(card.instance_id),
        ))
      : [];
  const skillJudgeReplaceCards =
    pending?.type === "skill_judge_replace_response" && pending.replacerSeatId === playerSeat?.id
      ? ([...(playerSeat?.hand ?? []), ...(playerSeat?.equipment ?? [])].filter((card) =>
          pending.replaceableCardIds.includes(card.instance_id),
        ))
      : [];
  const guanxingCards = pending?.type === "guanxing_response" ? pending.viewedCards : [];
  const dyingCards = game ? getDyingCards(game) : [];
  const qiaobianMoveSource =
    pending?.type === "qiaobian_play_move" && selectedTargetIds.length > 0 && game
      ? game.seats[selectedTargetIds[0]] ?? null
      : null;
  const qiaobianMoveCards = qiaobianMoveSource
    ? getQiaobianFieldCards(qiaobianMoveSource)
    : [];
  const selectedQiaobianMoveCard =
    selectedQiaobianMoveCardId && qiaobianMoveSource
      ? qiaobianMoveCards.find((card) => card.instance_id === selectedQiaobianMoveCardId) ?? null
      : null;
  const qiaobianMoveDestination =
    pending?.type === "qiaobian_play_move" && selectedTargetIds.length > 1 && game
      ? game.seats[selectedTargetIds[1]] ?? null
      : null;

  const finishPlayerPlay = useCallback(() => {
    setSelectedCardId(null);
    setSelectedTargetIds([]);
    setSelectedDiscardIds([]);
    setSelectedSkillName(null);
    setSelectedSkillCardIds([]);
    setSelectedWeaponAction(null);
    setSelectedQiaobianMoveCardId(null);
    setGame((current) => {
      if (!current || current.pendingAction || current.winner) {
        return current;
      }

      const actingSeat = current.seats[current.turn.activeSeatId];
      if (!actingSeat || actingSeat.controller !== "human" || current.turn.phase !== "出牌") {
        return current;
      }

      let next = advanceGame(current);
      for (let step = 0; step < 2; step += 1) {
        if (next.pendingAction || next.winner) {
          break;
        }
        if (next.turn.phase !== "弃牌" && next.turn.phase !== "结束") {
          break;
        }
        next = advanceGame(next);
      }
      return next;
    });
  }, []);

  const restart = useCallback(() => {
    setSelectedCardId(null);
    setSelectedTargetIds([]);
    setSelectedDiscardIds([]);
    setSelectedSkillName(null);
    setSelectedSkillCardIds([]);
    setSelectedWeaponAction(null);
    setSelectedQiaobianMoveCardId(null);
    setGame(null);
    if (data) {
      setSetupDraft(createSetupDraft(data));
    }
  }, [data]);

  const rerollSetup = useCallback(() => {
    if (!data) {
      return;
    }
    setSelectedCardId(null);
    setSelectedTargetIds([]);
    setSelectedDiscardIds([]);
    setSelectedSkillName(null);
    setSelectedSkillCardIds([]);
    setSelectedWeaponAction(null);
    setSelectedQiaobianMoveCardId(null);
    setSetupDraft(createSetupDraft(data));
  }, [data]);

  const selectSetupGeneral = useCallback((generalId: string) => {
    setSetupDraft((current) =>
      current
        ? {
            ...current,
            selectedGeneralId: generalId,
          }
        : current,
    );
  }, []);

  const startGame = useCallback(() => {
    if (!data || !setupDraft) {
      return;
    }
    setSelectedCardId(null);
    setSelectedTargetIds([]);
    setSelectedDiscardIds([]);
    setSelectedSkillName(null);
    setSelectedSkillCardIds([]);
    setSelectedWeaponAction(null);
    setSelectedQiaobianMoveCardId(null);
    setGame(
      createInitialGame(data, setupDraft.seed, {
        playerRole: setupDraft.assignedRole,
        playerGeneralId: setupDraft.selectedGeneralId || data.generals[0]?.id,
        paused: false,
      }),
    );
  }, [data, setupDraft]);

  const togglePaused = useCallback(() => {
    setGame((current) => (current ? setPaused(current, !current.paused) : current));
  }, []);

  const handleCardClick = useCallback(
    (card: DeckInstance) => {
      if (!game || !playerSeat) {
        return;
      }
      const cardInHand = playerSeat.hand.some((item) => item.instance_id === card.instance_id);
      const cardInEquipment = playerSeat.equipment.some((item) => item.instance_id === card.instance_id);
      if (discardPending) {
        if (!cardInHand) {
          return;
        }
        setSelectedDiscardIds((current) =>
          current.includes(card.instance_id)
            ? current.filter((id) => id !== card.instance_id)
            : [...current, card.instance_id],
        );
        return;
      }
      if (selectedWeaponAction === "zhangba") {
        if (!cardInHand) {
          return;
        }
        setSelectedCardId(null);
        setSelectedSkillName(null);
        setSelectedSkillCardIds((current) => {
          if (current.includes(card.instance_id)) {
            return current.filter((id) => id !== card.instance_id);
          }
          if (current.length >= 2) {
            return [current[1], card.instance_id];
          }
          return [...current, card.instance_id];
        });
        return;
      }
      if (
        pending?.type === "beige_club_discard_response" &&
        pending.sourceSeatId === playerSeat.id &&
        pending.discardableCardIds.includes(card.instance_id)
      ) {
        setSelectedCardId(null);
        setSelectedSkillName(null);
        setSelectedSkillCardIds((current) => {
          if (current.includes(card.instance_id)) {
            return current.filter((id) => id !== card.instance_id);
          }
          if (current.length >= pending.requiredCount) {
            return [...current.slice(1), card.instance_id];
          }
          return [...current, card.instance_id];
        });
        return;
      }
      if (pendingTriggerSkill) {
        if (cardInEquipment && pendingTriggerSkill !== "流离") {
          return;
        }
        if (!isPendingTriggerCardSelectable(card)) {
          return;
        }
        setSelectedCardId(null);
        setSelectedSkillName(null);
        setSelectedSkillCardIds((current) =>
          current[0] === card.instance_id ? [] : [card.instance_id],
        );
        return;
      }
      if (
        pending?.type === "fangquan_end_response" &&
        pending.seatId === playerSeat.id &&
        pending.discardableCardIds.includes(card.instance_id)
      ) {
        setSelectedCardId(null);
        setSelectedSkillName(null);
        setSelectedSkillCardIds((current) =>
          current[0] === card.instance_id ? [] : [card.instance_id],
        );
        return;
      }
      if (selectedSkillName) {
        const canSelectEquipment =
          selectedSkillName === "制衡" ||
          selectedSkillName === "武圣" ||
          selectedSkillName === "奇袭" ||
          selectedSkillName === "神速";
        if (cardInEquipment && !canSelectEquipment) {
          return;
        }
        if (!isManualSkillCardSelectable(selectedSkillName, card, playerSeat, game)) {
          return;
        }
        const limit = manualSkillCardLimit(selectedSkillName);
        setSelectedCardId(null);
        setSelectedSkillCardIds((current) => {
          if (current.includes(card.instance_id)) {
            return current.filter((id) => id !== card.instance_id);
          }
          if (current.length >= limit) {
            return [card.instance_id];
          }
          return [...current, card.instance_id];
        });
        return;
      }
      const info = getCardPlayInfo(game, playerSeat.id, card);
      if (!info.canPlay) {
        return;
      }

      if (info.mode === "target") {
        setSelectedTargetIds([]);
        setSelectedWeaponAction(null);
        setSelectedCardId(selectedCardId === card.instance_id ? null : card.instance_id);
        return;
      }

      setSelectedCardId(null);
      setSelectedTargetIds([]);
      setSelectedWeaponAction(null);
      setGame(playCardFromHand(game, playerSeat.id, card.instance_id));
    },
    [discardPending, game, pending, pendingTriggerSkill, playerSeat, selectedCardId, selectedSkillName, selectedWeaponAction],
  );

  const handleTarget = useCallback(
    (targetSeatId: number) => {
      if (!game || !playerSeat) {
        return;
      }
      if (
        (pending?.type === "liuli_response" || pending?.type === "tianxiang_response") &&
        pending.targetSeatId === playerSeat.id
      ) {
        if (!targetableSeatIds.has(targetSeatId)) {
          return;
        }
        setSelectedTargetIds((current) =>
          current[0] === targetSeatId ? [] : [targetSeatId],
        );
        return;
      }
      if (pending?.type === "jieming_response" && pending.targetSeatId === playerSeat.id) {
        if (!targetableSeatIds.has(targetSeatId)) {
          return;
        }
        setSelectedTargetIds((current) =>
          current[0] === targetSeatId ? [] : [targetSeatId],
        );
        return;
      }
      if (pending?.type === "leiji_response" && pending.actorSeatId === playerSeat.id) {
        if (!targetableSeatIds.has(targetSeatId)) {
          return;
        }
        setSelectedTargetIds((current) =>
          current[0] === targetSeatId ? [] : [targetSeatId],
        );
        return;
      }
      if (pending?.type === "tuxi_response" && pending.seatId === playerSeat.id) {
        if (!targetableSeatIds.has(targetSeatId)) {
          return;
        }
        setSelectedTargetIds((current) => {
          if (current.includes(targetSeatId)) {
            return current.filter((seatId) => seatId !== targetSeatId);
          }
          if (current.length >= 2) {
            return [current[1], targetSeatId];
          }
          return [...current, targetSeatId];
        });
        return;
      }
      if (pending?.type === "qiaobian_draw_targets" && pending.seatId === playerSeat.id) {
        if (!targetableSeatIds.has(targetSeatId)) {
          return;
        }
        setSelectedTargetIds((current) => {
          if (current.includes(targetSeatId)) {
            return current.filter((seatId) => seatId !== targetSeatId);
          }
          if (current.length >= 2) {
            return [current[1], targetSeatId];
          }
          return [...current, targetSeatId];
        });
        return;
      }
      if (pending?.type === "qiaobian_play_move" && pending.seatId === playerSeat.id) {
        if (!targetableSeatIds.has(targetSeatId)) {
          return;
        }
        if (selectedTargetIds.length === 0 || !selectedQiaobianMoveCardId) {
          setSelectedTargetIds([targetSeatId]);
          setSelectedQiaobianMoveCardId(null);
          return;
        }
        setSelectedTargetIds([selectedTargetIds[0], targetSeatId]);
        return;
      }
      if (
        (pending?.type === "shensu_response" || pending?.type === "fangquan_end_response") &&
        pending.seatId === playerSeat.id
      ) {
        if (!targetableSeatIds.has(targetSeatId)) {
          return;
        }
        setSelectedTargetIds((current) =>
          current[0] === targetSeatId ? [] : [targetSeatId],
        );
        return;
      }
      if (selectedSkillName) {
        if (!targetableSeatIds.has(targetSeatId)) {
          return;
        }
        if (selectedSkillName === "武圣") {
          const cardId = selectedSkillCardIds[0];
          const maxTargets =
            game && playerSeat && cardId
              ? getWushengTargetLimit(game, playerSeat.id, cardId)
              : 1;
          setSelectedTargetIds((current) => {
            if (current.includes(targetSeatId)) {
              return current.filter((seatId) => seatId !== targetSeatId);
            }
            if (current.length >= maxTargets) {
              return [...current.slice(1), targetSeatId];
            }
            return [...current, targetSeatId];
          });
          return;
        }
        if (selectedSkillName === "奇袭") {
          setSelectedTargetIds((current) =>
            current[0] === targetSeatId ? [] : [targetSeatId],
          );
          return;
        }
        if (selectedSkillName === "连环") {
          setSelectedTargetIds((current) => {
            if (current.includes(targetSeatId)) {
              return current.filter((seatId) => seatId !== targetSeatId);
            }
            if (current.length >= 2) {
              return [current[1], targetSeatId];
            }
            return [...current, targetSeatId];
          });
          return;
        }
        if (selectedSkillName === "龙胆") {
          const cardId = selectedSkillCardIds[0];
          const maxTargets =
            game && playerSeat && cardId
              ? getLongdanTargetLimit(game, playerSeat.id, cardId)
              : 1;
          setSelectedTargetIds((current) => {
            if (current.includes(targetSeatId)) {
              return current.filter((seatId) => seatId !== targetSeatId);
            }
            if (current.length >= maxTargets) {
              return [...current.slice(1), targetSeatId];
            }
            return [...current, targetSeatId];
          });
          return;
        }
        if (
          selectedSkillName === "国色" ||
          selectedSkillName === "双雄"
        ) {
          setSelectedTargetIds((current) =>
            current[0] === targetSeatId ? [] : [targetSeatId],
          );
          return;
        }
        if (
          selectedSkillName === "仁德" ||
          selectedSkillName === "反间" ||
          selectedSkillName === "青囊" ||
          selectedSkillName === "强袭" ||
          selectedSkillName === "结姻"
        ) {
          setSelectedTargetIds((current) =>
            current[0] === targetSeatId ? [] : [targetSeatId],
          );
          return;
        }
        if (selectedSkillName === "离间") {
          setSelectedTargetIds((current) => {
            if (current.includes(targetSeatId)) {
              return current.filter((seatId) => seatId !== targetSeatId);
            }
            if (current.length >= 2) {
              return [current[1], targetSeatId];
            }
            return [...current, targetSeatId];
          });
          return;
        }
        if (selectedSkillName === "驱虎") {
          setSelectedTargetIds((current) => {
            if (current.length === 0) {
              return [targetSeatId];
            }
            if (current[0] === targetSeatId) {
              return [];
            }
            if (current.length === 1) {
              return [current[0], targetSeatId];
            }
            if (current[1] === targetSeatId) {
              return [current[0]];
            }
            return [current[0], targetSeatId];
          });
          return;
        }
        if (
          selectedSkillName === "天义" ||
          selectedSkillName === "黄天" ||
          selectedSkillName === "放权" ||
          selectedSkillName === "神速"
        ) {
          setSelectedTargetIds((current) =>
            current[0] === targetSeatId ? [] : [targetSeatId],
          );
          return;
        }
      }
      if (selectedWeaponAction === "zhangba") {
        if (!zhangbaInfo?.validTargetIds.includes(targetSeatId)) {
          return;
        }
        setSelectedTargetIds((current) =>
          current[0] === targetSeatId ? [] : [targetSeatId],
        );
        return;
      }
      if (!selectedCard) {
        return;
      }
      if (selectedCard.card_id === "jiedaosharen") {
        if (selectedTargetIds.length === 0) {
          if (selectedInfo?.validTargetIds.includes(targetSeatId)) {
            setSelectedTargetIds([targetSeatId]);
          }
          return;
        }

        const weaponOwnerSeatId = selectedTargetIds[0];
        if (!getJiedaoVictimIds(game, weaponOwnerSeatId).includes(targetSeatId)) {
          return;
        }
        setSelectedCardId(null);
        setSelectedTargetIds([]);
        setGame(
          playCardFromHand(
            game,
            playerSeat.id,
            selectedCard.instance_id,
            weaponOwnerSeatId,
            [targetSeatId],
          ),
        );
        return;
      }

      if (selectedInfo?.canRecast) {
        if (!selectedInfo?.validTargetIds.includes(targetSeatId)) {
          return;
        }
        setSelectedTargetIds((current) => {
          if (current.includes(targetSeatId)) {
            return current.filter((seatId) => seatId !== targetSeatId);
          }
          if (current.length >= 2) {
            return [current[1], targetSeatId];
          }
          return [...current, targetSeatId];
        });
        return;
      }

      if ((selectedInfo?.maxTargets ?? 1) > 1) {
        if (!selectedInfo?.validTargetIds.includes(targetSeatId)) {
          return;
        }
        setSelectedTargetIds((current) => {
          if (current.includes(targetSeatId)) {
            return current.filter((seatId) => seatId !== targetSeatId);
          }
          const maxTargets = selectedInfo.maxTargets ?? 1;
          if (current.length >= maxTargets) {
            return [...current.slice(1), targetSeatId];
          }
          return [...current, targetSeatId];
        });
        return;
      }

      setSelectedCardId(null);
      setSelectedTargetIds([]);
      setGame(
        playCardFromHand(game, playerSeat.id, selectedCard.instance_id, targetSeatId),
      );
    },
    [
      game,
      pending,
      playerSeat,
      selectedCard,
      selectedInfo,
      selectedQiaobianMoveCardId,
      selectedSkillCardIds,
      selectedSkillName,
      selectedWeaponAction,
      selectedTargetIds,
      targetableSeatIds,
      zhangbaInfo,
    ],
  );

  const handleConfirmTiesuo = useCallback(() => {
    if (
      !game ||
      !playerSeat ||
      !selectedCard ||
      !selectedInfo?.canRecast ||
      selectedTargetIds.length < 1
    ) {
      return;
    }
    setSelectedCardId(null);
    setSelectedTargetIds([]);
    setGame(
      playCardFromHand(
        game,
        playerSeat.id,
        selectedCard.instance_id,
        selectedTargetIds[0],
        selectedTargetIds.slice(1),
      ),
    );
  }, [game, playerSeat, selectedCard, selectedInfo, selectedTargetIds]);

  const handleConfirmMultiSha = useCallback(() => {
    if (
      !game ||
      !playerSeat ||
      !selectedCard ||
      !selectedInfo ||
      (selectedInfo.maxTargets ?? 1) <= 1 ||
      selectedTargetIds.length < (selectedInfo.minTargets ?? 1)
    ) {
      return;
    }
    setSelectedCardId(null);
    setSelectedTargetIds([]);
    setGame(
      playCardFromHand(
        game,
        playerSeat.id,
        selectedCard.instance_id,
        selectedTargetIds[0],
        selectedTargetIds.slice(1),
      ),
    );
  }, [game, playerSeat, selectedCard, selectedInfo, selectedTargetIds]);

  const handleConfirmZhangba = useCallback(() => {
    if (
      !game ||
      !playerSeat ||
      selectedWeaponAction !== "zhangba" ||
      !canUseSelectedWeaponAction
    ) {
      return;
    }
    const [targetSeatId] = selectedTargetIds;
    setSelectedWeaponAction(null);
    setSelectedSkillCardIds([]);
    setSelectedTargetIds([]);
    setGame(
      playZhangbaShaFromHand(
        game,
        playerSeat.id,
        selectedSkillCardIds,
        targetSeatId,
      ),
    );
  }, [
    canUseSelectedWeaponAction,
    game,
    playerSeat,
    selectedSkillCardIds,
    selectedTargetIds,
    selectedWeaponAction,
  ]);

  const handleRecastTiesuo = useCallback(() => {
    if (!game || !playerSeat || !selectedCard || !selectedInfo?.canRecast) {
      return;
    }
    setSelectedCardId(null);
    setSelectedTargetIds([]);
    setGame(playCardFromHand(game, playerSeat.id, selectedCard.instance_id));
  }, [game, playerSeat, selectedCard, selectedInfo]);

  const handleShaResponse = useCallback((useShan: boolean, cardInstanceId?: string | null) => {
    setSelectedCardId(null);
    setSelectedTargetIds([]);
    setSelectedSkillName(null);
    setSelectedSkillCardIds([]);
    setGame((current) => (current ? respondToSha(current, useShan, cardInstanceId) : current));
  }, []);

  const handleLiuliResponse = useCallback((useSkill: boolean) => {
    const cardId = useSkill ? selectedSkillCardIds[0] ?? null : null;
    const targetId = useSkill ? selectedTargetIds[0] ?? null : null;
    setSelectedCardId(null);
    setSelectedTargetIds([]);
    setSelectedSkillCardIds([]);
    setGame((current) => (current ? respondToLiuli(current, cardId, targetId) : current));
  }, [selectedSkillCardIds, selectedTargetIds]);

  const handleTianxiangResponse = useCallback((useSkill: boolean) => {
    const cardId = useSkill ? selectedSkillCardIds[0] ?? null : null;
    const targetId = useSkill ? selectedTargetIds[0] ?? null : null;
    setSelectedCardId(null);
    setSelectedTargetIds([]);
    setSelectedSkillCardIds([]);
    setGame((current) => (current ? respondToTianxiang(current, cardId, targetId) : current));
  }, [selectedSkillCardIds, selectedTargetIds]);

  const handleBeigeResponse = useCallback((useSkill: boolean) => {
    const cardId = useSkill ? selectedSkillCardIds[0] ?? null : null;
    setSelectedCardId(null);
    setSelectedTargetIds([]);
    setSelectedSkillCardIds([]);
    setGame((current) => (current ? respondToBeige(current, cardId) : current));
  }, [selectedSkillCardIds]);

  const handleBeigeClubDiscard = useCallback(() => {
    const cardIds = [...selectedSkillCardIds];
    setSelectedCardId(null);
    setSelectedTargetIds([]);
    setSelectedSkillCardIds([]);
    setGame((current) => (current ? respondToBeigeClubDiscard(current, cardIds) : current));
  }, [selectedSkillCardIds]);

  const handleFankuiResponse = useCallback((optionKey: string | null) => {
    setSelectedCardId(null);
    setSelectedTargetIds([]);
    setSelectedSkillCardIds([]);
    setGame((current) => (current ? respondToFankui(current, optionKey) : current));
  }, []);

  const handleFanjianSuitResponse = useCallback((declaredSuit: DeclaredSuit) => {
    setSelectedCardId(null);
    setSelectedTargetIds([]);
    setSelectedSkillCardIds([]);
    setGame((current) => (current ? respondToFanjianSuit(current, declaredSuit) : current));
  }, []);

  const handleYijiResponse = useCallback((useSkill: boolean) => {
    setSelectedCardId(null);
    setSelectedTargetIds([]);
    setSelectedSkillCardIds([]);
    setYijiAssignments({});
    setGame((current) => (current ? respondToYiji(current, useSkill ? [] : null) : current));
  }, []);

  const handleYijiRecipientChange = useCallback((cardInstanceId: string, recipientSeatId: number | null) => {
    setYijiAssignments((current) => ({
      ...current,
      [cardInstanceId]: recipientSeatId,
    }));
  }, []);

  const handleConfirmYijiDistribution = useCallback(() => {
    if (pending?.type !== "yiji_response" || !pending.revealedCards) {
      return;
    }
    const assignments = pending.revealedCards
      .map<YijiAssignment | null>((card) => {
        const recipientSeatId = yijiAssignments[card.instance_id];
        return recipientSeatId === null || recipientSeatId === undefined
          ? null
          : {
              cardInstanceId: card.instance_id,
              recipientSeatId,
            };
      })
      .filter((assignment): assignment is YijiAssignment => assignment !== null);
    setSelectedCardId(null);
    setSelectedTargetIds([]);
    setSelectedSkillCardIds([]);
    setYijiAssignments({});
    setGame((current) => (current ? respondToYiji(current, assignments) : current));
  }, [pending, yijiAssignments]);

  const handleJiemingResponse = useCallback((useSkill: boolean) => {
    const targetId = useSkill ? selectedTargetIds[0] ?? null : null;
    setSelectedCardId(null);
    setSelectedTargetIds([]);
    setSelectedSkillCardIds([]);
    setGame((current) => (current ? respondToJieming(current, targetId) : current));
  }, [selectedTargetIds]);

  const handleJianxiongResponse = useCallback((useSkill: boolean) => {
    setSelectedCardId(null);
    setSelectedTargetIds([]);
    setSelectedSkillCardIds([]);
    setGame((current) => (current ? respondToJianxiong(current, useSkill) : current));
  }, []);

  const handleGanglieResponse = useCallback((useSkill: boolean) => {
    setSelectedCardId(null);
    setSelectedTargetIds([]);
    setSelectedSkillCardIds([]);
    setGame((current) => (current ? respondToGanglie(current, useSkill) : current));
  }, []);

  const handleGanglieCostResponse = useCallback((discardCardIds: string[] | null) => {
    setSelectedCardId(null);
    setSelectedTargetIds([]);
    setSelectedSkillCardIds([]);
    setGame((current) => (current ? respondToGanglieCost(current, discardCardIds) : current));
  }, []);

  const handleXiaojiResponse = useCallback((useSkill: boolean) => {
    setSelectedCardId(null);
    setSelectedTargetIds([]);
    setSelectedSkillCardIds([]);
    setGame((current) => (current ? respondToXiaoji(current, useSkill) : current));
  }, []);

  const handleLeijiResponse = useCallback((useSkill: boolean) => {
    const targetId = useSkill ? selectedTargetIds[0] ?? null : null;
    setSelectedCardId(null);
    setSelectedTargetIds([]);
    setSelectedSkillCardIds([]);
    setGame((current) => (current ? respondToLeiji(current, targetId) : current));
  }, [selectedTargetIds]);

  const handleDrawSkillResponse = useCallback((useSkill: boolean) => {
    setSelectedCardId(null);
    setSelectedTargetIds([]);
    setSelectedSkillCardIds([]);
    setGame((current) => (current ? respondToDrawSkill(current, useSkill) : current));
  }, []);

  const handleTuxiResponse = useCallback((useSkill: boolean) => {
    const targetIds = useSkill ? [...selectedTargetIds] : [];
    setSelectedCardId(null);
    setSelectedTargetIds([]);
    setSelectedSkillCardIds([]);
    setGame((current) => (current ? respondToTuxi(current, targetIds) : current));
  }, [selectedTargetIds]);

  const handleShensuResponse = useCallback((useSkill: boolean) => {
    const targetId = useSkill ? selectedTargetIds[0] ?? null : null;
    const equipmentCardId =
      useSkill && pending?.type === "shensu_response" && pending.mode === "skip_play"
        ? selectedSkillCardIds[0] ?? null
        : null;
    setSelectedCardId(null);
    setSelectedTargetIds([]);
    setSelectedSkillCardIds([]);
    setGame((current) =>
      current ? respondToShensu(current, targetId, equipmentCardId) : current,
    );
  }, [pending, selectedSkillCardIds, selectedTargetIds]);

  const handleFangquanPlayResponse = useCallback((useSkill: boolean) => {
    setSelectedCardId(null);
    setSelectedTargetIds([]);
    setSelectedSkillCardIds([]);
    setGame((current) => (current ? respondToFangquanPlay(current, useSkill) : current));
  }, []);

  const handleFangquanEndResponse = useCallback((useSkill: boolean) => {
    const targetId = useSkill ? selectedTargetIds[0] ?? null : null;
    const cardInstanceId = useSkill ? selectedSkillCardIds[0] ?? null : null;
    setSelectedCardId(null);
    setSelectedTargetIds([]);
    setSelectedSkillCardIds([]);
    setGame((current) =>
      current ? respondToFangquanEnd(current, targetId, cardInstanceId) : current,
    );
  }, [selectedSkillCardIds, selectedTargetIds]);

  const handleKejiResponse = useCallback((useSkill: boolean) => {
    setSelectedCardId(null);
    setSelectedTargetIds([]);
    setSelectedSkillCardIds([]);
    setGame((current) => (current ? respondToKeji(current, useSkill) : current));
  }, []);

  const handleEndSkillResponse = useCallback((useSkill: boolean) => {
    setSelectedCardId(null);
    setSelectedTargetIds([]);
    setSelectedSkillCardIds([]);
    setGame((current) => (current ? respondToEndSkill(current, useSkill) : current));
  }, []);

  const handleGuanxingCardClick = useCallback((cardInstanceId: string) => {
    setSelectedSkillCardIds((current) =>
      current.includes(cardInstanceId)
        ? current.filter((id) => id !== cardInstanceId)
        : [...current, cardInstanceId],
    );
  }, []);

  const handleGuanxingResponse = useCallback((mode: "selected" | "original" | "bottom") => {
    const orderedIds =
      mode === "original"
        ? guanxingCards.map((card) => card.instance_id)
        : mode === "bottom"
          ? []
          : [...selectedSkillCardIds];
    setSelectedCardId(null);
    setSelectedTargetIds([]);
    setSelectedSkillCardIds([]);
    setGame((current) => (current ? respondToGuanxing(current, orderedIds) : current));
  }, [guanxingCards, selectedSkillCardIds]);

  const handleLuoshenResponse = useCallback((useSkill: boolean) => {
    setSelectedCardId(null);
    setSelectedTargetIds([]);
    setSelectedSkillCardIds([]);
    setGame((current) => (current ? respondToLuoshen(current, useSkill) : current));
  }, []);

  const handleBasicResponse = useCallback((action: "card" | "wuxie" | "pass", cardInstanceId?: string | string[] | null) => {
    setSelectedCardId(null);
    setSelectedTargetIds([]);
    setSelectedSkillName(null);
    setSelectedSkillCardIds([]);
    setGame((current) => (current ? respondToBasicCard(current, action, cardInstanceId) : current));
  }, []);

  const handleWuxieResponse = useCallback((useWuxie: boolean, cardInstanceId?: string | null) => {
    setSelectedCardId(null);
    setSelectedTargetIds([]);
    setGame((current) => (current ? respondToWuxie(current, useWuxie, cardInstanceId) : current));
  }, []);

  const handleDuelShaResponse = useCallback((useShaCard: boolean, cardInstanceId?: string | string[] | null) => {
    setSelectedCardId(null);
    setSelectedTargetIds([]);
    setSelectedSkillName(null);
    setSelectedSkillCardIds([]);
    setGame((current) => (current ? respondToDuelSha(current, useShaCard, cardInstanceId) : current));
  }, []);

  const handleXiangleResponse = useCallback((cardInstanceId: string | null) => {
    setSelectedCardId(null);
    setSelectedTargetIds([]);
    setSelectedSkillName(null);
    setSelectedSkillCardIds([]);
    setGame((current) => (current ? respondToXiangle(current, cardInstanceId) : current));
  }, []);

  const handleGuanshiResponse = useCallback((useSkill: boolean) => {
    const cardIds = useSkill ? selectedSkillCardIds.slice(0, 2) : [];
    setSelectedCardId(null);
    setSelectedTargetIds([]);
    setSelectedSkillCardIds([]);
    setGame((current) => (current ? respondToGuanshiForce(current, cardIds) : current));
  }, [selectedSkillCardIds]);

  const handleQinglongResponse = useCallback((cardInstanceId: string | null) => {
    setSelectedCardId(null);
    setSelectedTargetIds([]);
    setGame((current) => (current ? respondToQinglongFollowup(current, cardInstanceId) : current));
  }, []);

  const handleQiangxiCost = useCallback((weaponOptionKey: string | null) => {
    setGame((current) =>
      current ? respondToQiangxiCost(current, weaponOptionKey) : current,
    );
  }, []);

  const handleCixiongResponse = useCallback((cardInstanceId: string | null) => {
    setSelectedCardId(null);
    setSelectedTargetIds([]);
    setSelectedSkillCardIds([]);
    setGame((current) => (current ? respondToCixiongSword(current, cardInstanceId) : current));
  }, []);

  const handleHanbingResponse = useCallback((optionKeys: string[] | null) => {
    setSelectedCardId(null);
    setSelectedTargetIds([]);
    setSelectedSkillCardIds([]);
    setGame((current) => (current ? respondToHanbingSword(current, optionKeys) : current));
  }, []);

  const handleQilingongResponse = useCallback((optionKey: string | null) => {
    setSelectedCardId(null);
    setSelectedTargetIds([]);
    setGame((current) => (current ? respondToQilingong(current, optionKey) : current));
  }, []);

  const handleHuogongDiscard = useCallback((cardInstanceId: string | null) => {
    setSelectedCardId(null);
    setSelectedTargetIds([]);
    setGame((current) =>
      current ? respondToHuogongDiscard(current, cardInstanceId) : current,
    );
  }, []);

  const handleJiedaoResponse = useCallback((useShaCard: boolean, cardInstanceId?: string | string[] | null) => {
    setSelectedCardId(null);
    setSelectedTargetIds([]);
    setSelectedSkillName(null);
    setSelectedSkillCardIds([]);
    setGame((current) => (current ? respondToJiedaoSha(current, useShaCard, cardInstanceId) : current));
  }, []);

  const handleQihuResponse = useCallback((useShaCard: boolean, cardInstanceId?: string | string[] | null) => {
    setSelectedCardId(null);
    setSelectedTargetIds([]);
    setSelectedSkillName(null);
    setSelectedSkillCardIds([]);
    setGame((current) => (current ? respondToQihuSha(current, useShaCard, cardInstanceId) : current));
  }, []);

  const handleGuoheSelect = useCallback((optionKey: string) => {
    setSelectedCardId(null);
    setSelectedTargetIds([]);
    setGame((current) => (current ? respondToGuoheSelect(current, optionKey) : current));
  }, []);

  const handleShunshouSelect = useCallback((optionKey: string) => {
    setSelectedCardId(null);
    setSelectedTargetIds([]);
    setGame((current) => (current ? respondToShunshouSelect(current, optionKey) : current));
  }, []);

  const handleMengjinResponse = useCallback((optionKey: string | null) => {
    setSelectedCardId(null);
    setSelectedTargetIds([]);
    setGame((current) => (current ? respondToMengjin(current, optionKey) : current));
  }, []);

  const handleWuguSelect = useCallback((cardInstanceId: string) => {
    setSelectedCardId(null);
    setSelectedTargetIds([]);
    setGame((current) => (current ? respondToWuguSelect(current, cardInstanceId) : current));
  }, []);

  const handleJudgeReplace = useCallback((cardInstanceId: string | null) => {
    setSelectedCardId(null);
    setSelectedTargetIds([]);
    setGame((current) => (current ? respondToJudgeReplace(current, cardInstanceId) : current));
  }, []);

  const handleTianduResponse = useCallback((useSkill: boolean) => {
    setSelectedCardId(null);
    setSelectedTargetIds([]);
    setGame((current) => (current ? respondToTiandu(current, useSkill) : current));
  }, []);

  const handleSkillJudgeReplace = useCallback((cardInstanceId: string | null) => {
    setSelectedCardId(null);
    setSelectedTargetIds([]);
    setGame((current) =>
      current ? respondToSkillJudgeReplace(current, cardInstanceId) : current,
    );
  }, []);

  const handleSkillTianduResponse = useCallback((useSkill: boolean) => {
    setSelectedCardId(null);
    setSelectedTargetIds([]);
    setGame((current) => (current ? respondToSkillTiandu(current, useSkill) : current));
  }, []);

  const handleDyingCard = useCallback((cardInstanceId: string) => {
    setSelectedCardId(null);
    setSelectedTargetIds([]);
    setGame((current) => (current ? playDyingCard(current, cardInstanceId) : current));
  }, []);

  const handleDyingPass = useCallback(() => {
    setSelectedCardId(null);
    setSelectedTargetIds([]);
    setGame((current) => (current ? passDyingResponse(current) : current));
  }, []);

  const handleSkillClick = useCallback((skillName: string) => {
    if (skillName === "龙胆" && longdanResponseMode) {
      setSelectedCardId(null);
      setSelectedTargetIds([]);
      setSelectedSkillCardIds([]);
      setSelectedWeaponAction(null);
      setSelectedQiaobianMoveCardId(null);
      setSelectedSkillName((current) => (current === skillName ? null : skillName));
      return;
    }

    if (manualSkillNames.has(skillName)) {
      setSelectedCardId(null);
      setSelectedTargetIds([]);
      setSelectedSkillCardIds([]);
      setSelectedWeaponAction(null);
      setSelectedQiaobianMoveCardId(null);
      if (
        !game ||
        !playerSeat ||
        game.turn.activeSeatId !== playerSeat.id ||
        game.turn.phase !== "出牌" ||
        game.pendingAction ||
        game.winner
      ) {
        setSelectedSkillName(null);
        setGame((current) =>
          current
            ? {
                ...current,
                log: [`【${skillName}】需要在自己的出牌阶段发动。`, ...current.log].slice(0, GAME_LOG_LIMIT),
              }
            : current,
        );
        return;
      }
      setSelectedSkillName((current) => (current === skillName ? null : skillName));
      return;
    }

    if (activeSkillNames.has(skillName)) {
      setSelectedCardId(null);
      setSelectedTargetIds([]);
      setSelectedSkillName(null);
      setSelectedSkillCardIds([]);
      setSelectedQiaobianMoveCardId(null);
      setGame((current) =>
        current && playerSeat ? activateSkill(current, playerSeat.id, skillName) : current,
      );
      return;
    }

    setGame((current) =>
      current
        ? {
            ...current,
            log: [
              skillName === "巧变"
                ? "技能【巧变】会在摸牌、出牌、弃牌阶段自动询问是否发动。"
                : isSkillImplemented(skillName)
                ? `技能【${skillName}】已接入，会在对应时机自动触发或作为响应牌生效。`
                : `技能【${skillName}】已显示，效果将在后续主动技能批次接入。`,
              ...current.log,
            ].slice(0, GAME_LOG_LIMIT),
          }
        : current,
    );
  }, [game, longdanResponseMode, playerSeat]);

  const handleConfirmSkill = useCallback(() => {
    if (!game || !playerSeat || !selectedSkillName || !selectedSkillReady) {
      return;
    }
    const skillName = selectedSkillName;
    const targetIds = [...selectedTargetIds];
    const cardIds = [...selectedSkillCardIds];
    setSelectedCardId(null);
    setSelectedTargetIds([]);
    setSelectedSkillName(null);
    setSelectedSkillCardIds([]);
    setSelectedWeaponAction(null);
    setSelectedQiaobianMoveCardId(null);
    setGame(activateSkillWithSelection(game, playerSeat.id, skillName, targetIds, cardIds));
  }, [
    game,
    playerSeat,
    selectedSkillCardIds,
    selectedSkillName,
    selectedSkillReady,
    selectedTargetIds,
  ]);

  const handleConfirmDiscard = useCallback(() => {
    setSelectedCardId(null);
    setSelectedTargetIds([]);
    setSelectedSkillName(null);
    setSelectedSkillCardIds([]);
    setSelectedWeaponAction(null);
    setSelectedQiaobianMoveCardId(null);
    setGame((current) => {
      if (!current) {
        return current;
      }
      const next = confirmDiscard(current, selectedDiscardIds);
      if (!next.pendingAction && !next.winner && next.turn.phase === "结束") {
        return advanceGame(next);
      }
      return next;
    });
    setSelectedDiscardIds([]);
  }, [selectedDiscardIds]);

  const handleQiaobianPhase = useCallback((cardInstanceId: string | null) => {
    setSelectedCardId(null);
    setSelectedTargetIds([]);
    setSelectedSkillName(null);
    setSelectedSkillCardIds([]);
    setSelectedQiaobianMoveCardId(null);
    setGame((current) =>
      current ? continueAfterQiaobianIfReady(respondToQiaobianPhase(current, cardInstanceId)) : current,
    );
  }, []);

  const handleConfirmQiaobianDrawTargets = useCallback(() => {
    const targetIds = [...selectedTargetIds];
    setSelectedCardId(null);
    setSelectedTargetIds([]);
    setSelectedQiaobianMoveCardId(null);
    setGame((current) =>
      current ? continueAfterQiaobianIfReady(respondToQiaobianDrawTargets(current, targetIds)) : current,
    );
  }, [selectedTargetIds]);

  const handleConfirmQiaobianMove = useCallback((skipMove = false) => {
    const sourceSeatId = skipMove ? null : selectedTargetIds[0] ?? null;
    const targetSeatId = skipMove ? null : selectedTargetIds[1] ?? null;
    const cardId = skipMove ? null : selectedQiaobianMoveCardId;
    setSelectedCardId(null);
    setSelectedTargetIds([]);
    setSelectedQiaobianMoveCardId(null);
    setGame((current) =>
      current
        ? continueAfterQiaobianIfReady(
            respondToQiaobianPlayMove(current, sourceSeatId, cardId, targetSeatId),
          )
        : current,
    );
  }, [selectedQiaobianMoveCardId, selectedTargetIds]);

  const applyExternalAiAction = useCallback(
    (
      current: GameState,
      action: AiLegalAction | undefined,
      reason?: string,
    ) => {
      const actor = current.seats[current.turn.activeSeatId];
      if (!actor || actor.controller !== "ai" || current.turn.phase !== "出牌") {
        return current;
      }

      const withReason = (next: GameState) =>
        reason
          ? {
              ...next,
              log: [`${actor.general.name} 外部AI：${reason}`, ...next.log].slice(0, GAME_LOG_LIMIT),
            }
          : next;

      if (!action || action.kind === "local") {
        return withReason(advanceGame(current));
      }

      if (action.kind === "end") {
        return withReason(finishAiPlayPhase(current));
      }

      const next = playCardFromHand(
        current,
        actor.id,
        action.cardInstanceId,
        action.targetSeatId,
        action.extraTargetSeatIds ?? [],
      );

      if (next.pendingAction || next.winner) {
        return withReason(next);
      }

      return withReason(finishAiPlayPhase(next));
    },
    [],
  );

  useEffect(() => {
    if (!selectedCardId || !getPlayerOwnedCard(playerSeat, selectedCardId)) {
      setSelectedCardId(null);
      setSelectedTargetIds([]);
    }
  }, [playerSeat, selectedCardId]);

  useEffect(() => {
    if (!selectedSkillName) {
      return;
    }
    const canKeepSkillSelection =
      game &&
      playerSeat &&
      (playerSeat.general.skills.some((skill) => skill.name === selectedSkillName) ||
        (selectedSkillName === "黄天" && hasGrantedHuangtian)) &&
      !game.winner &&
      (
        (game.turn.activeSeatId === playerSeat.id &&
          game.turn.phase === "出牌" &&
          !game.pendingAction) ||
        (selectedSkillName === "龙胆" && Boolean(longdanResponseMode))
      );
    if (!canKeepSkillSelection) {
      setSelectedSkillName(null);
      setSelectedSkillCardIds([]);
      setSelectedTargetIds([]);
      setSelectedQiaobianMoveCardId(null);
      return;
    }
    setSelectedSkillCardIds((current) =>
      current.filter((id) =>
        selectedSkillName === "制衡" ||
        selectedSkillName === "武圣" ||
        selectedSkillName === "奇袭"
          ? Boolean(getPlayerOwnedCard(playerSeat, id))
          : playerSeat.hand.some((card) => card.instance_id === id),
      ),
    );
  }, [game, hasGrantedHuangtian, longdanResponseMode, playerSeat, selectedSkillName]);

  useEffect(() => {
    if (
      !game ||
      !activeSeat ||
      activeSeat.controller !== "human" ||
      game.pendingAction ||
      game.winner ||
      game.turn.activeSeatId !== activeSeat.id ||
      game.turn.phase !== "出牌" ||
      game.turn.skipPlay
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      setSelectedCardId(null);
      setSelectedTargetIds([]);
      setSelectedSkillName(null);
      setSelectedSkillCardIds([]);
      setSelectedQiaobianMoveCardId(null);
      setGame((current) => {
        if (
          !current ||
          current.pendingAction ||
          current.winner ||
          current.turn.phase !== "出牌" ||
          current.turn.skipPlay
        ) {
          return current;
        }
        const beforeUsedSkills = current.turn.usedSkills.join("|");
        const beforeLogHead = current.log[0];
        const next = offerHumanPlayPhaseOpeningPrompt(current);
        if (
          next.pendingAction ||
          next.turn.usedSkills.join("|") !== beforeUsedSkills ||
          next.log[0] !== beforeLogHead
        ) {
          return next;
        }
        return current;
      });
    }, 120);

    return () => window.clearTimeout(timer);
  }, [activeSeat, game]);

  useEffect(() => {
    if (
      !game ||
      !playerSeat ||
      game.pendingAction ||
      game.winner ||
      game.turn.activeSeatId !== playerSeat.id ||
      game.turn.phase !== "出牌" ||
      !playerSeat.general.skills.some((skill) => skill.name === "巧变") ||
      playerSeat.hand.length === 0 ||
      game.turn.usedSkills.includes("巧变询问-出牌")
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      setSelectedCardId(null);
      setSelectedTargetIds([]);
      setSelectedSkillName(null);
      setSelectedSkillCardIds([]);
      setSelectedQiaobianMoveCardId(null);
      setGame((current) =>
        current && playerSeat && !current.pendingAction
          ? offerQiaobianPhase(current, playerSeat.id, "出牌")
          : current,
      );
    }, 160);

    return () => window.clearTimeout(timer);
  }, [game, playerSeat]);

  useEffect(() => {
    if (!discardPending) {
      setSelectedDiscardIds([]);
      return;
    }
    setSelectedDiscardIds((current) =>
      current.filter((id) => playerSeat?.hand.some((card) => card.instance_id === id)),
    );
  }, [discardPending, playerSeat]);

  useEffect(() => {
    if (pending?.type !== "yiji_response" || !pending.revealedCards) {
      setYijiAssignments({});
      return;
    }

    setYijiAssignments((current) => {
      const next: Record<string, number | null> = {};
      pending.revealedCards?.forEach((card) => {
        next[card.instance_id] = current[card.instance_id] ?? null;
      });
      return next;
    });
  }, [pending]);

  useEffect(() => {
    const shouldAutoAdvanceHumanPhase =
      game
        ? autoHumanPhases.has(game.turn.phase) ||
          (game.turn.phase === "出牌" && game.turn.skipPlay) ||
          game.turn.phase === "弃牌" ||
          game.turn.phase === "结束"
        : false;
    if (
      !game ||
      !activeSeat ||
      activeSeat.controller !== "human" ||
      game.pendingAction ||
      game.winner ||
      !shouldAutoAdvanceHumanPhase
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      setSelectedCardId(null);
      setGame((current) => (current ? advanceGame(current) : current));
    }, 420);

    return () => window.clearTimeout(timer);
  }, [activeSeat, game]);

  useEffect(() => {
    if (
      !game ||
      !activeSeat ||
      activeSeat.controller !== "ai" ||
      game.paused ||
      game.pendingAction ||
      game.winner
    ) {
      return;
    }

    const canUseExternalAi =
      aiConfig.enabled &&
      aiConfig.provider !== "local" &&
      game.turn.phase === "出牌";

    if (canUseExternalAi) {
      const legalActions = buildAiLegalActions(game, activeSeat.id);
      const requestKey = [
        game.seed,
        game.turn.round,
        game.turn.activeSeatId,
        game.turn.phase,
        game.turn.phaseStep,
        activeSeat.hand.map((card) => card.instance_id).join("."),
      ].join(":");

      if (legalActions.length === 0) {
        const timer = window.setTimeout(() => {
          setGame((current) => (current ? finishAiPlayPhase(current) : current));
        }, 300);
        return () => window.clearTimeout(timer);
      }

      if (aiRequestKeyRef.current === requestKey) {
        return;
      }

      aiRequestKeyRef.current = requestKey;
      setAiStatus(`${aiProviderLabels[aiConfig.provider]} 思考中：${activeSeat.general.name}`);
      const payload = buildAiDecisionPayload(game, activeSeat.id, legalActions);
      let cancelled = false;

      requestAiDecision(aiConfig, payload)
        .then((decision) => {
          if (cancelled) {
            return;
          }
          setAiStatus(
            `${aiProviderLabels[aiConfig.provider]} 选择：${
              legalActions.find((action) => action.id === decision.actionId)?.label ??
              decision.actionId
            }`,
          );
          setGame((current) => {
            if (!current) {
              return current;
            }
            const currentSeat = current.seats[current.turn.activeSeatId];
            const stillSameDecisionPoint =
              current.seed === game.seed &&
              current.turn.round === game.turn.round &&
              current.turn.activeSeatId === game.turn.activeSeatId &&
              current.turn.phase === "出牌" &&
              !current.pendingAction &&
              !current.winner &&
              currentSeat?.controller === "ai";
            if (!stillSameDecisionPoint) {
              return current;
            }
            const freshActions = buildAiLegalActions(current, currentSeat.id);
            return applyExternalAiAction(
              current,
              freshActions.find((action) => action.id === decision.actionId),
              decision.reason,
            );
          });
        })
        .catch((reason: unknown) => {
          if (cancelled) {
            return;
          }
          const message = reason instanceof Error ? reason.message : String(reason);
          setAiStatus(`${aiProviderLabels[aiConfig.provider]} 调用失败，改用本地 AI：${message}`);
          setGame((current) => {
            if (!current) {
              return current;
            }
            const currentSeat = current.seats[current.turn.activeSeatId];
            if (
              currentSeat?.controller !== "ai" ||
              current.turn.phase !== "出牌" ||
              current.pendingAction ||
              current.winner
            ) {
              return current;
            }
            return advanceGame(current);
          });
        });

      return () => {
        cancelled = true;
      };
    }

    setAiStatus(
      aiConfig.enabled && aiConfig.provider !== "local"
        ? `${aiProviderLabels[aiConfig.provider]} 服务端代理`
        : aiProviderLabels[aiConfig.provider],
    );

    const timer = window.setTimeout(() => {
      setGame((current) => (current ? advanceGame(current) : current));
    }, 720);

    return () => window.clearTimeout(timer);
  }, [activeSeat, aiConfig, applyExternalAiAction, game]);

  useEffect(() => {
    window.render_game_to_text = () =>
      JSON.stringify(
        game
          ? {
              ...summarizeState(game),
              aiProvider: aiProviderLabels[aiConfig.provider],
              externalAiEnabled: aiConfig.enabled && aiConfig.provider !== "local",
              aiStatus,
            }
          : {
              mode: data ? "setup" : "loading",
              selectedGenerals: data?.generals.length ?? 0,
              deckInstances: data?.deckInstances.length ?? 0,
              assignedRole: setupDraft?.assignedRole,
              generalChoices: setupDraft?.generalIds,
              selectedGeneralId: setupDraft?.selectedGeneralId,
            },
        null,
        2,
      );

    window.advanceTime = (ms: number) => {
      const steps = Math.max(1, Math.min(6, Math.round(ms / 500)));
      for (let i = 0; i < steps; i += 1) {
        setGame((current) => (current ? advanceGame(current) : current));
      }
  };
  }, [aiConfig.enabled, aiConfig.provider, aiStatus, data, game, setupDraft]);

  if (error) {
    return (
      <main className="app-shell">
        <section className="state-panel">
          <h1>数据读取失败</h1>
          <p>{error}</p>
        </section>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="app-shell">
        <section className="state-panel">
          <h1>正在布置身份局</h1>
          <p>读取武将、卡牌、牌堆并发起手牌。</p>
        </section>
      </main>
    );
  }

  if (!game && setupDraft) {
    return (
      <SetupScreen
        data={data}
        draft={setupDraft}
        selectedGeneralId={setupDraft.selectedGeneralId || data.generals[0]?.id || ""}
        onGeneralChange={selectSetupGeneral}
        onReroll={rerollSetup}
        onStart={startGame}
      />
    );
  }

  if (!game) {
    return (
      <main className="app-shell">
        <section className="state-panel">
          <h1>正在随机身份与武将候选</h1>
          <p>准备本局身份牌和五名候选武将。</p>
        </section>
      </main>
    );
  }

  if (!activeSeat || !playerSeat) {
    return (
      <main className="app-shell">
        <section className="state-panel">
          <h1>桌面状态异常</h1>
          <p>没有找到当前行动角色或玩家座位。</p>
        </section>
      </main>
    );
  }

  const roleText = Object.entries(roleCounts)
    .map(([role, count]) => `${count}${role}`)
    .join(" · ");
  const grantedPlayerSkills = hasGrantedHuangtian
      ? [
          {
            name: "黄天",
            description: "主公技授权。出牌阶段，你可以将一张【闪】或【闪电】交给拥有【黄天】的主公。",
          },
        ]
      : [];
  const playerSkillButtons = [
    ...playerSeat.general.skills,
    ...grantedPlayerSkills.filter(
      (granted) => !playerSeat.general.skills.some((skill) => skill.name === granted.name),
    ),
  ];

  return (
    <main className="game-shell" data-testid="game-board">
      <section className="table-header">
        <div>
          <p className="eyebrow">浏览器版单机身份局</p>
          <h1>肥喵多尼的AI三国杀 <span>v2.0</span></h1>
        </div>
        <div className="header-actions">
          <button
            type="button"
            onClick={() => setAiSettingsOpen((current) => !current)}
            data-testid="ai-settings-toggle"
          >
            AI 设置
          </button>
          <button type="button" onClick={togglePaused} data-testid="toggle-ai">
            {game.paused ? "继续 AI" : "暂停 AI"}
          </button>
          <button type="button" onClick={restart} data-testid="restart-game">
            重新开始
          </button>
        </div>
      </section>

      {aiSettingsOpen ? (
        <AiSettingsPanel
          config={aiConfig}
          status={
            aiConfig.enabled && aiConfig.provider !== "local"
              ? `${aiProviderLabels[aiConfig.provider]} 服务端代理，失败自动 fallback 本地 AI`
              : aiStatus
          }
          onChange={setAiConfig}
          onClose={() => setAiSettingsOpen(false)}
        />
      ) : null}

      <section className="table-layout">
        <div className="table-surface">
          {game.seats.map((seat) => (
            <SeatPanel
              key={seat.id}
              seat={seat}
              active={seat.id === game.turn.activeSeatId}
              targetable={targetableSeatIds.has(seat.id)}
              targetSelected={selectedTargetIds.includes(seat.id)}
              needsAction={requiredSeatId === seat.id}
              effectPulse={
                game.lastEffect?.targetSeatId === seat.id &&
                (game.lastEffect.effectKind === "target" ||
                  game.lastEffect.effectKind === "damage")
                  ? {
                      kind: game.lastEffect.effectKind,
                      label:
                        game.lastEffect.effectKind === "damage"
                          ? game.lastEffect.impactText ?? "受伤"
                          : game.lastEffect.impactText ?? "目标",
                      sequence: game.lastEffect.sequence,
                    }
                  : null
              }
              attackRange={getAttackRange(seat)}
              distanceFromPlayer={
                seat.id === playerSeat.id
                  ? 0
                  : distanceBetweenSeats(game, playerSeat, seat)
              }
              onTarget={() => handleTarget(seat.id)}
              onPreviewGeneral={setGeneralPreview}
            />
          ))}
          <TableActionOverlay effect={game.lastEffect} />
        </div>
      </section>

      {game.winner ? (
        <section className={`victory-screen ${roleToneClass(game.winner.side === "主忠" ? "主公" : game.winner.side)}`} data-testid="victory-screen">
          <div>
            <p className="eyebrow">游戏结束</p>
            <h2>
              {game.winner.side === "主忠"
                ? "主公与忠臣胜利"
                : `${game.winner.side}胜利`}
            </h2>
            <p>{game.winner.reason}</p>
          </div>
          <button type="button" onClick={restart}>
            重新开始
          </button>
        </section>
      ) : null}

      {pending?.type === "guanxing_response" && pending.seatId === playerSeat.id ? (
        <section className="response-panel" data-testid="guanxing-response">
          <div>
            <p className="eyebrow">观星</p>
            <h2>调整牌堆顶</h2>
            <p>{pending.message}</p>
            <p>
              {selectedSkillCardIds.length > 0
                ? `置顶顺序：${selectedSkillCardIds
                    .map((id) => guanxingCards.find((card) => card.instance_id === id)?.name)
                    .filter(Boolean)
                    .join("、")}`
                : "不选择则可将这些牌全部置底；未选牌会按原顺序置底。"}
            </p>
          </div>
          <div className="response-actions card-choice-actions">
            {guanxingCards.map((card) => {
              const order = selectedSkillCardIds.indexOf(card.instance_id);
              return (
                <MiniCard
                  key={card.instance_id}
                  card={card}
                  selected={order >= 0}
                  label={order >= 0 ? `顶${order + 1}` : "置顶"}
                  reason="点击加入或移出牌堆顶顺序"
                  onClick={() => handleGuanxingCardClick(card.instance_id)}
                />
              );
            })}
            <button type="button" onClick={() => handleGuanxingResponse("selected")}>
              确认观星
            </button>
            <button type="button" onClick={() => handleGuanxingResponse("original")}>
              原顺序置顶
            </button>
            <button type="button" onClick={() => handleGuanxingResponse("bottom")}>
              全部置底
            </button>
          </div>
        </section>
      ) : null}

      {pending?.type === "luoshen_response" && pending.seatId === playerSeat.id ? (
        <section className="response-panel" data-testid="luoshen-response">
          <div>
            <p className="eyebrow">洛神</p>
            <h2>{pending.count > 0 ? "是否继续洛神" : "是否发动洛神"}</h2>
            <p>{pending.message}</p>
          </div>
          <div className="response-actions">
            <button type="button" onClick={() => handleLuoshenResponse(true)}>
              {pending.count > 0 ? "继续判定" : "发动洛神"}
            </button>
            <button type="button" onClick={() => handleLuoshenResponse(false)}>
              {pending.count > 0 ? "停止" : "不发动"}
            </button>
          </div>
        </section>
      ) : null}

      {pending?.type === "draw_skill_response" && pending.seatId === playerSeat.id ? (
        <section className="response-panel" data-testid="draw-skill-response">
          <div>
            <p className="eyebrow">{pending.skillName}</p>
            <h2>是否发动{pending.skillName}</h2>
            <p>{pending.message}</p>
          </div>
          <div className="response-actions">
            <button type="button" onClick={() => handleDrawSkillResponse(true)}>
              发动{pending.skillName}
            </button>
            <button type="button" onClick={() => handleDrawSkillResponse(false)}>
              不发动
            </button>
          </div>
        </section>
      ) : null}

      {pending?.type === "tuxi_response" && pending.seatId === playerSeat.id ? (
        <section className="response-panel" data-testid="tuxi-response">
          <div>
            <p className="eyebrow">突袭</p>
            <h2>选择至多两名目标</h2>
            <p>{pending.message}</p>
            <p>{selectedTargetNames ? `已选：${selectedTargetNames}` : "点击桌面上有手牌的角色，最多两名。"}</p>
          </div>
          <div className="response-actions">
            <button
              type="button"
              onClick={() => handleTuxiResponse(true)}
              disabled={selectedTargetIds.length < 1}
            >
              发动突袭
            </button>
            <button type="button" onClick={() => handleTuxiResponse(false)}>
              不发动
            </button>
          </div>
        </section>
      ) : null}

      {pending?.type === "shensu_response" && pending.seatId === playerSeat.id ? (
        <section className="response-panel" data-testid="shensu-response">
          <div>
            <p className="eyebrow">神速</p>
            <h2>{pending.mode === "skip_judge_draw" ? "是否发动第一项" : "是否发动第二项"}</h2>
            <p>{pending.message}</p>
            <p>{selectedTargetNames ? `已选目标：${selectedTargetNames}` : "点击桌面上的一名可选目标。"}</p>
          </div>
          <div className="response-actions card-choice-actions">
            {pending.mode === "skip_play"
              ? shensuEquipmentCards.map((card) => {
                  const selected = selectedSkillCardIds[0] === card.instance_id;
                  return (
                    <MiniCard
                      key={card.instance_id}
                      card={card}
                      selected={selected}
                      label={selected ? "已选" : "弃置"}
                      reason={`弃置${card.name}发动神速第二项`}
                      onClick={() =>
                        setSelectedSkillCardIds((current) =>
                          current[0] === card.instance_id ? [] : [card.instance_id],
                        )
                      }
                    />
                  );
                })
              : null}
            <button
              type="button"
              onClick={() => handleShensuResponse(true)}
              disabled={
                selectedTargetIds.length !== 1 ||
                (pending.mode === "skip_play" && selectedSkillCardIds.length !== 1)
              }
            >
              {pending.mode === "skip_judge_draw" ? "发动第一项" : "发动第二项"}
            </button>
            <button type="button" onClick={() => handleShensuResponse(false)}>
              不发动
            </button>
          </div>
        </section>
      ) : null}

      {pending?.type === "fangquan_play_response" && pending.seatId === playerSeat.id ? (
        <section className="response-panel" data-testid="fangquan-play-response">
          <div>
            <p className="eyebrow">放权</p>
            <h2>是否跳过出牌阶段</h2>
            <p>{pending.message}</p>
          </div>
          <div className="response-actions">
            <button type="button" onClick={() => handleFangquanPlayResponse(true)}>
              发动放权
            </button>
            <button type="button" onClick={() => handleFangquanPlayResponse(false)}>
              不发动
            </button>
          </div>
        </section>
      ) : null}

      {pending?.type === "fangquan_end_response" && pending.seatId === playerSeat.id ? (
        <section className="response-panel" data-testid="fangquan-end-response">
          <div>
            <p className="eyebrow">放权</p>
            <h2>选择弃牌与额外回合目标</h2>
            <p>{pending.message}</p>
            <p>{selectedTargetNames ? `已选目标：${selectedTargetNames}` : "点击桌面上的一名其他角色。"}</p>
          </div>
          <div className="response-actions card-choice-actions">
            {fangquanDiscardCards.map((card) => {
              const selected = selectedSkillCardIds[0] === card.instance_id;
              return (
                <MiniCard
                  key={card.instance_id}
                  card={card}
                  selected={selected}
                  label={selected ? "已选" : "弃置"}
                  reason={`弃置${card.name}结算放权`}
                  onClick={() =>
                    setSelectedSkillCardIds((current) =>
                      current[0] === card.instance_id ? [] : [card.instance_id],
                    )
                  }
                />
              );
            })}
            <button
              type="button"
              onClick={() => handleFangquanEndResponse(true)}
              disabled={selectedTargetIds.length !== 1 || selectedSkillCardIds.length !== 1}
            >
              弃牌放权
            </button>
            <button type="button" onClick={() => handleFangquanEndResponse(false)}>
              不结算
            </button>
          </div>
        </section>
      ) : null}

      {pending?.type === "keji_response" && pending.seatId === playerSeat.id ? (
        <section className="response-panel" data-testid="keji-response">
          <div>
            <p className="eyebrow">克己</p>
            <h2>是否跳过弃牌阶段</h2>
            <p>{pending.message}</p>
          </div>
          <div className="response-actions">
            <button type="button" onClick={() => handleKejiResponse(true)}>
              发动克己
            </button>
            <button type="button" onClick={() => handleKejiResponse(false)}>
              不发动
            </button>
          </div>
        </section>
      ) : null}

      {pending?.type === "end_skill_response" && pending.seatId === playerSeat.id ? (
        <section className="response-panel" data-testid="end-skill-response">
          <div>
            <p className="eyebrow">{pending.skillName}</p>
            <h2>是否发动{pending.skillName}</h2>
            <p>{pending.message}</p>
          </div>
          <div className="response-actions">
            <button type="button" onClick={() => handleEndSkillResponse(true)}>
              发动{pending.skillName}
            </button>
            <button type="button" onClick={() => handleEndSkillResponse(false)}>
              不发动
            </button>
          </div>
        </section>
      ) : null}

      {pending?.type === "qiaobian_phase" && pending.seatId === playerSeat.id ? (
        <section className="response-panel" data-testid="qiaobian-phase-response">
          <div>
            <p className="eyebrow">巧变</p>
            <h2>是否跳过{pending.phase}阶段</h2>
            <p>{pending.message}</p>
          </div>
          <div className="response-actions card-choice-actions">
            {playerSeat.hand.map((card) => (
              <MiniCard
                key={card.instance_id}
                card={card}
                label={`跳过${pending.phase}`}
                reason={`弃置${card.name}，跳过${pending.phase}阶段`}
                onClick={() => handleQiaobianPhase(card.instance_id)}
              />
            ))}
            <button type="button" onClick={() => handleQiaobianPhase(null)}>
              不发动
            </button>
          </div>
        </section>
      ) : null}

      {pending?.type === "liuli_response" && pending.targetSeatId === playerSeat.id ? (
        <section className="response-panel" data-testid="liuli-response">
          <div>
            <p className="eyebrow">流离</p>
            <h2>是否转移杀</h2>
            <p>{pending.message}</p>
            <p>{selectedTargetNames ? `已选目标：${selectedTargetNames}` : "先选一张手牌或装备牌，再点桌面上的合法目标。"}</p>
          </div>
          <div className="response-actions card-choice-actions">
            {liuliCards.map((card) => (
              <MiniCard
                key={card.instance_id}
                card={card}
                selected={selectedSkillCardIds.includes(card.instance_id)}
                label={selectedSkillCardIds.includes(card.instance_id) ? "已选" : "弃置"}
                reason={`弃置${card.name}发动流离`}
                onClick={() => handleCardClick(card)}
              />
            ))}
            <button
              type="button"
              onClick={() => handleLiuliResponse(true)}
              disabled={selectedSkillCardIds.length !== 1 || selectedTargetIds.length !== 1}
            >
              发动流离
            </button>
            <button type="button" onClick={() => handleLiuliResponse(false)}>
              不发动
            </button>
          </div>
        </section>
      ) : null}

      {pending?.type === "tianxiang_response" && pending.targetSeatId === playerSeat.id ? (
        <section className="response-panel" data-testid="tianxiang-response">
          <div>
            <p className="eyebrow">天香</p>
            <h2>是否转移伤害</h2>
            <p>{pending.message}</p>
            <p>{selectedTargetNames ? `转移给：${selectedTargetNames}` : "选择一张红桃牌，再点桌面上的转移目标。"}</p>
          </div>
          <div className="response-actions card-choice-actions">
            {tianxiangCards.map((card) => (
              <MiniCard
                key={card.instance_id}
                card={card}
                selected={selectedSkillCardIds.includes(card.instance_id)}
                label={selectedSkillCardIds.includes(card.instance_id) ? "已选" : "红桃"}
                reason={`弃置${card.name}发动天香`}
                onClick={() => handleCardClick(card)}
              />
            ))}
            <button
              type="button"
              onClick={() => handleTianxiangResponse(true)}
              disabled={selectedSkillCardIds.length !== 1 || selectedTargetIds.length !== 1}
            >
              发动天香
            </button>
            <button type="button" onClick={() => handleTianxiangResponse(false)}>
              不发动
            </button>
          </div>
        </section>
      ) : null}

      {pending?.type === "beige_response" && pending.singerSeatId === playerSeat.id ? (
        <section className="response-panel" data-testid="beige-response">
          <div>
            <p className="eyebrow">悲歌</p>
            <h2>是否弃牌判定</h2>
            <p>{pending.message}</p>
          </div>
          <div className="response-actions card-choice-actions">
            {beigeCards.map((card) => (
              <MiniCard
                key={card.instance_id}
                card={card}
                selected={selectedSkillCardIds.includes(card.instance_id)}
                label={selectedSkillCardIds.includes(card.instance_id) ? "已选" : "弃置"}
                reason={`弃置${card.name}发动悲歌`}
                onClick={() => handleCardClick(card)}
              />
            ))}
            <button
              type="button"
              onClick={() => handleBeigeResponse(true)}
              disabled={selectedSkillCardIds.length !== 1}
            >
              发动悲歌
            </button>
            <button type="button" onClick={() => handleBeigeResponse(false)}>
              不发动
            </button>
          </div>
        </section>
      ) : null}

      {pending?.type === "beige_club_discard_response" && pending.sourceSeatId === playerSeat.id ? (
        <section className="response-panel" data-testid="beige-club-discard-response">
          <div>
            <p className="eyebrow">悲歌</p>
            <h2>弃置伤害来源的牌</h2>
            <p>{pending.message}</p>
          </div>
          <div className="response-actions card-choice-actions">
            {beigeClubDiscardCards.map((card) => (
              <MiniCard
                key={card.instance_id}
                card={card}
                selected={selectedSkillCardIds.includes(card.instance_id)}
                label={selectedSkillCardIds.includes(card.instance_id) ? "已选" : "弃置"}
                reason={`因悲歌弃置${card.name}`}
                onClick={() => handleCardClick(card)}
              />
            ))}
            <button
              type="button"
              onClick={handleBeigeClubDiscard}
              disabled={selectedSkillCardIds.length !== pending.requiredCount}
            >
              弃置{pending.requiredCount}张
            </button>
          </div>
        </section>
      ) : null}

      {pending?.type === "fankui_response" && pending.targetSeatId === playerSeat.id ? (
        <section className="response-panel" data-testid="fankui-response">
          <div>
            <p className="eyebrow">反馈</p>
            <h2>是否获得伤害来源一张牌</h2>
            <p>{pending.message}</p>
          </div>
          <div className="response-actions">
            {pending.cardOptions.map((option) => (
              <button
                type="button"
                key={option.key}
                onClick={() => handleFankuiResponse(option.key)}
              >
                {option.zone}：{option.label}
              </button>
            ))}
            <button type="button" onClick={() => handleFankuiResponse(null)}>
              不发动
            </button>
          </div>
        </section>
      ) : null}

      {pending?.type === "fanjian_suit_response" && pending.targetSeatId === playerSeat.id ? (
        <section className="response-panel" data-testid="fanjian-suit-response">
          <div>
            <p className="eyebrow">反间</p>
            <h2>声明花色</h2>
            <p>{pending.message}</p>
          </div>
          <div className="response-actions">
            {(["黑桃", "红桃", "梅花", "方片"] as DeclaredSuit[]).map((suit) => (
              <button type="button" key={suit} onClick={() => handleFanjianSuitResponse(suit)}>
                {suit}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {pending?.type === "yiji_response" && pending.targetSeatId === playerSeat.id ? (
        <section className="response-panel" data-testid="yiji-response">
          <div>
            <p className="eyebrow">遗计</p>
            <h2>{pending.revealedCards ? "分配遗计牌" : "是否发动遗计"}</h2>
            <p>{pending.message}</p>
          </div>
          {pending.revealedCards ? (
            <div className="response-actions yiji-allocation-actions">
              {pending.revealedCards.map((card) => (
                <label className="yiji-allocation-row" key={card.instance_id}>
                  <MiniCard
                    card={card}
                    disabled
                    label="遗计牌"
                    reason={`遗计牌：${card.name}`}
                  />
                  <span>交给</span>
                  <select
                    value={yijiAssignments[card.instance_id] ?? ""}
                    onChange={(event) =>
                      handleYijiRecipientChange(
                        card.instance_id,
                        event.target.value === "" ? null : Number(event.target.value),
                      )
                    }
                  >
                    <option value="">选择角色</option>
                    {pending.validTargetIds.map((seatId) => {
                      const seat = game.seats[seatId];
                      return (
                        <option key={seatId} value={seatId}>
                          {seat.id === playerSeat.id ? `${seat.general.name}（自己）` : seat.general.name}
                        </option>
                      );
                    })}
                  </select>
                </label>
              ))}
              <button
                type="button"
                onClick={handleConfirmYijiDistribution}
                disabled={pending.revealedCards.some(
                  (card) => yijiAssignments[card.instance_id] === null || yijiAssignments[card.instance_id] === undefined,
                )}
              >
                确认分配
              </button>
            </div>
          ) : (
            <div className="response-actions">
              <button type="button" onClick={() => handleYijiResponse(true)}>
                发动遗计（{pending.drawCount}张）
              </button>
              <button type="button" onClick={() => handleYijiResponse(false)}>
                不发动
              </button>
            </div>
          )}
        </section>
      ) : null}

      {pending?.type === "jieming_response" && pending.targetSeatId === playerSeat.id ? (
        <section className="response-panel" data-testid="jieming-response">
          <div>
            <p className="eyebrow">节命</p>
            <h2>是否令一名角色补牌</h2>
            <p>{pending.message}</p>
            <p>{selectedTargetNames ? `补牌给：${selectedTargetNames}` : "点击桌面上的一名角色，令其摸至体力上限张。"}</p>
          </div>
          <div className="response-actions">
            <button
              type="button"
              onClick={() => handleJiemingResponse(true)}
              disabled={selectedTargetIds.length !== 1}
            >
              发动节命
            </button>
            <button type="button" onClick={() => handleJiemingResponse(false)}>
              不发动
            </button>
          </div>
        </section>
      ) : null}

      {pending?.type === "jianxiong_response" && pending.targetSeatId === playerSeat.id ? (
        <section className="response-panel" data-testid="jianxiong-response">
          <div>
            <p className="eyebrow">奸雄</p>
            <h2>是否获得造成伤害的牌</h2>
            <p>{pending.message}</p>
          </div>
          <div className="response-actions">
            <button type="button" onClick={() => handleJianxiongResponse(true)}>
              发动奸雄
            </button>
            <button type="button" onClick={() => handleJianxiongResponse(false)}>
              不发动
            </button>
          </div>
        </section>
      ) : null}

      {pending?.type === "ganglie_response" && pending.targetSeatId === playerSeat.id ? (
        <section className="response-panel" data-testid="ganglie-response">
          <div>
            <p className="eyebrow">刚烈</p>
            <h2>是否判定反击</h2>
            <p>{pending.message}</p>
          </div>
          <div className="response-actions">
            <button type="button" onClick={() => handleGanglieResponse(true)}>
              发动刚烈
            </button>
            <button type="button" onClick={() => handleGanglieResponse(false)}>
              不发动
            </button>
          </div>
        </section>
      ) : null}

      {pending?.type === "ganglie_cost_response" && pending.sourceSeatId === playerSeat.id ? (
        <section className="response-panel" data-testid="ganglie-cost-response">
          <div>
            <p className="eyebrow">刚烈</p>
            <h2>选择代价</h2>
            <p>{pending.message}</p>
          </div>
          <div className="response-actions card-choice-actions">
            {ganglieDiscardCards.map((card) => {
              const selected = selectedSkillCardIds.includes(card.instance_id);
              return (
                <MiniCard
                  key={card.instance_id}
                  card={card}
                  selected={selected}
                  label={selected ? "已选" : "弃置"}
                  reason={`弃置${card.name}结算刚烈`}
                  onClick={() =>
                    setSelectedSkillCardIds((current) =>
                      current.includes(card.instance_id)
                        ? current.filter((id) => id !== card.instance_id)
                        : current.length >= 2
                          ? [current[1], card.instance_id]
                          : [...current, card.instance_id],
                    )
                  }
                />
              );
            })}
            <button
              type="button"
              onClick={() => handleGanglieCostResponse(selectedSkillCardIds.slice(0, 2))}
              disabled={selectedSkillCardIds.length !== 2}
            >
              弃2张手牌
            </button>
            <button type="button" onClick={() => handleGanglieCostResponse(null)}>
              受1点伤害
            </button>
          </div>
        </section>
      ) : null}

      {pending?.type === "xiaoji_response" && pending.seatId === playerSeat.id ? (
        <section className="response-panel" data-testid="xiaoji-response">
          <div>
            <p className="eyebrow">枭姬</p>
            <h2>是否摸两张牌</h2>
            <p>{pending.message}</p>
          </div>
          <div className="response-actions">
            <button type="button" onClick={() => handleXiaojiResponse(true)}>
              发动枭姬
            </button>
            <button type="button" onClick={() => handleXiaojiResponse(false)}>
              不发动
            </button>
          </div>
        </section>
      ) : null}

      {pending?.type === "leiji_response" && pending.actorSeatId === playerSeat.id ? (
        <section className="response-panel" data-testid="leiji-response">
          <div>
            <p className="eyebrow">雷击</p>
            <h2>是否令一名角色判定</h2>
            <p>{pending.message}</p>
            <p>{selectedTargetNames ? `雷击目标：${selectedTargetNames}` : "点击桌面上的一名其他角色作为雷击目标。"}</p>
          </div>
          <div className="response-actions">
            <button
              type="button"
              onClick={() => handleLeijiResponse(true)}
              disabled={selectedTargetIds.length !== 1}
            >
              发动雷击
            </button>
            <button type="button" onClick={() => handleLeijiResponse(false)}>
              不发动
            </button>
          </div>
        </section>
      ) : null}

      {pending?.type === "shan_response" && pending.targetSeatId === playerSeat.id ? (
        <section className="response-panel" data-testid="shan-response">
          <div>
            <p className="eyebrow">响应</p>
            <h2>需要打出闪</h2>
            <p>{pending.message}</p>
          </div>
          <div className="response-actions card-choice-actions">
            {longdanResponseMode === "shan" ? (
              <button
                type="button"
                className={isLongdanResponseSelected ? "is-selected" : undefined}
                onClick={() => handleSkillClick("龙胆")}
                data-testid="response-skill-longdan"
              >
                {isLongdanResponseSelected ? "取消龙胆" : "龙胆：杀当闪"}
              </button>
            ) : null}
            {shanCards.map((card) => (
              <MiniCard
                key={card.instance_id}
                card={card}
                label="打出"
                reason={`打出${card.name}响应杀`}
                onClick={() => handleShaResponse(true, card.instance_id)}
              />
            ))}
            <button type="button" onClick={() => handleShaResponse(false)}>
              不出闪，承受伤害
            </button>
          </div>
        </section>
      ) : null}

      {pending?.type === "guanshi_force_response" && pending.sourceSeatId === playerSeat.id ? (
        <section className="response-panel" data-testid="guanshi-force-response">
          <div>
            <p className="eyebrow">贯石斧</p>
            <h2>弃置2张牌强制命中</h2>
            <p>{pending.message}</p>
          </div>
          <div className="response-actions card-choice-actions">
            {guanshiDiscardCards.map((card) => {
              const selected = selectedSkillCardIds.includes(card.instance_id);
              return (
                <MiniCard
                  key={card.instance_id}
                  card={card}
                  selected={selected}
                  label={selected ? "已选" : "弃置"}
                  reason={`弃置${card.name}作为贯石斧代价`}
                  onClick={() =>
                    setSelectedSkillCardIds((current) =>
                      current.includes(card.instance_id)
                        ? current.filter((id) => id !== card.instance_id)
                        : current.length >= 2
                          ? [current[1], card.instance_id]
                          : [...current, card.instance_id],
                    )
                  }
                />
              );
            })}
            <button type="button" onClick={() => handleGuanshiResponse(true)} disabled={selectedSkillCardIds.length !== 2}>
              发动贯石斧
            </button>
            <button type="button" onClick={() => handleGuanshiResponse(false)}>
              不发动
            </button>
          </div>
        </section>
      ) : null}

      {pending?.type === "xiangle_response" && pending.sourceSeatId === playerSeat.id ? (
        <section className="response-panel" data-testid="xiangle-response">
          <div>
            <p className="eyebrow">享乐</p>
            <h2>弃置1张基本牌</h2>
            <p>{pending.message}</p>
          </div>
          <div className="response-actions card-choice-actions">
            {xiangleBasicCards.map((card) => (
              <MiniCard
                key={card.instance_id}
                card={card}
                label="弃置"
                reason={`弃置${card.name}，令杀继续结算`}
                onClick={() => handleXiangleResponse(card.instance_id)}
              />
            ))}
            <button type="button" onClick={() => handleXiangleResponse(null)}>
              不弃置，令杀无效
            </button>
          </div>
        </section>
      ) : null}

      {pending?.type === "qiangxi_cost_response" && pending.sourceSeatId === playerSeat.id ? (
        <section className="response-panel" data-testid="qiangxi-cost-response">
          <div>
            <p className="eyebrow">强袭</p>
            <h2>选择发动代价</h2>
            <p>{pending.message}</p>
          </div>
          <div className="response-actions card-choice-actions">
            {qiangxiWeaponOptions.map((option) => (
              <MiniCard
                key={option.key}
                card={option.card}
                label={`弃${option.zone}`}
                reason={`弃置${option.zone}${option.card.name}发动强袭`}
                onClick={() => handleQiangxiCost(option.key)}
              />
            ))}
            <button type="button" onClick={() => handleQiangxiCost(null)}>
              失去1点体力
            </button>
          </div>
        </section>
      ) : null}

      {pending?.type === "qinglong_followup_response" && pending.sourceSeatId === playerSeat.id ? (
        <section className="response-panel" data-testid="qinglong-followup-response">
          <div>
            <p className="eyebrow">青龙偃月刀</p>
            <h2>追加一张杀</h2>
            <p>{pending.message}</p>
          </div>
          <div className="response-actions card-choice-actions">
            {qinglongShaCards.map((card) => (
              <MiniCard
                key={card.instance_id}
                card={card}
                label="追杀"
                reason={`使用${card.name}发动青龙偃月刀`}
                onClick={() => handleQinglongResponse(card.instance_id)}
              />
            ))}
            <button type="button" onClick={() => handleQinglongResponse(null)}>
              不追杀
            </button>
          </div>
        </section>
      ) : null}

      {pending?.type === "cixiong_response" && pending.targetSeatId === playerSeat.id ? (
        <section className="response-panel" data-testid="cixiong-response">
          <div>
            <p className="eyebrow">雌雄双股剑</p>
            <h2>选择1张手牌弃置</h2>
            <p>{pending.message}</p>
          </div>
          <div className="response-actions card-choice-actions">
            {cixiongCards.map((card) => (
              <MiniCard
                key={card.instance_id}
                card={card}
                selected={selectedSkillCardIds[0] === card.instance_id}
                label={selectedSkillCardIds[0] === card.instance_id ? "已选" : "弃置"}
                reason={`弃置${card.name}响应雌雄双股剑`}
                onClick={() => setSelectedSkillCardIds([card.instance_id])}
              />
            ))}
            <button
              type="button"
              onClick={() => handleCixiongResponse(selectedSkillCardIds[0] ?? null)}
              disabled={selectedSkillCardIds.length !== 1}
            >
              弃置所选手牌
            </button>
            <button type="button" onClick={() => handleCixiongResponse(null)}>
              让对方摸1张
            </button>
          </div>
        </section>
      ) : null}

      {pending?.type === "hanbing_response" && pending.sourceSeatId === playerSeat.id ? (
        <section className="response-panel" data-testid="hanbing-response">
          <div>
            <p className="eyebrow">寒冰剑</p>
            <h2>防止伤害并弃置2张牌</h2>
            <p>{pending.message}</p>
          </div>
          <div className="response-actions card-choice-actions">
            {hanbingOptions.map((option) =>
              option.card ? (
                <MiniCard
                  key={option.key}
                  card={option.card}
                  selected={selectedSkillCardIds.includes(option.key)}
                  label={selectedSkillCardIds.includes(option.key) ? "已选" : "弃置"}
                  reason={`弃置${option.zone}${option.label}`}
                  onClick={() =>
                    setSelectedSkillCardIds((current) =>
                      current.includes(option.key)
                        ? current.filter((key) => key !== option.key)
                        : current.length >= 2
                          ? current
                          : [...current, option.key],
                    )
                  }
                />
              ) : (
                <button
                  type="button"
                  key={option.key}
                  className={selectedSkillCardIds.includes(option.key) ? "is-selected" : undefined}
                  onClick={() =>
                    setSelectedSkillCardIds((current) =>
                      current.includes(option.key)
                        ? current.filter((key) => key !== option.key)
                        : current.length >= 2
                          ? current
                          : [...current, option.key],
                    )
                  }
                >
                  {selectedSkillCardIds.includes(option.key) ? "已选" : "弃置"}{option.label}
                </button>
              ),
            )}
            <button
              type="button"
              onClick={() => handleHanbingResponse(selectedSkillCardIds.slice(0, 2))}
              disabled={selectedSkillCardIds.length !== 2}
            >
              发动寒冰剑
            </button>
            <button type="button" onClick={() => handleHanbingResponse(null)}>
              不发动，造成伤害
            </button>
          </div>
        </section>
      ) : null}

      {pending?.type === "qilingong_response" && pending.sourceSeatId === playerSeat.id ? (
        <section className="response-panel" data-testid="qilingong-response">
          <div>
            <p className="eyebrow">麒麟弓</p>
            <h2>弃置目标坐骑</h2>
            <p>{pending.message}</p>
          </div>
          <div className="response-actions card-choice-actions">
            {qilingongMountOptions.map((option) => (
              <MiniCard
                key={option.key}
                card={option.card}
                label="弃马"
                reason={`弃置${option.card.name}`}
                onClick={() => handleQilingongResponse(option.key)}
              />
            ))}
            <button type="button" onClick={() => handleQilingongResponse(null)}>
              不发动
            </button>
          </div>
        </section>
      ) : null}

      {pending?.type === "basic_card_response" && pending.targetSeatId === playerSeat.id ? (
        <section className="response-panel" data-testid="basic-card-response">
          <div>
            <p className="eyebrow">响应</p>
            <h2>需要打出{pending.requiredCard === "shan" ? "闪" : "杀"}</h2>
            <p>{pending.message}</p>
          </div>
          <div className="response-actions card-choice-actions">
            {longdanResponseMode ? (
              <button
                type="button"
                className={isLongdanResponseSelected ? "is-selected" : undefined}
                onClick={() => handleSkillClick("龙胆")}
                data-testid="response-skill-longdan"
              >
                {isLongdanResponseSelected
                  ? "取消龙胆"
                  : longdanResponseMode === "shan"
                    ? "龙胆：杀当闪"
                    : "龙胆：闪当杀"}
              </button>
            ) : null}
            {basicResponseCards.map((card) => (
              <MiniCard
                key={card.instance_id}
                card={card}
                label="打出"
                reason={`打出${card.name}响应${pending.cardName}`}
                onClick={() => handleBasicResponse("card", card.instance_id)}
              />
            ))}
            {canUseZhangbaForBasicResponse ? (
              <>
                {playerSeat.hand.map((card) => (
                  <MiniCard
                    key={`zhangba-basic-${card.instance_id}`}
                    card={card}
                    selected={selectedSkillCardIds.includes(card.instance_id)}
                    label={selectedSkillCardIds.includes(card.instance_id) ? "已选" : "丈八"}
                    reason="选择两张牌当【杀】响应"
                    onClick={() =>
                      setSelectedSkillCardIds((current) =>
                        current.includes(card.instance_id)
                          ? current.filter((id) => id !== card.instance_id)
                          : current.length >= 2
                            ? [current[1], card.instance_id]
                            : [...current, card.instance_id],
                      )
                    }
                  />
                ))}
                <button
                  type="button"
                  onClick={() => handleBasicResponse("card", selectedSkillCardIds.slice(0, 2))}
                  disabled={selectedSkillCardIds.length !== 2}
                >
                  丈八当杀
                </button>
              </>
            ) : null}
            {wuxieCards.map((card) => (
              <MiniCard
                key={card.instance_id}
                card={card}
                label="无懈"
                reason={`使用${card.name}抵消锦囊效果`}
                onClick={() => handleBasicResponse("wuxie", card.instance_id)}
              />
            ))}
            <button type="button" onClick={() => handleBasicResponse("pass")}>
              不响应，承受效果
            </button>
          </div>
        </section>
      ) : null}

      {pending?.type === "duel_sha_response" && pending.currentSeatId === playerSeat.id ? (
        <section className="response-panel" data-testid="duel-sha-response">
          <div>
            <p className="eyebrow">决斗</p>
            <h2>需要打出杀</h2>
            <p>{pending.message}</p>
          </div>
          <div className="response-actions card-choice-actions">
            {longdanResponseMode === "sha" ? (
              <button
                type="button"
                className={isLongdanResponseSelected ? "is-selected" : undefined}
                onClick={() => handleSkillClick("龙胆")}
                data-testid="response-skill-longdan"
              >
                {isLongdanResponseSelected ? "取消龙胆" : "龙胆：闪当杀"}
              </button>
            ) : null}
            {duelShaCards.map((card) => (
              <MiniCard
                key={card.instance_id}
                card={card}
                label="打出"
                reason={`打出${card.name}响应决斗`}
                onClick={() => handleDuelShaResponse(true, card.instance_id)}
              />
            ))}
            {canUseZhangbaForDuel ? (
              <>
                {playerSeat.hand.map((card) => (
                  <MiniCard
                    key={`zhangba-duel-${card.instance_id}`}
                    card={card}
                    selected={selectedSkillCardIds.includes(card.instance_id)}
                    label={selectedSkillCardIds.includes(card.instance_id) ? "已选" : "丈八"}
                    reason="选择两张牌当【杀】响应决斗"
                    onClick={() =>
                      setSelectedSkillCardIds((current) =>
                        current.includes(card.instance_id)
                          ? current.filter((id) => id !== card.instance_id)
                          : current.length >= 2
                            ? [current[1], card.instance_id]
                            : [...current, card.instance_id],
                      )
                    }
                  />
                ))}
                <button
                  type="button"
                  onClick={() => handleDuelShaResponse(true, selectedSkillCardIds.slice(0, 2))}
                  disabled={selectedSkillCardIds.length !== 2}
                >
                  丈八当杀
                </button>
              </>
            ) : null}
            <button type="button" onClick={() => handleDuelShaResponse(false)}>
              不出杀，承受伤害
            </button>
          </div>
        </section>
      ) : null}

      {pending?.type === "huogong_discard" && pending.sourceSeatId === playerSeat.id ? (
        <section className="response-panel" data-testid="huogong-discard-response">
          <div>
            <p className="eyebrow">火攻</p>
            <h2>弃置同花色牌</h2>
            <p>{pending.message}</p>
          </div>
          <div className="response-actions card-choice-actions">
            {huogongDiscardCards.map((card) => (
              <MiniCard
                key={card.instance_id}
                card={card}
                label="弃置"
                reason={`弃置${card.name}，造成1点火焰伤害`}
                onClick={() => handleHuogongDiscard(card.instance_id)}
              />
            ))}
            <button type="button" onClick={() => handleHuogongDiscard(null)}>
              不弃置
            </button>
          </div>
        </section>
      ) : null}

      {pending?.type === "jiedao_sha_response" && pending.weaponOwnerSeatId === playerSeat.id ? (
        <section className="response-panel" data-testid="jiedao-sha-response">
          <div>
            <p className="eyebrow">借刀杀人</p>
            <h2>需要打出杀</h2>
            <p>{pending.message}</p>
          </div>
          <div className="response-actions card-choice-actions">
            {longdanResponseMode === "sha" ? (
              <button
                type="button"
                className={isLongdanResponseSelected ? "is-selected" : undefined}
                onClick={() => handleSkillClick("龙胆")}
                data-testid="response-skill-longdan"
              >
                {isLongdanResponseSelected ? "取消龙胆" : "龙胆：闪当杀"}
              </button>
            ) : null}
            {jiedaoShaCards.map((card) => (
              <MiniCard
                key={card.instance_id}
                card={card}
                label="出杀"
                reason={`使用${card.name}响应借刀杀人`}
                onClick={() => handleJiedaoResponse(true, card.instance_id)}
              />
            ))}
            {canUseZhangbaForJiedao ? (
              <>
                {playerSeat.hand.map((card) => (
                  <MiniCard
                    key={`zhangba-jiedao-${card.instance_id}`}
                    card={card}
                    selected={selectedSkillCardIds.includes(card.instance_id)}
                    label={selectedSkillCardIds.includes(card.instance_id) ? "已选" : "丈八"}
                    reason="选择两张牌当【杀】响应借刀杀人"
                    onClick={() =>
                      setSelectedSkillCardIds((current) =>
                        current.includes(card.instance_id)
                          ? current.filter((id) => id !== card.instance_id)
                          : current.length >= 2
                            ? [current[1], card.instance_id]
                            : [...current, card.instance_id],
                      )
                    }
                  />
                ))}
                <button
                  type="button"
                  onClick={() => handleJiedaoResponse(true, selectedSkillCardIds.slice(0, 2))}
                  disabled={selectedSkillCardIds.length !== 2}
                >
                  丈八当杀
                </button>
              </>
            ) : null}
            <button type="button" onClick={() => handleJiedaoResponse(false)}>
              交出武器
            </button>
          </div>
        </section>
      ) : null}

      {pending?.type === "qihu_sha_response" && pending.forcedSeatId === playerSeat.id ? (
        <section className="response-panel" data-testid="qihu-sha-response">
          <div>
            <p className="eyebrow">驱虎</p>
            <h2>需要使用杀</h2>
            <p>{pending.message}</p>
          </div>
          <div className="response-actions card-choice-actions">
            {longdanResponseMode === "sha" ? (
              <button
                type="button"
                className={isLongdanResponseSelected ? "is-selected" : undefined}
                onClick={() => handleSkillClick("龙胆")}
                data-testid="response-skill-longdan"
              >
                {isLongdanResponseSelected ? "取消龙胆" : "龙胆：闪当杀"}
              </button>
            ) : null}
            {qihuShaCards.map((card) => (
              <MiniCard
                key={card.instance_id}
                card={card}
                label="出杀"
                reason={`因驱虎对目标使用${card.name}`}
                onClick={() => handleQihuResponse(true, card.instance_id)}
              />
            ))}
            {canUseZhangbaForQihu ? (
              <>
                {playerSeat.hand.map((card) => (
                  <MiniCard
                    key={`zhangba-qihu-${card.instance_id}`}
                    card={card}
                    selected={selectedSkillCardIds.includes(card.instance_id)}
                    label={selectedSkillCardIds.includes(card.instance_id) ? "已选" : "丈八"}
                    reason="选择两张牌当【杀】响应驱虎"
                    onClick={() =>
                      setSelectedSkillCardIds((current) =>
                        current.includes(card.instance_id)
                          ? current.filter((id) => id !== card.instance_id)
                          : current.length >= 2
                            ? [current[1], card.instance_id]
                            : [...current, card.instance_id],
                      )
                    }
                  />
                ))}
                <button
                  type="button"
                  onClick={() => handleQihuResponse(true, selectedSkillCardIds.slice(0, 2))}
                  disabled={selectedSkillCardIds.length !== 2}
                >
                  丈八当杀
                </button>
              </>
            ) : null}
            <button type="button" onClick={() => handleQihuResponse(false)}>
              不出杀
            </button>
          </div>
        </section>
      ) : null}

      {pending?.type === "guohe_select_response" && pending.sourceSeatId === playerSeat.id ? (
        <section className="response-panel" data-testid="guohe-select-response">
          <div>
            <p className="eyebrow">过河拆桥</p>
            <h2>选择拆除区域</h2>
            <p>{pending.message}</p>
          </div>
          <div className="response-actions card-choice-actions">
            {guoheOptions.map((option) =>
              option.card ? (
                <MiniCard
                  key={option.key}
                  card={option.card}
                  label="拆除"
                  reason={`拆除${option.zone}${option.label}`}
                  onClick={() => handleGuoheSelect(option.key)}
                />
              ) : (
                <button type="button" key={option.key} onClick={() => handleGuoheSelect(option.key)}>
                  拆除{option.label}
                </button>
              ),
            )}
          </div>
        </section>
      ) : null}

      {pending?.type === "shunshou_select_response" && pending.sourceSeatId === playerSeat.id ? (
        <section className="response-panel" data-testid="shunshou-select-response">
          <div>
            <p className="eyebrow">顺手牵羊</p>
            <h2>选择获得区域</h2>
            <p>{pending.message}</p>
          </div>
          <div className="response-actions card-choice-actions">
            {shunshouOptions.map((option) =>
              option.card ? (
                <MiniCard
                  key={option.key}
                  card={option.card}
                  label="获得"
                  reason={`获得${option.zone}${option.label}`}
                  onClick={() => handleShunshouSelect(option.key)}
                />
              ) : (
                <button type="button" key={option.key} onClick={() => handleShunshouSelect(option.key)}>
                  获得{option.label}
                </button>
              ),
            )}
          </div>
        </section>
      ) : null}

      {pending?.type === "mengjin_response" && pending.sourceSeatId === playerSeat.id ? (
        <section className="response-panel" data-testid="mengjin-response">
          <div>
            <p className="eyebrow">猛进</p>
            <h2>是否弃置目标一张牌</h2>
            <p>{pending.message}</p>
          </div>
          <div className="response-actions card-choice-actions">
            {mengjinOptions.map((option) =>
              option.card ? (
                <MiniCard
                  key={option.key}
                  card={option.card}
                  label="弃置"
                  reason={`弃置${option.zone}${option.label}`}
                  onClick={() => handleMengjinResponse(option.key)}
                />
              ) : (
                <button type="button" key={option.key} onClick={() => handleMengjinResponse(option.key)}>
                  弃置{option.label}
                </button>
              ),
            )}
            <button type="button" onClick={() => handleMengjinResponse(null)}>
              不发动
            </button>
          </div>
        </section>
      ) : null}

      {pending?.type === "wugufengdeng_select" && pending.responderSeatId === playerSeat.id ? (
        <section className="response-panel" data-testid="wugu-select-response">
          <div>
            <p className="eyebrow">五谷丰登</p>
            <h2>选择一张牌</h2>
            <p>{pending.message}</p>
          </div>
          <div className="response-actions card-choice-actions">
            {wuguCards.map((card) => (
              <MiniCard
                key={card.instance_id}
                card={card}
                label="获得"
                reason={`获得${card.name}`}
                onClick={() => handleWuguSelect(card.instance_id)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {pending?.type === "judge_replace_response" && pending.replacerSeatId === playerSeat.id ? (
        <section className="response-panel" data-testid="judge-replace-response">
          <div>
            <p className="eyebrow">鬼才 / 鬼道</p>
            <h2>是否改判</h2>
            <p>{pending.message}</p>
          </div>
          <div className="response-actions card-choice-actions">
            <MiniCard
              card={pending.judgeCard}
              disabled
              label="当前判定"
              reason={`当前判定牌：${pending.judgeCard.name}`}
            />
            {judgeReplaceCards.map((card) => (
              <MiniCard
                key={card.instance_id}
                card={card}
                label="改判"
                reason={`用${card.name}替换当前判定`}
                onClick={() => handleJudgeReplace(card.instance_id)}
              />
            ))}
            <button type="button" onClick={() => handleJudgeReplace(null)}>
              不改判
            </button>
          </div>
        </section>
      ) : null}

      {pending?.type === "tiandu_response" && pending.judgeOwnerSeatId === playerSeat.id ? (
        <section className="response-panel" data-testid="tiandu-response">
          <div>
            <p className="eyebrow">天妒</p>
            <h2>是否获得判定牌</h2>
            <p>{pending.message}</p>
          </div>
          <div className="response-actions card-choice-actions">
            <MiniCard
              card={pending.judgeCard}
              disabled
              label="判定牌"
              reason={`判定牌：${pending.judgeCard.name}`}
            />
            <button type="button" onClick={() => handleTianduResponse(true)}>
              发动天妒
            </button>
            <button type="button" onClick={() => handleTianduResponse(false)}>
              不发动
            </button>
          </div>
        </section>
      ) : null}

      {pending?.type === "skill_judge_replace_response" && pending.replacerSeatId === playerSeat.id ? (
        <section className="response-panel" data-testid="skill-judge-replace-response">
          <div>
            <p className="eyebrow">鬼才 / 鬼道</p>
            <h2>是否改判【{pending.skillName}】</h2>
            <p>{pending.message}</p>
          </div>
          <div className="response-actions card-choice-actions">
            <MiniCard
              card={pending.judgeCard}
              disabled
              label="当前判定"
              reason={`当前判定牌：${pending.judgeCard.name}`}
            />
            {skillJudgeReplaceCards.map((card) => (
              <MiniCard
                key={card.instance_id}
                card={card}
                label="改判"
                reason={`用${card.name}替换当前判定`}
                onClick={() => handleSkillJudgeReplace(card.instance_id)}
              />
            ))}
            <button type="button" onClick={() => handleSkillJudgeReplace(null)}>
              不改判
            </button>
          </div>
        </section>
      ) : null}

      {pending?.type === "skill_tiandu_response" && pending.judgeOwnerSeatId === playerSeat.id ? (
        <section className="response-panel" data-testid="skill-tiandu-response">
          <div>
            <p className="eyebrow">天妒</p>
            <h2>是否获得【{pending.skillName}】判定牌</h2>
            <p>{pending.message}</p>
          </div>
          <div className="response-actions card-choice-actions">
            <MiniCard
              card={pending.judgeCard}
              disabled
              label="判定牌"
              reason={`判定牌：${pending.judgeCard.name}`}
            />
            <button type="button" onClick={() => handleSkillTianduResponse(true)}>
              发动天妒
            </button>
            <button type="button" onClick={() => handleSkillTianduResponse(false)}>
              不发动
            </button>
          </div>
        </section>
      ) : null}

      {pending?.type === "wuxie_response" && wuxieResponderSeatId === playerSeat.id ? (
        <section className="response-panel" data-testid="wuxie-response">
          <div>
            <p className="eyebrow">无懈</p>
            <h2>是否使用无懈可击</h2>
            <p>{pending.message}</p>
            <p>
              当前：
              {pending.nullified
                ? "原锦囊已被抵消，再出无懈会反制并恢复效果。"
                : "原锦囊将继续生效，出无懈可抵消。"}
            </p>
          </div>
          <div className="response-actions">
            {wuxieCards.map((card) => (
              <MiniCard
                key={card.instance_id}
                card={card}
                label="无懈"
                reason={`使用${card.name}`}
                onClick={() => handleWuxieResponse(true, card.instance_id)}
              />
            ))}
            <button type="button" onClick={() => handleWuxieResponse(false)}>
              不使用
            </button>
          </div>
        </section>
      ) : null}

      {pending?.type === "dying_response" ? (
        <section className="response-panel danger" data-testid="dying-response">
          <div>
            <p className="eyebrow">Dying</p>
            <h2>濒死求桃</h2>
            <p>{pending.message}</p>
          </div>
          <div className="response-actions">
            {dyingCards.map((card) => (
              <button
                type="button"
                key={card.instance_id}
                onClick={() => handleDyingCard(card.instance_id)}
              >
                使用{card.name}
              </button>
            ))}
            <button type="button" onClick={handleDyingPass}>
              放弃救援
            </button>
          </div>
        </section>
      ) : null}

      {discardPending ? (
        <section className="response-panel discard-select" data-testid="discard-response">
          <div>
            <p className="eyebrow">Discard</p>
            <h2>弃牌阶段</h2>
            <p>
              {discardPending.message} 已选择 {selectedDiscardIds.length}/
              {discardPending.requiredCount} 张。
            </p>
          </div>
          <div className="response-actions">
            <button
              type="button"
              onClick={handleConfirmDiscard}
              disabled={selectedDiscardIds.length !== discardPending.requiredCount}
              data-testid="confirm-discard"
            >
              确认弃牌
            </button>
          </div>
        </section>
      ) : null}

      <section className="player-console">
        <div className="player-summary">
          <div className="player-general">
            <button
              type="button"
              className="player-portrait-button"
              onClick={() => setGeneralPreview(playerSeat.general)}
              aria-label={`查看${playerSeat.general.name}武将图`}
            >
              <img
                src={getDisplayAssetPath(playerSeat.general.image.path) ?? ""}
                alt={playerSeat.general.name}
              />
            </button>
            <div>
              <p className="eyebrow">玩家武将</p>
              <div className="player-title-row">
                <h2>{playerSeat.general.name}</h2>
                <span className={`player-role-badge ${roleToneClass(playerSeat.role)}`}>
                  {playerSeat.role}
                </span>
              </div>
              <p>
                {playerSeat.general.faction} · <HealthHearts hp={playerSeat.hp} maxHp={playerSeat.maxHp} />
                {playerSeat.chained ? " · 连环" : ""}
                {playerSeat.turnedOver ? " · 翻面" : ""}
              </p>
            </div>
          </div>
          <div className="player-skills" data-testid="player-skills">
            <p className="eyebrow">技能</p>
            <div className="player-skill-actions">
              {playerSkillButtons.length > 0 ? (
                playerSkillButtons.map((skill) => {
                  const live = isSkillImplemented(skill.name);
                  const selected = selectedSkillName === skill.name;
                  return (
                    <button
                      type="button"
                      key={`${playerSeat.general.id}-${skill.name}`}
                      className={`${live ? "is-live" : ""}${selected ? " is-selected" : ""}`.trim() || undefined}
                      onClick={() => handleSkillClick(skill.name)}
                      title={`${live ? "已接入" : "待接入"}：${skill.description}`}
                      data-tooltip={`${live ? "已接入" : "待接入"}：${skill.description}`}
                      data-testid={`skill-action-${skill.name}`}
                    >
                      <span>{skill.name}</span>
                      <small>{selected ? "选择中" : manualSkillNames.has(skill.name) ? "手动" : live ? "已接入" : "待接入"}</small>
                    </button>
                  );
                })
              ) : (
                <span className="skill-empty">无技能</span>
              )}
            </div>
          </div>
          <div className="game-facts">
            <Stat label="身份配置" value={roleText} note="经典 8 人局" />
            <Stat
              label="武将池"
              value={data.generals.length}
              note={Object.entries(generalPacks).map(([pack, count]) => `${pack}${count}`).join(" / ")}
            />
            <Stat
              label="牌堆来源"
              value={data.deckInstances.length}
              note={Object.entries(deckPacks).map(([pack, count]) => `${pack}${count}`).join(" / ")}
            />
          </div>
        </div>

        <div className="hand-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Hand</p>
              <h2>玩家手牌</h2>
            </div>
            <span>{playerSeat.hand.length} 张</span>
          </div>
          <div className="hand-strip" data-testid="player-hand">
            {playerSeat.hand.map((card) => {
              const info = getCardPlayInfo(game, playerSeat.id, card);
              const discardSelected = selectedDiscardIds.includes(card.instance_id);
              const skillCardSelected = selectedSkillCardIds.includes(card.instance_id);
              const skillCardSelectable =
                selectedSkillName &&
                isManualSkillCardSelectable(selectedSkillName, card, playerSeat, game);
              const weaponCardSelected =
                selectedWeaponAction === "zhangba" &&
                selectedSkillCardIds.includes(card.instance_id);
              const weaponCardLimitReached =
                selectedWeaponAction === "zhangba" &&
                !weaponCardSelected &&
                selectedSkillCardIds.length >= 2;
              const skillCardLimitReached =
                Boolean(selectedSkillName) &&
                !skillCardSelected &&
                selectedSkillCardIds.length >= manualSkillCardLimit(selectedSkillName);
              const triggerCardSelected = selectedSkillCardIds.includes(card.instance_id);
              const triggerCardSelectable = isPendingTriggerCardSelectable(card);
              const fangquanCardSelected =
                pending?.type === "fangquan_end_response" &&
                pending.seatId === playerSeat.id &&
                selectedSkillCardIds.includes(card.instance_id);
              const fangquanCardSelectable =
                pending?.type === "fangquan_end_response" &&
                pending.seatId === playerSeat.id &&
                pending.discardableCardIds.includes(card.instance_id);
              return (
                <MiniCard
                  key={card.instance_id}
                  card={card}
                  disabled={
                    !discardPending &&
                    (pendingTriggerSkill
                      ? !triggerCardSelectable
                      : pending?.type === "fangquan_end_response" &&
                          pending.seatId === playerSeat.id
                        ? !fangquanCardSelectable
                      : selectedWeaponAction === "zhangba"
                      ? weaponCardLimitReached
                      : selectedSkillName
                      ? !skillCardSelectable || skillCardLimitReached
                      : !info.canPlay)
                  }
                  selected={selectedCardId === card.instance_id || discardSelected || skillCardSelected || triggerCardSelected || weaponCardSelected || fangquanCardSelected}
                  label={
                    pendingTriggerSkill
                      ? triggerCardSelected
                        ? "已选"
                        : pendingTriggerSkill === "天香"
                          ? "红桃"
                          : "弃置"
                      : pending?.type === "fangquan_end_response" &&
                          pending.seatId === playerSeat.id
                        ? fangquanCardSelected
                          ? "已选"
                          : "弃置"
                      : selectedWeaponAction === "zhangba"
                      ? weaponCardSelected
                        ? "已选"
                        : "丈八"
                      : selectedSkillName
                      ? skillCardSelectable || skillCardSelected
                        ? manualSkillCardLabel(selectedSkillName, skillCardSelected)
                        : undefined
                      : discardPending
                      ? discardSelected
                        ? "已选"
                        : "弃置"
                      : info.canPlay
                        ? info.label
                        : undefined
                  }
                  reason={
                    pendingTriggerSkill
                      ? `点击选择或取消作为【${pendingTriggerSkill}】的弃牌。`
                      : pending?.type === "fangquan_end_response" &&
                          pending.seatId === playerSeat.id
                        ? "点击选择或取消作为【放权】结束阶段的弃牌。"
                      : selectedWeaponAction === "zhangba"
                      ? "点击选择或取消作为【丈八蛇矛】的两张手牌。"
                      : selectedSkillName
                      ? `点击选择或取消作为【${selectedSkillName}】的牌。`
                      : discardPending
                      ? "点击选择或取消弃置。"
                      : info.reason
                  }
                  onClick={() => handleCardClick(card)}
                />
              );
            })}
          </div>
          {playerSeat.equipment.length > 0 ? (
            <div className="equipment-action-strip" data-testid="player-equipment-actions">
              <span>装备区</span>
              {playerSeat.equipment.map((card) => {
                const info = getCardPlayInfo(game, playerSeat.id, card);
                const skillCardSelected = selectedSkillCardIds.includes(card.instance_id);
                const canSelectForManualEquipment =
                  Boolean(selectedSkillName) &&
                  (selectedSkillName === "制衡" ||
                    selectedSkillName === "武圣" ||
                    selectedSkillName === "奇袭" ||
                    selectedSkillName === "神速") &&
                  isManualSkillCardSelectable(selectedSkillName, card, playerSeat, game);
                const canSelectForLiuli =
                  pendingTriggerSkill === "流离" &&
                  isPendingTriggerCardSelectable(card);
                const selected =
                  selectedCardId === card.instance_id ||
                  skillCardSelected ||
                  (canSelectForLiuli && selectedSkillCardIds.includes(card.instance_id));
                const disabled =
                  discardPending ||
                  selectedWeaponAction === "zhangba" ||
                  (pendingTriggerSkill
                    ? !canSelectForLiuli
                    : selectedSkillName
                      ? !canSelectForManualEquipment
                      : !info.canPlay);
                return (
                  <MiniCard
                    key={`equipment-action-${card.instance_id}`}
                    card={card}
                    disabled={Boolean(disabled)}
                    selected={selected}
                    label={
                      pendingTriggerSkill === "流离"
                        ? selected
                          ? "已选"
                          : "弃置"
                        : selectedSkillName && canSelectForManualEquipment
                          ? manualSkillCardLabel(selectedSkillName, selected)
                          : info.canPlay
                            ? info.label
                            : equipmentSlotLabel(getEquipmentSlot(card))
                    }
                    reason={
                      pendingTriggerSkill === "流离"
                        ? "点击选择或取消作为【流离】的弃牌。"
                        : selectedSkillName && canSelectForManualEquipment
                          ? `点击选择或取消作为【${selectedSkillName}】的装备牌。`
                          : info.reason
                    }
                    onClick={() => handleCardClick(card)}
                  />
                );
              })}
            </div>
          ) : null}
          <div className="hand-help">
            {discardPending
              ? `手牌上限 ${getHandLimit(playerSeat, game)}，需要弃置 ${getDiscardOverflow(playerSeat, game)} 张。`
              : pending?.type === "fangquan_end_response" && pending.seatId === playerSeat.id
              ? "放权：先点一张要弃置的手牌，再点桌面上一名其他角色。"
              : pendingTriggerSkill
              ? `正在询问【${pendingTriggerSkill}】：选择需要弃置的${pendingTriggerSkill === "流离" ? "手牌或装备牌" : "手牌"}${pendingTriggerSkill === "悲歌" ? "。" : "，再选择目标。"}`
              : selectedWeaponAction === "zhangba"
              ? "丈八蛇矛：选择两张手牌，再选择一名目标。"
              : selectedSkillName
              ? selectedSkillHint
              : game.turn.activeSeatId === playerSeat.id && game.turn.phase === "出牌"
              ? "点击可用手牌；转换技能先点技能再选牌。出牌完成后点下方结束出牌。"
              : autoHumanPhases.has(game.turn.phase) && game.turn.activeSeatId === playerSeat.id
              ? "正在自动完成准备、判定和摸牌。"
              : "等待进入你的出牌阶段。"}
          </div>
          <div className="player-action-row">
            {pending?.type === "qiaobian_draw_targets" && pending.seatId === playerSeat.id ? (
              <div className="selected-card-actions selected-skill-actions" data-testid="qiaobian-draw-actions">
                <span>
                  {selectedTargetNames
                    ? `巧变摸牌：获得 ${selectedTargetNames} 各一张手牌`
                    : "巧变摸牌：可选择至多两名有手牌的其他角色，或不获得"}
                </span>
                <button type="button" onClick={handleConfirmQiaobianDrawTargets}>
                  {selectedTargetIds.length > 0 ? "获得所选" : "不获得"}
                </button>
              </div>
            ) : null}
            {pending?.type === "qiaobian_play_move" && pending.seatId === playerSeat.id ? (
              <div className="selected-card-actions selected-skill-actions" data-testid="qiaobian-move-actions">
                <span>
                  {!qiaobianMoveSource
                    ? "巧变出牌：选择一名有装备牌或判定牌的角色"
                    : !selectedQiaobianMoveCard
                    ? `巧变出牌：选择要移动的 ${qiaobianMoveSource.general.name} 场上牌`
                    : qiaobianMoveDestination
                    ? `巧变出牌：移动${selectedQiaobianMoveCard.name}给 ${qiaobianMoveDestination.general.name}`
                    : `巧变出牌：选择${selectedQiaobianMoveCard.name}的移动目标`}
                </span>
                {qiaobianMoveSource && qiaobianMoveCards.length > 0 ? (
                  <div className="qiaobian-card-picker">
                    {qiaobianMoveCards.map((card) => (
                      <button
                        type="button"
                        key={card.instance_id}
                        className={card.instance_id === selectedQiaobianMoveCardId ? "is-picked" : undefined}
                        onClick={() => {
                          setSelectedQiaobianMoveCardId(card.instance_id);
                          setSelectedTargetIds((current) => current.slice(0, 1));
                        }}
                      >
                        {getEquipmentSlot(card) ? "装备" : "判定"}：{card.name}
                      </button>
                    ))}
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={() => handleConfirmQiaobianMove(false)}
                  disabled={!qiaobianMoveSource || !selectedQiaobianMoveCard || !qiaobianMoveDestination}
                  data-testid="confirm-qiaobian-move"
                >
                  移动
                </button>
                <button type="button" onClick={() => handleConfirmQiaobianMove(true)}>
                  不移动
                </button>
              </div>
            ) : null}
            {!pending &&
            !selectedWeaponAction &&
            game.turn.activeSeatId === playerSeat.id &&
            game.turn.phase === "出牌" &&
            zhangbaInfo?.canPlay ? (
              <button
                type="button"
                className="weapon-action-button"
                onClick={() => {
                  setSelectedCardId(null);
                  setSelectedSkillName(null);
                  setSelectedSkillCardIds([]);
                  setSelectedTargetIds([]);
                  setSelectedWeaponAction("zhangba");
                }}
                data-testid="start-zhangba"
              >
                丈八当杀
              </button>
            ) : null}
            {selectedWeaponAction === "zhangba" ? (
              <div className="selected-card-actions selected-skill-actions" data-testid="selected-weapon-actions">
                <span>
                  {selectedTargetNames
                    ? `丈八蛇矛：已选 ${selectedSkillCardIds.length}/2 张手牌，目标 ${selectedTargetNames}`
                    : `丈八蛇矛：已选 ${selectedSkillCardIds.length}/2 张手牌，再选择1名目标`}
                </span>
                <button
                  type="button"
                  onClick={handleConfirmZhangba}
                  disabled={!canUseSelectedWeaponAction}
                  data-testid="confirm-zhangba"
                >
                  确认丈八出杀
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedWeaponAction(null);
                    setSelectedSkillCardIds([]);
                    setSelectedTargetIds([]);
                  }}
                >
                  取消
                </button>
              </div>
            ) : null}
            {selectedSkillName ? (
              <div className="selected-card-actions selected-skill-actions" data-testid="selected-skill-actions">
                <span>{selectedSkillHint}</span>
                <button
                  type="button"
                  onClick={handleConfirmSkill}
                  disabled={!selectedSkillReady}
                  data-testid="confirm-skill"
                >
                  确认{selectedSkillName}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSkillName(null);
                    setSelectedSkillCardIds([]);
                    setSelectedTargetIds([]);
                    setSelectedQiaobianMoveCardId(null);
                  }}
                >
                  取消
                </button>
              </div>
            ) : null}
            {selectedCard && selectedInfo?.mode === "target" ? (
              <div className="selected-card-actions" data-testid="selected-card-actions">
                <span>
                  {selectedCard.card_id === "jiedaosharen" && selectedTargetIds.length === 1
                    ? `借刀杀人：已选持刀者 ${selectedTargetNames}，再选第二目标`
                    : (selectedInfo.maxTargets ?? 1) > 1
                    ? selectedTargetNames
                      ? `方天画戟：${selectedTargetNames}`
                      : `方天画戟：选择 1 至 ${selectedInfo.maxTargets} 名目标`
                    : selectedInfo?.canRecast
                    ? selectedTargetNames
                      ? `铁索连环：${selectedTargetNames}`
                      : "铁索连环：选择 1 至 2 名目标，或重铸"
                    : `${selectedCard.name}${selectedTargetNames ? `：${selectedTargetNames}` : ""}`}
                </span>
                {selectedInfo?.canRecast ? (
                  <>
                    <button
                      type="button"
                      onClick={handleConfirmTiesuo}
                      disabled={selectedTargetIds.length === 0}
                      data-testid="confirm-tiesuo"
                    >
                      确认连环
                    </button>
                    <button
                      type="button"
                      onClick={handleRecastTiesuo}
                      data-testid="recast-tiesuo"
                    >
                      重铸摸牌
                    </button>
                  </>
                ) : null}
                {(selectedInfo.maxTargets ?? 1) > 1 ? (
                  <button
                    type="button"
                    onClick={handleConfirmMultiSha}
                    disabled={selectedTargetIds.length < (selectedInfo.minTargets ?? 1)}
                    data-testid="confirm-multi-sha"
                  >
                    确认出杀
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCardId(null);
                    setSelectedTargetIds([]);
                  }}
                >
                  取消
                </button>
              </div>
            ) : null}
            <button
              type="button"
              onClick={finishPlayerPlay}
              disabled={
                game.turn.activeSeatId !== playerSeat.id ||
                game.turn.phase !== "出牌" ||
                Boolean(game.pendingAction) ||
                Boolean(game.winner)
              }
              data-testid="advance-phase"
            >
              结束出牌
            </button>
          </div>
        </div>

        <div className="log-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Log</p>
              <h2>回合记录</h2>
            </div>
          </div>
          <ol>
            {game.log.map((item, index) => (
              <li key={`${item}-${index}`}>{item}</li>
            ))}
          </ol>
        </div>
      </section>

      {generalPreview ? (
        <div
          className="general-preview-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={`${generalPreview.name}武将图`}
          onClick={() => setGeneralPreview(null)}
        >
          <article className="general-preview-card" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="general-preview-close"
              onClick={() => setGeneralPreview(null)}
              aria-label="关闭武将图"
            >
              X
            </button>
            <img
              src={getDisplayAssetPath(generalPreview.image.path) ?? ""}
              alt={generalPreview.name}
            />
            <div>
              <p className="eyebrow">武将详情</p>
              <h2>{generalPreview.name}</h2>
              <p>
                {generalPreview.faction} · <HealthHearts hp={generalPreview.maxHp} maxHp={generalPreview.maxHp} />
              </p>
              <div className="preview-skill-list">
                {generalPreview.skills.length > 0 ? (
                  generalPreview.skills.map((skill) => (
                    <div key={`${generalPreview.id}-${skill.name}`}>
                      <strong>{skill.name}</strong>
                      <span>{skill.description}</span>
                    </div>
                  ))
                ) : (
                  <div>
                    <strong>无技能</strong>
                    <span>该武将没有记录到可用技能描述。</span>
                  </div>
                )}
              </div>
            </div>
          </article>
        </div>
      ) : null}
    </main>
  );
}

export default App;
