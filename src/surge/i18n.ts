import { CONTENT_EN } from './i18n-content';
import { EVENTS_EN } from './i18n-events';
import { UI_EN } from './i18n-ui';
export type Locale = 'zh-CN' | 'en';
const KEY = 'oinja-surge-locale';
let locale: Locale | undefined;
export function getLocale(): Locale {
  if (!locale) { try { locale = localStorage.getItem(KEY) === 'en' ? 'en' : 'zh-CN'; } catch { locale = 'zh-CN'; } }
  return locale;
}
export function setLocale(next: Locale): void {
  locale = next;
  try { localStorage.setItem(KEY, next); } catch { /* Play remains available when storage is blocked. */ }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = next;
    document.title = next === 'en' ? 'Oinja · Surge' : 'Oinja · 电涌';
    document.querySelector('canvas')?.setAttribute('aria-label', next === 'en' ? 'Third-person survival game' : '第三人称生存游戏画面');
  }
}
export const ENGLISH: Readonly<Record<string,string>> = { ...CONTENT_EN, ...UI_EN, ...EVENTS_EN };
type Params = Record<string,string|number>;
/** Translate an individual content value or a named-parameter message, never rendered HTML. */
export function t(source: string, params: Params = {}): string {
  if (!source) return '';
  if (getLocale() !== 'en') return format(source, params);
  const trimmed=source.trim(), direct=ENGLISH[trimmed];
  if(direct!==undefined) return format(source.slice(0,source.indexOf(trimmed))+direct+source.slice(source.indexOf(trimmed)+trimmed.length),params);
  // Legacy simulation messages are parsed by their explicit schema at the presentation boundary.
  const templates: [RegExp,string,string[]][] = [
    [/^(.+) · 已启动$/,'{name} · 已启动',['name']],
    [/^(.+) 暂停 · 随时可以重新启动$/,'{name} 暂停 · 随时可以重新启动',['name']],
    [/^保留(.+)，恢复全部生命并获得50护盾。$/,'保留{name}，恢复全部生命并获得50护盾。',['name']],
    [/^机制进化 · (.+)$/,'机制进化 · {name}',['name']],
    [/^载入遇到问题：(.*)$/,'载入遇到问题：{error}',['error']],
    [/^载入失败，请刷新重试：(.*)$/,'载入失败，请刷新重试：{error}',['error']],
  ];
  for(const [pattern,key,names] of templates){const match=source.match(pattern);if(match)return t(key,Object.fromEntries(names.map((name,i)=>[name,name==='error'?match[i+1]:t(match[i+1])])));}
  const rank=source.match(/^(.+) (\d+)$/);if(rank&&ENGLISH[rank[1]])return `${t(rank[1])} ${rank[2]}`;
  const detail=source.match(/^(.+) · (\d+) → (\d+)$/);if(detail&&ENGLISH[detail[1]])return `${t(detail[1])} · ${detail[2]} → ${detail[3]}`;
  return format(source,params);
}
function format(text:string,params:Params):string {return text.replace(/\{(\w+)\}/g,(match,key)=>String(params[key]??match));}
