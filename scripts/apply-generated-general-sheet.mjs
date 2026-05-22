import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const targetDir = path.join(root, "public", "assets", "generals");
const previewRoot = path.join(root, "output", "general-art-v2.1-generated-batches");
const outputWidth = 1080;
const outputHeight = 1440;

const parseArgs = () => {
  const args = new Map();
  for (let index = 2; index < process.argv.length; index += 1) {
    const value = process.argv[index];
    if (!value.startsWith("--")) continue;
    const key = value.slice(2);
    const next = process.argv[index + 1];
    if (next && !next.startsWith("--")) {
      args.set(key, next);
      index += 1;
    } else {
      args.set(key, "true");
    }
  }
  return args;
};

const getBrightness = (data, channels, width, x, y) => {
  const index = (y * width + x) * channels;
  return data[index] + data[index + 1] + data[index + 2];
};

const detectCardBoxes = async (sourcePath) => {
  const { data, info } = await sharp(sourcePath).raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const columnCounts = [];
  for (let x = 0; x < width; x += 1) {
    let count = 0;
    for (let y = 0; y < height; y += 1) {
      if (getBrightness(data, channels, width, x, y) > 90) count += 1;
    }
    columnCounts[x] = count;
  }

  const segments = [];
  let inSegment = false;
  let start = 0;
  for (let x = 0; x < width; x += 1) {
    const active = columnCounts[x] > 20;
    if (active && !inSegment) {
      start = x;
      inSegment = true;
    }
    if ((!active || x === width - 1) && inSegment) {
      const end = active && x === width - 1 ? x : x - 1;
      if (end - start > 50) segments.push([start, end]);
      inSegment = false;
    }
  }

  return segments.map(([x1, x2]) => {
    let y1 = height;
    let y2 = 0;
    for (let y = 0; y < height; y += 1) {
      let rowCount = 0;
      for (let x = x1; x <= x2; x += 1) {
        if (getBrightness(data, channels, width, x, y) > 90) rowCount += 1;
      }
      if (rowCount > 20) {
        y1 = Math.min(y1, y);
        y2 = Math.max(y2, y);
      }
    }
    return { left: x1, top: y1, width: x2 - x1 + 1, height: y2 - y1 + 1 };
  });
};

const cropToGameAsset = async ({ sourcePath, box, name, previewDir }) => {
  const extracted = await sharp(sourcePath)
    .extract(box)
    .resize({ height: outputHeight, fit: "inside", withoutEnlargement: false })
    .png()
    .toBuffer();
  const metadata = await sharp(extracted).metadata();
  const left = Math.round((outputWidth - metadata.width) / 2);
  const top = Math.round((outputHeight - metadata.height) / 2);

  const output = await sharp({
    create: {
      width: outputWidth,
      height: outputHeight,
      channels: 4,
      background: "#11100c",
    },
  })
    .composite([{ input: extracted, left, top }])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();

  await fs.writeFile(path.join(targetDir, `${name}.png`), output);
  await fs.writeFile(path.join(previewDir, `${name}.png`), output);
};

const main = async () => {
  const args = parseArgs();
  const sourceArg = args.get("source");
  const namesArg = args.get("names");
  const namesJsonArg = args.get("names-json");
  const namesFileArg = args.get("names-file");
  const batchArg = args.get("batch") ?? "batch";
  if (!sourceArg || (!namesArg && !namesJsonArg && !namesFileArg)) {
    throw new Error(
      "Usage: node scripts/apply-generated-general-sheet.mjs --source <image> --names <name1,name2> | --names-json <json-array> | --names-file <json-file> [--batch batch-01]",
    );
  }

  const sourcePath = path.resolve(root, sourceArg);
  const names = namesFileArg
    ? JSON.parse(await fs.readFile(path.resolve(root, namesFileArg), "utf8"))
    : namesJsonArg
      ? JSON.parse(namesJsonArg)
      : namesArg
          .split(",")
          .map((name) => name.trim())
          .filter(Boolean);
  const previewDir = path.join(previewRoot, batchArg);
  await fs.mkdir(targetDir, { recursive: true });
  await fs.mkdir(previewDir, { recursive: true });

  const boxes = await detectCardBoxes(sourcePath);
  if (boxes.length !== names.length) {
    throw new Error(`Expected ${names.length} cards in ${sourcePath}, found ${boxes.length}.`);
  }

  for (const [index, name] of names.entries()) {
    await cropToGameAsset({ sourcePath, box: boxes[index], name, previewDir });
  }

  console.log(
    JSON.stringify(
      {
        source: path.relative(root, sourcePath),
        targetDir: path.relative(root, targetDir),
        previewDir: path.relative(root, previewDir),
        applied: names,
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
