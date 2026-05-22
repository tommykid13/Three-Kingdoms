import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
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

const args = parseArgs();
const sourceDir = path.resolve(root, args.get("source") ?? "public/assets/generals");
const targetDir = path.resolve(root, args.get("target") ?? "public/assets/generals");
const previewDir = path.resolve(root, args.get("preview") ?? "output/general-art-v2.1-normalized-preview");
const targetMargin = Number(args.get("margin") ?? 34);
const darkThreshold = Number(args.get("threshold") ?? 28);
const shouldApply = args.has("apply");

const listPngs = async (dir) =>
  (await fs.readdir(dir, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".png"))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));

const detectVisibleXRange = async (filePath) => {
  const { data, info } = await sharp(filePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  let left = width;
  let right = -1;

  for (let x = 0; x < width; x += 1) {
    let visiblePixels = 0;
    for (let y = 0; y < height; y += 1) {
      const index = (y * width + x) * channels;
      const alpha = data[index + 3];
      const maxChannel = Math.max(data[index], data[index + 1], data[index + 2]);
      if (alpha > 10 && maxChannel > darkThreshold) visiblePixels += 1;
    }
    if (visiblePixels > 20) {
      left = Math.min(left, x);
      right = Math.max(right, x);
    }
  }

  if (right < left) {
    return { left: 0, right: width - 1, width };
  }

  left = Math.max(0, left - 2);
  right = Math.min(width - 1, right + 2);
  return { left, right, width: right - left + 1 };
};

const normalizeCard = async (inputPath, outputPath) => {
  const range = await detectVisibleXRange(inputPath);
  const contentWidth = outputWidth - targetMargin * 2;
  const stretched = await sharp(inputPath)
    .extract({ left: range.left, top: 0, width: range.width, height: outputHeight })
    .resize(contentWidth, outputHeight, { fit: "fill" })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: outputWidth,
      height: outputHeight,
      channels: 4,
      background: "#11100c",
    },
  })
    .composite([{ input: stretched, left: targetMargin, top: 0 }])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(outputPath);

  return {
    leftMargin: range.left,
    rightMargin: outputWidth - 1 - range.right,
    sourceWidth: range.width,
    targetWidth: contentWidth,
  };
};

const makeProofSheet = async (files, stats) => {
  const cardWidth = 154;
  const cardHeight = Math.round((outputHeight / outputWidth) * cardWidth);
  const gap = 16;
  const labelHeight = 32;
  const margin = 22;
  const columns = 7;
  const rows = Math.ceil(files.length / columns);
  const width = margin * 2 + columns * cardWidth + (columns - 1) * gap;
  const height = margin * 2 + 46 + rows * (cardHeight + labelHeight + gap);

  const composites = [
    {
      input: Buffer.from(`
        <svg width="${width}" height="46" xmlns="http://www.w3.org/2000/svg">
          <style>
            text { font-family: "Microsoft YaHei", "Noto Sans CJK SC", Arial, sans-serif; fill: #1c2325; }
            .title { font-size: 22px; font-weight: 800; }
            .sub { font-size: 14px; font-weight: 700; fill: #657174; }
          </style>
          <text class="title" x="${margin}" y="25">武将图边距规范化预览</text>
          <text class="sub" x="${margin + 230}" y="25">统一左右黑边为 ${targetMargin}px，不贴名牌，不改文字内容</text>
        </svg>
      `),
      left: 0,
      top: margin,
    },
  ];

  for (const [index, fileName] of files.entries()) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = margin + column * (cardWidth + gap);
    const y = margin + 46 + row * (cardHeight + labelHeight + gap);
    const imageBuffer = await sharp(path.join(previewDir, "images", fileName))
      .resize(cardWidth, cardHeight, { fit: "fill" })
      .png()
      .toBuffer();
    const stat = stats.get(fileName);
    const label = fileName.replace(/\.png$/i, "");
    const labelSvg = Buffer.from(`
      <svg width="${cardWidth}" height="${labelHeight}" xmlns="http://www.w3.org/2000/svg">
        <style>
          text { font-family: "Microsoft YaHei", "Noto Sans CJK SC", Arial, sans-serif; fill: #253032; }
          .name { font-size: 15px; font-weight: 800; }
          .meta { font-size: 10px; font-weight: 700; fill: #677276; }
        </style>
        <text class="name" x="0" y="15">${label}</text>
        <text class="meta" x="0" y="29">L/R ${stat.leftMargin}/${stat.rightMargin}</text>
      </svg>
    `);
    composites.push({ input: imageBuffer, left: x, top: y });
    composites.push({ input: labelSvg, left: x, top: y + cardHeight + 3 });
  }

  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: "#f2f5f2",
    },
  })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toFile(path.join(previewDir, "all-generals-normalized-proof.png"));
};

const main = async () => {
  const files = await listPngs(sourceDir);
  const previewImageDir = path.join(previewDir, "images");
  await fs.mkdir(previewImageDir, { recursive: true });
  if (shouldApply) await fs.mkdir(targetDir, { recursive: true });

  const stats = new Map();
  for (const fileName of files) {
    const inputPath = path.join(sourceDir, fileName);
    const previewPath = path.join(previewImageDir, fileName);
    const stat = await normalizeCard(inputPath, previewPath);
    stats.set(fileName, stat);
    if (shouldApply) {
      await fs.copyFile(previewPath, path.join(targetDir, fileName));
    }
  }

  await makeProofSheet(files, stats);
  console.log(
    JSON.stringify(
      {
        sourceDir: path.relative(root, sourceDir),
        targetDir: shouldApply ? path.relative(root, targetDir) : null,
        previewDir: path.relative(root, previewDir),
        margin: targetMargin,
        processed: files.length,
        applied: shouldApply,
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
