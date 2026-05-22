import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "public");
const publicDataDir = path.join(publicDir, "data");
const publicCardAssetDir = path.join(publicDir, "assets", "cards");
const publicGeneralAssetDir = path.join(publicDir, "assets", "generals");

const generalImageAliases = {
  "刘禅": "刘婵",
  "许褚": "许诸",
};

const readJson = (relativePath) =>
  JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));

const ensureDir = (dir) => fs.mkdirSync(dir, { recursive: true });

const writeJson = (fileName, payload) => {
  ensureDir(publicDataDir);
  fs.writeFileSync(
    path.join(publicDataDir, fileName),
    `${JSON.stringify(payload, null, 2)}\n`,
    "utf8",
  );
};

const copyFile = (source, targetDir, options = {}) => {
  ensureDir(targetDir);
  const target = path.join(targetDir, path.basename(source));
  if (options.preserveExisting && fs.existsSync(target)) {
    return target;
  }
  fs.copyFileSync(source, target);
  return target;
};

const listPngsByBaseName = (relativeDir) => {
  const dir = path.join(root, relativeDir);
  return new Map(
    fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".png"))
      .map((entry) => [path.basename(entry.name, ".png"), path.join(dir, entry.name)]),
  );
};

const toSkillList = (row) => {
  const skills = [];
  for (let i = 1; i <= 4; i += 1) {
    const name = row[`技能${i}`]?.trim();
    const description = row[`技能${i}说明`]?.trim();
    if (name) {
      skills.push({ name, description: description ?? "" });
    }
  }
  return skills;
};

const toGeneral = (row, index, imageBaseName) => {
  const fileName = `${imageBaseName}.png`;
  return {
    id: `general_${String(index + 1).padStart(3, "0")}`,
    name: row["武将"],
    pack: row["包"],
    faction: row["势力"],
    maxHp: Number(row["体力"]),
    image: {
      sourceName: imageBaseName,
      fileName,
      path: `/assets/generals/${fileName}`,
      aliasOf: imageBaseName === row["武将"] ? null : row["武将"],
    },
    skills: toSkillList(row),
  };
};

const generalsRaw = readJson("Final.json");
const cardDefsRaw = readJson("rules/card_defs.json");
const deckInstancesRaw = readJson("rules/deck_instances.json");
const generalImages = listPngsByBaseName("Comic");
const cardImages = listPngsByBaseName("cards");

const selectedGenerals = [];
const excludedGenerals = [];

generalsRaw.forEach((row) => {
  const imageBaseName = generalImageAliases[row["武将"]] ?? row["武将"];
  const imagePath = generalImages.get(imageBaseName);

  if (!imagePath) {
    excludedGenerals.push({
      name: row["武将"],
      pack: row["包"],
      faction: row["势力"],
      maxHp: Number(row["体力"]),
      reason: "missing_general_image",
      expectedImage: `${imageBaseName}.png`,
    });
    return;
  }

  copyFile(imagePath, publicGeneralAssetDir, { preserveExisting: true });
  selectedGenerals.push(toGeneral(row, selectedGenerals.length, imageBaseName));
});

const cardDefs = cardDefsRaw.map((card) => {
  const imagePath = cardImages.get(card.name);
  if (imagePath) {
    copyFile(imagePath, publicCardAssetDir);
  }

  return {
    ...card,
    image: {
      sourceName: card.name,
      fileName: `${card.name}.png`,
      path: imagePath ? `/assets/cards/${card.name}.png` : null,
    },
  };
});

const knownCardIds = new Set(cardDefs.map((card) => card.card_id));
const deckInstances = deckInstancesRaw.map((card) => ({
  ...card,
  imagePath: card.image_key
    ? cardDefs.find((def) => def.card_id === card.card_id)?.image.path ?? null
    : null,
}));

const issues = [
  ...cardDefs
    .filter((card) => !card.image.path)
    .map((card) => ({
      type: "missing_card_image",
      cardId: card.card_id,
      name: card.name,
      expectedImage: `${card.name}.png`,
    })),
  ...deckInstances
    .filter((card) => !knownCardIds.has(card.card_id))
    .map((card) => ({
      type: "deck_references_unknown_card",
      instanceId: card.instance_id,
      cardId: card.card_id,
    })),
];

const identitySetup = {
  mode: "8人经典身份局",
  seats: 8,
  roles: [
    { role: "主公", count: 1 },
    { role: "忠臣", count: 2 },
    { role: "反贼", count: 4 },
    { role: "内奸", count: 1 },
  ],
  playerControl: "玩家控制1人，其余7人为AI",
};

const manifest = {
  generatedAt: new Date().toISOString(),
  source: {
    generals: "Final.json",
    cardDefs: "rules/card_defs.json",
    deckInstances: "rules/deck_instances.json",
    generalImages: "Comic/*.png",
    cardImages: "cards/*.png",
  },
  counts: {
    sourceGenerals: generalsRaw.length,
    selectedGenerals: selectedGenerals.length,
    excludedGenerals: excludedGenerals.length,
    sourceGeneralImages: generalImages.size,
    cardDefs: cardDefs.length,
    deckInstances: deckInstances.length,
    cardImages: cardImages.size,
    issues: issues.length,
  },
  aliases: generalImageAliases,
  identitySetup,
};

writeJson("selected-generals.json", selectedGenerals);
writeJson("excluded-generals.json", excludedGenerals);
writeJson("card-defs.json", cardDefs);
writeJson("deck-instances.json", deckInstances);
writeJson("data-issues.json", issues);
writeJson("data-manifest.json", manifest);

console.log(
  [
    `Selected generals: ${selectedGenerals.length}`,
    `Excluded generals: ${excludedGenerals.length}`,
    `Card definitions: ${cardDefs.length}`,
    `Deck instances: ${deckInstances.length}`,
    `Data issues: ${issues.length}`,
  ].join("\n"),
);
