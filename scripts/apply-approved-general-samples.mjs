import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const sourcePath = path.join(root, "docs", "art-references", "approved-general-style-v2.1.png");
const targetDir = path.join(root, "public", "assets", "generals");
const previewDir = path.join(root, "output", "general-art-v2.1-approved-samples");

const sampleNames = ["曹操", "刘备", "赵云", "貂蝉", "张飞"];
const outputWidth = 1080;
const outputHeight = 1440;

const detectCardBoxes = async () => {
  const { data, info } = await sharp(sourcePath).raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const columnCounts = [];
  for (let x = 0; x < width; x += 1) {
    let count = 0;
    for (let y = 0; y < height; y += 1) {
      const index = (y * width + x) * channels;
      const brightness = data[index] + data[index + 1] + data[index + 2];
      if (brightness > 90) count += 1;
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
      if (end - start > 50) {
        segments.push([start, end]);
      }
      inSegment = false;
    }
  }

  return segments.map(([x1, x2]) => {
    let y1 = height;
    let y2 = 0;
    for (let y = 0; y < height; y += 1) {
      let rowCount = 0;
      for (let x = x1; x <= x2; x += 1) {
        const index = (y * width + x) * channels;
        const brightness = data[index] + data[index + 1] + data[index + 2];
        if (brightness > 90) rowCount += 1;
      }
      if (rowCount > 20) {
        y1 = Math.min(y1, y);
        y2 = Math.max(y2, y);
      }
    }
    return { left: x1, top: y1, width: x2 - x1 + 1, height: y2 - y1 + 1 };
  });
};

const cropToGameAsset = async (box, name) => {
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
  await fs.mkdir(targetDir, { recursive: true });
  await fs.mkdir(previewDir, { recursive: true });
  const boxes = await detectCardBoxes();
  if (boxes.length !== sampleNames.length) {
    throw new Error(`Expected ${sampleNames.length} cards in reference sheet, found ${boxes.length}.`);
  }

  for (const [index, name] of sampleNames.entries()) {
    await cropToGameAsset(boxes[index], name);
  }

  console.log(
    JSON.stringify(
      {
        source: path.relative(root, sourcePath),
        targetDir: path.relative(root, targetDir),
        previewDir: path.relative(root, previewDir),
        applied: sampleNames,
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
