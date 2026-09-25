import type { Choice, EventKind, Profile, RunState, Settings, WeaponId, WeaponSlot } from './types';
import type { MapWorld } from '../world/types';
import { WEAPONS, MODS, SUPPORTS, UNLOCKS, DEFAULT_PROFILE } from './content';
import { getLocale, setLocale, t, type Locale } from './i18n';
import { MAPS, type SurgeMapId } from './maps';
import { ENCOUNTERS, ENCOUNTER_BUFFS } from './encounters';
import { SYNERGIES, activeSynergies, previewChoiceSynergies } from './synergies';

export interface UIActions {
  start(weapon: WeaponId, danger: number, kit?: string, mapId?: SurgeMapId): void;
  continue(): void; resume(): void; restart(): void; menu(): void;
  choose(id: string, replace?: number): void; reroll(): void;
  pause(): void; map(): void; settings(settings: Settings): void;
}
type View = 'menu' | 'loading' | 'game' | 'choices' | 'pause' | 'result' | 'map' | 'settings' | 'guide';
// Translate one data value before escaping it; HTML templates are never post-processed.
const esc = (s: unknown): string => t(String(s ?? '')).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]!));
const clamp = (n: number, lo = 0, hi = 100): number => Math.max(lo, Math.min(hi, Number.isFinite(n) ? n : 0));
const pct = (a: number, b: number): number => clamp(a / Math.max(1, b) * 100);
const clock = (t: number): string => `${Math.floor(Math.max(0,t) / 60).toString().padStart(2,'0')}:${Math.floor(Math.max(0,t) % 60).toString().padStart(2,'0')}`;
const number = (n: number): string => Math.round(n).toLocaleString(getLocale());
const bearing = (dx: number, dz: number): string => t(['北','东北','东','东南','南','西南','西','西北'][(Math.round(Math.atan2(dx,-dz)/(Math.PI/4))+8)%8]);
const weaponIds = Object.keys(WEAPONS) as WeaponId[];
const weaponName = (w: WeaponSlot): string => t(w.evolution ? WEAPONS[w.id].evolutions[w.evolution === 'a' ? 0 : 1] : WEAPONS[w.id].name);
const KITS = [
  { id:'balanced', name:'标准回路', unlock:'', gain:'从零搭出自己的流派', cost:'无额外收益或代价' },
  { id:'recycler', name:'回收专家', unlock:'first-circuit', gain:'开局重抽 +2', cost:'所有伤害 −8%' },
  { id:'conductor', name:'导电先驱', unlock:'storm-reader', gain:'自带「导电涂层」', cost:'最大生命 −35' },
  { id:'wanderer', name:'漫游回路', unlock:'surge-master', gain:'自带「波域扩展」1 级', cost:'技能冷却 +10%' },
  { id:'support', name:'工坊支援', unlock:'harbor-friend', gain:'随机支援试用 90 秒', cost:'开局重抽 −1' },
];
const EVENT_HELP: Record<EventKind,string> = { relay:'留在设施附近击破 14 台敌机，接通继电器。', convoy:'跟随运输车前进 24 米，保持在护送范围内。', crane:'启动起重架，立即清场并放下桥梁。', forge:'启动工坊，立即充满同调并修复生命。', conveyor:'启动输送线聚拢怪群，清理附近 16 台敌机。', cache:'击败缓存旁的两台守卫，回收支援。' };
const ENCOUNTER_BRIEF = {
  'storm-hunt':'圈内连续击破 12 敌（间隔不超过 6 秒）→ 25 秒冷却 −20%、移速 +12%',
  'battery-run':'依次收集 4 枚电池 → 35 秒经验吸取范围 +10 米',
  overload:'清空护盾、支付 10% 最大生命；10 秒承伤 +30% → 25 秒伤害 +40%',
  'echo-hunt':'击破 2 台标记精英 → 充满同调、20 秒伤害 +40%',
};
const controls = (): string => `<div class="su-controls"><span><kbd>W A S D</kbd>${t(" 移动")}</span><span><kbd>Space</kbd>${t(" 闪避")}</span><span><kbd>Q</kbd>${t(" 同调爆发")}</span><span><kbd>E</kbd>${t(" 场景互动")}</span><span><kbd>Tab</kbd>${t(" 地图")}</span><span><kbd>Esc</kbd>${t(" 暂停")}</span></div>`;


/** DOM presentation only. Simulation, pause policy and persistence belong to the host. */
export class SurgeUI {
  private shell: HTMLDivElement;
  private overlay: HTMLDivElement;
  private hudNode: HTMLDivElement;
  private toastNode: HTMLDivElement;
  private view: View = 'menu';
  private returnView: View = 'menu';
  private state?: RunState;
  private world?: MapWorld;
  private profile: Profile = structuredClone(DEFAULT_PROFILE);
  private hasSave = false;
  private selectedWeapon: WeaponId = 'fist';
  private danger = 0;
  private kit = 'balanced';
  private selectedMap: SurgeMapId = 'old-harbor';
  private region = '';
  private resultUnlocks: string[] = [];
  private guideArchive = false;
  private loadingState = { progress: 0, label: '' };
  private encounterSignature = '';
  private encounterNode?: HTMLElement;
  private replacement?: Choice;
  private hudSignature = '';
  private synergyBuild = '';
  private synergyColor = '';
  private synergyNodes?: { wrap: HTMLElement; count: HTMLElement; trigger: HTMLElement };
  private synergyCount = 0;
  private lastFocus?: HTMLElement;
  private toastTimers = new Set<ReturnType<typeof setTimeout>>();
  private clickHandler = (e: Event): void => this.onClick(e);
  private changeHandler = (e: Event): void => this.onSetting(e);
  private focusFrame = 0;

  constructor(private root: HTMLElement, private callbacks: UIActions) {
    this.shell = document.createElement('div');
    this.shell.className = 'surge-ui';
    this.shell.innerHTML = `<div class="su-hud" hidden></div><div class="su-overlay"></div><div class="su-toasts" role="status" aria-live="polite" aria-atomic="false"></div>`;
    this.root.append(this.shell);
    this.overlay = this.shell.querySelector('.su-overlay')!;
    this.hudNode = this.shell.querySelector('.su-hud')!;
    this.toastNode = this.shell.querySelector('.su-toasts')!;
    this.shell.addEventListener('click', this.clickHandler);
    this.shell.addEventListener('input', this.changeHandler);
    this.shell.addEventListener('change', this.changeHandler);
    setLocale(getLocale()); this.applyPreferences();
  }

  get isOverlayOpen(): boolean { return this.view !== 'game'; }

  menu(profile: Profile, hasSave: boolean): void {
    this.profile = structuredClone(profile); this.hasSave = hasSave;
    this.selectedWeapon = WEAPONS[profile.lastWeapon] ? profile.lastWeapon : 'fist';
    if (!KITS.some(k => k.id === this.kit && (!k.unlock || profile.unlocks.includes(k.unlock)))) this.kit = 'balanced';
    this.applyPreferences(); this.renderMenu();
  }

