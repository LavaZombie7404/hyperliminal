// ── Input handling: pointer lock, mouse, keyboard ──

import { GameState } from './types';

let onPickCallback: (() => void) | null = null;
let onDropCallback: (() => void) | null = null;

export function setPickDropCallbacks(onPick: () => void, onDrop: () => void): void {
  onPickCallback = onPick;
  onDropCallback = onDrop;
}

export function initInput(state: GameState, canvas: HTMLCanvasElement): void {
  const blocker = document.getElementById('blocker')!;

  // Pointer lock
  blocker.addEventListener('click', () => canvas.requestPointerLock());

  canvas.addEventListener('click', () => {
    if (state.editorMode && state.edPanelOpen) {
      // handled in editor module
    } else if (!state.locked) {
      canvas.requestPointerLock();
    }
  });

  document.addEventListener('pointerlockchange', () => {
    state.locked = !!document.pointerLockElement;
    if (state.editorMode) {
      blocker.classList.add('hidden');
    } else {
      blocker.classList.toggle('hidden', state.locked);
    }
  });

  // Mouse movement
  document.addEventListener('mousemove', (e: MouseEvent) => {
    if (!state.locked) return;
    state.yaw += e.movementX * 0.002;
    state.pitch -= e.movementY * 0.002;
    state.pitch = Math.max(-1.2, Math.min(1.2, state.pitch));
  });

  // Keyboard
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    state.keys[e.code] = true;
  });

  document.addEventListener('keyup', (e: KeyboardEvent) => {
    state.keys[e.code] = false;
  });

  // Mouse click -> pick/drop
  document.addEventListener('mousedown', (e: MouseEvent) => {
    if (!state.locked || state.transitioning || e.button !== 0) return;
    if (state.heldObj) {
      if (onDropCallback) onDropCallback();
    } else {
      if (onPickCallback) onPickCallback();
    }
  });
}
