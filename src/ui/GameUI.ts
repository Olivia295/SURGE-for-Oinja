import type {
  GameSettings, HUDState, LoadingState, MapId, MapState, MenuOptions,
  ResultState, RunSelection, SkillId, ToastTone, UICallbacks, UpgradeState,
} from './types';
export * from './types';

type View = 'menu' | 'loading' | 'game' | 'upgrades' | 'pause' | 'result' | 'map';
type Dialog = 'settings' | 'help' | 'bestiary' | null;

const PATHS: Record<string, string> = {
  grapple: '<path d="M8 26 21 13m-7-4 7 4 3 7M14 9l6-5 7 1 1 7-4 8M5 23l4 4M4 28l3-3"/>',
  shield: '<path d="m16 3 11 5v9c0 7-11 12-11 12S5 24 5 17V8Z"/><path d="m16 9 4 7-4 7-4-7Z"/>',
  cannon: '<path d="m5 13 17-6 5 4-1 9-18 3Z"/><path d="m22 7-1 11 5 2M11 12l2 9M5 16l-3 1m7 6-2 6m9-8 1 6"/>',
  lightning: '<path d="m19 2-4 11h9L10 30l4-13H6Z"/>',
  mist: '<path d="M5 21h22M3 26h20M9 16h19M6 15a6 6 0 0 1 3-11 7 7 0 0 1 13 3 5 5 0 0 1 6 5"/><path d="m16 10-3 8h5l-3 8"/>',
  barrier: '<path d="M3 25C3 12 9 4 16 4s13 8 13 21M2 26h28M16 4v22M5 15h22M9 26C9 13 11 6 16 4c5 2 7 9 7 22"/>',
  heart: '<path d="M16 27 4 15C-2 7 8-1 16 8 24-1 34 7 28 15Z"/>',
  energy: '<path d="m18 3-9 15h8l-3 11 10-16h-8Z"/>',
  pause: '<path d="M11 7v18M21 7v18"/>',
  play: '<path d="m11 6 16 10-16 10Z"/>',
  arrow: '<path d="M4 16h23M19 8l8 8-8 8"/>',
  close: '<path d="m8 8 16 16M24 8 8 24"/>',
  check: '<path d="m6 16 7 7L27 8"/>',
  map: '<path d="m3 8 9-4 8 4 9-4v21l-9 4-8-4-9 4Zm9-4v21M20 8v21"/>',
  settings: '<path d="M5 8h22M5 16h22M5 24h22M11 4v8M22 12v8M14 20v8"/>',
  help: '<path d="M11 10a5 5 0 1 1 9 3c-3 2-4 3-4 6M16 24v1"/><circle cx="16" cy="16" r="14"/>',
  book: '<path d="M16 8C12 5 7 4 3 6v21c4-2 9-1 13 2 4-3 9-4 13-2V6c-4-2-9-1-13 2Zm0 0v21M7 11l5 1m-5 5 5 1m8-6 5-1m-5 7 5-1"/>',
  reset: '<path d="M6 11a12 12 0 1 1-1 12M6 3v8h8"/>',
  star: '<path d="m16 3 4 8 9 1-7 7 2 10-8-5-8 5 2-10-7-7 9-1Z"/>',
  crawler: '<path d="m9 12 7-4 7 4v10l-7 3-7-3Zm0 2L3 9m6 11-7 5m21-11 6-5m-6 11 7 5M13 14h6"/>',
  rammer: '<path d="m6 12 20 1-5 10-10 1Zm0 0L2 6m24 7 4-8M12 24l-4 5m12-6 6 6M8 13l5-8 9 2"/>',
  gunner: '<circle cx="16" cy="16" r="6"/><path d="M16 1v9M3 24l8-5m18 5-8-5M7 7a13 13 0 0 1 18 0M4 15a13 13 0 0 0 9 14m6 0a13 13 0 0 0 9-14"/>',
  bulwark: '<path d="M7 5h18v21H7ZM2 10h5m18 0h5M11 29h10M12 11h8v10h-8Z"/>',
  weaver: '<circle cx="16" cy="13" r="7"/><path d="m10 18-6 11m18-11 6 11M16 6V1M9 13 2 9m21 4 7-4M6 25l10-7 10 7M16 18v12"/>',
};
function icon(name: string, extraClass = ''): string {
  return `<svg class="ui-icon ${extraClass}" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name] ?? PATHS.energy}</svg>`;
}
function esc(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
}
function time(seconds: number): string {
  const safe = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return `${Math.floor(safe / 60).toString().padStart(2, '0')}:${(safe % 60).toString().padStart(2, '0')}`;
}
function pct(value: number, max: number): number { return Math.max(0, Math.min(100, max > 0 ? value / max * 100 : 0)); }
function compact(value: number): string { return Math.round(value).toLocaleString('zh-CN'); }

export const SKILL_LABELS: Record<SkillId, { name: string; short: string; arm: 'right' | 'left'; description: string; role: string }> = {
  grapple: { name: '钩爪鞭', short: '钩爪', arm: 'right', description: '抓取敌人，或借锚点快速转移。', role: '牵引 · 机动' },
  shield: { name: '护卫盾', short: '护盾', arm: 'right', description: '挡住正面攻击，向前推进。', role: '防护 · 反击' },
  cannon: { name: '充能炮', short: '充能炮', arm: 'right', description: '左键逐炮发射，穿透一线敌人。', role: '穿透 · 爆发' },
  lightning: { name: '雷电冲击', short: '雷电', arm: 'left', description: '从首个目标跳跃，连锁附近敌人。', role: '连锁 · 清群' },
  mist: { name: '雷雾掩护', short: '雷雾', arm: 'left', description: '留下电雾，再次施放可回闪。', role: '遮蔽 · 脱险' },
  barrier: { name: '电流屏障', short: '屏障', arm: 'left', description: '引导穹顶，完成后强化一次右臂技能。', role: '庇护 · 强化' },
};
const MAP_NAMES: Record<MapId, string> = { 'old-harbor': '潮锈旧港', 'new-harbor': '霁电新港' };
const DEFAULT_SETTINGS: GameSettings = {
  volume: 0.7, musicVolume: 0.4, effectsVolume: 0.8, quality: 'medium', shake: true,
  sensitivity: 1, damageNumbers: true, reducedMotion: false, invertY: false, quickCast: false,
};
const KEY_ACTIONS = [
  ['forward', '向前', 'KeyW'], ['backward', '后退', 'KeyS'], ['left', '向左', 'KeyA'], ['right', '向右', 'KeyD'],
  ['jump', '跳跃', 'Space'], ['grapple', '钩爪鞭', 'KeyQ'], ['shield', '护卫盾', 'KeyE'], ['cannon', '充能炮', 'KeyR'],
  ['lightning', '雷电冲击', 'KeyF'], ['mist', '雷雾掩护', 'KeyC'], ['barrier', '电流屏障', 'KeyV'],
  ['beginnerRight', '入门右臂', 'KeyQ'], ['beginnerLeft', '入门左臂', 'KeyE'],
  ['interact', '交互', 'KeyX'], ['map', '地图', 'Tab'], ['resetCamera', '镜头归正', 'KeyZ'],
] as const;
const ENEMIES = [
  { id: 'crawler', name: '群行爬机', type: '包围', description: '四足爬行，成群从侧面接近。抬爪后才会攻击。', counter: '保持移动，用连锁与范围攻击清理。' },
  { id: 'rammer', name: '撞角奔机', type: '冲锋', description: '俯身蓄力后沿锁定方向直冲，转向笨重。', counter: '看地面冲锋带，侧移后攻击恢复中的奔机。' },
  { id: 'gunner', name: '针炮悬机', type: '远程', description: '展开三片炮叶，向预先瞄准的位置齐射。', counter: '利用掩体、护盾，或将它钩到身前。' },
  { id: 'bulwark', name: '重盾搬运机', type: '封路', description: '前盾挡住大部分直接攻击，背部电芯暴露。', counter: '绕向侧后，钩住背部可打断推进。' },
  { id: 'weaver', name: '窃电织网机', type: '控场', description: '布设节点，虚线预警后通电。接触网线会减速、损血并耗电。', counter: '优先拆节点或摧毁织网机，沿缺口离开。' },
];

