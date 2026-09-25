/** Game locations are adaptations for play, not additions to character canon. */
export type SurgeMapId = 'old-harbor' | 'tidal-observatory';
export const MAPS: {id:SurgeMapId;name:string;subtitle:string;description:string}[] = [
 {id:'old-harbor',name:'旧港工坊',subtitle:'街巷与货场',description:'穿行小店、货场和双坡高架，接通旧港设施。'},
 {id:'tidal-observatory',name:'潮汐观测庭',subtitle:'水庭与环廊',description:'绕行温室与水庭，沿高架观测环廊寻找新的清场路线。'},
];
export const isSurgeMapId = (value:unknown):value is SurgeMapId => MAPS.some(map=>map.id===value);
export const mapName = (id:SurgeMapId='old-harbor') => MAPS.find(map=>map.id===id)!.name;
