import type { GameData } from "../data/types";
import type { GameState, Role, Seat } from "./types";

const INITIAL_HAND_SIZE = 4;

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

export type CreateGameOptions = {
  playerRole?: Role;
  playerGeneralId?: string;
  paused?: boolean;
};

const createRng = (seed: number) => {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 2 ** 32;
  };
};

const shuffle = <T,>(items: T[], seed: number): T[] => {
  const rng = createRng(seed);
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

const drawCards = <T,>(deck: T[], count: number): T[] => deck.splice(0, count);

const makeSeed = () => {
  const dateKey = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return Number(dateKey) + Math.floor(Math.random() * 10000);
};

export const createInitialGame = (
  data: GameData,
  seed = makeSeed(),
  options: CreateGameOptions = {},
): GameState => {
  const playerRole = options.playerRole;
  const roles = playerRole
    ? [
        playerRole,
        ...shuffle(
          identityDeck.filter((_, index) => index !== identityDeck.indexOf(playerRole)),
          seed + 11,
        ),
      ]
    : shuffle(identityDeck, seed);
  const playerGeneral =
    data.generals.find((general) => general.id === options.playerGeneralId) ?? null;
  const aiGeneralPool = shuffle(
    data.generals.filter((general) => general.id !== playerGeneral?.id),
    seed + 17,
  );
  const generals = [
    playerGeneral ?? aiGeneralPool.shift() ?? data.generals[0],
    ...aiGeneralPool,
  ].slice(0, 8);
  const draw = shuffle(data.deckInstances, seed + 37);

  const seats: Seat[] = roles.map((role, id) => {
    const general = generals[id];
    const hand = drawCards(draw, INITIAL_HAND_SIZE);
    return {
      id,
      controller: id === 0 ? "human" : "ai",
      role,
      roleVisible: id === 0 || role === "主公",
      general,
      hp: general.maxHp,
      maxHp: general.maxHp,
      alive: true,
      chained: false,
      awakenedSkills: [],
      buquMarks: [],
      hand,
      equipment: [],
      judgeArea: [],
    };
  });

  const lordSeat = seats.find((seat) => seat.role === "主公") ?? seats[0];

  return {
    seed,
    seats,
    piles: {
      draw,
      discard: [],
    },
    turn: {
      round: 1,
      activeSeatId: lordSeat.id,
      phase: "准备",
      phaseStep: 0,
      shaPlayed: false,
      jiuUsed: false,
      drunkShaBonus: 0,
      luoyiActive: false,
      skipDraw: false,
      skipPlay: false,
      usedSkills: [],
      tianyiState: null,
      shuangxiongColor: null,
      fangquanTargetSeatId: null,
      fangquanCostCardId: null,
      extraTurnReturnSeatId: null,
      extraTurnReturnRound: null,
    },
    pendingAction: null,
    winner: null,
    lastEffect: null,
    log: [
      `种子 ${seed}，生成 8 人身份局。`,
      `玩家选择 ${seats[0].general.name}，身份为${seats[0].role}。`,
      `主公为 ${lordSeat.general.name}（${lordSeat.id + 1}号位）。`,
      "每名角色已发起手 4 张牌。",
    ],
    paused: options.paused ?? true,
  };
};

export const roleCounts = identityDeck.reduce<Record<Role, number>>(
  (summary, role) => {
    summary[role] += 1;
    return summary;
  },
  {
    主公: 0,
    忠臣: 0,
    反贼: 0,
    内奸: 0,
  },
);
