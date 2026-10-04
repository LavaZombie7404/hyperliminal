// ── Physics: player movement, gravity, held object ──

import { GameState, PLAYER_H, PLAYER_R } from './types';

export function rotY(x: number, z: number, a: number): [number, number] {
  const s = Math.sin(a),
    c = Math.cos(a);
  return [x * c - z * s, x * s + z * c];
}

export function getLookDir(state: GameState): { x: number; y: number; z: number } {
  const sy = Math.sin(state.yaw),
    cy = Math.cos(state.yaw);
  const sp = Math.sin(state.pitch),
    cp = Math.cos(state.pitch);
  return { x: sy * cp, y: sp, z: -cy * cp };
}

export function movePlayer(state: GameState, dt: number): void {
  if (!state.locked) return;

  let mx = 0,
    mz = 0;
  if (state.keys['KeyW'] || state.keys['ArrowUp']) mz -= 1;
  if (state.keys['KeyS'] || state.keys['ArrowDown']) mz += 1;
  if (state.keys['KeyA'] || state.keys['ArrowLeft']) mx -= 1;
  if (state.keys['KeyD'] || state.keys['ArrowRight']) mx += 1;
  const len = Math.sqrt(mx * mx + mz * mz) || 1;
  mx /= len;
  mz /= len;
  const [rmx, rmz] = rotY(mx, mz, state.yaw);
  const spd = (!state.onGround && (mx || mz) ? 11 : 6) * dt;
  state.camX += rmx * spd;
  state.camZ += rmz * spd;

  // Gravity for player
  state.camVY -= 18 * dt;
  state.camY += state.camVY * dt;

  // Check floor
  let floorY = PLAYER_H;

  // Standing on pickable objects
  for (const p of state.pickables) {
    if (p === state.heldObj) continue;
    const dx = state.camX - p.x;
    const dz = state.camZ - p.z;
    const objR = p.size;
    if (Math.abs(dx) < objR + PLAYER_R && Math.abs(dz) < objR + PLAYER_R) {
      const topY = p.y + p.size + PLAYER_H;
      if (state.camY <= topY && state.camY > topY - 1.0 && state.camVY <= 0) {
        floorY = Math.max(floorY, topY);
      }
    }
  }

  // Standing on solid blocks
  for (const s of state.solids) {
    const dx = state.camX - s.x,
      dz = state.camZ - s.z;
    if (Math.abs(dx) < s.w / 2 + PLAYER_R && Math.abs(dz) < s.d / 2 + PLAYER_R) {
      const topY = s.y + s.h + PLAYER_H;
      if (state.camY <= topY && state.camY > topY - 1.0 && state.camVY <= 0) {
        floorY = Math.max(floorY, topY);
      }
    }
  }

  if (state.camY <= floorY) {
    state.camY = floorY;
    state.camVY = 0;
    state.onGround = true;
  } else {
    state.onGround = false;
  }

  // Jump
  if (state.keys['Space'] && state.onGround) {
    state.camVY = 6;
    state.onGround = false;
  }
}

export function updateHeld(state: GameState): void {
  if (!state.heldObj) return;

  // Pitch-based scaling
  const t = (state.pitch + 1.2) / 2.4; // 0 (down) to 1 (up)
  const scale = 0.05 + t * t * t * 5.0;
  state.heldObj.size = state.heldOrigSize * scale;

  const dir = getLookDir(state);
  const scaledDist = state.heldBaseDist * scale;

  state.heldObj.x = state.camX + dir.x * scaledDist;
  state.heldObj.y = state.camY + dir.y * scaledDist;
  state.heldObj.z = state.camZ + dir.z * scaledDist;

  // Clamp to room bounds
  if (state.currentRoomDef) {
    const rd = state.currentRoomDef;
    const hw = rd.w / 2 - state.heldObj.size * 0.5;
    const zNear = rd.oz - state.heldObj.size * 0.5;
    const zFar = rd.oz - rd.d + state.heldObj.size * 0.5;
    state.heldObj.x = Math.max(-hw, Math.min(hw, state.heldObj.x));
    state.heldObj.z = Math.max(zFar, Math.min(zNear, state.heldObj.z));
    state.heldObj.y = Math.max(state.heldObj.size * 0.5, Math.min(rd.h || 4, state.heldObj.y));
  }
}

export function getFloorFor(
  state: GameState,
  p: { x: number; y: number; z: number; size: number },
): number {
  let floor = p.size;

  for (const s of state.solids) {
    const dx = p.x - s.x,
      dz = p.z - s.z;
    if (Math.abs(dx) < s.w / 2 + p.size && Math.abs(dz) < s.d / 2 + p.size) {
      const topY = s.y + s.h + p.size;
      if (topY > floor) floor = topY;
    }
  }

  for (const o of state.pickables) {
    if (o === p || o === state.heldObj) continue;
    const dx = p.x - o.x,
      dz = p.z - o.z;
    if (Math.abs(dx) < o.size + p.size * 0.5 && Math.abs(dz) < o.size + p.size * 0.5) {
      const topY = o.y + o.size + p.size;
      if (topY > floor && p.y >= topY - 0.5) floor = topY;
    }
  }

  return floor;
}

export function applyGravity(state: GameState, dt: number): void {
  const gravity = 14;
  for (const p of state.pickables) {
    if (p === state.heldObj) {
      p.vy = 0;
      continue;
    }
    const floorY = getFloorFor(state, p);
    if (p.y > floorY + 0.01) {
      p.vy -= gravity * dt;
      p.y += p.vy * dt;
      if (p.y <= floorY) {
        p.y = floorY;
        p.vy = Math.abs(p.vy) > 1.5 ? -p.vy * 0.25 : 0;
      }
    } else {
      p.y = floorY;
      p.vy = 0;
    }
  }
}

/** Raycast for held-object distance (pitch only) */
export function raycastRoom(state: GameState): number {
  const cp = Math.cos(state.pitch),
    sp = Math.sin(state.pitch);
  const dirY = sp;
  const dirForward = -cp;
  let bestT = Infinity;

  // Floor (y=0)
  if (dirY < -0.001) {
    const t = -state.camY / dirY;
    if (t > 0.5 && t < bestT) bestT = t;
  }
  // Ceiling
  if (dirY > 0.001) {
    const roomH = state.currentRoomDef ? state.currentRoomDef.h : 4;
    const t = (roomH - state.camY) / dirY;
    if (t > 0.5 && t < bestT) bestT = t;
  }
  // Back wall
  if (state.currentRoomDef && dirForward < -0.001) {
    const zFar = state.currentRoomDef.oz - state.currentRoomDef.d;
    const t = (zFar - state.camZ) / dirForward;
    if (t > 0.5 && t < bestT) bestT = t;
  }

  if (bestT === Infinity) bestT = 20;
  bestT = Math.min(bestT, 50);
  return bestT;
}