/** DOM presentation only. The host owns simulation, storage, audio and pointer lock. */
export class GameUI {
  private readonly root: HTMLDivElement;
  private readonly overlay: HTMLDivElement;
  private readonly hud: HTMLDivElement;
  private readonly dialogLayer: HTMLDivElement;
  private readonly toasts: HTMLDivElement;
  private readonly live: HTMLDivElement;
  private view: View = 'menu';
  private dialog: Dialog = null;
  private selection: RunSelection = { mapId: 'old-harbor', mode: 'beginner', rightSkill: 'grapple', leftSkill: 'lightning' };
  private menuOptions: MenuOptions = {};
  private settings: GameSettings = { ...DEFAULT_SETTINGS };
  private upgradeState?: UpgradeState;
  private hudState?: HUDState;
  private skillSignature = '';
  private hudElements = new Map<string, HTMLElement>();
  private bindingAction: string | null = null;
  private previousFocus: HTMLElement | null = null;
  private readonly toastTimers = new Set<ReturnType<typeof setTimeout>>();
  private readonly clickListener = (event: MouseEvent) => this.onClick(event);
  private readonly changeListener = (event: Event) => this.onSetting(event);

  constructor(host: HTMLElement, private readonly callbacks: UICallbacks) {
    this.root = document.createElement('div');
    this.root.className = 'oinja-ui';
    this.root.innerHTML = '<div class="ui-hud" hidden></div><div class="ui-overlay"></div><div class="ui-dialog-layer" hidden></div><div class="ui-toast-stack" aria-live="polite" aria-atomic="false"></div><div class="ui-sr-only" role="status" aria-live="polite"></div>';
    host.append(this.root);
    this.overlay = this.root.querySelector('.ui-overlay')!;
    this.hud = this.root.querySelector('.ui-hud')!;
    this.dialogLayer = this.root.querySelector('.ui-dialog-layer')!;
    this.toasts = this.root.querySelector('.ui-toast-stack')!;
    this.live = this.root.querySelector('.ui-sr-only')!;
    this.root.addEventListener('click', this.clickListener);
    this.root.addEventListener('input', this.changeListener);
    this.root.addEventListener('change', this.changeListener);
    this.setSettings(DEFAULT_SETTINGS);
  }

  get currentView(): View { return this.view; }
  get hasModal(): boolean { return this.view !== 'game' || this.dialog !== null; }

  setSettings(settings: GameSettings): void {
    this.settings = { ...DEFAULT_SETTINGS, ...settings, keybinds: { ...settings.keybinds } };
    this.root.classList.toggle('ui-reduced-motion', this.settings.reducedMotion);
  }

  showMenu(options: MenuOptions = {}): void {
    this.menuOptions = { ...options };
    this.selection = { ...this.selection, ...options.selection };
    this.setView('menu', false);
    this.renderMenu();
    this.focusFirst();
  }

