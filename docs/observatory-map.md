# 潮汐观测庭 / Tidal Observatory（0.4）

本地图是 Oinja-game 的原创游戏场景，不新增或修改 Oinja 叙事 Canon。环境由项目内程序化几何自主建模；未改动原 Oinja 资料。旧港继续保留，新地图使用独立建筑、路网和场景构图。

## 运行契约

- 工厂：`src/surge/observatory.ts` → `createObservatory(seed): Promise<HarborResult>`。
- 地图 ID：`tidal-observatory`。尺寸 180 × 180 米，X/Z 边界均为 −90 至 90。
- 出生点：`[0, 0, 56]`。附近装配台 `obs-forge-home` 在 `[0, 0, 63]`。
- 坐标单位为米，Y 向上。返回已有 MapWorld、事件候选和六个区域；选取事件及奖励状态由主模拟管理。
- 复用 HarborKit、现有 Physics 及 harborNavigation，不加载旧大地图。seed 只改变石材微纹理，物理几何稳定。
- 已保留 0.3 连续重力/贴地接口。地图不覆盖角色物理高度。

## 建筑和路线

视觉使用白石、铜绿、玻璃、反射水庭与暖色金属；穹顶观测台、抛物面天线、四门温室、柱廊和独立高架环廊形成地标。出生视野左右的天象环仪与倾斜望远镜位于 X=±12、Z=42，中央保留约 19.6 米无设施阻挡的通路。观测台南墙有三扇竖窗。植物、长椅、铺装分区、道路刻线和路灯构成近景细节。

主要地面回路绕中央水庭左右两侧、建筑外庭和地图外围相连。温室及实验亭的四面真实门洞允许穿堂路线；未恢复设施时也能从其他入口到达所有候选事件。水池为可见的抬高实体，导航和角色碰撞共同阻挡池体，避免不可见的地面陷阱。

高架环廊为完整矩形回路，桥面 Y=5，南北中心线 Z=28/−32，东西中心线 X=±32，净桥面宽约 8 米。两条坡道宽 10 米、水平长度 34 米、高差 5 米，坡度约 8.37°：

- 西坡道：`[-70,0,0]` → `[-36,5,0]`。
- 东坡道：`[36,5,0]` → `[70,0,0]`。

坡道链按约 2 米间距接入导航，环廊、地面和门洞各有正确的高度层。桥下净空足够的位置保留真实地面通路。高架可顺时针或逆时针完整绕行；所有流派均可步行到达。

## 六个区域

| ID | 中文 | English | 中心 |
|---|---|---|---|
| A | 迎潮前庭 | Tidefront Court | `[0,0,56]` |
| B | 铜绿温室 | Verdigris Conservatory | `[-62,0,-49]` |
| C | 星轨观测台 | Meridian Observatory | `[0,0,-46]` |
| D | 天线实验场 | Antenna Yard | `[60,0,-48]` |
| E | 高架环廊 | Skywalk Ring | `[0,5,-32]` |
| F | 镜水花园 | Mirrorwater Garden | `[64,0,40]` |

中英文名称及区域说明已交付给 UI 翻译表。地图物理层只存既有中文描述；语言选择由 UI 处理。

## 十二个事件候选

六类 EventKind 各有两个候选，沿用现有支援奖励体系。

| ID | 类别 | 中文 / English | 位置 | 奖励 |
|---|---|---|---|---|
| obs-forge-home | forge | 迎潮装配台 / Tidefront Workshop | `[0,0,63]` | titan |
| obs-forge-lab | forge | 光学维修台 / Optics Workbench | `[-21,0,-56]` | prism |
| obs-relay-array | relay | 天线馈电站 / Antenna Relay | `[60,0,-48]` | tempest |
| obs-relay-ring | relay | 环廊校准器 / Ring Calibrator | `[-32,5,-16]` | prism |
| obs-convoy-greenhouse | convoy | 温室补给车 / Conservatory Convoy | `[-54,0,-25]` | medic |
| obs-convoy-court | convoy | 庭院储能车 / Courtyard Energy Cart | `[0,0,43]` | titan |
| obs-crane-antenna | crane | 反射器吊架 / Reflector Hoist | `[42,0,-62]` | crusher |
| obs-crane-water | crane | 水庭闸机 / Watergarden Sluice | `[64,0,40]` | orbital |
| obs-conveyor-west | conveyor | 种植分拣台 / Botanical Sorter | `[-62,0,30]` | crusher |
| obs-conveyor-east | conveyor | 仪器输送线 / Instrument Conveyor | `[46,0,8]` | tempest |
| obs-cache-upper | cache | 高台观测箱 / Skywalk Supply Cache | `[31,5,18]` | orbital |
| obs-cache-garden | cache | 花园应急柜 / Garden Reserve | `[-49,0,61]` | medic |

