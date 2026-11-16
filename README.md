# 精灵物语

原创怪物收集养成游戏 · 网页端 + 微信小程序端（规划中）

当前阶段：**第三人称 3D 第一版垂直切片**（阶段 1/2 验证），React + TypeScript 前端 / NestJS 后端联调 Demo。

## 技术栈

| 层 | 选型 |
|---|---|
| 前端 | React 18 + TypeScript + Vite |
| 3D 渲染 | Three.js + React Three Fiber + Drei（第三人称场景 / 2.5D 广告牌）|
| 后端 | NestJS 10 + TypeScript |
| 数据库 | MySQL 独立库 `jingling_story`（`STORAGE_MODE=mysql`，可切 `local`）|
| 共享 | `shared/types.ts` 共用类型 · `shared/gamedata.ts` 共用配置 · `shared/rules.ts` 共用战斗规则 |
| 美术 | AI 立绘（男/女训练师、精灵群像裁切头像、草原地面、天空远景）+ 程序化补齐（树木/水面/地形）+ Canvas 2D 战斗特效 |
| 认证 | 本地测试账号 + JWT（微信 UnionID 登录后补）|

## 目录结构

```
精灵物语/
├── web/         # React 前端（Vite，端口 5180）
│   └── src/
│       ├── components/        # TitleScreen / BattleUI / SummonUI / Panel / SpiritArt
│       ├── game/
│       │   ├── world3d/       # 第三人称 3D 场景：coords / useBillboardTexture / Scene3D
│       │   ├── engine.ts      # 游戏引擎：野怪游荡 / 投球过场 / 战斗状态机 / 权威结算接入
│       │   ├── sprites.ts     # 2D Canvas 动作绘制层
│       │   ├── config.ts      # 转发 @shared/gamedata
│       │   └── model.ts       # 复用 @shared/rules 建精灵
│       └── public/art/        # AI 素材：trainer_male/female / spirits / scene_grass / scene_sky
├── server/      # NestJS 后端（端口 3000）
│   └── src/{auth,player,game,common}
├── shared/      # 前后端共享：types / gamedata / rules
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

Vite 已配 `/api` 代理到后端 3000，前端 API 请求走同源。

## 已实现功能

### 第三人称 3D 世界（第一版垂直切片）

- **第三人称视角**：Three.js / React Three Fiber / Drei 搭建，跟随相机锁定玩家，方向键 / WASD 操控移动
- **范围空间场景**：AI 生成的草原地面贴图 + 蓝天白云远山天空图，程序化补齐树木、水面与地形边界（AI 生成场景图 + 程序化补齐方案）
- **2.5D 广告牌角色**：AI 生成的人物/精灵立绘作为朝向相机的贴图平面，运行时抠图（浅绿背景/白底转透明），保留 AI 画风并呈现浮动/待机动效
- 玩家身后跟随出战精灵；地图上 6 只野怪游荡、浮动、发现玩家显示警戒感叹号
- 3D 世界作为底层，战斗/投球过场用 2D Canvas 特效层叠加，兼顾画面表现与开发效率

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

## 后续

- 战斗主画面升级为完整 3D 演出（当前为 3D 背景 + 2D 战斗特效层混合，精灵已用 AI 贴图形象）
- 人物/精灵由 2.5D 广告牌升级为真 3D 骨骼模型
- 微信开放平台 UnionID 登录（资质就绪后）
- 微信小游戏端适配：当前 React DOM 方案不能直接跑进微信小游戏，需提前做架构决策
- 内容扩充：更多地图/精灵/任务/进化链/音效/新手引导
- summon 过场偶发黑屏的精确排查（当前已加渐变兜底）

## 说明

游戏名统一为「精灵物语」。所有灵兽、技能、地图、文案均为原创，仅借鉴玩法机制，不复用宝可梦素材、角色、名称、音乐。