  private renderMenu(): void {
    const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusedAction = focused?.dataset.action;
    const focusedId = focused?.dataset.id;
    const { mode, mapId, rightSkill, leftSkill } = this.selection;
    const skillRow = (arm: 'right' | 'left') => (Object.keys(SKILL_LABELS) as SkillId[])
      .filter(id => SKILL_LABELS[id].arm === arm)
      .map(id => {
        const selected = mode === 'thunder' || id === (arm === 'right' ? rightSkill : leftSkill);
        const skill = SKILL_LABELS[id];
        return `<button class="loadout-skill ${selected ? 'is-selected' : ''}" data-action="skill" data-id="${id}" ${mode === 'thunder' ? 'aria-disabled="true"' : ''} aria-pressed="${selected}" aria-label="${skill.name}：${skill.description}" title="${skill.description}">${icon(id)}<span>${skill.short}</span><span class="skill-selection-mark">${selected ? icon('check') : ''}</span></button>`;
      }).join('');
    this.overlay.innerHTML = `<div class="menu-vignette"></div>
      <nav class="menu-tools" aria-label="辅助菜单">
        <button class="icon-button" data-action="help" aria-label="操作指南" title="操作指南">${icon('help')}</button>
        <button class="icon-button" data-action="bestiary" aria-label="敌人图鉴" title="敌人图鉴">${icon('book')}</button>
        <button class="icon-button" data-action="settings" aria-label="设置" title="设置">${icon('settings')}</button>
      </nav>
      <main class="main-menu" aria-label="游戏主菜单">
        <header class="menu-title"><p class="eyebrow"><span class="status-light"></span> 广潮 · 海湾行动</p><div class="brand-word" aria-label="Oinja">OINJA<span class="brand-spark">✦</span></div><h1>惊雷回路</h1><p class="menu-subtitle">机械与雷电，在你手中同调。</p></header>
        <section class="menu-section" aria-labelledby="map-selection"><div class="section-caption"><h2 id="map-selection"><span>01</span> 选择作战区</h2><span>两条回路，随你启程</span></div>
          <div class="map-choices">${this.mapChoice('old-harbor', mapId)}${this.mapChoice('new-harbor', mapId)}</div>
        </section>
        <section class="menu-section" aria-labelledby="mode-selection"><div class="section-caption"><h2 id="mode-selection"><span>02</span> 选择模式</h2><span>单人 · 一局约 15 分钟</span></div>
          <div class="mode-choices" role="group" aria-label="模式">
            <button class="mode-choice ${mode === 'beginner' ? 'is-selected' : ''}" data-action="mode" data-id="beginner" aria-pressed="${mode === 'beginner'}"><span class="mode-title">入门<span class="mode-tag">双臂专精</span></span><span>各选一项技能，专注走位与成长</span>${icon('check', 'mode-check')}</button>
            <button class="mode-choice ${mode === 'thunder' ? 'is-selected' : ''}" data-action="mode" data-id="thunder" aria-pressed="${mode === 'thunder'}"><span class="mode-title">惊雷<span class="mode-tag">完整同调</span></span><span>六项技能，全程自由调度</span>${icon('check', 'mode-check')}</button>
          </div>
        </section>
        <section class="loadout-section" aria-label="初始技能"><div class="loadout-row"><div class="arm-label"><span class="arm-dot mechanical"></span><strong>机械右臂</strong><small>${mode === 'beginner' ? '选择一项' : '全部装备'}</small></div><div class="loadout-options">${skillRow('right')}</div></div><div class="loadout-row"><div class="arm-label"><span class="arm-dot magical"></span><strong>雷电左臂</strong><small>${mode === 'beginner' ? '选择一项' : '全部装备'}</small></div><div class="loadout-options">${skillRow('left')}</div></div></section>
        <div class="menu-actions"><button class="primary-button start-button" data-action="start"><span><strong>开始行动</strong><small>${MAP_NAMES[mapId]} · ${mode === 'beginner' ? '入门' : '惊雷'}</small></span>${icon('arrow')}</button>
          ${this.menuOptions.hasSave ? `<button class="resume-save" data-action="continue">${icon('play')}<span><strong>继续上次行动</strong><small>${esc(this.menuOptions.saveLabel ?? '恢复本地保存的进度')}</small></span></button>` : ''}
        </div>
        <footer class="menu-record"><span>${this.menuOptions.totalWins ? `已完成 ${this.menuOptions.totalWins} 次行动` : '身体持续进化，内心保持温度。'}</span>${this.menuOptions.bestTime ? `<span>最快完成 ${time(this.menuOptions.bestTime)}</span>` : '<span>键鼠操作</span>'}</footer>
        ${this.menuOptions.status ? `<p class="menu-status" role="status">${esc(this.menuOptions.status)}</p>` : ''}
      </main><div class="scene-caption" aria-hidden="true"><span class="scene-coordinate">${mapId === 'old-harbor' ? '01 / RUST TIDE' : '02 / CLEAR CURRENT'}</span><span>${MAP_NAMES[mapId]}</span><i></i></div>`;
    if (focusedAction) {
      const candidates = this.overlay.querySelectorAll<HTMLElement>('[data-action]');
      Array.from(candidates).find(item => item.dataset.action === focusedAction && item.dataset.id === focusedId)?.focus({ preventScroll: true });
    }
  }

  private mapChoice(id: MapId, current: MapId): string {
    const old = id === 'old-harbor';
    const art = old
      ? '<path d="M12 69h130M25 69V41l24-15 23 15v28M32 44h33M82 69V30h29v39M78 30l17-16 20 16M120 69V12h8v57M124 17h28M145 17v27M35 69V52h12v17M55 49h9v8"/><path d="M14 77h126M10 84h130" class="map-water"/>'
      : '<path d="M12 69h137M22 69V26h28v43M17 26l34-13v13M29 34h14m-14 9h14m-14 9h14M64 69V40h32v29M64 49h32M109 69V23h31v46M105 23h39M115 31h20m-20 9h20m-20 9h20M74 40V14h9v26M78 14h28"/><path d="M10 78h138M28 84h113" class="map-water"/>';
    return `<button class="map-choice ${current === id ? 'is-selected' : ''} ${old ? 'map-old' : 'map-new'}" data-action="map-choice" data-id="${id}" aria-pressed="${current === id}"><svg class="map-line-art" viewBox="0 0 160 90" fill="none" stroke="currentColor" stroke-width="1.1" aria-hidden="true">${art}</svg><span class="map-number">${old ? '01' : '02'}</span><span class="map-choice-name">${MAP_NAMES[id]}</span><span class="map-choice-description">${old ? '落日 · 砖仓 · 锈色栈桥' : '晴空 · 储能站 · 高架管廊'}</span><span class="map-choice-check">${icon('check')}</span></button>`;
  }

  showLoading(state: LoadingState): void {
    this.setView('loading', false);
    const progress = state.progress <= 1 ? state.progress * 100 : state.progress;
    this.overlay.innerHTML = `<div class="full-shade"></div><section class="loading-panel" role="status"><div class="loading-emblem">${icon(state.error ? 'reset' : 'energy')}</div><p class="eyebrow">OINJA · 惊雷回路</p><h1>${state.error ? '连接暂时中断' : '正在接通回路'}</h1><p>${esc(state.error ?? state.label)}</p><div class="loading-track"><span style="width:${pct(progress, 100)}%"></span></div><span class="loading-percentage">${state.error ? '资源尚未就绪' : `${Math.round(pct(progress, 100))}%`}</span>${state.error ? `<div class="button-row"><button class="primary-button" data-action="retry">重新加载 ${icon('reset')}</button><button class="quiet-button" data-action="menu">返回主菜单</button></div>` : '<small>准备好后，即可进入作战区。</small>'}</section>`;
  }

  showGame(): void {
    this.setView('game', true);
    this.overlay.innerHTML = '';
    if (!this.hudElements.size) this.buildHUD();
    if (this.hudState) this.updateHUD(this.hudState);
  }