  private renderMenu(focus = true): void {
    const w = WEAPONS[this.selectedWeapon], map = MAPS.find(m => m.id === this.selectedMap)!;
    this.show('menu', `<main class="su-menu" aria-label="${t("电涌主菜单")}">
      <header class="su-menu-header"><a class="su-brand" href="#" data-act="noop" aria-label="${t("Oinja 电涌")}"><span class="su-brand-mark">O/</span><span>OINJA<span class="su-brand-sub">FIELD OPERATIONS</span></span></a><div class="su-header-actions">${this.universeLink()}${this.localeButtons()}<button class="su-text-btn" data-act="guide">${t("怎么玩 ")}<span>↗</span></button><button class="su-icon-btn" data-act="settings" aria-label="${t("打开设置")}">⚙</button></div></header>
      <div class="su-menu-content"><section class="su-hero"><p class="su-eyebrow"><span class="su-live-dot"></span> ${esc(map.name)} / ${this.selectedMap === 'old-harbor' ? '01' : '02'}</p><h1><span>${getLocale() === 'en' ? 'OINJA' : '电涌'}</span><strong>SURGE<span class="su-title-dot">.</span></strong></h1><p class="su-hero-copy">${t("冲进怪潮。让回路失控。")}</p><p class="su-hero-detail">${t("四格能力 · 自由构筑 · 十二分钟决战")}</p></section>
      <section class="su-launch" aria-label="${t("行动配置")}"><div class="su-section-line"><h2>${t("从一个火花开始")}</h2><span>${t("选择初始能力 ")}<b>${String(weaponIds.indexOf(this.selectedWeapon)+1).padStart(2,'0')} / 08</b></span></div>
      <div class="su-weapon-picker" role="group" aria-label="${t("初始能力")}">${weaponIds.map(id => {const a = WEAPONS[id]; return `<button class="su-weapon-pick ${id === this.selectedWeapon ? 'is-selected' : ''}" data-act="weapon" data-id="${id}" style="--weapon:${a.color}" aria-pressed="${id === this.selectedWeapon}" title="${esc(a.description)}"><span class="su-weapon-glyph" aria-hidden="true">${a.icon}</span><span>${t(a.name)}</span></button>`;}).join('')}</div>
      <div class="su-selected-weapon" style="--weapon:${w.color}"><span class="su-selected-family">${t(w.family)}</span><p>${esc(w.description)}</p><span class="su-auto-label">${t("自动发动")}</span></div>
      <div class="su-map-picker" role="group" aria-label="${t('行动地点')}">${MAPS.map((m,i) => `<button data-act="location" data-id="${m.id}" aria-pressed="${this.selectedMap === m.id}" class="${this.selectedMap === m.id ? 'is-selected' : ''}"><span>0${i+1}</span><div><b>${esc(m.name)}</b><small>${esc(m.subtitle)}</small></div><i aria-hidden="true">↗</i></button>`).join('')}</div>
      <div class="su-danger-row"><span>${t("危险合约")}</span><div role="group" aria-label="${t("危险合约等级")}">${[t('标准'),t('危险 I'),t('危险 II')].map((s,i) => `<button class="${this.danger === i ? 'is-selected' : ''}" data-act="danger" data-id="${i}" aria-pressed="${this.danger === i}">${s}</button>`).join('')}</div><span class="su-danger-note">${this.danger ? t('更强的敌潮，额外挑战') : t('轻松上手，尽情构筑')}</span></div>
      <details class="su-kit-drawer"><summary>${t("开局方案 ")}<span>${t(KITS.find(k => k.id === this.kit)!.name)} <b>＋</b></span></summary><div class="su-kits">${KITS.map(k => {const locked = !!k.unlock && !this.profile.unlocks.includes(k.unlock); const unlock = UNLOCKS.find(u => u.id === k.unlock); return `<button class="su-kit ${this.kit === k.id ? 'is-selected' : ''}" data-act="kit" data-id="${k.id}" ${locked ? 'disabled' : ''} aria-pressed="${this.kit === k.id}"><span>${t(k.name)}${locked ? t(' · 未解锁') : ''}</span><small>${locked ? `${t("解锁：")}${esc(unlock?.name ?? k.unlock)}` : esc(k.gain)}</small><em>${locked ? esc(unlock?.description ?? '') : esc(k.cost)}</em></button>`;}).join('')}</div></details>
      <div class="su-start-row"><button class="su-primary su-start" data-act="start"><span>${esc(t('进入{name}',{name:t(map.name)}))}</span><span aria-hidden="true">↗</span></button>${this.hasSave ? `<button class="su-secondary su-continue" data-act="continue">${t("继续行动 ")}<span>↗</span></button>` : ''}</div>
      <p class="su-input-note"><span class="su-keyboard-icon">⌨</span>${t(" 桌面键鼠游玩 ")}<span>${t("WASD 移动 · 自动攻击")}</span></p></section></div>
      <aside class="su-scene-caption"><span>SECTOR ${this.selectedMap === 'old-harbor' ? '01' : '02'}</span><strong>${t("港灯仍亮着。")}<br>${t("该你上场了。")}</strong><i>${esc(map.description)}</i></aside>
      <footer class="su-menu-footer"><button data-act="archive">${t("行动档案 ")}<span>${this.profile.unlocks.length.toString().padStart(2,'0')} / 04</span></button><span>${t("OINJA · 电涌 ")}<b>${t("本地原型")}</b></span></footer>
      <div class="su-narrow-notice">${t("请在桌面浏览器使用键盘游玩；放大窗口可获得更完整的战场视野。")}</div>
    </main>`, focus);
  }

  loading(progress: number, label: string): void {
    this.loadingState = {progress,label};
    this.show('loading', `<section class="su-loading" aria-label="${t("正在载入")}"><span class="su-eyebrow">OINJA / SURGE</span><h2>${t("接通回路")}</h2><div class="su-load-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(clamp(progress <= 1 ? progress * 100 : progress))}"><i style="width:${clamp(progress <= 1 ? progress * 100 : progress)}%"></i></div><p>${esc(label)}<b>${Math.round(clamp(progress <= 1 ? progress * 100 : progress))}%</b></p></section>`, false);
  }

  game(): void {
    this.view = 'game'; this.replacement = undefined; this.overlay.hidden = true;
    this.overlay.innerHTML = ''; this.hudNode.hidden = false;
    this.shell.classList.remove('has-overlay');
    cancelAnimationFrame(this.focusFrame);
  }

