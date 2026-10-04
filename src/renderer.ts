// ── Three.js Renderer — matches the original Canvas 2D flat-shaded look ──

import * as THREE from 'three';
import { GameState, Wall, Pickable, Zone, DecorItem, RoomDef } from './types';
import { rotY } from './physics';

// ── Color helpers (match the original) ──

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return '#' + [clamp(r), clamp(g), clamp(b)].map((v) => v.toString(16).padStart(2, '0')).join('');
}

function lighten(hex: string, amt: number): string {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(r + amt, g + amt, b + amt);
}

function darken(hex: string, amt: number): string {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(r - amt, g - amt, b - amt);
}

function colorToThree(hex: string): THREE.Color {
  return new THREE.Color(hex);
}

// ── Renderer state ──

let renderer: THREE.WebGLRenderer;
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;

// Managed mesh groups
let roomGroup: THREE.Group; // floor, ceiling, walls, decor
let solidGroup: THREE.Group; // static platforms
let dynamicGroup: THREE.Group; // pickables, zones, shadows, HUD

// Reusable materials pool
const matCache: Map<string, THREE.MeshBasicMaterial> = new Map();

// Track what we built so we know when to rebuild
let lastWallCount = -1;
let lastSolidCount = -1;
let lastRoomDef: RoomDef | null = null;