  private buildHUD(): void {
    this.hud.innerHTML = `<section class="vitals-cluster" aria-label="角色状态">
      <div class="vitals-heading"><span class="hud-name">OINJA</span><span class="hud-level" data-hud="level">Lv. 1</span><span class="attack-arm" data-hud="arm">右拳</span><div class="sync-dots" data-hud="sync" aria-label="同调计数"></div></div>
      <div class="resource-line health-line">${icon('heart')}<div class="resource-track" role="meter" aria-label="生命" data-hud="healthMeter"><span data-hud="healthBar"></span><i data-hud="shieldBar"></i></div><span class="resource-value" data-hud="health">1200</span></div>
      <div class="resource-line energy-line">${icon('energy')}<div class="resource-track" role="meter" aria-label="电量" data-hud="energyMeter"><span data-hud="energyBar"></span></div><span class="resource-value" data-hud="energy">100</span></div>
      <div class="hud-skill-dock" data-hud="skills" aria-label="主动技能"></div>
      <div class="experience-line"><div class="xp-track" role="meter" aria-label="升级经验" data-hud="xpMeter"><span data-hud="xpBar"></span></div><span data-hud="xp">0 / 20</span></div>
      <div class="empowered-label" data-hud="empowered" hidden>${icon('star')} 下一次机械技能强化</div>
      <div class="cannon-ammo" data-hud="cannon" hidden></div>
    </section>
    <section class="mission-cluster" aria-label="行动目标"><div class="mission-top"><span class="mission-clock" data-hud="time">00:00</span><span class="kill-count"><b data-hud="kills">0</b> 击破</span><button class="hud-mini-button" data-action="pause" aria-label="暂停">${icon('pause')}</button></div><p class="hud-objective" data-hud="objective">生存，升级，准备终局</p><div class="hud-region">${icon('map')}<span data-hud="region"></span><button data-action="map" title="打开地图">地图 <kbd>Tab</kbd></button></div><div class="hud-event" data-hud="event" hidden></div></section>
    <div class="aim-reticle" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
    <div class="interaction-prompt" data-hud="interaction" hidden></div>
    <section class="boss-bar" data-hud="boss" aria-label="终局目标" hidden><div><span data-hud="bossName">织网主机</span><span data-hud="bossPhase"></span></div><div class="boss-track"><span data-hud="bossHealth"></span></div></section>
    <span class="hud-performance" data-hud="fps" hidden></span>`;
    this.hudElements.clear();
    this.hud.querySelectorAll<HTMLElement>('[data-hud]').forEach(el => this.hudElements.set(el.dataset.hud!, el));
    this.skillSignature = '';
  }

  updateHUD(state: HUDState): void {
    this.hudState = state;
    if (!this.hudElements.size || this.hud.hidden) return;
    const el = (key: string) => this.hudElements.get(key)!;
    const write = (key: string, value: string) => { if (el(key).textContent !== value) el(key).textContent = value; };
    const meter = (name: string, value: number, max: number) => {
      el(`${name}Bar`).style.transform = `scaleX(${pct(value, max) / 100})`;
      el(`${name}Meter`).setAttribute('aria-valuenow', String(Math.round(value)));
      el(`${name}Meter`).setAttribute('aria-valuemax', String(Math.round(max)));
      el(`${name}Meter`).setAttribute('aria-valuemin', '0');
    };
    meter('health', state.health, state.maxHealth);
    meter('energy', state.energy, state.maxEnergy);
    meter('xp', state.xp, state.nextLevelXp);
    write('health', `${Math.ceil(Math.max(0, state.health))}`);
    write('energy', `${Math.floor(Math.max(0, state.energy))}`);
    el('health').title = `生命 ${Math.ceil(state.health)} / ${state.maxHealth}`;
    el('energy').title = `电量 ${Math.floor(state.energy)} / ${state.maxEnergy}`;
    this.hud.classList.toggle('low-health', state.health > 0 && state.health / state.maxHealth < 0.25);
    el('shieldBar').style.transform = `scaleX(${pct(state.shield ?? 0, state.maxHealth) / 100})`;
    write('level', `Lv. ${state.level}`);
    write('xp', state.level >= 20 ? '等级已满' : `${Math.floor(state.xp)} / ${Math.ceil(state.nextLevelXp)}`);
    write('time', time(state.elapsed));
    el('time').classList.toggle('is-overtime', state.elapsed >= 900);
    write('kills', compact(state.kills));
    write('arm', state.attackArm === 'right' ? '右拳' : '左电泡');
    el('arm').classList.toggle('is-magical', state.attackArm === 'left');
    const syncSignature = `${state.attackArm}-${state.syncCount}-${state.syncMax}`;
    if (el('sync').dataset.value !== syncSignature) {
      el('sync').innerHTML = Array.from({ length: Math.max(1, Math.min(state.syncMax, 8)) }, (_, i) => `<i class="${i < state.syncCount ? 'is-filled' : ''}"></i>`).join('');
      el('sync').dataset.value = syncSignature;
      el('sync').setAttribute('aria-label', `强化普攻积攒 ${state.syncCount} / ${state.syncMax}`);
    }
    write('objective', state.objective ?? (state.elapsed < 720 ? `终局于 12:00 到场 · 继续成长` : '击破织网主机'));
    write('region', state.region ?? '海湾作战区');
    const signature = state.skills.map(skill => `${skill.id}:${skill.key}`).join('|');
    if (signature !== this.skillSignature) {
      this.skillSignature = signature;
      el('skills').innerHTML = state.skills.map(skill => `<button class="hud-skill ${SKILL_LABELS[skill.id].arm}" data-action="ability" data-id="${skill.id}" data-skill="${skill.id}" aria-label="${SKILL_LABELS[skill.id].name}" title="${SKILL_LABELS[skill.id].name} · ${skill.key}"><span class="cooldown-fill"></span>${icon(skill.id)}<kbd>${esc(skill.key)}</kbd><span class="cooldown-number"></span><span class="skill-level-pips"></span></button>`).join('');
      this.hud.classList.toggle('six-skills', state.skills.length > 2);
    }
    for (const skill of state.skills) {
      const button = el('skills').querySelector<HTMLElement>(`[data-skill="${skill.id}"]`)!;
      button.classList.toggle('is-cooling', skill.cooldown > 0);
      button.classList.toggle('is-active', Boolean(skill.active));
      button.classList.toggle('is-unavailable', Boolean(skill.unavailable));
      button.classList.toggle('is-evolved', Boolean(skill.evolution));
      button.querySelector<HTMLElement>('.cooldown-fill')!.style.transform = `scaleY(${pct(skill.cooldown, skill.maxCooldown) / 100})`;
      button.querySelector<HTMLElement>('.cooldown-number')!.textContent = skill.cooldown > 0 ? (skill.cooldown < 1 ? skill.cooldown.toFixed(1) : String(Math.ceil(skill.cooldown))) : '';
      const pips = button.querySelector<HTMLElement>('.skill-level-pips')!;
      const level = skill.level ?? 1;
      if (pips.dataset.level !== String(level)) {
        pips.innerHTML = Array.from({ length: 5 }, (_, i) => `<i class="${i < level ? 'filled' : ''}"></i>`).join('');
        pips.dataset.level = String(level);
      }
      button.setAttribute('aria-label', `${SKILL_LABELS[skill.id].name}，${level}级，${skill.cooldown > 0 ? `冷却${Math.ceil(skill.cooldown)}秒` : skill.unavailable ? '电量不足' : '可施放'}`);
    }
    el('empowered').hidden = !state.empowered;
    if (state.empowered) el('empowered').innerHTML = `${icon('star')} 下一次机械技能强化${state.empowermentRemaining ? ` · ${Math.ceil(state.empowermentRemaining)}s` : ''}`;
    el('cannon').hidden = !(state.cannonShots && state.cannonShots > 0);
    if (state.cannonShots) el('cannon').innerHTML = `<kbd>左键</kbd> 发射 <span>${'▮'.repeat(Math.max(0, Math.min(6, state.cannonShots)))}</span> ${state.cannonShots} 炮`;
    el('interaction').hidden = !state.interaction;
    if (state.interaction) el('interaction').innerHTML = `<kbd>${this.keyLabel(this.settings.keybinds?.interact ?? 'KeyX')}</kbd> ${esc(state.interaction.replace(/^X\s*[·:：]\s*/, ''))}`;
    el('boss').hidden = !state.boss;
    if (state.boss) {
      write('bossName', state.boss.name);
      write('bossPhase', state.boss.phase ?? '终局目标');
      el('bossHealth').style.transform = `scaleX(${pct(state.boss.health, state.boss.maxHealth) / 100})`;
    }
    el('event').hidden = !state.event;
    if (state.event) el('event').innerHTML = `<span class="event-dot"></span>${esc(state.event.title)}${state.event.remaining != null ? `<b>${time(state.event.remaining)}</b>` : ''}${state.event.progress != null ? `<div class="event-track"><i style="width:${pct(state.event.progress, 1)}%"></i></div>` : ''}`;
    el('fps').hidden = state.fps == null;
    if (state.fps != null) write('fps', `${Math.round(state.fps)} FPS`);
  }

