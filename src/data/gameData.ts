import type {
  CardDefinition,
  DataIssue,
  DataManifest,
  DeckInstance,
  ExcludedGeneral,
  GameData,
  General,
} from "./types";

const fetchJson = async <T,>(path: string): Promise<T> => {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`无法读取数据文件：${path}`);
  }

  return response.json() as Promise<T>;
};

export const loadGameData = async (): Promise<GameData> => {
  const [manifest, generals, excludedGenerals, cardDefs, deckInstances, issues] =
    await Promise.all([
      fetchJson<DataManifest>("/data/data-manifest.json"),
      fetchJson<General[]>("/data/selected-generals.json"),
      fetchJson<ExcludedGeneral[]>("/data/excluded-generals.json"),
      fetchJson<CardDefinition[]>("/data/card-defs.json"),
      fetchJson<DeckInstance[]>("/data/deck-instances.json"),
      fetchJson<DataIssue[]>("/data/data-issues.json"),
    ]);

  return {
    manifest,
    generals,
    excludedGenerals,
    cardDefs,
    deckInstances,
    issues,
  };
};

export const getDisplayAssetPath = (path: string | null): string | null => {
  if (!path) {
    return null;
  }

  return encodeURI(path);
};

export const summarizeDeckPacks = (deck: DeckInstance[]) =>
  deck.reduce<Record<string, number>>((summary, card) => {
    summary[card.pack] = (summary[card.pack] ?? 0) + 1;
    return summary;
  }, {});

export const summarizeGeneralPacks = (generals: General[]) =>
  generals.reduce<Record<string, number>>((summary, general) => {
    summary[general.pack] = (summary[general.pack] ?? 0) + 1;
    return summary;
  }, {});