  hud(state: RunState, region: string): void {
    this.state = state; this.region = region;
    if (!this.hudNode.firstChild) this.buildHUD();
    this.updateSynergyHUD(state);
    this.updateEncounterHUD(state);
    const text = (id: string, value: string): void => { const el = this.hudNode.querySelector(`[data-hud="${id}"]`); if (el && el.textContent !== value) el.textContent = value; };
    const bar = (id: string, value: number): void => {const el = this.hudNode.querySelector<HTMLElement>(`[data-hud="${id}"]`); if(el)el.style.width=`${clamp(value)}%`;};
    text('hp', `${Math.ceil(state.hp)} / ${Math.ceil(state.maxHp)}`); bar('hp-fill', pct(state.hp,state.maxHp));
    text('shield', state.shield > .5 ? `+${Math.ceil(state.shield)}${t(" 护盾")}` : '');
    text('level', `${state.level}`); bar('xp-fill', pct(state.xp,state.xpNext));
    text('time', clock(state.time)); text('kills', number(state.kills)); text('region', t(region));
    text('sync-text', state.syncTime > 0 ? `${t("同调 ")}${state.syncTime.toFixed(1)}s` : state.sync >= 100 ? t('同调就绪') : t('同调蓄能'));
    text('sync-value', state.syncTime > 0 ? t('爆发中') : `${Math.floor(state.sync)}%`); bar('sync-fill', state.syncTime > 0 ? 100 : state.sync);
    this.hudNode.querySelector('.su-sync')?.classList.toggle('is-ready', state.sync >= 100 || state.syncTime > 0);
    text('dash', state.dashCooldown > 0 ? `${state.dashCooldown.toFixed(1)}s` : t('闪避'));
    text('revive', state.revives > 0 ? `${t("复苏 ×")}${state.revives}` : t('复苏已用尽'));
    const sig = JSON.stringify([state.weapons.map(w => [w.id,w.level,w.evolution]),state.support]);
    if (sig !== this.hudSignature) {
      this.hudSignature = sig;
      this.hudNode.querySelector('[data-hud="slots"]')!.innerHTML = Array.from({length:4},(_,i) => state.weapons[i] ? this.slot(state.weapons[i],i,true) : `<div class="su-slot su-slot-empty" title="${t("空能力槽")}">＋<small>${i+1}</small></div>`).join('') + `<span class="su-slot-divider"></span>${state.support ? `<div class="su-slot su-support-slot" style="--weapon:${SUPPORTS[state.support].color}" tabindex="0"><span>${SUPPORTS[state.support].icon}</span><small data-hud="support-label">${t("支援")}</small><div class="su-tooltip"><b>${t(SUPPORTS[state.support].name)}</b><p>${t(SUPPORTS[state.support].description)}</p></div></div>` : `<div class="su-slot su-slot-empty su-support-slot" title="${t("完成地图事件可获得独立支援")}">◇<small>${t("支援")}</small></div>`}`;
    }
    text('support-label',state.supportTrial && state.supportTrial>0 ? `${t("试用 ")}${Math.ceil(state.supportTrial)}s` : t('支援'));
    const boss = state.enemies.find(e => e.boss && e.hp>0);
    const bossNode = this.hudNode.querySelector<HTMLElement>('.su-boss')!;
    bossNode.hidden = !boss;
    if (boss) { text('boss-name',`${t("断电统御机 · ")}${bearing(boss.pos.x-state.player.x,boss.pos.z-state.player.z)} ${Math.round(Math.hypot(boss.pos.x-state.player.x,boss.pos.z-state.player.z))}m`); text('boss-hp', `${Math.ceil(pct(boss.hp,boss.maxHp))}%`);bar('boss-fill',pct(boss.hp,boss.maxHp)); }
    const active = state.events.find(e => e.state === 'active');
    const near = state.events.filter(e => e.state === 'available' && Math.abs(e.pos.y-state.player.y)<2.3).map(e => ({e,d:Math.hypot(e.pos.x-state.player.x,e.pos.z-state.player.z)})).sort((a,b) => a.d-b.d)[0];
    const prompt = this.hudNode.querySelector<HTMLElement>('[data-hud="event"]')!;
    if(active) prompt.innerHTML = `<span class="su-event-tag">${t("现场行动")}</span><b>${esc(active.title)}</b><p>${t(EVENT_HELP[active.kind])}</p><span>${active.kind==='convoy' ? t('护送距离 ') : active.kind==='cache' ? t('击破守卫 ') : t('附近击破 ')}${active.kind==='convoy' ? active.progress.toFixed(1) : number(active.progress)} / ${number(active.goal)}${active.kind==='convoy' ? 'm' : ''}${active.remaining > 0 ? ` · ${Math.ceil(active.remaining)}s` : ''}</span><div class="su-mini-track"><i style="width:${pct(active.progress,active.goal)}%"></i></div>`;
    else if(near && near.d < 12) prompt.innerHTML = `<span class="su-event-tag">${Math.round(near.d)}${t("m · 地图支援")}</span><b>${esc(near.e.title)}</b><p>${t(EVENT_HELP[near.e.kind])}</p><span>${near.d <= 6 ? `<kbd>E</kbd>${t(" 互动")}` : t('靠近设施以互动')} <i>${esc(SUPPORTS[near.e.reward].name)}</i></span>`;
    else prompt.innerHTML = '';
    const combo = this.hudNode.querySelector<HTMLElement>('[data-hud="combo"]')!;
    combo.hidden = state.combo < 10 || state.comboTime <= 0;
    if (!combo.hidden) combo.innerHTML = `<b>${state.combo}</b><span>${t("连击")}</span>`;
    text('note', t(state.notes) || (state.time < 15 ? t('移动即可自动攻击 · 拾取经验构筑能力') : ''));
  }

  private buildHUD(): void {
    this.hudNode.innerHTML = `<section class="su-status"><div class="su-status-title"><span class="su-mini-brand">O/</span><b>OINJA</b><span data-hud="shield"></span></div><div class="su-health-track"><i data-hud="hp-fill"></i><span data-hud="hp"></span></div><div class="su-xp-row"><span>LV.<b data-hud="level">1</b></span><div class="su-xp-track"><i data-hud="xp-fill"></i></div><small data-hud="revive"></small></div><div class="su-sync"><div><kbd>Q</kbd><span data-hud="sync-text"></span><b data-hud="sync-value"></b></div><div class="su-sync-track"><i data-hud="sync-fill"></i></div></div></section>
      <section class="su-run-meta"><div><span class="su-region" data-hud="region"></span><button data-act="map" aria-label="${t("打开地图")}"><kbd>Tab</kbd></button><button data-act="pause" aria-label="${t("暂停游戏")}">Ⅱ</button></div><strong data-hud="time">00:00</strong><span><b data-hud="kills">0</b>${t(" 击破")}</span></section>
      <div class="su-boss" hidden><div><span data-hud="boss-name"></span><b data-hud="boss-hp"></b></div><div class="su-boss-track"><i data-hud="boss-fill"></i></div></div>
      <div class="su-event" data-hud="event"></div><div class="su-combo" data-hud="combo" hidden></div>
      <div class="su-bottom-left"><div class="su-link-hud" hidden><span data-hud="synergy-count"></span><b data-hud="synergy-trigger" hidden></b></div><div class="su-loadout" data-hud="slots"></div><div class="su-hud-hints"><span><kbd>Space</kbd> <b data-hud="dash">${t("闪避")}</b></span><span><kbd>E</kbd>${t(" 互动")}</span><span>${t("能力自动发动")}</span></div></div><div class="su-run-note" data-hud="note"></div><div class="su-encounter-chip" data-hud="encounter" hidden></div>`;
    this.encounterNode=this.hudNode.querySelector<HTMLElement>('[data-hud="encounter"]')!;
    this.synergyNodes = {wrap:this.hudNode.querySelector<HTMLElement>('.su-link-hud')!,count:this.hudNode.querySelector<HTMLElement>('[data-hud="synergy-count"]')!,trigger:this.hudNode.querySelector<HTMLElement>('[data-hud="synergy-trigger"]')!};
  }

  choices(state: RunState): void {
    this.state = state; this.replacement = undefined;
    const reward = state.choiceSource === 'event';
    this.show('choices', `<section class="su-dialog su-choices-dialog" role="dialog" aria-modal="true" aria-labelledby="su-choice-title"><div class="su-dialog-kicker">${reward ? 'HARBOR SUPPORT' : 'CIRCUIT UPGRADE'} <span>${reward ? t('独立支援槽') : `LV.${state.level}`}</span></div><div class="su-dialog-heading"><div><p class="su-eyebrow">${reward ? t('这片城区，现在站在你这边。') : t('让这一次，变得不一样。')}</p><h2 id="su-choice-title">${reward ? t('接通强力支援') : t('接入新回路')}</h2></div><span class="su-pause-pill">${t("战斗已暂停")}</span></div><p class="su-dialog-intro">${reward ? (state.support ? `${t("选择一项支援，替换当前「")}${t(SUPPORTS[state.support].name)}${t("」。四个能力槽保持不变。")}` : t('选择一项支援。不占四个能力槽，自动加入战斗。')) : t('选择一项强化。能力会自动发动，把它们接成你自己的打法。')}</p><div class="su-choice-grid">${state.choices.map((c,i) => this.choiceCard(c,i)).join('')}</div><div class="su-choice-bottom"><div class="su-current-build"><span>${t("当前能力")}</span>${state.weapons.map((w,i) => this.slot(w,i,true)).join('')}</div><button class="su-secondary" data-act="reroll" ${state.rerolls <= 0 ? 'disabled' : ''}><kbd>R</kbd>${t(" 重抽 ")}<b>×${state.rerolls}</b></button></div><p class="su-dialog-footnote">${t("按 1–")}${state.choices.length}${t(" 选择")}${state.pendingLevels > 1 ? `${t(" · 还有 ")}${state.pendingLevels - 1}${t(" 次升级待选")}` : ''}</p></section>`);
  }