  showUpgrades(state: UpgradeState): void {
    this.upgradeState = state;
    this.setView('upgrades', true);
    this.overlay.innerHTML = `<div class="full-shade upgrade-shade"></div><section class="upgrade-screen" aria-labelledby="upgrade-title"><header><p class="eyebrow">${state.evolution ? '形态突破' : '回路升级'} <span class="inline-divider"></span> LV. ${state.level}</p><h1 id="upgrade-title">${state.evolution ? '让力量，长成你的样子。' : '选择下一次进化。'}</h1><p>${esc(state.subtitle ?? (state.evolution ? '选择一种进化，本局保留。' : '行动已暂停。选一项升级，继续你的回路。'))}</p></header>
      <div class="upgrade-choices ${state.choices.length === 1 ? 'single-choice' : ''}">${state.choices.map((choice, index) => `<button class="upgrade-card ${choice.kind === 'evolution' || state.evolution ? 'evolution-card' : ''}" data-action="upgrade" data-id="${esc(choice.id)}" ${choice.locked ? 'disabled' : ''}><span class="upgrade-shortcut"><kbd>${index + 1}</kbd><span>${choice.kind === 'evolution' || state.evolution ? '进化' : choice.kind === 'passive' ? '同调' : choice.kind === 'utility' ? '生存' : '技能'}</span></span><span class="upgrade-art">${icon(choice.skillId ?? (choice.id.includes('health') ? 'heart' : choice.id.includes('mobility') ? 'grapple' : 'energy'))}<i></i></span><span class="upgrade-arm">${choice.skillId ? SKILL_LABELS[choice.skillId].arm === 'right' ? '机械右臂' : '雷电左臂' : '角色强化'}${choice.level ? ` · LV. ${choice.level}` : ''}</span><h2>${esc(choice.title)}</h2><p>${esc(choice.description)}</p>${choice.current || choice.next ? `<span class="upgrade-change">${choice.current ? `<span>${esc(choice.current)}</span>${icon('arrow')}` : ''}<strong>${esc(choice.next ?? '')}</strong></span>` : ''}${choice.detail ? `<span class="upgrade-detail">${esc(choice.detail)}</span>` : ''}<span class="upgrade-choose">${choice.locked ? '尚未解锁' : '选择此升级'} ${icon('arrow')}</span></button>`).join('')}</div>
      <footer class="upgrade-footer"><span>${state.evolution ? '进化会与屏障的机械强化共同生效' : '升级仅在本次行动中生效'}</span>${state.evolution ? '' : `<button class="secondary-button reroll-button" data-action="reroll" ${state.rerolls <= 0 ? 'disabled' : ''}>${icon('reset')} 重抽 <b>${state.rerolls}</b></button>`}</footer></section>`;
    this.announce(state.evolution ? '选择技能进化，行动已暂停' : `升至${state.level}级，选择一项升级`);
    this.focusFirst();
  }

  showPause(reason = '行动已暂停'): void {
    this.setView('pause', true);
    this.overlay.innerHTML = `<div class="full-shade pause-shade"></div><section class="pause-panel" aria-labelledby="pause-title"><p class="eyebrow">TAKE A BREATH</p><h1 id="pause-title">回路暂歇</h1><p class="pause-reason">${esc(reason)}</p>${this.hudState ? `<div class="pause-state"><span>${time(this.hudState.elapsed)}</span><i></i><span>Lv. ${this.hudState.level}</span><i></i><span>${compact(this.hudState.kills)} 击破</span></div>` : ''}<button class="primary-button" data-action="resume">继续行动 ${icon('play')}</button><div class="pause-links"><button class="secondary-button" data-action="map">${icon('map')} 作战地图</button><button class="secondary-button" data-action="settings">${icon('settings')} 设置</button><button class="secondary-button" data-action="help">${icon('help')} 操作指南</button><button class="secondary-button" data-action="bestiary">${icon('book')} 敌人图鉴</button></div><div class="pause-bottom"><button class="quiet-button" data-action="restart">重新开始</button><button class="quiet-button" data-action="menu">返回主菜单</button></div><small>暂停时，战斗与行动计时均停止。</small></section>`;
    this.focusFirst();
  }

