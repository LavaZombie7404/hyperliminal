// ── Level Editor ──

import { GameState, EditorItem, Pickable } from './types';
import { clearLevel, makeRoom, addSolid, addPickable, addZone } from './levels';
import { getLookDir } from './physics';

let state: GameState;
let canvas: HTMLCanvasElement;

export function setEditorState(s: GameState, c: HTMLCanvasElement): void {
  state = s;
  canvas = c;
}

export function edEnter(): void {
  state.editorMode = true;
  edShowPanel(true);
  document.getElementById('level-text')!.textContent = 'EDITOR';
  document.getElementById('hint')!.textContent = 'E = toggle panel | F to place';
  edBuildRoom();
}

export function edShowPanel(show: boolean): void {
  state.edPanelOpen = show;
  const editorEl = document.getElementById('editor')!;
  editorEl.classList.toggle('active', show);
  if (show) {
    document.exitPointerLock();
  }
}

export function edSetTool(t: 'solid' | 'pick' | 'zone'): void {
  state.edTool = t;
  document
    .querySelectorAll('#editor button[id^="ed-t-"]')
    .forEach((b) => b.classList.remove('active-tool'));
  const btn = document.getElementById('ed-t-' + t);
  if (btn) btn.classList.add('active-tool');
}

export function edBuildRoom(): void {
  const rw = parseFloat((document.getElementById('ed-rw') as HTMLInputElement).value) || 14;
  const rh = parseFloat((document.getElementById('ed-rh') as HTMLInputElement).value) || 5;
  const rd = parseFloat((document.getElementById('ed-rd') as HTMLInputElement).value) || 30;
  clearLevel();
  makeRoom(rw, rh, rd, 2);
  state.camX = 0;
  state.camY = 1.6;
  state.camZ = 1;
  state.yaw = 0;
  state.pitch = 0;
  // Re-place all items
  for (const item of state.edItems) {
    if (item.type === 'solid') addSolid(item.x, 0, item.z, item.w!, item.h!, item.d!, item.color);
    else if (item.type === 'pick')
      addPickable(item.x, item.size!, item.z, item.size!, item.color!, item.shape as Pickable['shape']);
    else if (item.type === 'zone')
      addZone(item.x, item.targetSize!, item.z, item.targetSize!, item.tolerance!, item.label!);
  }
}

export function edRebuild(): void {
  if (!state.editorMode) return;
  const rw = parseFloat((document.getElementById('ed-rw') as HTMLInputElement).value) || 14;
  const rh = parseFloat((document.getElementById('ed-rh') as HTMLInputElement).value) || 5;
  const rd = parseFloat((document.getElementById('ed-rd') as HTMLInputElement).value) || 30;
  const cx = state.camX,
    cy = state.camY,
    cz = state.camZ,
    cYaw = state.yaw,
    cPitch = state.pitch;
  clearLevel();
  makeRoom(rw, rh, rd, 2);
  state.camX = cx;
  state.camY = cy;
  state.camZ = cz;
  state.yaw = cYaw;
  state.pitch = cPitch;
  for (const item of state.edItems) {
    if (item.type === 'solid') addSolid(item.x, 0, item.z, item.w!, item.h!, item.d!, item.color);
    else if (item.type === 'pick')
      addPickable(item.x, item.size!, item.z, item.size!, item.color!, item.shape as Pickable['shape']);
    else if (item.type === 'zone')
      addZone(item.x, item.targetSize!, item.z, item.targetSize!, item.tolerance!, item.label!);
  }
}

export function edPlace(): void {
  const dir = getLookDir(state);
  const dist = 5;
  const px = state.camX + dir.x * dist;
  const pz = state.camZ + dir.z * dist;

  if (state.edTool === 'solid') {
    const sz = parseFloat((document.getElementById('ed-size') as HTMLInputElement).value) || 1;
    const col = (document.getElementById('ed-color') as HTMLInputElement).value;
    const item: EditorItem = {
      type: 'solid',
      x: Math.round(px),
      z: Math.round(pz),
      w: sz * 3,
      h: sz * 1.5,
      d: sz * 3,
      color: col,
    };
    state.edItems.push(item);
    addSolid(item.x, 0, item.z, item.w!, item.h!, item.d!, item.color);
  } else if (state.edTool === 'pick') {
    const sz = parseFloat((document.getElementById('ed-size') as HTMLInputElement).value) || 1;
    const col = (document.getElementById('ed-color') as HTMLInputElement).value;
    const shape = (document.getElementById('ed-shape') as HTMLSelectElement).value;
    const item: EditorItem = {
      type: 'pick',
      x: Math.round(px * 2) / 2,
      z: Math.round(pz * 2) / 2,
      size: sz,
      color: col,
      shape,
    };
    state.edItems.push(item);
    addPickable(item.x, item.size!, item.z, item.size!, item.color!, item.shape as Pickable['shape']);
  } else if (state.edTool === 'zone') {
    const ts = parseFloat((document.getElementById('ed-ztarget') as HTMLInputElement).value) || 1;
    const tol = parseFloat((document.getElementById('ed-ztol') as HTMLInputElement).value) || 0.3;
    const lbl = (document.getElementById('ed-zlabel') as HTMLInputElement).value || 'goal';
    const item: EditorItem = {
      type: 'zone',
      x: Math.round(px * 2) / 2,
      z: Math.round(pz * 2) / 2,
      targetSize: ts,
      tolerance: tol,
      label: lbl,
    };
    state.edItems.push(item);
    addZone(item.x, item.targetSize!, item.z, item.targetSize!, item.tolerance!, item.label!);
  }
  edUpdateList();
}

