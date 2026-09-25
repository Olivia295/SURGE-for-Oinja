from pathlib import Path
import json
base=Path('artifacts/surge-movement')
b=json.loads((base/'physics-before.json').read_text());a=json.loads((base/'physics-after.json').read_text())
b60={r['id']:r for r in b['results'] if r['hz']==60};a60={r['id']:r for r in a['results'] if r['hz']==60}
labels={'ordinary-plaza':'平坦工坊广场','ordinary-north-street':'普通北街','crate-edge-forward':'贴箱边正向','crate-edge-backward':'贴箱边反向','west-uphill':'西坡上行','west-downhill':'西坡下行','east-uphill':'东坡上行','east-downhill':'东坡下行','west-ramp-edge-up':'西坡边缘上行','west-ramp-edge-down':'西坡边缘下行','basin-ramp-down':'渠底坡下行','basin-ramp-up':'渠底坡上行'}
rows=[]
for key,label in labels.items():
 old,new=b60[key],a60[key]
 rows.append(f"| {label} | {old['meanSpeedRatio']*100:.1f}% → {new['meanSpeedRatio']*100:.1f}% | {old['longestSlowFrames']} → {new['longestSlowFrames']} | {'到达' if new['arrived'] else '未到达'} |")
text='''# 连续移动修复验证 · 2026-09-19

修复的是实际物理接触与坡缘布局；碰撞继续生效。

- `SurgeSimulation.step` 现向 `Physics.move` 传入 dt，使用其返回的真实高度，不再每帧写回设计用 `heightAt`。
- `Physics.move` 在新接口下按秒推进重力，着地时只保留轻微向下接触速度，消除原每帧 −0.3m 位移带来的帧率差异与上下坡速度反差。
- Rapier 接触退让调整为 1cm，避免浮点误差造成胶囊和地面反复接触。保留阶梯、贴地、墙体阻挡和沿墙滑动。
- 西坡边缘的两只货箱由 Z=−27 移至 Z=−31，解除实体货箱侵入坡道的问题。

测试固定输入为 9.3m/s，12 条路线分别在 30、60、120Hz 下记录完整逐帧轨迹，包含位置、实际前进速度、接触状态和碰撞数量。前后数据不是只比较终点。修复前使用当时正式移动代码和强制 floor 覆写；修复后保留物理返回高度。起点是显式测试夹具，不采用传送穿过障碍。

36/36 修复后轨迹到达目标，所有帧率的最长低速段只有 1 帧。低速定义为实际前进不足本步输入的 50%。60Hz 下广场、普通道路和贴箱双向均没有低速帧；坡缘上行还有 1 个孤立低速帧，因此不宣称每个数值接触都绝对匀速。

| 60Hz 路线 | 平均前进速度 / 输入速度（修复前 → 后） | 最长连续低速帧（前 → 后） | 修复后 |
|---|---:|---:|---|
'''+ '\n'.join(rows)+'''

`tests/movement.test.ts` 共 11 项通过：普通行走、两側上下坡、西坡边缘、帧率一致性、箱体阻挡与切向滑动、离桥连续下落，以及真实 SurgeSimulation 不覆写物理高度。全项目类型检查通过。角色从高架边缘落下时逐帧下落，未直接吸到下层地面。地图 22 项实体路线及原护送卡角回归也再次通过。

来源与证据：`physics-before.json`、`physics-after.json` 包含来源 SHA-256 和完整轨迹，`speed-comparison.svg` 展示典型路线速度；`tools/surge/movement-probe.ts` 可复跑。不要在修复后用 before 模式覆盖旧证据，该模式仅描述旧调用方式，不能恢复旧的 Physics 与地图源码。
'''
(base/'report.md').write_text(text)
svg=['<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="790" viewBox="0 0 1100 790">','<rect width="1100" height="790" fill="#101827"/>','<g font-family="Arial,sans-serif" fill="#e5edf7"><text x="36" y="36" font-size="24">Continuous movement — measured at 60 Hz</text><text x="36" y="62" font-size="14" fill="#a4b5ca">Actual forward speed / commanded 9.3 m/s. Solid teal: fixed. Coral: previous.</text>']
for index,(key,label) in enumerate([('ordinary-plaza','Flat workshop plaza'),('west-uphill','West ramp ascent'),('west-downhill','West ramp descent'),('west-ramp-edge-up','West ramp edge ascent')]):
 x=55+(index%2)*530;y=120+(index//2)*320;w=465;h=230;tmax=12 if index in [0,3] else 6.5
 svg += [f'<text x="{x}" y="{y-20}" font-size="17">{label}</text>']
 for ratio in [0,.5,1,1.5]:
  yy=y+h-ratio/1.5*h;svg += [f'<line x1="{x}" y1="{yy}" x2="{x+w}" y2="{yy}" stroke="#2c3b50"/>',f'<text x="{x-32}" y="{yy+5}" font-size="12" fill="#8c9eb5">{ratio:g}</text>']
 for t in [0,tmax/2,tmax]:
  xx=x+t/tmax*w;svg += [f'<text x="{xx-10}" y="{y+h+24}" font-size="12" fill="#8c9eb5">{t:g}s</text>']
 for r,color in [(b60[key],'#ff907c'),(a60[key],'#65ddcf')]:
  pts=' '.join(f"{x+q['t']/tmax*w:.2f},{y+h-max(0,min(1.5,q['ratio']))/1.5*h:.2f}" for q in r['trajectory'] if q['t']<=tmax)
  svg.append(f'<polyline points="{pts}" fill="none" stroke="{color}" stroke-width="1.6" opacity=".92"/>')
svg+=['<text x="36" y="765" font-size="13" fill="#a4b5ca">Source: artifacts/surge-movement/physics-before.json and physics-after.json. Fixed input; actual Rapier collisions.</text></g></svg>']
(base/'speed-comparison.svg').write_text('\n'.join(svg))