  showResult(state: ResultState): void {
    this.setView('result', false);
    const win = state.outcome === 'victory';
    const title = win ? '回路，重新亮起。' : state.outcome === 'timeout' ? '这次，差一点。' : '下一次，再向前。';
    this.overlay.innerHTML = `<div class="full-shade result-shade"></div><section class="result-screen ${win ? 'is-victory' : ''}" aria-labelledby="result-title"><header><span class="result-emblem">${icon(win ? 'star' : 'energy')}</span><p class="eyebrow">${win ? '行动完成 · CIRCUIT RESTORED' : state.outcome === 'timeout' ? '行动超时 · TIME LIMIT' : '行动结束 · CIRCUIT INTERRUPTED'}</p><h1 id="result-title">${title}</h1><p>${MAP_NAMES[state.mapId]} <span class="inline-divider"></span> ${state.mode === 'beginner' ? '入门 · 双臂专精' : '惊雷 · 完整同调'}</p></header>
      <div class="result-stats"><div><small>行动时间</small><strong>${time(state.elapsed)}</strong>${state.best ? '<span class="new-record">个人最佳</span>' : ''}</div><div><small>机械击破</small><strong>${compact(state.kills)}</strong></div><div><small>最终等级</small><strong><span>LV.</span>${state.level}</strong></div>${state.damageDealt != null ? `<div><small>造成伤害</small><strong>${compact(state.damageDealt)}</strong></div>` : ''}</div>
      ${state.reason ? `<p class="result-reason">${icon(win ? 'check' : 'help')} ${esc(state.reason)}</p>` : ''}
      ${state.build?.length ? `<section class="result-build"><h2>本次回路</h2><div>${state.build.map(skill => `<div class="build-skill ${skill.evolution ? 'is-evolved' : ''}">${icon(skill.id)}<span><strong>${esc(skill.evolution ?? SKILL_LABELS[skill.id].name)}</strong><small>Lv. ${skill.level}${skill.evolution ? ' · 已进化' : ''}</small></span></div>`).join('')}</div></section>` : ''}
      ${state.unlocks?.length || state.achievements?.length ? `<section class="result-unlocks"><h2>${icon('star')} 新的收获</h2><div>${[...(state.unlocks ?? []), ...(state.achievements ?? [])].map(unlock => `<span>${esc(unlock)}</span>`).join('')}</div></section>` : ''}
      <div class="result-actions"><button class="primary-button" data-action="restart">再来一局 ${icon('arrow')}</button><button class="secondary-button" data-action="menu">返回主菜单</button></div><small class="result-footnote">成绩与已解锁内容保存在本机。新的行动从 1 级开始。</small></section>`;
    this.announce(win ? '行动胜利，织网主机已击破' : state.outcome === 'timeout' ? '行动超时' : '行动结束');
    this.focusFirst();
  }

  showMap(state: MapState): void {
    this.setView('map', true);
    const old = state.mapId === 'old-harbor';
    const labels = old ? ['旧轨堆场', '红砖货仓', '临时配电场', '干船坞', '铆接检修桥', '临海广场'] : ['自动货柜区', '转运大厅', '模块储能站', '冷却检修庭', '高架管廊', '工业中庭'];
    const nodes = [{ x: 22, y: 35 }, { x: 47, y: 23 }, { x: 78, y: 34 }, { x: 23, y: 75 }, { x: 60, y: 48 }, { x: 62, y: 78 }];
    const regions = state.regions?.length ? state.regions : nodes.map((node, index) => ({ ...node, width: 17, height: 11, label: labels[index] }));
    const route = (edges: number[][]) => edges.filter(([a, b]) => regions[a] && regions[b]).map(([a, b]) => `M${regions[a].x} ${regions[a].y}L${regions[b].x} ${regions[b].y}`).join(' ');
    const groundRoute = route([[0, 1], [1, 2], [2, 5], [5, 3], [3, 0], [1, 5]]);
    const upperRoute = route([[1, 4], [4, 2], [4, 3]]);
    this.overlay.innerHTML = `<div class="full-shade"></div><section class="map-screen" aria-labelledby="map-title"><header><div><p class="eyebrow">作战区导览 · 行动已暂停</p><h1 id="map-title">${MAP_NAMES[state.mapId]}</h1></div><button class="icon-button" data-action="resume" aria-label="关闭地图并继续">${icon('close')}</button></header><div class="tactical-map" aria-label="区域与行动标记"><div class="map-grid"></div><svg class="map-routes" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path class="ground-route" d="${groundRoute}"/><path class="upper-route" d="${upperRoute}"/></svg>${regions.map((region, index) => `<div class="map-region" style="left:${pct(region.x, 100)}%;top:${pct(region.y, 100)}%"><b>${String.fromCharCode(65 + index)}</b><span>${esc(region.label)}</span></div>`).join('')}${(state.markers ?? []).map(marker => `<div class="map-marker marker-${marker.type}" style="left:${pct(marker.x, 100)}%;top:${pct(marker.y, 100)}%" title="${esc(marker.label ?? marker.type)}">${icon(marker.type === 'player' ? 'play' : marker.type === 'boss' ? 'weaver' : marker.type === 'supply' ? 'heart' : marker.type === 'anchor' ? 'grapple' : 'energy')}${marker.label ? `<span>${esc(marker.label)}</span>` : ''}</div>`).join('')}<span class="map-north">N<br>↑</span><span class="map-water-label">广潮湾</span></div><footer class="map-legend"><span><i class="legend-player"></i> 你的位置</span><span><i class="legend-boss"></i> 终局主机</span><span><i class="legend-event"></i> 事件 / 补给</span><span>虚线：上层绕行</span></footer><div class="map-bottom"><p>${state.region ? `当前位置：${esc(state.region)}` : '区域连通示意 · 路线以场景内通行为准'}</p><button class="primary-button" data-action="resume">继续行动 ${icon('play')}</button></div></section>`;
    this.focusFirst();
  }

  toast(message: string, tone: ToastTone = 'info', duration = 3500): void {
    if (tone === 'info' && (this.view === 'result' || this.view === 'loading')) return;
    const item = document.createElement('div');
    item.className = `game-toast toast-${tone}`;
    item.innerHTML = `${icon(tone === 'success' ? 'check' : tone === 'warning' || tone === 'danger' ? 'help' : 'energy')}<span>${esc(message)}</span>`;
    this.toasts.append(item);
    while (this.toasts.children.length > 4) this.toasts.firstElementChild?.remove();
    const timer = setTimeout(() => { item.remove(); this.toastTimers.delete(timer); }, duration);
    this.toastTimers.add(timer);
  }

