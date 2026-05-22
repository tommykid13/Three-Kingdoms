import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();

const args = new Set(process.argv.slice(2));
const getArg = (name, fallback) => {
  const prefix = `${name}=`;
  const found = process.argv.slice(2).find((item) => item.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
};

const sourceDir = path.resolve(root, getArg("--source", "Comic"));
const targetDir = path.resolve(root, getArg("--target", "public/assets/generals"));
const previewDir = path.resolve(root, getArg("--preview", "output/general-art-v2.1"));
const shouldApply = args.has("--apply");

const profileName = getArg("--profile", "clean");
const profiles = {
  soft: {
    shadowLift: 0.07,
    contrast: 0.99,
    brightness: 1.018,
    saturation: 0.985,
    blackLift: 1.5,
    warmth: 1.006,
    sharpen: 0.35,
  },
  clean: {
    shadowLift: 0.105,
    contrast: 0.975,
    brightness: 1.026,
    saturation: 0.972,
    blackLift: 2.5,
    warmth: 1.008,
    sharpen: 0.45,
  },
  bright: {
    shadowLift: 0.135,
    contrast: 0.955,
    brightness: 1.038,
    saturation: 0.955,
    blackLift: 4.5,
    warmth: 1.012,
    sharpen: 0.5,
  },
};

const profile = profiles[profileName];
if (!profile) {
  throw new Error(`Unknown profile "${profileName}". Use one of: ${Object.keys(profiles).join(", ")}`);
}

const clamp01 = (value) => Math.max(0, Math.min(1, value));

const softenHighlights = (value) => {
  if (value <= 0.82) return value;
  return 0.82 + (value - 0.82) * 0.84;
};

const tunePixel = (r8, g8, b8) => {
  let r = r8 / 255;
  let g = g8 / 255;
  let b = b8 / 255;

  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const inkPreserveMask = clamp01((luma - 0.035) / 0.18);
  const shadowMask = Math.pow(1 - luma, 1.55) * inkPreserveMask;
  const lift = profile.shadowLift * shadowMask;
  r += (1 - r) * lift;
  g += (1 - g) * lift;
  b += (1 - b) * lift;

  r = 0.5 + (r - 0.5) * profile.contrast;
  g = 0.5 + (g - 0.5) * profile.contrast;
  b = 0.5 + (b - 0.5) * profile.contrast;

  const blackLift = profile.blackLift / 255;
  r = r * profile.brightness + blackLift;
  g = g * profile.brightness + blackLift;
  b = b * profile.brightness + blackLift;

  const postLuma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const saturation = profile.saturation - (postLuma < 0.26 ? 0.025 : 0);
  r = postLuma + (r - postLuma) * saturation;
  g = postLuma + (g - postLuma) * saturation;
  b = postLuma + (b - postLuma) * saturation;

  r *= profile.warmth;
  b *= 0.998;

  r = softenHighlights(clamp01(r));
  g = softenHighlights(clamp01(g));
  b = softenHighlights(clamp01(b));

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
};

const tuneImage = async (inputPath, outputPath) => {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let index = 0; index < data.length; index += 4) {
    const [r, g, b] = tunePixel(data[index], data[index + 1], data[index + 2]);
    data[index] = r;
    data[index + 1] = g;
    data[index + 2] = b;
  }

  await sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: info.channels,
    },
  })
    .sharpen({ sigma: 0.45, m1: profile.sharpen, m2: 0.35 })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(outputPath);
};

const listPngs = async (dir) =>
  (await fs.readdir(dir, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".png"))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));

const makeContactSheet = async (files) => {
  const samples = [
    "曹操.png",
    "刘备.png",
    "关羽.png",
    "诸葛亮.png",
    "赵云.png",
    "司马懿.png",
    "张角.png",
    "吕布.png",
    "小乔.png",
    "孙尚香.png",
    "典韦.png",
    "夏侯渊.png",
  ].filter((name) => files.includes(name));

  const cardWidth = 180;
  const gap = 18;
  const rowGap = 22;
  const margin = 24;
  const labelHeight = 42;
  const pairWidth = cardWidth * 2 + gap;

  const first = await sharp(path.join(sourceDir, samples[0])).metadata();
  const cardHeight = Math.round((first.height / first.width) * cardWidth);
  const width = margin * 2 + pairWidth * 3 + gap * 2;
  const height = margin * 2 + labelHeight + (cardHeight + rowGap) * Math.ceil(samples.length / 3);

  const composites = [];
  const labelSvg = Buffer.from(`
    <svg width="${width}" height="${labelHeight}" xmlns="http://www.w3.org/2000/svg">
      <style>
        text { font-family: "Microsoft YaHei", "Noto Sans CJK SC", Arial, sans-serif; font-weight: 700; fill: #24342f; }
        .small { font-size: 18px; fill: #5d6a65; font-weight: 600; }
      </style>
      <text x="${margin}" y="25">武将图清爽化预览</text>
      <text class="small" x="${margin + 180}" y="25">左：原图 / 右：2.1 ${profileName}</text>
    </svg>
  `);
  composites.push({ input: labelSvg, left: 0, top: margin });

  for (const [index, name] of samples.entries()) {
    const col = index % 3;
    const row = Math.floor(index / 3);
    const x = margin + col * (pairWidth + gap);
    const y = margin + labelHeight + row * (cardHeight + rowGap);
    const originalBuffer = await sharp(path.join(sourceDir, name)).resize({ width: cardWidth }).png().toBuffer();
    const tunedBuffer = await sharp(path.join(previewDir, "images", name)).resize({ width: cardWidth }).png().toBuffer();
    composites.push({ input: originalBuffer, left: x, top: y });
    composites.push({ input: tunedBuffer, left: x + cardWidth + gap, top: y });
  }

  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: "#f4f7f4",
    },
  })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toFile(path.join(previewDir, `contact-sheet-${profileName}.png`));
};

const main = async () => {
  const files = await listPngs(sourceDir);
  const previewImageDir = path.join(previewDir, "images");
  await fs.mkdir(previewImageDir, { recursive: true });
  if (shouldApply) {
    await fs.mkdir(targetDir, { recursive: true });
  }

  for (const fileName of files) {
    const inputPath = path.join(sourceDir, fileName);
    const previewPath = path.join(previewImageDir, fileName);
    await tuneImage(inputPath, previewPath);
    if (shouldApply) {
      await fs.copyFile(previewPath, path.join(targetDir, fileName));
    }
  }

  await makeContactSheet(files);
  console.log(
    JSON.stringify(
      {
        profile: profileName,
        sourceDir: path.relative(root, sourceDir),
        targetDir: shouldApply ? path.relative(root, targetDir) : null,
        previewDir: path.relative(root, previewDir),
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