export function initRenderer(): THREE.WebGLRenderer {
  const canvas = document.getElementById('c') as HTMLCanvasElement | null;
  renderer = new THREE.WebGLRenderer({
    antialias: false,
    canvas: canvas || undefined,
    failIfMajorPerformanceCaveat: false,
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(1); // match the flat pixelated look
  renderer.setClearColor(0x4a5060);
  renderer.sortObjects = false; // we do manual depth sorting

  // If we reused the existing canvas, just ensure the id is set
  // Otherwise add the renderer's canvas to the DOM
  if (!canvas) {
    const oldCanvas = document.getElementById('c');
    if (oldCanvas) oldCanvas.remove();
    document.body.appendChild(renderer.domElement);
  }
  renderer.domElement.id = 'c';

  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x4a5060, 2, 45);

  camera = new THREE.PerspectiveCamera(
    70, // approximate FOV to match f = H * 0.7
    window.innerWidth / window.innerHeight,
    0.1,
    200,
  );

  roomGroup = new THREE.Group();
  solidGroup = new THREE.Group();
  dynamicGroup = new THREE.Group();
  scene.add(roomGroup);
  scene.add(solidGroup);
  scene.add(dynamicGroup);

  window.addEventListener('resize', () => {
    const w = window.innerWidth,
      h = window.innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });

  return renderer;
}

export function getCanvas(): HTMLCanvasElement {
  return renderer.domElement;
}

// ── Material helpers ──

function getMat(
  color: string,
  opacity: number = 1,
  transparent: boolean = false,
): THREE.MeshBasicMaterial {
  const key = color + '|' + opacity.toFixed(2) + '|' + (transparent ? 't' : 'o');
  let mat = matCache.get(key);
  if (!mat) {
    mat = new THREE.MeshBasicMaterial({
      color: colorToThree(color),
      transparent: transparent || opacity < 1,
      opacity,
      side: THREE.DoubleSide,
      depthWrite: opacity >= 0.99,
    });
    matCache.set(key, mat);
  }
  return mat;
}

function getTransparentMat(color: string, opacity: number): THREE.MeshBasicMaterial {
  return getMat(color, opacity, true);
}

// ── Build static room geometry ──

function buildRoom(state: GameState): void {
  // Clear existing
  while (roomGroup.children.length) {
    const child = roomGroup.children[0];
    roomGroup.remove(child);
    disposeObject(child);
  }

  if (!state.currentRoomDef) return;
  const rd = state.currentRoomDef;

  // Floor — checkerboard
  buildCheckerFloor(rd);

  // Ceiling
  buildCeiling(rd);

  // Walls
  for (const w of state.walls) {
    buildWallMesh(w);
  }

  // Decor
  for (const d of state.decor) {
    buildDecorMesh(d);
  }
}

function buildCheckerFloor(rd: RoomDef): void {
  const step = 2;
  const hw = rd.w / 2;
  // Build within room bounds with some margin
  const xMin = Math.floor(-hw / step) * step;
  const xMax = Math.ceil(hw / step) * step;
  const zMin = rd.oz - rd.d;
  const zMax = rd.oz;

  for (let x = xMin; x < xMax; x += step) {
    for (let z = zMin; z < zMax; z += step) {
      const dark = ((Math.floor(x / step) + Math.floor(z / step)) & 1) === 0;
      const color = dark ? '#505868' : '#5c6474';
      const geo = new THREE.PlaneGeometry(step, step);
      const mesh = new THREE.Mesh(geo, getMat(color));
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(x + step / 2, 0, z + step / 2);
      roomGroup.add(mesh);
    }
  }
}

function buildCeiling(rd: RoomDef): void {
  const step = 3;
  const hw = rd.w / 2;
  const ceilH = rd.h;
  const xMin = Math.floor(-hw / step) * step;
  const xMax = Math.ceil(hw / step) * step;
  const zMin = rd.oz - rd.d;
  const zMax = rd.oz;

  for (let x = xMin; x < xMax; x += step) {
    for (let z = zMin; z < zMax; z += step) {
      const geo = new THREE.PlaneGeometry(step, step);
      const mesh = new THREE.Mesh(geo, getMat('#70788a'));
      mesh.rotation.x = Math.PI / 2;
      mesh.position.set(x + step / 2, ceilH, z + step / 2);
      roomGroup.add(mesh);
    }
  }
}

function buildWallMesh(w: Wall): void {
  // Wall is a quad from (x1,y0,z1) to (x2,y1,z2)
  const dx = w.x2 - w.x1;
  const dz = w.z2 - w.z1;
  const width = Math.sqrt(dx * dx + dz * dz);
  const height = w.y1 - w.y0;

  if (width < 0.001 || height < 0.001) return;

  const geo = new THREE.PlaneGeometry(width, height);
  const mesh = new THREE.Mesh(geo, getMat(w.color));

  // Position at center of wall
  mesh.position.set((w.x1 + w.x2) / 2, (w.y0 + w.y1) / 2, (w.z1 + w.z2) / 2);

  // Rotate to face correct direction
  const angle = Math.atan2(dx, dz);
  mesh.rotation.y = angle;

  roomGroup.add(mesh);
}

function buildDecorMesh(d: DecorItem): void {
  if (d.type === 'panel') {
    // Thin vertical line on wall
    const height = d.y1 - d.y0;
    const geo = new THREE.PlaneGeometry(0.02, height);
    const mesh = new THREE.Mesh(geo, getTransparentMat('#000000', 0.04));
    mesh.position.set(d.x, (d.y0 + d.y1) / 2, d.z);
    // Face inward based on side
    mesh.rotation.y = d.side === 'left' ? Math.PI / 2 : -Math.PI / 2;
    roomGroup.add(mesh);
  } else if (d.type === 'light') {
    const hw = 0.15,
      hh = 0.25;
    // Light panel
    const geo = new THREE.PlaneGeometry(hw * 2, hh * 2);
    const mesh = new THREE.Mesh(geo, getTransparentMat('#fffaeb', 0.5));
    mesh.position.set(d.x, d.y, d.z);
    mesh.rotation.y = d.side === 'left' ? Math.PI / 2 : -Math.PI / 2;
    roomGroup.add(mesh);

    // Glow sprite
    const spriteMat = new THREE.SpriteMaterial({
      color: 0xfff5dc,
      transparent: true,
      opacity: 0.12,
      blending: THREE.AdditiveBlending,
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.set(d.side === 'left' ? d.x + 0.1 : d.x - 0.1, d.y, d.z);
    sprite.scale.set(1.5, 1.5, 1);
    roomGroup.add(sprite);
  } else if (d.type === 'floorstripe') {
    const len = Math.abs(d.z2 - d.z1);
    const geo = new THREE.PlaneGeometry(d.w * 2, len);
    const mesh = new THREE.Mesh(geo, getTransparentMat('#000000', 0.03));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set((d.x1 + d.x2) / 2, 0.01, (d.z1 + d.z2) / 2);
    roomGroup.add(mesh);
  } else if (d.type === 'wallband') {
    const width = Math.abs(d.x2 - d.x1);
    const geo = new THREE.PlaneGeometry(width, d.thickness * 2);
    const mesh = new THREE.Mesh(geo, getTransparentMat('#000000', 0.03));
    mesh.position.set((d.x1 + d.x2) / 2, d.y, d.z);
    roomGroup.add(mesh);
  }
}

// ── Build solid platforms ──

function buildSolids(state: GameState): void {
  while (solidGroup.children.length) {
    const child = solidGroup.children[0];
    solidGroup.remove(child);
    disposeObject(child);
  }

  for (const s of state.solids) {
    const hw = s.w / 2,
      hd = s.d / 2;
    const group = new THREE.Group();

    // Top face
    const topGeo = new THREE.PlaneGeometry(s.w, s.d);
    const topMesh = new THREE.Mesh(topGeo, getMat(lighten(s.color, 10)));
    topMesh.rotation.x = -Math.PI / 2;
    topMesh.position.set(s.x, s.y + s.h, s.z);
    group.add(topMesh);

    // Front face (+Z)
    const frontGeo = new THREE.PlaneGeometry(s.w, s.h);
    const frontMesh = new THREE.Mesh(frontGeo, getMat(s.color));
    frontMesh.position.set(s.x, s.y + s.h / 2, s.z + hd);
    group.add(frontMesh);

    // Back face (-Z)
    const backGeo = new THREE.PlaneGeometry(s.w, s.h);
    const backMesh = new THREE.Mesh(backGeo, getMat(darken(s.color, 8)));
    backMesh.rotation.y = Math.PI;
    backMesh.position.set(s.x, s.y + s.h / 2, s.z - hd);
    group.add(backMesh);

    // Left face (-X)
    const leftGeo = new THREE.PlaneGeometry(s.d, s.h);
    const leftMesh = new THREE.Mesh(leftGeo, getMat(darken(s.color, 5)));
    leftMesh.rotation.y = Math.PI / 2;
    leftMesh.position.set(s.x - hw, s.y + s.h / 2, s.z);
    group.add(leftMesh);

    // Right face (+X)
    const rightGeo = new THREE.PlaneGeometry(s.d, s.h);
    const rightMesh = new THREE.Mesh(rightGeo, getMat(darken(s.color, 12)));
    rightMesh.rotation.y = -Math.PI / 2;
    rightMesh.position.set(s.x + hw, s.y + s.h / 2, s.z);
    group.add(rightMesh);

    solidGroup.add(group);
  }
}

// ── Create shape meshes for pickables ──

function createCubeMesh(p: Pickable): THREE.Group {
  const group = new THREE.Group();
  const s = p.size;

  // Front face (square)
  const frontGeo = new THREE.PlaneGeometry(s * 2, s * 2);
  const frontMesh = new THREE.Mesh(frontGeo, getMat(p.color));
  frontMesh.position.z = 0.001;
  group.add(frontMesh);

  // Front face bottom shading overlay
  const shadingGeo = new THREE.PlaneGeometry(s * 2, s);
  const shadingMesh = new THREE.Mesh(shadingGeo, getTransparentMat('#000000', 0.04));
  shadingMesh.position.set(0, -s / 2, 0.002);
  group.add(shadingMesh);

  // Top face (isometric parallelogram) — built as custom geometry
  const topShape = new THREE.Shape();
  topShape.moveTo(-s, s);
  topShape.lineTo(-s * 0.65, s * 1.3);
  topShape.lineTo(s * 1.35, s * 1.3);
  topShape.lineTo(s, s);
  topShape.closePath();
  const topGeo = new THREE.ShapeGeometry(topShape);
  const topMesh = new THREE.Mesh(topGeo, getMat(lighten(p.color, 15)));
  topMesh.position.z = 0.003;
  group.add(topMesh);

  // Right face (isometric parallelogram)
  const rightShape = new THREE.Shape();
  rightShape.moveTo(s, s);
  rightShape.lineTo(s * 1.35, s * 1.3);
  rightShape.lineTo(s * 1.35, -s * 0.7);
  rightShape.lineTo(s, -s);
  rightShape.closePath();
  const rightGeo = new THREE.ShapeGeometry(rightShape);
  const rightMesh = new THREE.Mesh(rightGeo, getMat(darken(p.color, 15)));
  rightMesh.position.z = 0.002;
  group.add(rightMesh);

  return group;
}

function createSphereMesh(p: Pickable): THREE.Group {
  const group = new THREE.Group();
  const s = p.size;

  // Main circle
  const circGeo = new THREE.CircleGeometry(s, 32);
  const circMesh = new THREE.Mesh(circGeo, getMat(p.color));
  group.add(circMesh);

  // Highlight gradient — approximate with a smaller lighter circle offset
  const highlightGeo = new THREE.CircleGeometry(s * 0.5, 24);
  const highlightMesh = new THREE.Mesh(highlightGeo, getTransparentMat('#ffffff', 0.2));
  highlightMesh.position.set(-s * 0.2, s * 0.2, 0.001);
  group.add(highlightMesh);

  // Rim darkening — ring
  const rimGeo = new THREE.RingGeometry(s * 0.75, s, 32);
  const rimMesh = new THREE.Mesh(rimGeo, getTransparentMat('#000000', 0.1));
  rimMesh.position.z = 0.002;
  group.add(rimMesh);

  return group;
}

function createPyramidMesh(p: Pickable): THREE.Group {
  const group = new THREE.Group();
  const s = p.size;

  // Left face triangle
  const leftShape = new THREE.Shape();
  leftShape.moveTo(0, s * 1.3);
  leftShape.lineTo(-s, -s);
  leftShape.lineTo(0, -s * 0.5);
  leftShape.closePath();
  const leftGeo = new THREE.ShapeGeometry(leftShape);
  const leftMesh = new THREE.Mesh(leftGeo, getMat(p.color));
  group.add(leftMesh);

  // Right face triangle (darker)
  const rightShape = new THREE.Shape();
  rightShape.moveTo(0, s * 1.3);
  rightShape.lineTo(s, -s);
  rightShape.lineTo(0, -s * 0.5);
  rightShape.closePath();
  const rightGeo = new THREE.ShapeGeometry(rightShape);
  const rightMesh = new THREE.Mesh(rightGeo, getMat(darken(p.color, 20)));
  rightMesh.position.z = 0.001;
  group.add(rightMesh);

  return group;
}

function createDiamondMesh(p: Pickable): THREE.Group {
  const group = new THREE.Group();
  const s = p.size;

  // Top triangle (lighter)
  const topShape = new THREE.Shape();
  topShape.moveTo(0, s * 1.4);
  topShape.lineTo(s, 0);
  topShape.lineTo(-s, 0);
  topShape.closePath();
  const topGeo = new THREE.ShapeGeometry(topShape);
  const topMesh = new THREE.Mesh(topGeo, getMat(p.color));
  group.add(topMesh);

  // Bottom triangle (darker)
  const botShape = new THREE.Shape();
  botShape.moveTo(-s, 0);
  botShape.lineTo(s, 0);
  botShape.lineTo(0, -s * 1.4);
  botShape.closePath();
  const botGeo = new THREE.ShapeGeometry(botShape);
  const botMesh = new THREE.Mesh(botGeo, getMat(darken(p.color, 15)));
  botMesh.position.z = 0.001;
  group.add(botMesh);

  return group;
}

function createShadowMesh(p: Pickable): THREE.Mesh {
  const s = p.size;
  // Ellipse shadow on floor
  const geo = new THREE.CircleGeometry(1, 24);
  geo.scale(s * 0.7, s * 0.15, 1);
  const mesh = new THREE.Mesh(geo, getTransparentMat('#000000', 0.12));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(p.x, 0.02, p.z);
  return mesh;
}

// ── Zone rendering ──

function createZoneMesh(z: Zone, time: number): THREE.Group {
  const group = new THREE.Group();
  const s = z.targetSize;
  const pulse = Math.sin(time * 2.5) * 0.12 + 0.88;
  const sp = s * pulse;

  // Zone wireframe box (using EdgesGeometry for dashed look)
  const boxGeo = new THREE.BoxGeometry(sp * 2, sp * 2, sp * 2);
  const edges = new THREE.EdgesGeometry(boxGeo);

  const lineColor = z.satisfied ? 0x50c8a0 : 0x50c8a0;
  const lineOpacity = z.satisfied ? 0.8 : 0.35;

  const lineMat = new THREE.LineBasicMaterial({
    color: lineColor,
    transparent: true,
    opacity: lineOpacity,
    linewidth: z.satisfied ? 2 : 1,
  });

  const lineSegments = new THREE.LineSegments(edges, lineMat);
  lineSegments.position.set(z.x, z.y, z.z);
  group.add(lineSegments);

  // Semi-transparent fill
  const fillOpacity = z.satisfied ? 0.12 : 0.04;
  const fillMat = new THREE.MeshBasicMaterial({
    color: 0x50c8a0,
    transparent: true,
    opacity: fillOpacity,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const fillMesh = new THREE.Mesh(boxGeo.clone(), fillMat);
  fillMesh.position.set(z.x, z.y, z.z);
  group.add(fillMesh);

  // Label as a sprite
  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 256;
  labelCanvas.height = 64;
  const lctx = labelCanvas.getContext('2d')!;
  lctx.clearRect(0, 0, 256, 64);
  lctx.fillStyle = z.satisfied ? 'rgba(60,160,130,0.7)' : 'rgba(60,160,130,0.35)';
  lctx.font = '24px Courier New';
  lctx.textAlign = 'center';
  lctx.fillText(z.label, 128, 40);

  const labelTex = new THREE.CanvasTexture(labelCanvas);
  const spriteMat = new THREE.SpriteMaterial({
    map: labelTex,
    transparent: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.position.set(z.x, z.y - sp - 0.4, z.z);
  sprite.scale.set(2, 0.5, 1);
  group.add(sprite);

  return group;
}

// ── Billboard shape rendering (shapes face camera like original 2D) ──

function createShapeBillboard(p: Pickable): THREE.Group {
  let shapeMesh: THREE.Group;

  switch (p.shape) {
    case 'cube':
      shapeMesh = createCubeMesh(p);
      break;
    case 'sphere':
      shapeMesh = createSphereMesh(p);
      break;
    case 'pyramid':
      shapeMesh = createPyramidMesh(p);
      break;
    case 'diamond':
      shapeMesh = createDiamondMesh(p);
      break;
    default:
      shapeMesh = createCubeMesh(p);
  }

  return shapeMesh;
}

// ── Cleanup ──

function disposeObject(obj: THREE.Object3D): void {
  if (obj instanceof THREE.Mesh) {
    obj.geometry?.dispose();
  } else if (obj instanceof THREE.LineSegments) {
    obj.geometry?.dispose();
  }
  if (obj instanceof THREE.Sprite) {
    (obj.material as THREE.SpriteMaterial).map?.dispose();
    obj.material.dispose();
  }
  if ('children' in obj) {
    while (obj.children.length) {
      const child = obj.children[0];
      obj.remove(child);
      disposeObject(child);
    }
  }
}

// ── Main render function ──

export function render(state: GameState): void {
  // Update camera from game state
  camera.position.set(state.camX, state.camY, state.camZ);

  // Apply yaw and pitch.
  // Original: look = (sin(yaw)*cp, sp, -cos(yaw)*cp). yaw>0 = look right.
  // Three.js Euler Y rotation is counter-clockwise (left), so negate yaw.
  const euler = new THREE.Euler(state.pitch, -state.yaw, 0, 'YXZ');
  camera.quaternion.setFromEuler(euler);

  // Check if room geometry needs rebuilding
  const roomChanged = state.walls.length !== lastWallCount || state.currentRoomDef !== lastRoomDef;
  if (roomChanged) {
    buildRoom(state);
    lastWallCount = state.walls.length;
    lastRoomDef = state.currentRoomDef;
  }

  // Check if solids changed
  if (state.solids.length !== lastSolidCount) {
    buildSolids(state);
    lastSolidCount = state.solids.length;
  }

  // Clear dynamic group and rebuild each frame
  while (dynamicGroup.children.length) {
    const child = dynamicGroup.children[0];
    dynamicGroup.remove(child);
    disposeObject(child);
  }

  // Depth sort pickables and zones together (same as original)
  const drawList: Array<{ type: 'zone' | 'pick'; obj: Zone | Pickable; depth: number }> = [];
  for (const z of state.zones) {
    drawList.push({ type: 'zone', obj: z, depth: depthOf(state, z) });
  }
  for (const p of state.pickables) {
    drawList.push({ type: 'pick', obj: p, depth: depthOf(state, p) });
  }
  drawList.sort((a, b) => a.depth - b.depth);

  for (const item of drawList) {
    if (item.type === 'zone') {
      const zoneMesh = createZoneMesh(item.obj as Zone, state.time);
      dynamicGroup.add(zoneMesh);
    } else {
      const p = item.obj as Pickable;

      // Shadow on floor
      const shadow = createShadowMesh(p);
      dynamicGroup.add(shadow);

      // Billboard shape — face toward camera
      const shapeBillboard = createShapeBillboard(p);

      // Position at object location, then make it face camera
      shapeBillboard.position.set(p.x, p.y, p.z);

      // Billboard: always face camera
      shapeBillboard.lookAt(camera.position);

      // Calculate distance-based fade (matching original shade calc)
      const dx = p.x - state.camX;
      const dz = p.z - state.camZ;
      const [, rz] = rotY(dx, dz, -state.yaw);
      const dist = -rz;
      if (dist > 0.1) {
        const shade = Math.max(0.3, Math.min(1, 5 / dist));
        shapeBillboard.traverse((child) => {
          if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshBasicMaterial) {
            // Clone material for per-object opacity
            const mat = child.material.clone();
            mat.opacity *= shade;
            mat.transparent = mat.transparent || shade < 1;
            child.material = mat;
          }
        });
      }

      dynamicGroup.add(shapeBillboard);
    }
  }

  // HUD: held object size text
  if (state.heldObj) {
    const hudCanvas = document.createElement('canvas');
    hudCanvas.width = 128;
    hudCanvas.height = 32;
    const hctx = hudCanvas.getContext('2d')!;
    hctx.clearRect(0, 0, 128, 32);
    hctx.fillStyle = 'rgba(255,255,255,0.3)';
    hctx.font = '14px Courier New';
    hctx.textAlign = 'center';
    hctx.fillText(`size: ${state.heldObj.size.toFixed(1)}`, 64, 20);

    const hudTex = new THREE.CanvasTexture(hudCanvas);
    const hudMat = new THREE.SpriteMaterial({
      map: hudTex,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const hudSprite = new THREE.Sprite(hudMat);
    // Place slightly below center of screen, in front of camera
    const lookDir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const downDir = new THREE.Vector3(0, -1, 0).applyQuaternion(camera.quaternion);
    hudSprite.position
      .copy(camera.position)
      .add(lookDir.multiplyScalar(0.5))
      .add(downDir.multiplyScalar(0.08));
    hudSprite.scale.set(0.15, 0.04, 1);
    hudSprite.renderOrder = 9999;
    dynamicGroup.add(hudSprite);
  }

  // Update fog distance based on room depth
  if (state.currentRoomDef) {
    const fogFar = Math.min(state.currentRoomDef.d + 5, 80);
    (scene.fog as THREE.Fog).far = fogFar;
  }

  renderer.render(scene, camera);
}

function depthOf(state: GameState, obj: { x: number; z: number }): number {
  const dx = obj.x - state.camX,
    dz = obj.z - state.camZ;
  const [, rz] = rotY(dx, dz, -state.yaw);
  return rz;
}