  private choiceCard(c: Choice, i: number): string {
    const icon = c.weapon ? WEAPONS[c.weapon].icon : c.support ? SUPPORTS[c.support].icon : c.mod ? MODS[c.mod]?.icon ?? '✦' : '+';
    const labels = {weapon:t('新能力'),rank:t('能力强化'),evolution:t('终极进化'),mod:t('回路改装'),support:t('地图支援'),heal:t('即时修复')};
    const links = c.mod ? MODS[c.mod]?.tags.filter(id => this.state?.weapons.some(w => w.id === id)) ?? [] : [];
    const full = c.type === 'weapon' && this.state!.weapons.length >= 4;
    return `<button class="su-choice-card ${c.type === 'evolution' ? 'is-evolution' : ''}" data-act="choose" data-id="${esc(c.id)}" style="--weapon:${esc(c.color)}"><span class="su-choice-type">${labels[c.type]} <kbd>${i+1}</kbd></span><span class="su-choice-icon" aria-hidden="true">${icon}</span><h3>${esc(c.title)}</h3><p>${esc(c.description)}</p><div class="su-choice-detail">${esc(c.detail)}</div>${links.length ? `<span class="su-choice-synergy">${t("适配：")}${links.map(id => t(WEAPONS[id].name)).join(' · ')}</span>` : ''}${this.choiceSynergies(c)}<span class="su-choice-select">${full ? t('选择要替换的能力') : c.type === 'evolution' ? t('完成进化') : t('接入回路')} <span>↗</span></span></button>`;
  }

  private updateSynergyHUD(state: RunState): void {
    const nodes=this.synergyNodes;if(!nodes)return;
    const key=state.weapons.map(w=>w.id).join('|')+':'+Number((state.mods.conductor??0)>0);
    if(key!==this.synergyBuild){
      this.synergyBuild=key;const links=activeSynergies(state);this.synergyCount=links.length;
      nodes.count.textContent=`${t("连携 · ")}${links.length}${t(" 条已接通")}`;
      nodes.wrap.title=links.map(link=>`${t(link.name)}：${t(link.description)}`).join('\n');
    }
    const reaction=state.lastReaction&&state.lastReaction.until>state.time?SYNERGIES[state.lastReaction.id]:undefined;
    const label=reaction?`${reaction.name}${t(" · 触发")}`:'';
    if(nodes.trigger.textContent!==label)nodes.trigger.textContent=label;
    if(nodes.trigger.hidden!==!label)nodes.trigger.hidden=!label;
    if(reaction&&this.synergyColor!==reaction.id){this.synergyColor=reaction.id;nodes.trigger.style.setProperty('--link-color',reaction.color);}
    const hidden=this.synergyCount===0&&!label;if(nodes.wrap.hidden!==hidden)nodes.wrap.hidden=hidden;
  }

  private choiceSynergies(choice: Choice): string {
    if(!this.state)return '';
    const preview=previewChoiceSynergies(this.state,choice);
    const added=preview.requiresReplacement
      ? [...new Map(this.state.weapons.flatMap((_,index)=>previewChoiceSynergies(this.state!,choice,index).added).map(link=>[link.id,link])).values()]
      : preview.added;
    if(!added.length)return preview.requiresReplacement ? `<span class="su-link-choice-note">${t("替换时可查看连携变化")}</span>` : '';
    return `<span class="su-choice-links"><span class="su-link-label">${preview.requiresReplacement?t('换入可点亮 · 需保留搭档'):t('接入后点亮')}</span>${added.map(link=>`<span class="su-choice-link" style="--link-color:${link.color}"><b>${esc(link.name)}</b><small>${esc(link.description)}</small></span>`).join('')}</span>`;
  }

  private replacementSynergies(choice: Choice, index: number): string {
    const change=previewChoiceSynergies(this.state!,choice,index);
    return `<span class="su-replace-links">${change.added.map(link=>`<span class="is-added">${t("＋ 点亮 ")}${esc(link.name)}</span>`).join('')}${change.lost.map(link=>`<span class="is-lost">${t("− 断开 ")}${esc(link.name)}</span>`).join('')}${!change.added.length&&!change.lost.length?`<span class="is-kept">${change.active.length?t('现有连携全部保留'):t('尚未形成连携')}</span>`:''}</span>`;
  }

  private synergyPanel(state: RunState, historical=false): string {
    const active=activeSynergies(state),activeIds=new Set(active.map(link=>link.id));
    const links=historical?Object.values(SYNERGIES).filter(link=>(state.stats.synergyTriggers?.[link.id]??0)>0):active;
    if(!links.length)return historical?'':`<p class="su-link-empty">${t("组合能力可以点亮自动连携。升级卡会预告新效果。")}</p>`;
    return `<details class="su-link-details" open><summary>${historical?t('本局连携表现'):t('已接通连携')}<span>${t('共 {count} 条',{count:links.length})} <i>⌄</i></span></summary><div>${links.map(link=>{const count=state.stats.synergyTriggers?.[link.id]??0,damage=state.stats.synergyDamage?.[link.id]??0;return `<article class="su-link-detail" style="--link-color:${link.color}"><header><b>${esc(link.name)}</b><span>${count?t('触发 {count} 次',{count:number(count)}):t('尚未触发')}${historical&&!activeIds.has(link.id)?t(' · 已换出'):''}</span></header><small>${esc(link.components)}</small>${historical?`<p class="su-link-damage">${number(damage)}${t(" 联动伤害")}</p>`:`<p>${esc(link.description)}</p><em>${number(damage)}${t(" 累计联动伤害")}</em>`}</article>`;}).join('')}</div>${historical?`<p class="su-link-accounting">${t("联动伤害已计入上方能力伤害，不重复相加。")}</p>`:''}</details>`;
  }

  private selectChoice(id: string): void {
    const c = this.state?.choices.find(v => v.id === id); if (!c) return;
    if(c.type === 'weapon' && c.weapon && this.state!.weapons.length >= 4 && !this.state!.weapons.some(w => w.id === c.weapon)) {
      this.replacement = c;
      this.show('choices', `<section class="su-dialog su-replace-dialog" role="dialog" aria-modal="true" aria-labelledby="su-replace-title"><div class="su-dialog-kicker">${t("REWIRE / 替换能力")}</div><h2 id="su-replace-title">${t("给「")}${esc(c.title)}${t("」腾个位置")}</h2><p class="su-dialog-intro">${t("选择一个能力槽。原有升级投入会保留到新能力，独立支援不占这四格。")}</p><div class="su-replace-grid">${this.state!.weapons.map((w,i) => `<button class="su-replace-card" data-act="replace" data-id="${i}" style="--weapon:${WEAPONS[w.id].color}"><kbd>${i+1}</kbd><span class="su-choice-icon">${WEAPONS[w.id].icon}</span><h3>${weaponName(w)}</h3><p>${t("等级 ")}${w.level}${w.evolution ? t(' · 已进化') : ''}</p>${this.replacementSynergies(c,i)}<span>${t("替换此能力 ↗")}</span></button>`).join('')}</div><button class="su-text-btn" data-act="back-choices">${t("← 返回强化选择 ")}<kbd>Esc</kbd></button></section>`);
    } else this.callbacks.choose(id);
  }

