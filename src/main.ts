// ── Hyperliminal — Main Entry Point ──

import './styles/main.scss';
import { createGameState } from './types';
import { initInput, setPickDropCallbacks } from './input';
import { movePlayer, updateHeld, applyGravity } from './physics';
import { setLevelState, loadLevel, levelDefs, checkWin } from './levels';
import { setEditorState, initEditorInputs } from './editor';
import { initRenderer, getCanvas, render } from './renderer';

// ── Create shared game state ──
const state = createGameState();

// ── Initialize renderer (Three.js) ──
initRenderer();
const canvas = getCanvas();

// ── Wire up modules to shared state ──
setLevelState(state);
setEditorState(state, canvas);

// ── Initialize input ──
initInput(state, canvas);
initEditorInputs(canvas);

// ── Pick/Drop callbacks ──
setPickDropCallbacks(
  // Pick
  () => {
    // Find closest pickable near screen center
    // We approximate screen center by checking which pickable is closest along the look direction
    let best: (typeof state.pickables)[number] | null = null;
    let bestD = Infinity;

    const sy = Math.sin(state.yaw),
      cy = Math.cos(state.yaw);
    const sp = Math.sin(state.pitch),
      cp = Math.cos(state.pitch);
    const lookX = sy * cp,
      lookY = sp,
      lookZ = -cy * cp;

    for (const p of state.pickables) {
      const dx = p.x - state.camX;
      const dy = p.y - state.camY;
      const dz = p.z - state.camZ;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      // Check if roughly in front
      const dot = dx * lookX + dy * lookY + dz * lookZ;
      if (dot < 0) continue;

      // Cross product magnitude for angular distance
      const cx = dy * lookZ - dz * lookY;
      const cyy = dz * lookX - dx * lookZ;
      const cz = dx * lookY - dy * lookX;
      const crossLen = Math.sqrt(cx * cx + cyy * cyy + cz * cz);
      const angle = Math.atan2(crossLen, dot);

      // Allow picking within a radius based on object size and distance
      const pickRadius = Math.atan2(p.size + 0.5, dist);
      if (angle < pickRadius + 0.15 && dist < bestD) {
        bestD = dist;
        best = p;
      }
    }

    if (best) {
      state.heldObj = best;
      state.heldOrigSize = best.size;
      state.heldBaseDist = bestD;
    }
  },
  // Drop
  () => {
    if (state.heldObj) {
      state.heldObj.vy = 0;
      state.heldObj = null;
      setTimeout(() => checkWin(), 600);
    }
  },
);

// ── Level skip keys (N/B) ──
document.addEventListener('keydown', (e: KeyboardEvent) => {
  if (state.editorMode) return;
  if (e.code === 'KeyN' && state.locked) {
    state.currentLevel = Math.min(state.currentLevel + 1, levelDefs.length - 1);
    loadLevel(state.currentLevel);
  }
  if (e.code === 'KeyB' && state.locked) {
    state.currentLevel = Math.max(state.currentLevel - 1, 0);
    loadLevel(state.currentLevel);
  }
});

// ── Load first level ──
loadLevel(0);

// ── Ambient hint messages ──
const ambMsgs = [
  'is it big or just far?',
  'perspective defines reality',
  'what you see is what it becomes',
  'look closer. or further.',
  'nothing is as it seems',
];
setInterval(() => {
  const hintEl = document.getElementById('hint')!;
  if (!state.transitioning && state.locked && Math.random() < 0.25) {
    const m = ambMsgs[Math.floor(Math.random() * ambMsgs.length)];
    hintEl.style.transition = 'opacity 1s';
    hintEl.style.opacity = '0';
    setTimeout(() => {
      hintEl.textContent = m;
      hintEl.style.opacity = '0.4';
    }, 1000);
  }
}, 12000);

// ── Main loop ──
let lastTime = 0;

function frame(ts: number): void {
  requestAnimationFrame(frame);
  const dt = Math.min((ts - lastTime) / 1000, 0.1);
  lastTime = ts;
  state.time += dt;

  // Update screen dimensions
  state.W = window.innerWidth;
  state.H = window.innerHeight;

  // Physics
  movePlayer(state, dt);
  updateHeld(state);
  applyGravity(state, dt);

  // Render
  render(state);
}

requestAnimationFrame(frame);
