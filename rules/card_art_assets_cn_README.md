# 中文文件名版卡图映射

你的卡图文件名是中文牌名，例如：
- 朱雀羽扇.png
- 八卦阵.png
- 杀.png
- 火杀.png

所以 card_art_assets.json 里原先的英文文件名路径需要改成中文文件名路径。

## 你现在该怎么用

把原来的 card_art_assets.json 替换为：
- card_art_assets_cn_filenames.json

并把图片放到：
- assets/cards/art/

例如：
- assets/cards/art/朱雀羽扇.png
- assets/cards/art/杀.png
- assets/cards/art/闪.png

## 注意
如果前端环境对中文路径加载有问题，可以在加载时加：
encodeURI(asset.art_file)
