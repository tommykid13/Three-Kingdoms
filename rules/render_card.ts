// 中文文件名版说明
// 不需要改 render_card.ts 的核心逻辑。
// 只要把 card_art_assets.json 里的 art_file 改成中文文件名路径即可。
//
// 例如：
// {
//   "card_id": "zhuque_yushan",
//   "title": "朱雀羽扇",
//   "art_file": "assets/cards/art/朱雀羽扇.png"
// }
//
// 保持：
// const artImage = await loadImage("/" + asset.art_file);
//
// 如果你的前端环境对中文路径支持不好，可以改成：
// const artImage = await loadImage("/" + encodeURI(asset.art_file));