  /** Call this before combat keyboard handling. Returns true when UI consumed the event. */
  handleKey(event: KeyboardEvent): boolean {
    if (this.bindingAction) {
      event.preventDefault();
      event.stopPropagation();
      if (event.code === 'Escape') { this.bindingAction = null; this.renderDialog(); return true; }
      if (['MetaLeft', 'MetaRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight'].includes(event.code)) return true;
      const thunder = ['grapple', 'shield', 'cannon', 'lightning', 'mist', 'barrier'];
      const beginner = ['beginnerRight', 'beginnerLeft'];
      const conflict = KEY_ACTIONS.find(([action, , code]) => {
        if (action === this.bindingAction) return false;
        if (thunder.includes(this.bindingAction!) && beginner.includes(action)) return false;
        if (beginner.includes(this.bindingAction!) && thunder.includes(action)) return false;
        return (this.settings.keybinds?.[action] ?? code) === event.code;
      });
      if (conflict) { this.toast(`此按键已用于「${conflict[1]}」，请换一个按键。Esc 取消。`, 'warning'); return true; }
      this.settings.keybinds = { ...this.settings.keybinds, [this.bindingAction]: event.code };
      this.bindingAction = null;
      this.callbacks.onSettingsChange({ ...this.settings });
      this.renderDialog();
      return true;
    }
    if (this.view === 'map' && !this.dialog && event.code === (this.settings.keybinds?.map ?? 'Tab')) {
      event.preventDefault();
      if (!event.repeat) this.callbacks.onResume();
      return true;
    }
    if (event.key === 'Tab' && this.hasModal) {
      this.trapFocus(event);
      return true;
    }
    if (event.key === 'Escape') {
      if (event.repeat) { event.preventDefault(); return true; }
      if (this.dialog) { event.preventDefault(); this.closeDialog(); return true; }
      if (this.view === 'pause' || this.view === 'map') { event.preventDefault(); this.callbacks.onResume(); return true; }
      if (this.view === 'game') { event.preventDefault(); this.callbacks.onPause?.(); return true; }
      return this.view !== 'menu';
    }
    if (this.view === 'upgrades' && !this.dialog && !event.repeat) {
      const number = Number(event.key);
      if (number >= 1 && number <= 3) {
        const choice = this.upgradeState?.choices[number - 1];
        if (choice && !choice.locked) { event.preventDefault(); this.callbacks.onUpgrade(choice.id); }
        return true;
      }
      if (event.code === 'KeyR' && !this.upgradeState?.evolution && (this.upgradeState?.rerolls ?? 0) > 0) {
        event.preventDefault(); this.callbacks.onReroll(); return true;
      }
    }
    if (this.view === 'game' && event.code === (this.settings.keybinds?.map ?? 'Tab')) {
      event.preventDefault(); if (!event.repeat) this.callbacks.onMap?.(); return true;
    }
    return this.hasModal;
  }

  private setView(view: View, showHUD: boolean): void {
    this.closeDialog(false);
    if (['menu', 'result', 'loading'].includes(view)) {
      this.toasts.replaceChildren();
      for (const timer of this.toastTimers) clearTimeout(timer);
      this.toastTimers.clear();
    }
    this.view = view;
    this.root.dataset.view = view;
    this.hud.hidden = !showHUD;
    this.overlay.hidden = view === 'game';
    if (showHUD && !this.hudElements.size) this.buildHUD();
  }

  private onClick(event: MouseEvent): void {
    const button = (event.target as Element).closest<HTMLElement>('[data-action]');
    if (!button || button.hasAttribute('disabled')) return;
    const action = button.dataset.action;
    const id = button.dataset.id ?? '';
    switch (action) {
      case 'start': this.callbacks.onStart({ ...this.selection }); break;
      case 'continue': this.callbacks.onContinue(); break;
      case 'mode': this.selection.mode = id as RunSelection['mode']; this.renderMenu(); this.callbacks.onSelectionChange?.({ ...this.selection }); break;
      case 'map-choice': this.selection.mapId = id as MapId; this.renderMenu(); this.callbacks.onSelectionChange?.({ ...this.selection }); break;
      case 'skill': {
        if (this.selection.mode === 'thunder') break;
        const skill = id as SkillId;
        this.selection[SKILL_LABELS[skill].arm === 'right' ? 'rightSkill' : 'leftSkill'] = skill;
        this.renderMenu(); this.callbacks.onSelectionChange?.({ ...this.selection }); break;
      }
      case 'pause': this.callbacks.onPause?.(); break;
      case 'resume': this.callbacks.onResume(); break;
      case 'restart': this.callbacks.onRestart(); break;
      case 'menu': this.callbacks.onMainMenu(); break;
      case 'upgrade': this.callbacks.onUpgrade(id); break;
      case 'reroll': this.callbacks.onReroll(); break;
      case 'ability': this.callbacks.onAbility?.(id as SkillId); break;
      case 'map': this.callbacks.onMap?.(); break;
      case 'retry': this.callbacks.onRetry?.(); break;
      case 'settings': case 'help': case 'bestiary': this.openDialog(action); break;
      case 'close-dialog': this.closeDialog(); break;
      case 'keybind': this.bindingAction = id; this.renderDialog(); break;
      case 'reset-settings': this.settings = { ...DEFAULT_SETTINGS, keybinds: {} }; this.setSettings(this.settings); this.callbacks.onSettingsChange({ ...this.settings }); this.renderDialog(); break;
    }
  }

  private openDialog(dialog: NonNullable<Dialog>): void {
    this.previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.dialog = dialog;
    this.dialogLayer.hidden = false;
    this.renderDialog();
  }

  private closeDialog(restoreFocus = true): void {
    this.dialog = null;
    this.bindingAction = null;
    this.dialogLayer.hidden = true;
    this.dialogLayer.innerHTML = '';
    if (restoreFocus && this.previousFocus?.isConnected) this.previousFocus.focus({ preventScroll: true });
    this.previousFocus = null;
  }

