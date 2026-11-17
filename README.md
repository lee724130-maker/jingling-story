# 精灵物语

原创怪物收集养成游戏 · 网页端 + 微信小程序端（规划中）

**GitHub 仓库**：https://github.com/lee724130-maker/jingling-story （私有）

当前阶段：**第三人称 3D 第一版 + CC0 3D 素材场景 + 双区域新手村/野外副本**（阶段 1/2/4 部分完成），React + TypeScript 前端 / NestJS 后端联调 Demo。

## 技术栈

| 层 | 选型 |
|---|---|
| 前端 | React 18 + TypeScript + Vite |
| 3D 渲染 | Three.js + React Three Fiber + Drei（第三人称场景 / 2.5D 广告牌）|
| 后端 | NestJS 10 + TypeScript |
| 数据库 | MySQL 独立库 `jingling_story`（`STORAGE_MODE=mysql`，可切 `local`）|
| 共享 | `shared/types.ts` 类型 · `shared/gamedata.ts` 配置 · `shared/rules.ts` 战斗规则 · `shared/quests.ts` 任务 · `shared/maps.ts` 多地图/NPC/商店 |
| 美术 | AI 立绘（精灵群像裁切头像、草原地面、天空远景）+ Kenney CC0 3D 场景模型（树木/花草/岩石/商店摊/喷泉/路灯/围栏）+ three.js 官方 MIT 带纹理装甲人物（hero.glb=Soldier，玩家/NPC，Idle/Walk/Run）+ Canvas 2D 战斗特效 |
| 认证 | 本地测试账号 + JWT（微信 UnionID 登录后补）|

## 目录结构

```
精灵物语/
├── web/         # React 前端（Vite，端口 5180）
│   └── src/
│       ├── components/        # TitleScreen / BattleUI / SummonUI / Panel / QuestPanel / StarterPanel / ShopPanel / SpiritArt
│       ├── game/
│       │   ├── world3d/       # 第三人称 3D 场景：coords / useBillboardTexture / Scene3D
│       │   ├── engine.ts      # 游戏引擎：野怪游荡 / 投球过场 / 战斗状态机 / 权威结算接入
│       │   ├── sprites.ts     # 2D Canvas 动作绘制层
│       │   ├── config.ts      # 转发 @shared/gamedata
│       │   └── model.ts       # 复用 @shared/rules 建精灵
│       ├── public/art/        # AI 素材：trainer_male/female / spirits / scene_grass / scene_sky
│       └── public/models/     # nature/（树花草岩石）+ town/（摊/喷泉/路灯/围栏，含 colormap.png）+ characters/（hero.glb 骨骼动画人物，MIT）
├── server/      # NestJS 后端（端口 3000）
│   └── src/{auth,player,game,common}
├── shared/      # 前后端共享：types / gamedata / rules / quests / maps
└── docs/        # MySQL 配置、E2E 脚本、AI 素材生成脚本
```

## 本地运行

要求 Node 18+。项目根目录已配 npm workspaces。

```bash
cd 精灵物语
npm install                 # 首次
npm run dev:server          # 终端1：后端（默认 local 存储）
npm run dev:web             # 终端2：前端 http://localhost:5180
```

浏览器打开 http://localhost:5180，输入训练师名字 → 选男女形象 → 进入游戏。
新流程：在青芽村找村长对话 → 三选一初始伙伴 → 走向地图上方出口进入大草原捕捉精灵。走近 NPC/出口按空格交互。

Vite 已配 `/api` 代理到后端 3000，前端 API 请求走同源。

## 已实现功能

### 第三人称 3D 世界（第一版垂直切片）