  pause(state: RunState): void {
    this.state = state;
    this.show('pause', `<section class="su-dialog su-pause-dialog" role="dialog" aria-modal="true" aria-labelledby="su-pause-title"><div class="su-dialog-kicker">TAKE A BREATH <span>${clock(state.time)}</span></div><h2 id="su-pause-title">${t("回路暂缓")}</h2><div class="su-pause-layout"><div class="su-pause-actions"><button class="su-primary" data-act="resume">${t("继续行动 ")}<span>↗</span></button><button class="su-secondary" data-act="settings">${t("游戏设置 ")}<span>↗</span></button><button class="su-secondary" data-act="guide">${t("能力与操作 ")}<span>↗</span></button><button class="su-text-btn" data-act="menu">${t("保存并返回主菜单")}</button><span class="su-small-note">${t("当前行动会保存在这台浏览器。")}</span></div><div class="su-build-summary"><h3>${t("这一局的回路 ")}<span>LV.${state.level}</span></h3>${this.buildList(state)}<div class="su-mod-chips">${Object.entries(state.mods).filter(([,n]) => n>0).map(([id,n]) => `<span title="${esc(MODS[id]?.description)}">${esc(MODS[id]?.name ?? id)}${n>1 ? ` ×${n}` : ''}</span>`).join('') || `<span>${t("还没有接入改装")}</span>`}</div>${this.synergyPanel(state)}</div></div>${this.encounterDetails(state)}${controls()}<div class="su-pause-extras">${this.localeButtons()}${this.universeLink()}</div></section>`);
  }

  result(state: RunState, unlocked: string[]): void {
    this.state = state; this.resultUnlocks = [...unlocked];
    const won = state.phase === 'won';
    const entries = Object.entries(state.stats.weaponDamage).sort((a,b) => (b[1]??0)-(a[1]??0));
    const max = Math.max(1,...entries.map(([,n]) => n??0));
    this.show('result', `<section class="su-dialog su-result-dialog ${won ? 'is-win' : ''}" role="dialog" aria-modal="true" aria-labelledby="su-result-title"><div class="su-dialog-kicker">${won ? 'CIRCUIT COMPLETE' : 'SIGNAL LOST'} <span>${esc(MAPS.find(m => m.id === state.mapId)?.name ?? MAPS[0].name)} / ${state.danger ? `${t("危险 ")}${state.danger}` : t('标准')}</span></div><div class="su-result-heading"><div><p class="su-eyebrow">${won ? t('这片街区，又亮了一次。') : t('带着这一局的灵感，再来。')}</p><h2 id="su-result-title">${won ? t('电涌，未完待续。') : t('回路暂时中断。')}</h2></div><span class="su-result-symbol">${won ? '↗' : '／'}</span></div><div class="su-result-stats"><div><span>${t("行动时间")}</span><b>${clock(state.time)}</b></div><div><span>${t("击破敌机")}</span><b>${number(state.kills)}</b></div><div><span>${t("回路等级")}</span><b>${state.level}</b></div><div><span>${t("地图事件")}</span><b>${state.stats.events}</b></div><div><span>${t("同调爆发")}</span><b>${state.stats.syncs}</b></div></div><div class="su-result-columns"><div><h3>${t("火力来自哪里 ")}<span>DAMAGE</span></h3><div class="su-damage-list">${entries.map(([id,n]) => {const meta=id==='support' ? {name:t('地图支援合计'),color:state.support ? SUPPORTS[state.support].color : '#83ead2',icon:'◇'} : WEAPONS[id as WeaponId];return `<div class="su-damage-row" style="--weapon:${meta?.color ?? '#ffac72'}"><div><span>${meta?.icon ?? '✦'} ${esc(meta?.name ?? id)}</span><b>${number(n??0)}</b></div><div class="su-damage-track"><i style="width:${pct(n??0,max)}%"></i></div></div>`;}).join('') || `<p class="su-small-note">${t("这一局还没有造成伤害。")}</p>`}</div>${this.synergyPanel(state,true)}</div><div><h3>${t("最终构筑 ")}<span>BUILD</span></h3>${this.buildList(state)}${unlocked.length ? `<div class="su-unlock-announcement"><span>${t("新档案解锁")}</span>${unlocked.map(id => `<b>${esc(UNLOCKS.find(u => u.id===id)?.name ?? id)}</b>`).join('')}<p>${t("下次行动，可选择新的开局方案。")}</p></div>` : ''}</div></div><div class="su-result-actions"><button class="su-primary" data-act="restart">${t("再来一局 ")}<span>↗</span></button><button class="su-secondary" data-act="menu">${t("换个构筑 · 返回主菜单")}</button>${this.universeLink()}</div></section>`);
  }

  map(state: RunState, world: MapWorld): void {
    this.state = state; this.world = world;
    const b = world.bounds, width = Math.max(1,b.maxX-b.minX), depth = Math.max(1,b.maxZ-b.minZ);
    const sx = (x: number): number => 30+(x-b.minX)/width*640;
    const sz = (z: number): number => 30+(z-b.minZ)/depth*500;
    const points = new Map(world.nav.waypoints.map(p => [p.id,p]));
    const shortcuts = world.nav.edges.filter(e => e.shortcut || !e.enabled).map(e => {const from=points.get(e.from),to=points.get(e.to);return from&&to ? `<line x1="${sx(from.position[0])}" y1="${sz(from.position[2])}" x2="${sx(to.position[0])}" y2="${sz(to.position[2])}" class="su-map-route ${e.enabled ? '' : 'is-closed'}"/>` : '';}).join('');
    const routes = state.events.filter(e => e.state!=='complete').map(e => {const path=world.findPath([state.player.x,state.player.y,state.player.z],[e.pos.x,e.pos.y,e.pos.z]);return path.length ? `<polyline points="${[[state.player.x,state.player.y,state.player.z],...path].map(p => `${sx(p[0])},${sz(p[2])}`).join(' ')}" class="su-map-route ${Math.abs(e.pos.y-state.player.y)>2.3?'is-elevated':''}"/>` : '';}).join('');
    const structures = world.colliders.filter(c => c.tag==='solid' && c.enabled!==false && c.half[1] > .8).map(c => `<rect x="${sx(c.center[0]-c.half[0])}" y="${sz(c.center[2]-c.half[2])}" width="${c.half[0]*2/width*640}" height="${c.half[2]*2/depth*500}" rx="1" class="su-map-building"/>`).join('');
    const zones = world.zones.map(z => `<g class="su-map-zone"><circle cx="${sx(z.center[0])}" cy="${sz(z.center[2])}" r="${Math.max(14,z.radius/width*640)}"/><text x="${sx(z.center[0])}" y="${sz(z.center[2])-16}">${esc(z.name)}</text></g>`).join('');
    const events = state.events.map((e,i) => `<g class="su-map-event ${e.state}"><title>${esc(e.title)}：${e.state==='complete'?t('已完成'):e.state==='active'?t('进行中'):t('可互动')}</title><circle cx="${sx(e.pos.x)}" cy="${sz(e.pos.z)}" r="11"/><text x="${sx(e.pos.x)}" y="${sz(e.pos.z)+4}">${e.state==='complete' ? '✓' : i+1}</text></g>`).join('');
    const boss=state.enemies.find(e => e.boss && e.hp>0);
    const bossMarker=boss ? `<g class="su-map-boss" transform="translate(${sx(boss.pos.x)} ${sz(boss.pos.z)})"><title>${t("断电统御机：")}${bearing(boss.pos.x-state.player.x,boss.pos.z-state.player.z)}，${Math.round(Math.hypot(boss.pos.x-state.player.x,boss.pos.z-state.player.z))}${t("米")}</title><circle r="21"/><path d="M0 -13 L13 0 L0 13 L-13 0Z"/><text y="4" class="su-map-boss-glyph">!</text><text y="-28" class="su-map-boss-label">${t("断电统御机")}</text></g>` : '';
    this.show('map', `<section class="su-dialog su-map-dialog" role="dialog" aria-modal="true" aria-labelledby="su-map-title"><div class="su-dialog-heading"><div><p class="su-eyebrow">${esc(MAPS.find(m => m.id === world.id)?.name ?? MAPS[0].name)} / ${t('行动地图')}</p><h2 id="su-map-title">${t("在街区之间，找个新解法。")}</h2></div><button class="su-icon-btn" data-act="resume" aria-label="${t("关闭地图")}">×</button></div><div class="su-map-layout"><div class="su-map-canvas"><svg viewBox="0 0 700 560" role="img" aria-label="${t("行动地图，含可用路径、事件位置与玩家位置")}"><rect x="14" y="14" width="672" height="532" rx="3" class="su-map-border"/>${structures}${zones}${routes}${shortcuts}${events}${this.encounterMap(state,sx,sz)}${bossMarker}<text x="662" y="44" class="su-map-north">N ↑</text><g transform="translate(${sx(state.player.x)} ${sz(state.player.z)}) rotate(${-state.yaw*180/Math.PI})"><circle r="15" class="su-map-player-ring"/><path d="M0 -11 L7 8 L0 4 L-7 8Z" class="su-map-player"/></g></svg><div class="su-map-legend"><span><i class="player"></i>${t("你的位置")}</span><span><i class="event"></i>${t("可接入事件")}</span><span><i class="complete"></i>${t("已完成")}</span><span><i class="route"></i>${t("事件通路")}</span>${boss ? `<span><i class="boss"></i>${t("首领")}</span>` : ''}</div></div><div class="su-map-events">${this.encounterDetails(state)}<p class="su-small-note">${t("靠近现场后按 ")}<kbd>E</kbd>${t(" 互动。完成事件可获得独立支援。")}</p>${state.events.map((e,i) => `<div class="su-map-event-card ${e.state}"><span>${e.state==='complete'?'✓':i+1}</span><div><b>${esc(e.title)}</b><small>${t(EVENT_HELP[e.kind])}</small><em>${e.state==='complete'?t('已完成'):e.state==='active'?t('进行中'):t('支援：')+t(SUPPORTS[e.reward].name)}</em></div></div>`).join('')}</div></div><div class="su-dialog-footer"><span class="su-small-note">${t("查看地图时战斗暂停")}</span><button class="su-secondary" data-act="resume"><kbd>Tab</kbd>${t(" 返回战场")}</button></div></section>`);
  }

