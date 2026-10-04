// ── Level definitions and world-building helpers ──

import { GameState, LevelDef, Pickable } from './types';

// Shared game state reference — set once from main
let state: GameState;

export function setLevelState(s: GameState): void {
  state = s;
}

// ── Helper functions ──

export function addWall(
  x1: number,
  z1: number,
  x2: number,
  z2: number,
  y0: number,
  y1: number,
  color: string,
): void {
  state.walls.push({ x1, z1, x2, z2, y0, y1, color });
}

export function makeRoom(w: number, h: number, d: number, oz: number): void {
  state.currentRoomDef = { w, h, d, oz };
  const hw = w / 2;

  addWall(-hw, oz, -hw, oz - d, 0, h, '#8890a0');
  addWall(hw, oz, hw, oz - d, 0, h, '#8890a0');
  addWall(-hw, oz - d, hw, oz - d, 0, h, '#7a8292');

  // Baseboard trim
  addWall(-hw, oz, -hw, oz - d, 0, 0.15, '#5a6070');
  addWall(hw, oz, hw, oz - d, 0, 0.15, '#5a6070');
  addWall(-hw, oz - d, hw, oz - d, 0, 0.15, '#5a6070');

  // Crown molding
  addWall(-hw, oz, -hw, oz - d, h - 0.1, h, '#9aa0b0');
  addWall(hw, oz, hw, oz - d, h - 0.1, h, '#9aa0b0');
  addWall(-hw, oz - d, hw, oz - d, h - 0.1, h, '#9aa0b0');

  // Wall panels
  const panelSpacing = Math.max(3, d / 6);
  for (let z = oz - panelSpacing; z > oz - d + 1; z -= panelSpacing) {
    state.decor.push({
      type: 'panel',
      x: -hw + 0.01,
      z,
      y0: 0.3,
      y1: h - 0.2,
      vertical: true,
      side: 'left',
    });
    state.decor.push({
      type: 'panel',
      x: hw - 0.01,
      z,
      y0: 0.3,
      y1: h - 0.2,
      vertical: true,
      side: 'right',
    });
  }

  // Wall lights
  const lightSpacing = Math.max(5, d / 4);
  for (let z = oz - lightSpacing / 2; z > oz - d + 2; z -= lightSpacing) {
    state.decor.push({ type: 'light', x: -hw + 0.02, z, y: h * 0.65, side: 'left' });
    state.decor.push({ type: 'light', x: hw - 0.02, z, y: h * 0.65, side: 'right' });
  }

  // Floor stripe
  state.decor.push({ type: 'floorstripe', x1: 0, z1: oz - 1, x2: 0, z2: oz - d + 1, w: 0.04 });

  // Back wall band
  state.decor.push({
    type: 'wallband',
    z: oz - d - 0.02,
    x1: -hw + 0.5,
    x2: hw - 0.5,
    y: h * 0.55,
    thickness: 0.03,
  });
}

export function addPickable(
  x: number,
  y: number,
  z: number,
  size: number,
  color: string,
  shape: Pickable['shape'],
): void {
  state.pickables.push({ x, y, z, size, color, shape, origSize: size, vy: 0 });
}

export function addSolid(
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  color?: string,
): void {
  state.solids.push({ x, y, z, w, h, d, color: color || '#6a7080' });
}

export function addZone(
  x: number,
  y: number,
  z: number,
  targetSize: number,
  tolerance: number,
  label: string,
): void {
  state.zones.push({ x, y, z, targetSize, tolerance, label, satisfied: false });
}

export function clearLevel(): void {
  state.walls = [];
  state.pickables = [];
  state.zones = [];
  state.decor = [];
  state.solids = [];
  state.heldObj = null;
  state.currentRoomDef = null;
  state.camVY = 0;
  state.onGround = false;
}

export function loadLevel(idx: number): void {
  const levelEl = document.getElementById('level-text')!;
  const hintEl = document.getElementById('hint')!;

  if (idx >= levelDefs.length) {
    showMessage('all levels complete — editor unlocked!', 3000);
    // Editor enter is triggered from main
    return;
  }
  clearLevel();
  levelDefs[idx].setup();
  hintEl.textContent = levelDefs[idx].hint;
  levelEl.textContent = 'LEVEL ' + (idx + 1);
}

export function showMessage(t: string, dur?: number): void {
  const msgEl = document.getElementById('message')!;
  msgEl.textContent = t;
  msgEl.classList.add('show');
  setTimeout(() => msgEl.classList.remove('show'), dur || 2000);
}

