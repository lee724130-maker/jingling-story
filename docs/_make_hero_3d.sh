#!/usr/bin/env bash
# 精灵物语 · AI 生成 3D 人物（男主 + 女主）
# 前置：Agnes 已生成并人工确认 hero_v3_realistic.png / heroine_v3_ranger.png
# 流程：图生3D(image-to-model) → 可绑骨门禁(rig-check) → 绑骨(rig, Mixamo) → 动画重定向(idle/walk/run)
# 重要：消耗 Tripo 积分。图生3D 每张约 110 积分，动画按条计费。
#      执行前务必确认：1) 两张图已确认  2) 国际站账号积分充足（tripo whoami 查看）
# 用法：
#   bash docs/_make_hero_3d.sh --dry-run   # 只预演不消耗（需改造成给 make 传 --dry-run）
#   bash docs/_make_hero_3d.sh             # 正式执行

set -e
cd "$(dirname "$0")/.."

# 国际站 ov 需要走本地代理（直连 openapi.tripo3d.ai 不通）
export HTTPS_PROXY=http://127.0.0.1:7890
export HTTP_PROXY=http://127.0.0.1:7890

echo "===== 当前账号与积分 ====="
tripo whoami

echo ""
echo "===== [1/2] 男主 hero_male ====="
# 生成 + 绑骨（rig-check 门禁：不可绑骨则不进入 rig，节省积分）
MALE_TASK=$(tripo make "人物候选图/hero_v3_realistic.png" \
  --for anim \
  --then rig-check,rig:model=rig-v3.0,spec=mixamo \
  --out tripo-out/hero_male \
  --name hero_male \
  --json --yes | tee /tmp/hero_male_make.json)

echo "$MALE_TASK"

echo ""
echo "===== [2/2] 女主 hero_female ====="
FEMALE_TASK=$(tripo make "人物候选图/heroine_v3_ranger.png" \
  --for anim \
  --then rig-check,rig:model=rig-v3.0,spec=mixamo \
  --out tripo-out/hero_female \
  --name hero_female \
  --json --yes | tee /tmp/hero_female_make.json)

echo "$FEMALE_TASK"

echo ""
echo "===== 完成 ====="
echo "产物目录：tripo-out/hero_male/ 与 tripo-out/hero_female/"
echo "下一步：单独执行 anim retarget 挂 idle/walk/run，再替换 web/public/models/characters/"