- **第三人称视角**：Three.js / React Three Fiber / Drei 搭建，跟随相机锁定玩家，支持 **左键点地面寻路移动** 与 **WASD / 方向键** 两种操控
- **左键点击交互**：点地面自动寻路（直线 + 轴向滑动绕障 + 不可达保护），点 NPC/出口/野怪直接交互；按住 **Shift** 或点击时带 Shift 进入小跑（速度 3.7 vs 走路 2.3）
- **3D 带纹理人物**：玩家与 NPC 用 three.js 官方 MIT **Soldier 装甲人物模型** `hero.glb`（自带 2 张纹理，有盔甲/面罩细节，比光滑人体模型更有质感）；`useGLTF` + `useAnimations` + `SkeletonUtils.clone` 深拷贝骨骼/材质，按状态播放 **Idle / Walk / Run** 动画；NPC 用轻微色调区分角色（与纹理相乘保留质感）；模型脚在 y≈0 直接贴地（不用 Box3 对齐，避免 SkinnedMesh 骨骼变换算错高度导致浮空），加载失败回退占位
- **朝向跟随移动方向**：引擎按实际位移记录 `moveAngle`（`atan2(dx,dy)`，含轴向滑动），3D 渲染做最短角度平滑插值（±π 环绕处理）并加 π 修正模型默认朝向，角色真正面朝移动方向（停止时保持最后朝向）
- **范围空间场景**：AI 生成的草原地面贴图 + 蓝天白云远山天空图，树木/花草/岩石/村庄建筑改用 **Kenney CC0 3D 模型**（GLB，`useGLTF` 加载 + 失败回退程序化几何体），水面与地形边界程序化补齐
- **2.5D 广告牌精灵**：AI 精灵立绘作为朝向相机的贴图平面（战斗与野怪），运行时抠白底；人物已升级为真 3D 模型
- 玩家身后跟随出战精灵；地图上 6 只野怪游荡、浮动、发现玩家显示警戒感叹号；点野怪可自动走过去触发战斗
- 3D 世界作为底层，战斗/投球过场用 2D Canvas 特效层叠加，兼顾画面表现与开发效率

### 双区域地图：新手村 + 野外副本

- **区域数据驱动**：地图集中在 `shared/maps.ts` 前后端共用，`SaveData.progress.map` 记录当前区域；地把单地图硬编码重构为多地图派生（engine 的 cellAt/findStart/野怪生成全按当前地图动态计算）
- **青芽村（新手村）**：开阔少障碍、Kenney 中世纪素材搭建（商店摊/村长摊/中央喷泉/路灯/围栏/岩石），无野生精灵；含村长木老（主线）、商店老板阿布、向导小岚、冒险任务板、疗伤石碑；村内上方有金色传送门出口
- **大草原（野外副本）**：AI 草地纹理 + Kenney 多种树木花草岩石 + 水面边界，6 只可见野怪游荡，绿色传送门出口返回村庄；走进出口格子即自动切换区域，切图后落点重置、野怪重建、短暂冷却防误触
- **3D 场景按区域切换**：村庄显示建筑与纯色草地（20 棵树）、草原显示 AI 纹理与野怪（42 棵树，密度已调稀保证视野开阔），`Canvas key=mapId` 强制重建场景
- **素材合规**：Kenney Nature Kit / Fantasy Town Kit 均为 CC0（可商用、无需署名），授权文件随模型存于 `web/public/models/*/LICENSE.txt`；Town 模型的外部图集 `Textures/colormap.png` 已随包提供，避免 GLTFLoader 贴图丢失

### 新手村基础设施与主线

- **三选一初始伙伴**：新账号队伍为空，主线标记 `story:need_starter`；与村长对话后弹出三选一面板（焰苗兽/潮泡兽/木芽兽 = 火/水/木），`POST /api/game/starter/choose` 服务端白名单校验 + 种子随机生成精灵（性别/性格），防重复选择（3003）；老账号（已有精灵）自动迁移跳过选宠
- **商店系统**：`POST /api/game/shop/buy` 服务端按 `SHOP_ITEMS` 权威定价（灵兽球 ◈20 / 活力草 ◈15），校验余额扣款加道具，金币不足返 3001
- **NPC 交互**：走近 NPC/出口按空格或 E 交互，HUD 弹出交互提示；村长主线对话、商店面板、任务板面板、向导致路对话
- **对话系统**：Dialog 组件支持结束后回调（onDone），村长对话结束自动打开三选一面板

### 战斗演出（AI 精灵 + 属性技能特效）