export function checkWin(): void {
  let allGood = true;
  for (const z of state.zones) {
    let found = false;
    for (const p of state.pickables) {
      const dx = p.x - z.x,
        dy = p.y - z.y,
        dz = p.z - z.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const sizeOk = Math.abs(p.size - z.targetSize) <= z.tolerance;
      if (dist < z.targetSize + 1.5 && sizeOk) {
        found = true;
        break;
      }
    }
    z.satisfied = found;
    if (!found) allGood = false;
  }
  if (allGood && state.zones.length > 0) {
    state.transitioning = true;
    showMessage('perception shifted', 1800);
    setTimeout(() => {
      state.currentLevel++;
      loadLevel(state.currentLevel);
      state.transitioning = false;
    }, 2200);
  }
}

// ── Cube color constant ──
const C = '#a0a8b8';

// ── 20 Level definitions ──
export const levelDefs: LevelDef[] = [
  // 1 — Tutorial: make it big
  {
    hint: 'Grab the cube. Look up — it grows. Drop it in the zone.',
    setup() {
      makeRoom(10, 4, 22, 2);
      state.camX = 0;
      state.camY = 1.6;
      state.camZ = 1;
      state.yaw = 0;
      state.pitch = 0;
      addPickable(-2, 0.5, -4, 0.5, C, 'cube');
      addZone(2, 1.2, -14, 1.8, 0.5, 'make it big');
    },
  },
  // 2 — Shrink
  {
    hint: 'The sphere is huge. Look down to shrink it.',
    setup() {
      makeRoom(12, 4, 25, 2);
      state.camX = 0;
      state.camY = 1.6;
      state.camZ = 1;
      state.yaw = 0;
      state.pitch = 0;
      addPickable(0, 1.5, -8, 2.2, '#4ecdc4', 'sphere');
      addZone(0, 0.5, -18, 0.5, 0.3, 'make it tiny');
    },
  },
  // 3 — Swap sizes
  {
    hint: 'Swap their sizes.',
    setup() {
      makeRoom(14, 5, 30, 2);
      state.camX = 0;
      state.camY = 1.6;
      state.camZ = 1;
      state.yaw = 0;
      state.pitch = 0;
      addPickable(-3, 0.4, -5, 0.4, '#ffe66d', 'pyramid');
      addPickable(3, 1.2, -5, 2.0, C, 'cube');
      addZone(-3, 1.2, -22, 2.0, 0.6, 'big pyramid');
      addZone(3, 0.4, -22, 0.5, 0.3, 'small cube');
    },
  },
  // 4 — Long corridor
  {
    hint: 'Long corridor. Perspective is everything.',
    setup() {
      makeRoom(6, 4, 55, 2);
      state.camX = 0;
      state.camY = 1.6;
      state.camZ = 1;
      state.yaw = 0;
      state.pitch = 0;
      addPickable(0, 0.8, -4, 0.3, '#fd79a8', 'diamond');
      addZone(0, 2, -45, 2.8, 0.7, 'fill the void');
    },
  },
  // 5 — Three shapes
  {
    hint: 'Three shapes. Three zones.',
    setup() {
      makeRoom(16, 5, 35, 2);
      state.camX = 0;
      state.camY = 1.6;
      state.camZ = 1;
      state.yaw = 0;
      state.pitch = 0;
      addPickable(-4, 0.5, -4, 0.4, C, 'cube');
      addPickable(0, 1.5, -4, 1.5, '#fab1a0', 'sphere');
      addPickable(4, 0.8, -4, 0.8, '#00cec9', 'diamond');
      addZone(-4, 1.5, -26, 1.6, 0.4, 'big cube');
      addZone(0, 0.5, -26, 0.5, 0.3, 'tiny sphere');
      addZone(4, 2, -26, 2.2, 0.5, 'large diamond');
    },
  },
  // 6 — Tiny room, giant object
  {
    hint: 'A big sphere in a tiny room. Make it fit.',
    setup() {
      makeRoom(5, 3, 10, 2);
      state.camX = 0;
      state.camY = 1.6;
      state.camZ = 1;
      state.yaw = 0;
      state.pitch = 0;
      addPickable(0, 1.5, -5, 2.5, '#74b9ff', 'sphere');
      addZone(0, 0.3, -7, 0.3, 0.2, 'microscopic');
    },
  },
  // 7 — Climb to reach the zone
  {
    hint: 'The zone is on the ledge. Use the blocks to climb up.',
    setup() {
      makeRoom(14, 7, 30, 2);
      state.camX = 0;
      state.camY = 1.6;
      state.camZ = 1;
      state.yaw = 0;
      state.pitch = 0;
      addSolid(0, 0, -10, 4, 1.2, 4, '#6a7080');
      addSolid(0, 0, -16, 4, 2.5, 4, '#5e6676');
      addSolid(0, 0, -22, 6, 4.0, 5, '#545c6c');
      addPickable(2, 0.5, -4, 0.5, '#00cec9', 'diamond');
      addZone(0, 4.6, -22, 0.6, 0.3, 'up here');
    },
  },
  // 8 — Narrow corridor, precise sizing
  {
    hint: 'Thread the needle.',
    setup() {
      makeRoom(4, 3, 40, 2);
      state.camX = 0;
      state.camY = 1.6;
      state.camZ = 1;
      state.yaw = 0;
      state.pitch = 0;
      addPickable(0, 0.5, -3, 0.5, '#dfe6e9', 'cube');
      addZone(0, 1.0, -32, 1.0, 0.2, 'exact fit');
    },
  },
  // 9 — Diamond rain
  {
    hint: 'Four diamonds. Four sizes. Sort them.',
    setup() {
      makeRoom(18, 5, 35, 2);
      state.camX = 0;
      state.camY = 1.6;
      state.camZ = 1;
      state.yaw = 0;
      state.pitch = 0;
      addPickable(-6, 0.5, -5, 0.5, '#00cec9', 'diamond');
      addPickable(-2, 0.5, -5, 0.5, '#55efc4', 'diamond');
      addPickable(2, 0.5, -5, 0.5, '#fd79a8', 'diamond');
      addPickable(6, 0.5, -5, 0.5, '#a29bfe', 'diamond');
      addZone(-6, 0.4, -28, 0.4, 0.2, 'tiny');
      addZone(-2, 0.8, -28, 0.8, 0.25, 'small');
      addZone(2, 1.4, -28, 1.4, 0.35, 'medium');
      addZone(6, 2.2, -28, 2.2, 0.45, 'large');
    },
  },
  // 10 — Platform puzzle
  {
    hint: 'Climb the platforms. Resize the sphere to fit the zone at the top.',
    setup() {
      makeRoom(14, 8, 35, 2);
      state.camX = 0;
      state.camY = 1.6;
      state.camZ = 1;
      state.yaw = 0;
      state.pitch = 0;
      addSolid(-4, 0, -8, 5, 1.5, 5, '#6a7080');
      addSolid(0, 0, -14, 5, 3.0, 5, '#5e6676');
      addSolid(4, 0, -20, 5, 4.5, 5, '#545c6c');
      addSolid(0, 0, -26, 8, 6.0, 5, '#4c5464');
      addPickable(-2, 1.0, -4, 1.0, '#fd79a8', 'sphere');
      addZone(0, 6.5, -26, 0.4, 0.25, 'the top');
    },
  },
  // 11 — All spheres, matching sizes
  {
    hint: 'Make all three spheres the same size.',
    setup() {
      makeRoom(14, 4, 30, 2);
      state.camX = 0;
      state.camY = 1.6;
      state.camZ = 1;
      state.yaw = 0;
      state.pitch = 0;
      addPickable(-4, 0.3, -5, 0.3, '#fab1a0', 'sphere');
      addPickable(0, 1.0, -5, 1.0, '#74b9ff', 'sphere');
      addPickable(4, 2.0, -5, 2.0, '#4ecdc4', 'sphere');
      addZone(-4, 1.0, -22, 1.0, 0.3, 'medium');
      addZone(0, 1.0, -22, 1.0, 0.3, 'medium');
      addZone(4, 1.0, -22, 1.0, 0.3, 'medium');
    },
  },
  // 12 — Pyramid gauntlet
  {
    hint: 'Big pyramids from small beginnings.',
    setup() {
      makeRoom(8, 4, 45, 2);
      state.camX = 0;
      state.camY = 1.6;
      state.camZ = 1;
      state.yaw = 0;
      state.pitch = 0;
      addPickable(-2, 0.3, -4, 0.3, '#ffe66d', 'pyramid');
      addPickable(2, 0.3, -4, 0.3, '#ffeaa7', 'pyramid');
      addZone(-2, 2.5, -35, 2.5, 0.6, 'giant');
      addZone(2, 2.5, -35, 2.5, 0.6, 'giant');
    },
  },
  // 13 — Mixed bag close quarters
  {
    hint: 'Everything must shrink.',
    setup() {
      makeRoom(8, 3, 15, 2);
      state.camX = 0;
      state.camY = 1.6;
      state.camZ = 1;
      state.yaw = 0;
      state.pitch = 0;
      addPickable(-2, 1.5, -5, 1.5, C, 'cube');
      addPickable(0, 1.2, -5, 1.2, '#fd79a8', 'diamond');
      addPickable(2, 1.8, -5, 1.8, '#4ecdc4', 'sphere');
      addZone(-2, 0.3, -10, 0.3, 0.15, 'tiny');
      addZone(0, 0.3, -10, 0.3, 0.15, 'tiny');
      addZone(2, 0.3, -10, 0.3, 0.15, 'tiny');
    },
  },
  // 14 — Two platforms, bridge the gap
  {
    hint: 'Two ledges. Grow a cube to bridge the gap. Carry the sphere across.',
    setup() {
      makeRoom(20, 5, 35, 2);
      state.camX = -7;
      state.camY = 3.6;
      state.camZ = -10;
      state.yaw = 0;
      state.pitch = 0;
      addSolid(-7, 0, -15, 6, 2.0, 12, '#6a7080');
      addSolid(7, 0, -15, 6, 2.0, 12, '#6a7080');
      addPickable(-5, 2.5, -12, 0.5, C, 'cube');
      addPickable(-5, 2.5, -16, 0.4, '#55efc4', 'sphere');
      addZone(7, 2.6, -15, 0.5, 0.3, 'across');
    },
  },
  // 15 — Extreme corridor
  {
    hint: 'The longest hallway. Patience.',
    setup() {
      makeRoom(4, 3, 80, 2);
      state.camX = 0;
      state.camY = 1.6;
      state.camZ = 1;
      state.yaw = 0;
      state.pitch = 0;
      addPickable(0, 0.2, -3, 0.2, '#a29bfe', 'diamond');
      addZone(0, 3.5, -70, 3.5, 0.8, 'massive');
    },
  },
  // 16 — Reverse
  {
    hint: 'The giant must become a speck.',
    setup() {
      makeRoom(20, 6, 30, 2);
      state.camX = 0;
      state.camY = 1.6;
      state.camZ = 1;
      state.yaw = 0;
      state.pitch = 0;
      addPickable(0, 3.0, -10, 3.0, '#fab1a0', 'sphere');
      addZone(0, 0.2, -20, 0.2, 0.12, 'speck');
    },
  },
  // 17 — Five cubes ascending
  {
    hint: 'Build a staircase of sizes.',
    setup() {
      makeRoom(20, 5, 35, 2);
      state.camX = 0;
      state.camY = 1.6;
      state.camZ = 1;
      state.yaw = 0;
      state.pitch = 0;
      for (let i = 0; i < 5; i++) {
        addPickable(-8 + i * 4, 0.5, -5, 0.5, C, 'cube');
        const target = 0.4 + i * 0.5;
        addZone(-8 + i * 4, target, -28, target, 0.2, ['xs', 's', 'm', 'l', 'xl'][i]);
      }
    },
  },
  // 18 — Spiral ascent
  {
    hint: 'Spiral up the tower. Shrink the diamond at the top.',
    setup() {
      makeRoom(12, 10, 30, 2);
      state.camX = 0;
      state.camY = 1.6;
      state.camZ = 1;
      state.yaw = 0;
      state.pitch = 0;
      addSolid(-3, 0, -6, 6, 1.5, 5, '#626a7a');
      addSolid(3, 0, -10, 6, 3.0, 5, '#6a7080');
      addSolid(-3, 0, -14, 6, 4.5, 5, '#5e6676');
      addSolid(3, 0, -18, 6, 6.0, 5, '#545c6c');
      addSolid(0, 0, -22, 8, 7.5, 5, '#4c5464');
      addPickable(0, 1.0, -4, 1.0, '#a29bfe', 'diamond');
      addZone(0, 8.0, -22, 0.3, 0.35, 'top');
    },
  },
  // 19 — The gallery
  {
    hint: 'The gallery. Each piece has its place.',
    setup() {
      makeRoom(24, 5, 40, 2);
      state.camX = 0;
      state.camY = 1.6;
      state.camZ = 1;
      state.yaw = 0;
      state.pitch = 0;
      const shapes: Pickable['shape'][] = [
        'cube',
        'sphere',
        'pyramid',
        'diamond',
        'cube',
        'sphere',
      ];
      const colors = [C, '#4ecdc4', '#ffe66d', '#fd79a8', C, '#fab1a0'];
      const sizes = [0.4, 1.8, 0.6, 2.0, 1.2, 0.3];
      const targets = [1.6, 0.4, 2.0, 0.5, 0.5, 1.8];
      for (let i = 0; i < 6; i++) {
        addPickable(-10 + i * 4, sizes[i], -6, sizes[i], colors[i], shapes[i]);
        addZone(-10 + i * 4, targets[i], -32, targets[i], 0.35, shapes[i]);
      }
    },
  },
  // 20 — Final
  {
    hint: 'The last room. Trust your eyes.',
    setup() {
      makeRoom(10, 4, 70, 2);
      state.camX = 0;
      state.camY = 1.6;
      state.camZ = 1;
      state.yaw = 0;
      state.pitch = 0;
      addPickable(0, 0.3, -3, 0.3, C, 'cube');
      addZone(0, 3.2, -60, 3.2, 0.6, 'perceive');
    },
  },
];