export function edUpdateList(): void {
  const el = document.getElementById('ed-items')!;
  el.innerHTML = state.edItems
    .map((it, i) => {
      let desc = it.type as string;
      if (it.type === 'pick') desc = it.shape!;
      if (it.type === 'zone') desc = 'zone: ' + it.label;
      if (it.type === 'solid') desc = 'platform';
      return `<div class="item-entry"><span>${desc} (${it.x}, ${it.z})</span><button data-remove="${i}">x</button></div>`;
    })
    .join('');

  // Attach click handlers for remove buttons
  el.querySelectorAll('button[data-remove]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = parseInt((btn as HTMLElement).dataset.remove!, 10);
      edRemove(idx);
    });
  });
}

export function edRemove(i: number): void {
  state.edItems.splice(i, 1);
  edRebuild();
  edUpdateList();
}

export function edClearAll(): void {
  state.edItems = [];
  edRebuild();
  edUpdateList();
}

export function edTestLevel(): void {
  edShowPanel(false);
  canvas.requestPointerLock();
  document.getElementById('level-text')!.textContent = 'EDITOR TEST';
  document.getElementById('hint')!.textContent = 'Testing... Press E to return to editor.';
  state.camX = 0;
  state.camY = 1.6;
  state.camZ = 1;
  state.yaw = 0;
  state.pitch = 0;
}

export function edStopTest(): void {
  edShowPanel(true);
  document.getElementById('level-text')!.textContent = 'EDITOR';
  document.getElementById('hint')!.textContent = 'E = toggle panel | F to place';
  edRebuild();
}

export function edExport(): void {
  const rw = parseFloat((document.getElementById('ed-rw') as HTMLInputElement).value) || 14;
  const rh = parseFloat((document.getElementById('ed-rh') as HTMLInputElement).value) || 5;
  const rd = parseFloat((document.getElementById('ed-rd') as HTMLInputElement).value) || 30;
  const data = { room: { w: rw, h: rh, d: rd }, items: state.edItems };
  (document.getElementById('export-box') as HTMLTextAreaElement).value = JSON.stringify(
    data,
    null,
    2,
  );
}

export function initEditorInputs(canvas: HTMLCanvasElement): void {
  // Room size inputs trigger rebuild
  ['ed-rw', 'ed-rh', 'ed-rd'].forEach((id) => {
    document.getElementById(id)!.addEventListener('change', edRebuild);
  });

  // Wire up editor button onclicks
  document.getElementById('ed-t-solid')!.addEventListener('click', () => edSetTool('solid'));
  document.getElementById('ed-t-pick')!.addEventListener('click', () => edSetTool('pick'));
  document.getElementById('ed-t-zone')!.addEventListener('click', () => edSetTool('zone'));

  // Wire up other editor buttons by id
  document.getElementById('ed-clear-all')!.addEventListener('click', edClearAll);
  document.getElementById('ed-test')!.addEventListener('click', edTestLevel);
  document.getElementById('ed-stop-test')!.addEventListener('click', edStopTest);
  document.getElementById('ed-export')!.addEventListener('click', edExport);

  // Editor keyboard shortcuts
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (!state.editorMode) return;
    if (e.code === 'KeyE') {
      if (state.edPanelOpen) {
        edShowPanel(false);
        canvas.requestPointerLock();
      } else {
        edShowPanel(true);
      }
    }
    if (e.code === 'KeyF' && state.locked && !state.edPanelOpen) {
      edPlace();
    }
  });

  // P = enter editor from anywhere
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.code === 'KeyP' && state.locked && !state.editorMode) {
      edEnter();
    }
  });

  // Editor canvas click to re-lock
  canvas.addEventListener('click', () => {
    if (state.editorMode && state.edPanelOpen) {
      edShowPanel(false);
      canvas.requestPointerLock();
    }
  });
}
