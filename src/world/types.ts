import * as THREE from 'three';

export type MapId = 'old-harbor' | 'new-harbor' | 'tidal-observatory';
export type Vec3 = [number, number, number];
export interface WorldCollider {
  id: string;
  center: Vec3;
  half: Vec3;
  rotation?: Vec3;
  tag: 'ground' | 'solid' | 'ramp' | 'bridge' | 'dynamic';
  enabled?: boolean;
}
export interface Zone {
  id: string;
  name: string;
  center: Vec3;
  radius: number;
  description: string;
}
export interface NavWaypoint { id: string; position: Vec3; zoneId?: string; layer: number }
export interface NavEdge { from: string; to: string; enabled: boolean; shortcut?: string }
export interface EventSite { id: string; position: Vec3; zoneId: string; kind: 'power' | 'bridge' | 'supply'; name: string }
export interface MapWorld {
  id: MapId;
  group: THREE.Group;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  spawn: THREE.Vector3;
  zones: Zone[];
  colliders: WorldCollider[];
  anchors: { id: string; position: Vec3; zoneId: string }[];
  nav: { waypoints: NavWaypoint[]; edges: NavEdge[] };
  eventSites: EventSite[];
  occluders: THREE.Object3D[];
  theme: { background: number; fog: number; fogNear: number; fogFar: number; ambient: number; sun: number; sunPosition: Vec3; exposure: number };
  heightAt(x: number, z: number, currentY?: number): number;
  walkableAt(x: number, z: number, currentY?: number, radius?: number): boolean;
  findPath(from: Vec3, to: Vec3): Vec3[];
  openShortcut(id: string, immediate?: boolean): void;
  update(time: number, dt: number): void;
  dispose(): void;
}
export interface Surface {
  minX: number; maxX: number; minZ: number; maxZ: number;
  y: number;
  endY?: number;
  axis?: 'x' | 'z';
  tag: 'ground' | 'ramp' | 'bridge';
  enabled?: boolean;
}