`world.openShortcut('obs-relay-ring')` 开启温室南门；`obs-relay-array` 开启实验亭南门。调用后撤除对应门碰撞并重建导航，视觉在 1.8 秒内升起。第二参数 `true` 立即恢复完成态，适用于续局。主循环在更新地图后调用既有 `physics.syncShortcuts()`。其他事件 ID 不改变地图碰撞。

## 本轮导航缺陷和修复

真实整局机器人暴露了一个独立路线缺陷：从 `[-54.6335,-0.0523,5.1494]` 到 `[-54,0,-25]`，原导航直接穿过西坡道下方净空不足的区域；角色真实 Rapier 碰撞正确地挡住了这条路。原 `walkableAt` 和线段检测跳过所有 ramp 碰撞体，因此数学路线与物理不一致。

`src/surge/world-navigation.ts` 现在使用同一旋转坡体的局部坐标和角色胶囊尺寸检测坡底及侧面。坡顶接触面仍可行走，净空足够的高处坡底和桥下仍保留直达路径。旋转轴在创建导航时缓存；没有关闭碰撞、传送、修改地图或改变角色控制器。

同一回归脚本使用真实 `Physics.route`，每 1/60 秒重算路线并按正常 9.3 m/s 输入交给 Rapier。保留完整起点、目标、初始路径和逐秒轨迹：

| 检查 | 修复前 | 修复后 |
|---|---|---|
| 原始穿坡点 → 温室补给车 | 直达错误路径，连续阻挡 61 帧后判失败 | 5.50 秒抵达，最长阻挡 1 帧 |
| 新图西坡低净空横穿 | 连续阻挡 61 帧后判失败 | 3.88 秒绕行抵达 |
| 新图东坡低净空横穿 | 连续阻挡 61 帧后判失败 | 2.23 秒通过可行通路 |
| 新图东坡上桥、返地面、回入口 | 125.98 秒仍未完成 | 19.02 秒完整完成 |
| 新图高处坡底 / 桥下 | 原来可直达 | 仍可直达，分别 1.92 / 1.80 秒 |
| 旧港高架 → convoy-west | 该独立夹具原来可达 | 仍可达，10.78 秒 |

该修复明确复现并解决了新图穿坡路径。它不把任何未复现的整局停留都归因为同一问题；真人手感与胜率仍须实际游玩评估。

## 验证结果及复跑

最终证据在 `artifacts/observatory/`：

- `qa.json`：29/29 真实 Rapier 路线及门状态检查，含全部 12 个事件、6 个区域、地面回路、高架双方向、桥下、两道门的实时及恢复碰撞。
- 同一文件保留 45/45 连续输入轨迹：15 条常速直行、两侧上下坡、坡道两边及环廊边缘，分别在 30、60、120 Hz 运行。最低 P05 前进速度为命令速度的 **96.03%**，最长连续低速 **1 帧**。
- `ramp-nav-before.json` / `ramp-nav-after.json`：同一组 13 条动态重规划路线前后对照；最终 13/13 通过。
- `harbor-qa.json`：旧港原有 22/22 实体通行检查全部通过。
- `tests.log`：5 项 Node 测试通过；两个地图相关模块的严格 TypeScript 检查通过。
- 证据 JSON 包含运行源码 SHA-256；`manifest.json` 为最终交付文件与依赖校验。

```sh
node --import tsx tools/surge/observatory-qa.ts
node --import tsx tools/surge/ramp-navigation-qa.ts
node --import tsx --test tests/observatory.test.ts tests/ramp-navigation.test.ts
node --import tsx --input-type=module -e "import {validateHarbor} from './src/surge/world-validation.ts'; const r=await validateHarbor(); console.log(r); if(!r.pass)process.exitCode=1;"
```

模型统计：98 个网格、35,496 个三角形、139 个碰撞体、8 个遮挡淡化对象。程序化源文件就是环境建模源；区域/材质合批避免按每块砖提交绘制。根任务另行保存两图实际浏览器画面、帧时间及最终整局测试；此文档只报告上述独立地图/导航证据。
