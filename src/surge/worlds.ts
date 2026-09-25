import {createHarbor} from './harbor';
import {createObservatory} from './observatory';
import type {SurgeMapId} from './maps';
export function createSurgeWorld(id:SurgeMapId,seed:number){
 return id==='tidal-observatory'?createObservatory(seed):createHarbor(seed);
}