  settings(profile: Profile): void {
    if(this.view !== 'settings') this.returnView = this.view;
    this.profile = structuredClone(profile); this.applyPreferences();
    this.renderSettings();
  }

  private renderSettings(): void {
    const s = this.profile.settings;
    this.show('settings', `<section class="su-dialog su-settings-dialog" role="dialog" aria-modal="true" aria-labelledby="su-settings-title"><div class="su-dialog-kicker">MAKE IT YOURS</div><div class="su-dialog-heading"><h2 id="su-settings-title">${t("调到顺手。")}</h2><button class="su-icon-btn" data-act="back" aria-label="${t("关闭设置")}">×</button></div><div class="su-settings-list"><label class="su-setting"><span><b>${t('语言')}</b><small>${t('界面与游戏内容')}</small></span><select data-locale aria-label="${t('语言')}"><option value="zh-CN" ${getLocale()==='zh-CN'?'selected':''}>简体中文</option><option value="en" ${getLocale()==='en'?'selected':''}>English</option></select></label><label class="su-setting"><span><b>${t("声音")}</b><small>${t("游戏整体音量")}</small></span><div><input type="range" min="0" max="1" step="0.05" value="${s.volume}" data-setting="volume" aria-label="${t("游戏整体音量")}"/><output data-output="volume">${Math.round(s.volume*100)}%</output></div></label><label class="su-setting"><span><b>${t("画面质量")}</b><small>${t("低画质适合希望更流畅的设备")}</small></span><select data-setting="quality" aria-label="${t("画面质量")}">${(['low','medium','high'] as const).map((q,i) => `<option value="${q}" ${s.quality===q?'selected':''}>${[t('流畅'),t('均衡'),t('精细')][i]}</option>`).join('')}</select></label><label class="su-setting"><span><b>${t("镜头距离")}</b><small>${t("拉远看清敌潮，拉近看清角色")}</small></span><div><input type="range" min="22" max="30" step="1" value="${s.cameraDistance}" data-setting="cameraDistance" aria-label="${t("镜头距离")}"/><output data-output="cameraDistance">${Math.round(s.cameraDistance)}m</output></div></label>${([['shake',t('镜头震动'),t('打击与爆发的镜头反馈')],['damageNumbers',t('伤害数字'),t('显示每次攻击的伤害')],['reducedMotion',t('减少动态效果'),t('减弱界面动画，保留必要战斗提示')]] as const).map(([id,name,desc]) => `<label class="su-setting"><span><b>${t(name)}</b><small>${t(desc)}</small></span><input class="su-switch" type="checkbox" data-setting="${id}" ${s[id]?'checked':''} aria-label="${t(name)}"/></label>`).join('')}</div><div class="su-dialog-footer"><span class="su-small-note">${t("更改会立即应用并保存。")}</span><button class="su-primary" data-act="back">${t("完成 ")}<span>↗</span></button></div></section>`);
  }

  toast(text: string): void {
    if(!text) return;
    const item = document.createElement('div'); item.className='su-toast';item.dataset.source=text;item.textContent=t(text);
    this.toastNode.append(item); while(this.toastNode.children.length>3)this.toastNode.firstElementChild?.remove();
    const timer = setTimeout(() => {item.remove();this.toastTimers.delete(timer);},4200);this.toastTimers.add(timer);
  }

  handleKey(e: KeyboardEvent): boolean {
    if(e.type !== 'keydown') return this.view !== 'game';
    const target=e.target as HTMLElement|null;
    if(e.code==='Tab' && this.view !== 'game' && this.view !== 'map') {
      const focusable = [...this.overlay.querySelectorAll<HTMLElement>('button:not([disabled]),input,select,summary,a[href]')].filter(el => el.offsetParent!==null);
      const first=focusable[0],last=focusable[focusable.length-1];
      if(first && ((!e.shiftKey && document.activeElement===last)||(e.shiftKey && document.activeElement===first))) {e.preventDefault();(e.shiftKey?last:first).focus();}
      return true;
    }
    if(this.view==='settings' && target?.matches('input,select') && e.code!=='Escape') return true;
    if(e.repeat && ['Escape','Tab','KeyR','Digit1','Digit2','Digit3','Digit4'].includes(e.code)) return true;
    if(this.view==='game') {
      if(e.code==='Escape'){e.preventDefault();this.callbacks.pause();return true;}
      if(e.code==='Tab'){e.preventDefault();this.callbacks.map();return true;}
      return false;
    }
    if(e.code==='Escape'||(e.code==='Tab'&&this.view==='map')) {
      e.preventDefault();
      if(this.view==='pause'||this.view==='map')this.callbacks.resume();
      else if(this.view==='settings'||this.view==='guide')this.back();
      else if(this.view==='choices'&&this.replacement)this.choices(this.state!);
      return true;
    }
    if(this.view==='choices') {
      const n=Number(e.code.replace('Digit',''))-1;
      if(/^Digit[1-4]$/.test(e.code)) {e.preventDefault();if(this.replacement && n<this.state!.weapons.length)this.callbacks.choose(this.replacement.id,n);else if(!this.replacement && this.state!.choices[n])this.selectChoice(this.state!.choices[n].id);}
      if(e.code==='KeyR'&&!this.replacement&&this.state!.rerolls>0){e.preventDefault();this.callbacks.reroll();}
    }
    return true;
  }

  destroy(): void {
    this.shell.removeEventListener('click',this.clickHandler);this.shell.removeEventListener('input',this.changeHandler);this.shell.removeEventListener('change',this.changeHandler);
    this.toastTimers.forEach(clearTimeout);this.toastTimers.clear();cancelAnimationFrame(this.focusFrame);this.shell.remove();
  }

