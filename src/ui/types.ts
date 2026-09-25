export type SkillId = 'grapple' | 'shield' | 'cannon' | 'lightning' | 'mist' | 'barrier';
export type MapId = 'old-harbor' | 'new-harbor';
export type GameMode = 'beginner' | 'thunder';
export type Quality = 'low' | 'medium' | 'high';
export type ToastTone = 'info' | 'success' | 'warning' | 'danger';

export interface GameSettings {
  volume: number;
  musicVolume: number;
  quality: Quality;
  shake: boolean;
  sensitivity: number;
  damageNumbers: boolean;
  reducedMotion: boolean;
  effectsVolume?: number;
  invertY?: boolean;
  quickCast?: boolean;
  keybinds?: Record<string, string>;
}

export interface RunSelection {
  mapId: MapId;
  mode: GameMode;
  rightSkill: SkillId;
  leftSkill: SkillId;
}

export interface MenuOptions {
  hasSave?: boolean;
  saveLabel?: string;
  bestTime?: number;
  totalWins?: number;
  unlocks?: string[];
  selection?: Partial<RunSelection>;
  status?: string;
}

export interface SkillHUD {
  id: SkillId;
  key: string;
  level?: number;
  cooldown: number;
  maxCooldown: number;
  active?: boolean;
  unavailable?: boolean;
  charges?: number;
  evolution?: string;
}

export interface HUDState {
  health: number;
  maxHealth: number;
  energy: number;
  maxEnergy: number;
  level: number;
  xp: number;
  nextLevelXp: number;
  elapsed: number;
  kills: number;
  attackArm: 'right' | 'left';
  syncCount: number;
  syncMax: number;
  skills: SkillHUD[];
  objective?: string;
  region?: string;
  interaction?: string;
  empowered?: boolean;
  empowermentRemaining?: number;
  cannonShots?: number;
  shield?: number;
  evolutionDamage?: number;
  boss?: { name: string; health: number; maxHealth: number; phase?: string };
  event?: { title: string; remaining?: number; progress?: number };
  fps?: number;
}

export interface UpgradeChoice {
  id: string;
  title: string;
  description: string;
  detail?: string;
  current?: string;
  next?: string;
  skillId?: SkillId;
  kind?: 'skill' | 'passive' | 'utility' | 'evolution';
  level?: number;
  locked?: boolean;
}

export interface UpgradeState {
  level: number;
  choices: UpgradeChoice[];
  rerolls: number;
  evolution?: boolean;
  subtitle?: string;
}

export interface LoadingState {
  progress: number;
  label: string;
  error?: string;
}

export interface ResultState {
  outcome: 'victory' | 'defeat' | 'timeout';
  mapId: MapId;
  mode: GameMode;
  elapsed: number;
  kills: number;
  level: number;
  damageDealt?: number;
  damageTaken?: number;
  reason?: string;
  best?: boolean;
  build?: { id: SkillId; level: number; evolution?: string }[];
  unlocks?: string[];
  achievements?: string[];
}

export interface MapMarker {
  x: number;
  y: number;
  label?: string;
  type: 'player' | 'boss' | 'event' | 'supply' | 'anchor';
}
export interface MapState {
  mapId: MapId;
  region?: string;
  markers?: MapMarker[];
  /** Optional actual world bounds for converting normalized map markers. */
  regions?: { x: number; y: number; width: number; height: number; label: string }[];
}

export interface UICallbacks {
  onStart(selection: RunSelection): void;
  onContinue(): void;
  onResume(): void;
  onRestart(): void;
  onMainMenu(): void;
  onUpgrade(id: string): void;
  onReroll(): void;
  onSettingsChange(settings: GameSettings): void;
  onPause?(): void;
  onAbility?(id: SkillId): void;
  onMap?(): void;
  onRetry?(): void;
  onSelectionChange?(selection: RunSelection): void;
}