- **AI 精灵实战化**：对战双方不再是程序化气泡，改用 AI 群像图裁切、运行时 flood-fill 抠白底后的真实精灵形象（火狐/水龟/木鹿/雷猫/岩怪/风鸟），带接地影子、浮动、前冲、受击缩放/抖动、治疗放大等立体动效；贴图未加载时自动回退程序化绘制，保证任何时刻有画面（`game/spiritCanvas.ts` + `game/sprites.ts`）
- **8 种属性专属技能特效**：`game/battleFx.ts` 实现蓄力→飞行→命中爆裂的粒子动画，按属性差异化——焰(火苗)/潮(水泡)/木(藤叶)/雷(折线闪电)/岩(碎石抛落)/风(气旋)/常(光弹拖尾)/回春(上升绿光)，威力越高粒子越密
- 技能施放时战斗画面中央弹出**带属性配色的技能名横幅**（CSS 动画，每次施放重播）；伤害结算对齐特效命中帧，进度用绝对时间戳计算，避免 rAF 节流导致卡顿
- 投球出战过场中的己方精灵同样使用 AI 贴图形象

### 核心玩法

- 登录（本地测试账号，自动注册）、JWT 鉴权
- **地图可见野怪**：走近触碰才触发战斗，不再是草丛随机遭遇；战斗结束后野怪在别处重生
- **投球出战过场**：「投掷精灵球 → 球飞行 → 落地开盖 → 光柱 → 己方精灵跃出 → 准备战斗」动画，再进入战斗
- **动作效果**：训练师走动摆臂踏步、野怪浮动/警戒跳、战斗精灵待机浮动/攻击前冲/受击抖动/治疗放大、捕捉球飞行摇晃与收进球发光
- 回合制战斗：技能/属性克制/本系加成、灵兽球捕获、活力草回血、逃跑
- **服务端权威结算**：伤害/捕获率/经验/升级/进化规则集中在 `shared/rules.ts` 前后端共用；金币、经验、升级、进化、捕获判定、道具消耗全部由服务端读取权威存档重算并写回，客户端只上报战斗上下文+随机种子；带 checksum 校验（篡改返 3002）、幂等键防重复结算（3003）、合理性校验（非法等级返 3001）；网络失败时降级本地计算
- 成长：经验、升级、进化；**捕获时精灵性别与性格随机**（由服务端种子生成）
- 图鉴（已见/已捕获分状态）、队伍、背包、菜单面板；精灵头像用 AI 群像裁切
- 存档经 API 存服务端，version 乐观锁（冲突返回 2001 并同步最新存档）
- 男女双主角 AI 立绘

### 冒险任务与新手引导

- **7 个渐进任务**：启程第一步（走 30 步）→ 初次对战（1 胜）→ 精灵收藏家（捕获 2 只）→ 见多识广（图鉴 5 种）→ 身经百战（5 胜）→ 训练有素（Lv.10）→ 图鉴大师（捕获 8 种），奖励金币/灵兽球/活力草
- **进度零存储**：全部从权威存档字段实时推导（步数/胜场/图鉴/队伍等级），不新增数据表；任务定义集中 `shared/quests.ts` 前后端共用
- **服务端权威领奖**：`POST /api/game/quest/claim` 校验条件达成后才发奖，标记写入 `progress.flags` 防重复领取（重复返 3003、未完成返 3001），发奖后 version 递增并整体同步权威存档
- **引导反馈**：HUD「任务」入口带可领取红点；任务刚完成时弹 Toast 提示；首次登录对话引导玩家去走第一步

## MySQL 数据库（已启用，与主项目隔离）

- 已在 MySQL（8.4.11）新建**独立库 `jingling_story`**，只含 `users` / `saves` 两张表。
- 使用**专用账号 `jingling_user`（密码 `123456`）**，仅授权 `jingling_story` 库，**无法访问主项目 `ai_anime` 库**（权限层隔离，已实测 `ERROR 1044`）。
- 主项目 `ai_anime`（30 张表）全程只读未改动。
- 凭证写在 `server/.env`（已在 `.gitignore` 中，切勿提交）。
- 当前 `STORAGE_MODE=mysql`。若需临时回退本地模式，改为 `local` 即可。

