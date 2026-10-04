// ── Shared TypeScript types for Hyperliminal ──

export interface Wall {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  y0: number;
  y1: number;
  color: string;
}

export interface Pickable {
  x: number;
  y: number;
  z: number;
  size: number;
  color: string;
  shape: 'cube' | 'sphere' | 'pyramid' | 'diamond';
  origSize: number;
  vy: number;
}

export interface Zone {
  x: number;
  y: number;
  z: number;
  targetSize: number;
  tolerance: number;
  label: string;
  satisfied: boolean;
}

export interface Solid {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  color: string;
}

export interface DecorPanel {
  type: 'panel';
  x: number;
  z: number;
  y0: number;
  y1: number;
  vertical: boolean;
  side: 'left' | 'right';
}

export interface DecorLight {
  type: 'light';
  x: number;
  z: number;
  y: number;
  side: 'left' | 'right';
}

export interface DecorFloorStripe {
  type: 'floorstripe';
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  w: number;
}

export interface DecorWallBand {
  type: 'wallband';
  z: number;
  x1: number;
  x2: number;
  y: number;
  thickness: number;
}

export type DecorItem = DecorPanel | DecorLight | DecorFloorStripe | DecorWallBand;

export interface RoomDef {
  w: number;
  h: number;
  d: number;
  oz: number;
}

export interface LevelDef {
  hint: string;
  setup: () => void;
}

export interface EditorItem {
  type: 'solid' | 'pick' | 'zone';
  x: number;
  z: number;
  // solid props
  w?: number;
  h?: number;
  d?: number;
  color?: string;
  // pick props
  size?: number;
  shape?: string;
  // zone props
  targetSize?: number;
  tolerance?: number;
  label?: string;
}

export interface GameState {
  // Camera
  camX: number;
  camY: number;
  camZ: number;
  yaw: number;
  pitch: number;
  camVY: number;
  onGround: boolean;

  // Input
  locked: boolean;
  keys: Record<string, boolean>;

  // World objects
  walls: Wall[];
  pickables: Pickable[];
  zones: Zone[];
  decor: DecorItem[];
  solids: Solid[];

  // Held object
  heldObj: Pickable | null;
  heldOrigSize: number;
  heldBaseDist: number;

  // Level
  currentLevel: number;
  transitioning: boolean;
  currentRoomDef: RoomDef | null;

  // Editor
  editorMode: boolean;
  edTool: 'solid' | 'pick' | 'zone';
  edItems: EditorItem[];
  edPanelOpen: boolean;

  // Timing
  time: number;

  // Screen dimensions
  W: number;
  H: number;
}

export const PLAYER_H = 1.6;
export const PLAYER_R = 0.3;
export const ROOM_H = 4;

export function createGameState(): GameState {
  return {
    camX: 0,
    camY: 1.6,
    camZ: 0,
    yaw: 0,
    pitch: 0,
    camVY: 0,
    onGround: false,

    locked: false,
    keys: {},

    walls: [],
    pickables: [],
    zones: [],
    decor: [],
    solids: [],

    heldObj: null,
    heldOrigSize: 0,
    heldBaseDist: 4,

    currentLevel: 0,
    transitioning: false,
    currentRoomDef: null,

    editorMode: false,
    edTool: 'solid',
    edItems: [],
    edPanelOpen: false,

    time: 0,

    W: window.innerWidth,
    H: window.innerHeight,
  };
}