  private onClick(e: Event): void {
    const button=(e.target as HTMLElement).closest<HTMLElement>('[data-act]');if(!button||!this.shell.contains(button)||button.hasAttribute('disabled'))return;
    e.preventDefault(); const id=button.dataset.id ?? '';
    switch(button.dataset.act){
      case 'locale':this.changeLocale(id as Locale);this.overlay.querySelector<HTMLElement>(`[data-act="locale"][data-id="${id}"]`)?.focus();break;
      case 'location':if(MAPS.some(m=>m.id===id)){this.selectedMap=id as SurgeMapId;this.renderMenu(false);this.overlay.querySelector<HTMLElement>(`[data-act="location"][data-id="${id}"]`)?.focus();}break;
      case 'weapon':this.selectedWeapon=id as WeaponId;this.renderMenu(false);this.overlay.querySelector<HTMLElement>(`[data-act="weapon"][data-id="${id}"]`)?.focus();break;
      case 'danger':this.danger=Number(id);this.renderMenu(false);this.overlay.querySelector<HTMLElement>(`[data-act="danger"][data-id="${id}"]`)?.focus();break;
      case 'kit':this.kit=id;this.renderMenu(false);this.overlay.querySelector('details')?.setAttribute('open','');this.overlay.querySelector<HTMLElement>(`[data-act="kit"][data-id="${id}"]`)?.focus();break;
      case 'start':this.callbacks.start(this.selectedWeapon,this.danger,this.kit,this.selectedMap);break;
      case 'continue':this.callbacks.continue();break;
      case 'resume':this.callbacks.resume();break;
      case 'restart':this.callbacks.restart();break;
      case 'menu':this.callbacks.menu();break;
      case 'pause':this.callbacks.pause();break;
      case 'map':this.callbacks.map();break;
      case 'settings':this.settings(this.profile);break;
      case 'choose':this.selectChoice(id);break;
      case 'replace':if(this.replacement)this.callbacks.choose(this.replacement.id,Number(id));break;
      case 'back-choices':this.choices(this.state!);break;
      case 'reroll':if(this.state && this.state.rerolls>0)this.callbacks.reroll();break;
      case 'back':this.back();break;
      case 'guide':this.openGuide(false);break;
      case 'archive':this.openGuide(true);break;
    }
  }

  private onSetting(e: Event): void {
    const input=e.target as HTMLInputElement|HTMLSelectElement;if(input.hasAttribute('data-locale')){if(e.type==='change'){this.changeLocale(input.value as Locale);this.overlay.querySelector<HTMLElement>('[data-locale]')?.focus();}return;}const key=input.dataset.setting as keyof Settings|undefined;if(!key)return;
    if(e.type==='change' && input instanceof HTMLInputElement && input.type==='range') return;
    if(e.type==='input' && (input instanceof HTMLSelectElement || input.type==='checkbox'))return;
    const value=input instanceof HTMLInputElement&&input.type==='checkbox'?input.checked:input instanceof HTMLSelectElement?input.value:Number(input.value);
    this.profile.settings={...this.profile.settings,[key]:value};this.applyPreferences();this.callbacks.settings({...this.profile.settings});
    const output=this.overlay.querySelector(`[data-output="${key}"]`);if(output)output.textContent=key==='volume'?`${Math.round(Number(value)*100)}%`:`${Math.round(Number(value))}m`;
  }

  private universeLink(): string {
    return `<a class="su-universe" href="https://oinja-website.vercel.app" target="_blank" rel="noopener noreferrer">${t('Oinja 宇宙')} <span aria-hidden="true">↗</span></a>`;
  }

  private localeButtons(): string {
    return `<div class="su-locale" role="group" aria-label="${t('语言')}"><button data-act="locale" data-id="zh-CN" aria-pressed="${getLocale()==='zh-CN'}">中文</button><span>/</span><button data-act="locale" data-id="en" aria-pressed="${getLocale()==='en'}">EN</button></div>`;
  }

  private changeLocale(locale: Locale): void {
    if(locale!=='zh-CN'&&locale!=='en'||locale===getLocale())return;
    const current=this.view, replacement=this.replacement;
    setLocale(locale);this.applyPreferences();
    this.hudSignature='';this.synergyBuild='';this.synergyColor='';this.encounterSignature='';
    this.hudNode.replaceChildren();this.synergyNodes=undefined;this.encounterNode=undefined;
    if(this.state)this.hud(this.state,this.region);
    for(const node of this.toastNode.querySelectorAll<HTMLElement>('[data-source]'))node.textContent=t(node.dataset.source!);
    if(current==='menu')this.renderMenu();
    else if(current==='settings')this.renderSettings();
    else if(current==='pause'&&this.state)this.pause(this.state);
    else if(current==='choices'&&this.state){this.choices(this.state);if(replacement)this.selectChoice(replacement.id);}
    else if(current==='result'&&this.state)this.result(this.state,this.resultUnlocks);
    else if(current==='map'&&this.state&&this.world)this.map(this.state,this.world);
    else if(current==='guide')this.openGuide(this.guideArchive);
    else if(current==='loading')this.loading(this.loadingState.progress,this.loadingState.label);
    else this.game();
  }

  private encounterTarget(state: RunState) {
    const event=state.encounter;if(!event)return undefined;
    if(event.kind==='battery-run'&&event.state==='active')return event.route?.[Math.floor(event.progress)]??event.pos;
    if(event.kind==='echo-hunt'&&event.state==='active')return state.enemies.find(enemy=>enemy.hp>0&&event.targetIds?.includes(enemy.id))?.pos??event.pos;
    return event.pos;
  }

  private updateEncounterHUD(state: RunState): void {
    const node=this.encounterNode;if(!node)return;
    const event=state.encounter,buff=state.encounterBuff&&state.encounterBuff.until>state.time?state.encounterBuff:undefined;
    if(!event&&!buff){if(!node.hidden)node.hidden=true;this.encounterSignature='';return;}
    const target=this.encounterTarget(state),distance=target?Math.round(Math.hypot(target.x-state.player.x,target.z-state.player.z)):0;
    const direction=target?bearing(target.x-state.player.x,target.z-state.player.z):'';
    const remaining=event?Math.max(0,Math.ceil(event.expiresAt-state.time)):0;
    const canOffer=event?.state==='offered'&&Math.hypot(event.pos.x-state.player.x,event.pos.z-state.player.z)<=5&&Math.abs(event.pos.y-state.player.y)<2;
    const progress=event?Math.floor(event.progress):0;
    const streak=event?.kind==='storm-hunt'&&event.state==='active'?Math.max(0,Math.ceil((event.streakUntil??state.time)-state.time)):0;
    const sig=[getLocale(),event?.id,event?.state,progress,remaining,distance,direction,canOffer,streak,buff?.kind,buff?Math.ceil(buff.until-state.time):0].join('|');
    if(sig===this.encounterSignature)return;this.encounterSignature=sig;node.hidden=false;
    const def=event?ENCOUNTERS[event.kind]:undefined;
    node.style.setProperty('--encounter-color',def?`#${def.color.toString(16).padStart(6,'0')}`:'#89e7d6');
    const status=event?.state==='announced'?t('信号接通中'):event?.state==='offered'?t('可选事件'):event?.state==='active'?`${progress} / ${event.goal}${event.kind==='overload'?'s':''}`:event?.state==='complete'?t('事件完成'):event?.state==='failed'?t('事件未完成'):t('信号消散');
    node.innerHTML=`${event?`<div><b>${esc(def!.name)}</b><span>${status} · ${remaining}s</span></div>${['announced','offered','active'].includes(event.state)?`<p><span>${direction} ${distance}m${event.state==='active'&&event.kind==='storm-hunt'?` · ${t('连杀窗口')} ${streak}s`:''}</span><span>${canOffer?`<kbd>E</kbd> ${t('接取')}`:event.state==='active'&&event.kind==='battery-run'?t('前往下一枚电池'):event.state==='offered'?t('靠近后接取'):''}</span></p>`:''}${canOffer?`<p class="su-encounter-offer">${esc(ENCOUNTER_BRIEF[event.kind])}</p>`:''}`:''}${buff?`<small title="${esc(ENCOUNTER_BUFFS[buff.kind].description)}">${esc(ENCOUNTER_BUFFS[buff.kind].name)} · ${Math.ceil(buff.until-state.time)}s</small>`:''}`;
  }