端口注意：前端用 **5180**（5173/5174 被 AI Anime 主项目占用），后端 3000。详见 `docs/MySQL配置说明.md`。

## 验证

- `docs/_settle_test.js`：服务端权威结算防作弊测试（17/17 PASS）
- `docs/_e2e_settle.js`：前端结算 E2E（金币 100→130、version 递增、零错误）
- `docs/_e2e_3d.js`：第三人称 3D E2E（WebGL 渲染 / WASD 移动 / 野怪存在 / 可进入 summon+battle / 零错误）
- `docs/_e2e_battle.js`：战斗演出 E2E（AI 精灵贴图渲染 / 技能特效触发与进度 / 横幅 / 结束后清除 / 零错误）
- `docs/_e2e_quest.js`：任务系统 E2E（面板渲染 / 权威领奖金币+30 / 防重复 3003 / 未完成 3001 / 刷新持久化 / 零错误）
- `docs/_e2e_village.js`：新手村系统 E2E（19 项全过：空队伍开局 / 无野怪 / 三选一 / 防重复选宠 / 商店扣款 / 金币不足 / 场景往返切换 / 野怪随区域增减 / 刷新持久化 / 零错误）
- `docs/_e2e_interact.js`：点击交互 E2E（11 项全过：hero.glb 3D 人物加载 / 点击寻路位移 / 小跑快于走路(固定30帧) / 四方向朝向角度 / Shift 切换 / 点 NPC 交互 / 真实鼠标点地面寻路 / 零错误）

## AI 写实人物模型试验（进行中，暂未接入）

目标：用 AI 生成的写实人物质感替换现有 Soldier 模型。当前进度与决策记录如下（详见 `docs/AI人物模型生成指引.md`、`docs/Mixamo绑骨操作指引.md`）：

- **生图**：Agnes Image 2.5 Flash 生成 5 张人物候选图（`人物候选图/`），选定男主 `hero_v3_realistic.png`（写实皮甲战士）、女主 `heroine_v3_ranger.png`（绿兜帽游侠）。
- **Tripo 已放弃**：网页创作平台积分与 API 积分不互通，且生成模型需开会员才能下载 → pass。
- **腾讯混元3D**：图生 3D 得到男主模型（75MB / 150 万面），外观超预期（正面还原 v3 图、背面 AI 补全长披风无破面、侧面比例正常）。已用 `@gltf-transform/cli` 减面压缩到 1.5MB / 3.45 万面（`docs/_make_hero_3d.sh` 等脚本备查），但混元3D 只能出**静态模型**（无骨骼无动画）。
- **Mixamo 绑骨受阻（待续）**：模型有连体长披风 + 2482 个碎片网格，Mixamo 自动绑骨卡在标记放置阶段（`Please place all markers on the character`），反复调整标记未成功。**明日续做**，方向：①最后试无披风 A-pose 重生成图重走流程；②或放弃 AI 模型沿用 Soldier；③或仅作静态立绘用于图鉴/对话。
- **当前游戏内人物仍为 Soldier**（`hero.glb`，带 Idle/Walk/Run），未受试验影响。

## 后续

- 战斗主画面升级为完整 3D 演出（当前为 3D 背景 + 2D 战斗特效层混合，精灵已用 AI 贴图形象）
- 人物/精灵由 2.5D 广告牌升级为真 3D 骨骼模型
- 微信开放平台 UnionID 登录（资质就绪后）
- 微信小游戏端适配：架构已定案 Cocos Creator 3.x 重做表现层，详见 `docs/双端适配方案.md`
- 内容扩充：更多野外副本地图/精灵/进化链/音效；主线任务链扩充（当前仅"选初始伙伴"一步，村长/向导有对话但无后续剧情）
- summon 过场偶发黑屏的精确排查（当前已加渐变兜底）

## 说明

游戏名统一为「精灵物语」。所有灵兽、技能、地图、文案均为原创，仅借鉴玩法机制，不复用宝可梦素材、角色、名称、音乐。
