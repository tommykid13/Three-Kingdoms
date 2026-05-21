export type Faction = "魏" | "蜀" | "吴" | "群" | "神";

export type Skill = {
  name: string;
  description: string;
};

export type General = {
  id: string;
  name: string;
  pack: string;
  faction: Faction;
  maxHp: number;
  image: {
    sourceName: string;
    fileName: string;
    path: string;
    aliasOf: string | null;
  };
  skills: Skill[];
};

export type ExcludedGeneral = {
  name: string;
  pack: string;
  faction: Faction;
  maxHp: number;
  reason: "missing_general_image";
  expectedImage: string;
};

export type CardDefinition = {
  card_id: string;
  name: string;
  category: string;
  subtype: string;
  pack: string;
  template_group: string;
  rules_text: string;
  range: number | null;
  damage_type: string | null;
  image: {
    sourceName: string;
    fileName: string;
    path: string | null;
  };
};

export type DeckInstance = {
  instance_id: string;
  pack: string;
  card_id: string;
  name: string;
  image_key: string;
  suit: string;
  suit_symbol: string;
  rank: string;
  color: "red" | "black" | "none";
  is_ex_card: boolean;
  imagePath: string | null;
};

export type IdentitySetup = {
  mode: string;
  seats: number;
  roles: Array<{
    role: "主公" | "忠臣" | "反贼" | "内奸";
    count: number;
  }>;
  playerControl: string;
};

export type DataIssue =
  | {
      type: "missing_card_image";
      cardId: string;
      name: string;
      expectedImage: string;
    }
  | {
      type: "deck_references_unknown_card";
      instanceId: string;
      cardId: string;
    };

export type DataManifest = {
  generatedAt: string;
  source: Record<string, string>;
  counts: {
    sourceGenerals: number;
    selectedGenerals: number;
    excludedGenerals: number;
    sourceGeneralImages: number;
    cardDefs: number;
    deckInstances: number;
    cardImages: number;
    issues: number;
  };
  aliases: Record<string, string>;
  identitySetup: IdentitySetup;
};

export type GameData = {
  manifest: DataManifest;
  generals: General[];
  excludedGenerals: ExcludedGeneral[];
  cardDefs: CardDefinition[];
  deckInstances: DeckInstance[];
  issues: DataIssue[];
};