  private encounterDetails(state: RunState): string {
    const event=state.encounter;if(!event)return '';
    const def=ENCOUNTERS[event.kind];
    return `<section class="su-encounter-detail" style="--encounter-color:#${def.color.toString(16).padStart(6,'0')}"><div><span>${t('可选临时事件')}</span><b>${Math.max(0,Math.ceil(event.expiresAt-state.time))}s</b></div><h3>${esc(def.name)}</h3><p>${esc(def.description)}</p><small>${esc(def.objective)} · ${Math.floor(event.progress)} / ${event.goal}</small><p class="su-encounter-reward">${t('奖励：')}${esc(def.reward)}</p></section>`;
  }

  private encounterMap(state: RunState,sx:(n:number)=>number,sz:(n:number)=>number): string {
    const event=state.encounter;if(!event||!['announced','offered','active'].includes(event.state))return '';
    const target=this.encounterTarget(state)!,def=ENCOUNTERS[event.kind],color=`#${def.color.toString(16).padStart(6,'0')}`;
    const route=event.kind==='battery-run'&&event.route?event.route.map((p,i)=>`<g class="su-map-battery ${i<event.progress?'is-collected':''}"><circle cx="${sx(p.x)}" cy="${sz(p.z)}" r="7"/><text x="${sx(p.x)}" y="${sz(p.z)+3}">${i+1}</text></g>`).join(''):'';
    return `<g class="su-map-encounter" style="--encounter-color:${color}">${event.route?`<polyline class="su-map-battery-route" points="${event.route.map(p=>`${sx(p.x)},${sz(p.z)}`).join(' ')}"/>`:''}${route}<g transform="translate(${sx(target.x)} ${sz(target.z)})"><title>${esc(def.name)} · ${esc(def.objective)}</title><circle r="19"/><path d="M0 -11 L10 7 L-10 7Z"/><text y="-26">${esc(def.name)}</text></g></g>`;
  }

  private applyPreferences(): void {this.shell.classList.toggle('reduce-motion',this.profile.settings.reducedMotion);this.shell.classList.toggle('locale-en',getLocale()==='en');}

  private back(): void {
    const view=this.returnView;
    if(view==='pause'&&this.state)this.pause(this.state);
    else if(view==='map'&&this.state&&this.world)this.map(this.state,this.world);
    else if(view==='game'){this.callbacks.resume();}
    else this.renderMenu();
  }

  private openGuide(archive: boolean): void {
    if(this.view!=='guide')this.returnView=this.view;this.guideArchive=archive;
    this.show('guide', `<section class="su-dialog su-guide-dialog" role="dialog" aria-modal="true" aria-labelledby="su-guide-title"><div class="su-dialog-heading"><div><p class="su-eyebrow">${archive?'FIELD ARCHIVE':'HOW TO SURGE'}</p><h2 id="su-guide-title">${archive?t('每次行动，都留下点什么。'):t('你负责走位，回路负责清场。')}</h2></div><button class="su-icon-btn" data-act="back" aria-label="${t("返回")}">×</button></div>${archive ? `<div class="su-archive-stats"><span><b>${this.profile.runs}</b>${t(" 次行动")}</span><span><b>${this.profile.wins}</b>${t(" 次突破")}</span><span><b>${number(this.profile.bestKills)}</b>${t(" 最高击破")}</span></div><div class="su-unlock-grid">${UNLOCKS.map(u => `<article class="su-unlock-card ${this.profile.unlocks.includes(u.id)?'is-unlocked':''}"><span>${this.profile.unlocks.includes(u.id)?t('已解锁 / ✓'):t('等待接通 / ○')}</span><h3>${esc(u.name)}</h3><p>${esc(u.description)}</p></article>`).join('')}</div><p class="su-small-note">${t("八种基础能力从第一局全部开放。开局方案提供不同取舍，不增加永久数值。")}</p>` : `${controls()}<p class="su-guide-intro">${t("拾取经验，升级时三选一。四个能力槽之外，还有一个地图支援槽。靠近现场按 E，完成事件，让这片城区成为你的帮手。")}</p><p class="su-guide-links-intro">${t("把搭档一起接入，就会自动点亮连携。选卡会预告新增效果；替换能力时，记得保留搭档。")}</p><div class="su-combo-grid">${Object.values(SYNERGIES).map(link => `<article><span>${t(link.name)}</span><h3>${t(link.components)}</h3><p>${t(link.description)}</p></article>`).join('')}</div><div class="su-guide-bottom"><b>${t("同调怎么用？")}</b><p>${t("攻击积累同调，能量充满后按 Q 进入爆发。先把敌人聚在一起，再把整条回路点亮。")}</p></div>`}<div class="su-dialog-footer"><span class="su-small-note">${t("键盘与鼠标 · 本地保存进度")}</span><button class="su-primary" data-act="back">${archive?t('返回'):t('明白了')} <span>↗</span></button></div></section>`);
  }

  private buildList(state: RunState): string {
    return `<div class="su-build-list">${state.weapons.map(w => `<div><span style="color:${WEAPONS[w.id].color}">${WEAPONS[w.id].icon}</span><b>${esc(weaponName(w))}</b><small>${w.evolution?t('进化'):`Lv.${w.level}`}</small></div>`).join('')}${state.support ? `<div class="su-build-support"><span style="color:${SUPPORTS[state.support].color}">${SUPPORTS[state.support].icon}</span><b>${t(SUPPORTS[state.support].name)}</b><small>${t("独立支援")}</small></div>` : ''}</div>`;
  }

  private slot(w: WeaponSlot, i: number, tooltip: boolean): string {
    const meta=WEAPONS[w.id];
    return `<div class="su-slot ${w.evolution?'is-evolved':''}" style="--weapon:${meta.color}" tabindex="0"><span>${meta.icon}</span><small>${w.evolution?'◆':w.level}</small>${tooltip ? `<div class="su-tooltip"><b>${esc(weaponName(w))}</b><p>${esc(w.evolution?meta.evoDescriptions[w.evolution==='a'?0:1]:meta.description)}</p><em>${t("能力槽 ")}${i+1}${t(" · 自动发动")}</em></div>` : ''}</div>`;
  }

  private show(view: View, html: string, focus = true): void {
    this.lastFocus=document.activeElement instanceof HTMLElement?document.activeElement:undefined;
    if(['choices','pause','map','result'].includes(view)){this.toastNode.replaceChildren();this.toastTimers.forEach(clearTimeout);this.toastTimers.clear();}
    this.view=view;this.overlay.hidden=false;this.overlay.className=`su-overlay su-view-${view}`;this.overlay.innerHTML=html;
    this.hudNode.hidden=view==='menu'||view==='loading'||view==='result'||((view==='settings'||view==='guide')&&this.returnView==='menu');this.shell.classList.add('has-overlay');
    cancelAnimationFrame(this.focusFrame);
    if(focus)this.focusFrame=requestAnimationFrame(() => {const el=this.overlay.querySelector<HTMLElement>('button:not([disabled]),[tabindex="0"]');el?.focus({preventScroll:true});});
  }
}