  private renderDialog(): void {
    const title = this.dialog === 'settings' ? '调整你的回路' : this.dialog === 'help' ? '行动指南' : '机械威胁档案';
    let content = '';
    if (this.dialog === 'settings') {
      const range = (key: keyof GameSettings, label: string, max = 1, min = 0, step = 0.05) => `<label class="setting-row"><span>${label}</span><input type="range" data-setting="${key}" min="${min}" max="${max}" step="${step}" value="${Number(this.settings[key] ?? 0.8)}" aria-label="${label}"><output data-output="${key}">${max === 1 ? `${Math.round(Number(this.settings[key] ?? 0.8) * 100)}%` : `${Number(this.settings[key]).toFixed(1)}×`}</output></label>`;
      const toggle = (key: keyof GameSettings, label: string, detail?: string) => `<label class="setting-row toggle-row"><span>${label}${detail ? `<small>${detail}</small>` : ''}</span><input type="checkbox" data-setting="${key}" ${this.settings[key] ? 'checked' : ''}><span class="toggle-switch" aria-hidden="true"></span></label>`;
      content = `<div class="settings-grid"><section><h3>声音</h3>${range('volume', '主音量')}${range('musicVolume', '音乐')}${range('effectsVolume', '效果音')}<h3>画面与反馈</h3><label class="setting-row"><span>画质</span><select data-setting="quality" aria-label="画质"><option value="low" ${this.settings.quality === 'low' ? 'selected' : ''}>低 · 流畅优先</option><option value="medium" ${this.settings.quality === 'medium' ? 'selected' : ''}>中 · 均衡</option><option value="high" ${this.settings.quality === 'high' ? 'selected' : ''}>高 · 完整光影</option></select></label>${toggle('shake', '镜头震动')}${toggle('damageNumbers', '伤害数字')}${toggle('reducedMotion', '减弱动态效果', '减少界面过渡与非必要运动')}</section><section><h3>镜头与操作</h3>${range('sensitivity', '鼠标灵敏度', 2.5, 0.2, 0.1)}${toggle('invertY', '反转纵向视角')}${toggle('quickCast', '快速施法', '点按直接施放，关闭时按住预览、松开施放')}<h3>键位 <small>点击后按下新按键</small></h3><div class="keybind-grid">${KEY_ACTIONS.map(([action, label, code]) => `<div><span>${label}</span><button class="keybind-button ${this.bindingAction === action ? 'is-listening' : ''}" data-action="keybind" data-id="${action}" aria-label="更改${label}按键">${this.bindingAction === action ? '请按键…' : this.keyLabel(this.settings.keybinds?.[action] ?? code)}</button></div>`).join('')}</div></section></div><footer class="dialog-footer"><button class="quiet-button" data-action="reset-settings">恢复默认</button><span>调整即时生效</span><button class="secondary-button" data-action="close-dialog">完成 ${icon('check')}</button></footer>`;
    } else if (this.dialog === 'help') {
      const key = (action: string) => this.keyLabel(this.settings.keybinds?.[action] ?? KEY_ACTIONS.find(([id]) => id === action)?.[2] ?? action);
      content = `<div class="help-intro"><span>${icon('energy')}</span><p>自动普攻维持节奏。<br><strong>走位、换手与关键技能，由你掌控。</strong></p></div><div class="help-columns"><section><h3>移动与战斗</h3><dl class="controls-list"><div><dt><kbd>${key('forward')}</kbd><kbd>${key('left')}</kbd><kbd>${key('backward')}</kbd><kbd>${key('right')}</kbd></dt><dd>移动 · ${key('jump')} 跳跃</dd></div><div><dt>鼠标</dt><dd>转动视角，准星选择目标</dd></div><div><dt>右键按住</dt><dd>精确瞄准</dd></div><div><dt>鼠标左键</dt><dd>炮形态逐炮射击</dd></div><div><dt><kbd>${key('interact')}</kbd></dt><dd>交互与接取事件</dd></div><div><dt><kbd>${key('map')}</kbd> / <kbd>Esc</kbd></dt><dd>地图 / 暂停</dd></div></dl><p class="help-note">点击「继续行动」进入鼠标控制；按 Esc 可随时退出。未锁定时可拖动调整视角。</p></section><section><h3>两臂同调</h3><p>右臂技能 → 左电泡普攻<br>左臂技能 → 右拳普攻</p><p>右拳两次命中后的下一击成为重击；左电泡四次命中后的下一击成为大电泡。换手保留各自积攒。</p><div class="control-skills">${(Object.keys(SKILL_LABELS) as SkillId[]).map((id, index) => `<span>${icon(id)}<b>${SKILL_LABELS[id].short}</b><kbd>${key(id)}</kbd></span>`).join('')}</div><p class="help-note">入门模式使用 ${key('beginnerRight')}（右臂）和 ${key('beginnerLeft')}（左臂）。${key('resetCamera')} 或中键归正镜头。键位可在设置中修改。</p></section></div><div class="help-timeline"><span><b>00:00</b>收集经验，选择升级</span><span><b>12:00</b>终局主机到场</span><span><b>18:00</b>行动时限</span></div><p class="help-note">击破终局主机即获胜。可选事件会改变路线并给予补给，不是通关的必要条件。</p>`;
    } else {
      content = `<p class="dialog-lead">读懂轮廓、预警与弱点，五种机械各有破法。</p><div class="bestiary-list">${ENEMIES.map((enemy, index) => `<article class="bestiary-entry"><span class="enemy-number">0${index + 1}</span><div class="enemy-icon">${icon(enemy.id)}</div><div><h3>${enemy.name}<span>${enemy.type}</span></h3><p>${enemy.description}</p><p class="enemy-counter">${icon('arrow')} ${enemy.counter}</p></div></article>`).join('')}</div><div class="boss-note">${icon('weaver')}<p><strong>终局 · 织网主机</strong>沿用织网机的预警与节点机制。拆除关键节点，争取电芯暴露的输出窗口。</p></div>`;
    }
    this.dialogLayer.innerHTML = `<div class="dialog-scrim"></div><section class="game-dialog ${this.dialog}-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><header class="dialog-header"><div><p class="eyebrow">OINJA · 惊雷回路</p><h2 id="dialog-title">${title}</h2></div><button class="icon-button" data-action="close-dialog" aria-label="关闭">${icon('close')}</button></header><div class="dialog-content">${content}</div></section>`;
    this.focusFirst();
  }

  private onSetting(event: Event): void {
    const target = event.target as HTMLInputElement | HTMLSelectElement;
    const key = target.dataset.setting as keyof GameSettings | undefined;
    if (!key) return;
    // Ranges emit input continuously; selects and toggles use change exactly once.
    if (target.type !== 'range' && event.type === 'input') return;
    if (target.type === 'range' && event.type === 'change') return;
    const value = target.type === 'checkbox' ? (target as HTMLInputElement).checked : target.type === 'range' ? Number(target.value) : target.value;
    this.settings = { ...this.settings, [key]: value };
    const output = this.dialogLayer.querySelector<HTMLOutputElement>(`[data-output="${key}"]`);
    if (output) output.value = key === 'sensitivity' ? `${Number(value).toFixed(1)}×` : `${Math.round(Number(value) * 100)}%`;
    this.root.classList.toggle('ui-reduced-motion', this.settings.reducedMotion);
    this.callbacks.onSettingsChange({ ...this.settings });
  }

  private keyLabel(code: string): string {
    return esc(({ Space: '空格', Tab: 'Tab', Escape: 'Esc', Mouse2: '中键', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', ShiftLeft: 'Shift', ShiftRight: 'Shift' } as Record<string, string>)[code] ?? code.replace(/^Key|^Digit/, ''));
  }
  private announce(message: string): void { this.live.textContent = message; }
  private focusFirst(): void {
    const scope = this.dialog ? this.dialogLayer : this.overlay;
    queueMicrotask(() => {
      const primary = !this.dialog ? scope.querySelector<HTMLElement>('[data-action="start"], [data-action="resume"]') : null;
      (primary ?? scope.querySelector<HTMLElement>('button:not([disabled]), input, select'))?.focus({ preventScroll: true });
    });
  }
  private trapFocus(event: KeyboardEvent): void {
    const scope = this.dialog ? this.dialogLayer : this.overlay;
    const elements = Array.from(scope.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex="0"]')).filter(el => !el.hidden && el.getClientRects().length > 0);
    if (!elements.length) { event.preventDefault(); return; }
    const first = elements[0], last = elements[elements.length - 1];
    if (event.shiftKey && (document.activeElement === first || !scope.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || !scope.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
  }

  destroy(): void {
    this.root.removeEventListener('click', this.clickListener);
    this.root.removeEventListener('input', this.changeListener);
    this.root.removeEventListener('change', this.changeListener);
    for (const timer of this.toastTimers) clearTimeout(timer);
    this.toastTimers.clear();
    this.root.remove();
  }
}
export default GameUI;
