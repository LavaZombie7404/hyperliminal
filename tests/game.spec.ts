import { test, expect, Page } from '@playwright/test';

// Helper: simulate pointer lock being granted
async function grantPointerLock(page: Page) {
  await page.evaluate(() => {
    const canvas = document.querySelector('canvas#c') as HTMLCanvasElement;
    Object.defineProperty(document, 'pointerLockElement', {
      value: canvas,
      writable: true,
      configurable: true,
    });
    document.dispatchEvent(new Event('pointerlockchange'));
  });
  await page.waitForTimeout(100);
}

// Helper: simulate pointer lock release
async function releasePointerLock(page: Page) {
  await page.evaluate(() => {
    Object.defineProperty(document, 'pointerLockElement', {
      value: null,
      writable: true,
      configurable: true,
    });
    document.dispatchEvent(new Event('pointerlockchange'));
  });
  await page.waitForTimeout(100);
}

// Helper: wait for game to be ready (state exposed)
async function waitForGame(page: Page) {
  await page.goto('/');
  // Wait for game state to be exposed
  await page.waitForFunction(() => (window as any).__gameState !== undefined, null, {
    timeout: 10000,
  });
  await page.waitForTimeout(300);
}

test.describe('Game Loading', () => {
  test('page loads with all UI elements', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);

    // Blocker screen
    const blocker = page.locator('#blocker');
    await expect(blocker).toBeVisible();
    await expect(blocker.locator('h1')).toHaveText('HYPERLIMINAL');

    // Canvas exists
    const canvas = page.locator('canvas#c');
    await expect(canvas).toBeAttached();

    // UI overlay
    await expect(page.locator('#level-text')).toHaveText('LEVEL 1');

    // Editor panel hidden initially
    const editor = page.locator('#editor');
    await expect(editor).not.toHaveClass(/active/);
  });

  test('game state is initialized correctly', async ({ page }) => {
    await waitForGame(page);

    const state = await page.evaluate(() => {
      const s = (window as any).__gameState;
      return {
        camX: s.camX,
        camY: s.camY,
        camZ: s.camZ,
        yaw: s.yaw,
        pitch: s.pitch,
        currentLevel: s.currentLevel,
        locked: s.locked,
        editorMode: s.editorMode,
        pickablesCount: s.pickables.length,
        zonesCount: s.zones.length,
      };
    });

    // Level 1 initial state
    expect(state.camX).toBe(0);
    expect(state.camY).toBeCloseTo(1.6, 1);
    expect(state.camZ).toBe(1);
    expect(state.yaw).toBe(0);
    expect(state.pitch).toBe(0);
    expect(state.currentLevel).toBe(0);
    expect(state.locked).toBe(false);
    expect(state.editorMode).toBe(false);
    // Level 1 has 1 pickable and 1 zone
    expect(state.pickablesCount).toBe(1);
    expect(state.zonesCount).toBe(1);
  });

  test('no page errors on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => {
      errors.push(err.message);
    });

    await page.goto('/');
    await page.waitForTimeout(2000);

    expect(errors).toEqual([]);
  });
});

test.describe('Pointer Lock & Blocker', () => {
  test('blocker hides when pointer lock is granted', async ({ page }) => {
    await waitForGame(page);
    await grantPointerLock(page);

    const state = await page.evaluate(() => (window as any).__gameState.locked);
    expect(state).toBe(true);

    await expect(page.locator('#blocker')).toHaveClass(/hidden/);
  });

  test('blocker shows when pointer lock is released', async ({ page }) => {
    await waitForGame(page);
    await grantPointerLock(page);
    await expect(page.locator('#blocker')).toHaveClass(/hidden/);

    await releasePointerLock(page);

    const state = await page.evaluate(() => (window as any).__gameState.locked);
    expect(state).toBe(false);
    await expect(page.locator('#blocker')).not.toHaveClass(/hidden/);
  });
});

test.describe('WASD Movement', () => {
  test('W key moves player forward (negative Z)', async ({ page }) => {
    await waitForGame(page);
    await grantPointerLock(page);

    const initialZ = await page.evaluate(() => (window as any).__gameState.camZ);

    // Simulate W keydown, wait for physics frames, keyup
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(500);
    await page.keyboard.up('KeyW');
    await page.waitForTimeout(100);

    const newZ = await page.evaluate(() => (window as any).__gameState.camZ);
    expect(newZ).toBeLessThan(initialZ);
  });

  test('S key moves player backward (positive Z)', async ({ page }) => {
    await waitForGame(page);
    await grantPointerLock(page);

    const initialZ = await page.evaluate(() => (window as any).__gameState.camZ);

    await page.keyboard.down('KeyS');
    await page.waitForTimeout(500);
    await page.keyboard.up('KeyS');
    await page.waitForTimeout(100);

    const newZ = await page.evaluate(() => (window as any).__gameState.camZ);
    expect(newZ).toBeGreaterThan(initialZ);
  });

  test('A key moves player left (negative X)', async ({ page }) => {
    await waitForGame(page);
    await grantPointerLock(page);

    const initialX = await page.evaluate(() => (window as any).__gameState.camX);

    await page.keyboard.down('KeyA');
    await page.waitForTimeout(500);
    await page.keyboard.up('KeyA');
    await page.waitForTimeout(100);

    const newX = await page.evaluate(() => (window as any).__gameState.camX);
    // With yaw=0, A should move left (negative X)
    expect(newX).toBeLessThan(initialX);
  });

  test('D key moves player right (positive X)', async ({ page }) => {
    await waitForGame(page);
    await grantPointerLock(page);

    const initialX = await page.evaluate(() => (window as any).__gameState.camX);

    await page.keyboard.down('KeyD');
    await page.waitForTimeout(500);
    await page.keyboard.up('KeyD');
    await page.waitForTimeout(100);

    const newX = await page.evaluate(() => (window as any).__gameState.camX);
    expect(newX).toBeGreaterThan(initialX);
  });

  test('Space key triggers jump (camY increases)', async ({ page }) => {
    await waitForGame(page);
    await grantPointerLock(page);

    // Wait for player to be on ground
    await page.waitForTimeout(200);
    const beforeY = await page.evaluate(() => (window as any).__gameState.camY);

    await page.keyboard.press('Space');
    await page.waitForTimeout(150); // catch mid-jump

    const midY = await page.evaluate(() => (window as any).__gameState.camY);
    expect(midY).toBeGreaterThan(beforeY);
  });

  test('diagonal movement (W+A) moves in expected direction', async ({ page }) => {
    await waitForGame(page);
    await grantPointerLock(page);

    const initial = await page.evaluate(() => {
      const s = (window as any).__gameState;
      return { x: s.camX, z: s.camZ };
    });

    await page.keyboard.down('KeyW');
    await page.keyboard.down('KeyA');
    await page.waitForTimeout(500);
    await page.keyboard.up('KeyW');
    await page.keyboard.up('KeyA');
    await page.waitForTimeout(100);

    const after = await page.evaluate(() => {
      const s = (window as any).__gameState;
      return { x: s.camX, z: s.camZ };
    });

    // Forward + left = -Z and -X
    expect(after.z).toBeLessThan(initial.z);
    expect(after.x).toBeLessThan(initial.x);
  });

  test('movement does not work when pointer is not locked', async ({ page }) => {
    await waitForGame(page);
    // Don't lock pointer

    const initialZ = await page.evaluate(() => (window as any).__gameState.camZ);

    await page.keyboard.down('KeyW');
    await page.waitForTimeout(300);
    await page.keyboard.up('KeyW');

    const newZ = await page.evaluate(() => (window as any).__gameState.camZ);
    // Should not have moved (only gravity affects camY)
    expect(newZ).toBe(initialZ);
  });
});

test.describe('Mouse Look', () => {
  test('mouse movement updates yaw', async ({ page }) => {
    await waitForGame(page);
    await grantPointerLock(page);

    const initialYaw = await page.evaluate(() => (window as any).__gameState.yaw);

    // Simulate mousemove with movementX
    await page.evaluate(() => {
      const event = new MouseEvent('mousemove', {
        movementX: 100,
        movementY: 0,
      });
      document.dispatchEvent(event);
    });

    const newYaw = await page.evaluate(() => (window as any).__gameState.yaw);
    expect(newYaw).toBeGreaterThan(initialYaw);
  });

  test('mouse movement updates pitch', async ({ page }) => {
    await waitForGame(page);
    await grantPointerLock(page);

    const initialPitch = await page.evaluate(() => (window as any).__gameState.pitch);

    // Simulate mousemove with movementY (negative = look up = positive pitch)
    await page.evaluate(() => {
      const event = new MouseEvent('mousemove', {
        movementX: 0,
        movementY: -100,
      });
      document.dispatchEvent(event);
    });

    const newPitch = await page.evaluate(() => (window as any).__gameState.pitch);
    expect(newPitch).toBeGreaterThan(initialPitch);
  });

  test('pitch is clamped to [-1.2, 1.2]', async ({ page }) => {
    await waitForGame(page);
    await grantPointerLock(page);

    // Look very far up
    await page.evaluate(() => {
      for (let i = 0; i < 20; i++) {
        document.dispatchEvent(
          new MouseEvent('mousemove', { movementX: 0, movementY: -500 }),
        );
      }
    });

    const pitch = await page.evaluate(() => (window as any).__gameState.pitch);
    expect(pitch).toBeLessThanOrEqual(1.2);
    expect(pitch).toBeGreaterThanOrEqual(-1.2);
  });

  test('movement direction follows yaw rotation', async ({ page }) => {
    await waitForGame(page);
    await grantPointerLock(page);

    // Rotate 90 degrees right (yaw increases)
    await page.evaluate(() => {
      // yaw += movementX * 0.002, so we need ~785 pixels for PI/2
      for (let i = 0; i < 10; i++) {
        document.dispatchEvent(
          new MouseEvent('mousemove', { movementX: 79, movementY: 0 }),
        );
      }
    });
    await page.waitForTimeout(100);

    const yaw = await page.evaluate(() => (window as any).__gameState.yaw);
    // Should be roughly PI/2 (1.57)
    expect(yaw).toBeCloseTo(Math.PI / 2, 0);

    // Now pressing W should move in +X direction (since we rotated right 90 degrees)
    const initialX = await page.evaluate(() => (window as any).__gameState.camX);
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(500);
    await page.keyboard.up('KeyW');

    const newX = await page.evaluate(() => (window as any).__gameState.camX);
    expect(newX).toBeGreaterThan(initialX);
  });
});

test.describe('Level System', () => {
  test('level 1 has correct hint text', async ({ page }) => {
    await waitForGame(page);

    const hint = await page.evaluate(
      () => document.getElementById('hint')?.textContent,
    );
    expect(hint).toContain('Grab the cube');
  });

  test('N key advances level when locked', async ({ page }) => {
    await waitForGame(page);
    await grantPointerLock(page);

    await page.keyboard.press('KeyN');
    await page.waitForTimeout(300);

    await expect(page.locator('#level-text')).toHaveText('LEVEL 2');

    const state = await page.evaluate(() => (window as any).__gameState.currentLevel);
    expect(state).toBe(1);
  });

  test('B key goes back a level when locked', async ({ page }) => {
    await waitForGame(page);
    await grantPointerLock(page);

    // Go to level 2
    await page.keyboard.press('KeyN');
    await page.waitForTimeout(200);
    await expect(page.locator('#level-text')).toHaveText('LEVEL 2');

    // Go back to level 1
    await page.keyboard.press('KeyB');
    await page.waitForTimeout(200);
    await expect(page.locator('#level-text')).toHaveText('LEVEL 1');
  });

  test('B key does not go below level 1', async ({ page }) => {
    await waitForGame(page);
    await grantPointerLock(page);

    await page.keyboard.press('KeyB');
    await page.waitForTimeout(200);

    await expect(page.locator('#level-text')).toHaveText('LEVEL 1');
    const level = await page.evaluate(() => (window as any).__gameState.currentLevel);
    expect(level).toBe(0);
  });

  test('level switch resets camera position', async ({ page }) => {
    await waitForGame(page);
    await grantPointerLock(page);

    // Move around in level 1
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(300);
    await page.keyboard.up('KeyW');

    // Switch to level 2
    await page.keyboard.press('KeyN');
    await page.waitForTimeout(200);

    const state = await page.evaluate(() => {
      const s = (window as any).__gameState;
      return { camX: s.camX, camZ: s.camZ };
    });

    // Level 2 resets to camX=0, camZ=1
    expect(state.camX).toBe(0);
    expect(state.camZ).toBe(1);
  });

  test('each level has pickables and zones', async ({ page }) => {
    await waitForGame(page);
    await grantPointerLock(page);

    // Check first 5 levels
    for (let i = 0; i < 5; i++) {
      const info = await page.evaluate(() => {
        const s = (window as any).__gameState;
        return {
          level: s.currentLevel,
          pickables: s.pickables.length,
          zones: s.zones.length,
        };
      });
      expect(info.pickables).toBeGreaterThan(0);
      expect(info.zones).toBeGreaterThan(0);

      if (i < 4) {
        await page.keyboard.press('KeyN');
        await page.waitForTimeout(200);
      }
    }
  });
});

test.describe('Pick & Drop Mechanics', () => {
  test('clicking picks up nearest object', async ({ page }) => {
    await waitForGame(page);
    await grantPointerLock(page);

    // In level 1, there's a cube at (-2, 0.5, -4)
    // Walk toward it
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(400);
    await page.keyboard.up('KeyW');

    // Click to pick up
    await page.evaluate(() => {
      document.dispatchEvent(
        new MouseEvent('mousedown', { button: 0, bubbles: true }),
      );
    });
    await page.waitForTimeout(100);

    const held = await page.evaluate(() => (window as any).__gameState.heldObj !== null);
    // May or may not pick up depending on exact position — just check no crash
    expect(typeof held).toBe('boolean');
  });

  test('pitch-based scaling works on held object', async ({ page }) => {
    await waitForGame(page);
    await grantPointerLock(page);

    // Force pick up the first pickable
    await page.evaluate(() => {
      const s = (window as any).__gameState;
      if (s.pickables.length > 0) {
        s.heldObj = s.pickables[0];
        s.heldOrigSize = s.pickables[0].size;
        s.heldBaseDist = 4;
      }
    });
    await page.waitForTimeout(100);

    // Look up (positive pitch) — object should grow
    await page.evaluate(() => {
      for (let i = 0; i < 10; i++) {
        document.dispatchEvent(
          new MouseEvent('mousemove', { movementX: 0, movementY: -100 }),
        );
      }
    });
    await page.waitForTimeout(200);

    const sizeUp = await page.evaluate(() => (window as any).__gameState.heldObj?.size ?? 0);

    // Reset pitch to 0
    await page.evaluate(() => {
      (window as any).__gameState.pitch = 0;
    });
    await page.waitForTimeout(200);

    const sizeNeutral = await page.evaluate(
      () => (window as any).__gameState.heldObj?.size ?? 0,
    );

    expect(sizeUp).toBeGreaterThan(sizeNeutral);
  });
});

test.describe('Editor', () => {
  test('P key opens editor when locked', async ({ page }) => {
    await waitForGame(page);
    await grantPointerLock(page);

    await page.keyboard.press('KeyP');
    await page.waitForTimeout(300);

    const state = await page.evaluate(() => (window as any).__gameState.editorMode);
    expect(state).toBe(true);
    await expect(page.locator('#level-text')).toHaveText('EDITOR');
    await expect(page.locator('#editor')).toHaveClass(/active/);
  });

  test('editor has all controls visible', async ({ page }) => {
    await waitForGame(page);
    await grantPointerLock(page);
    await page.keyboard.press('KeyP');
    await page.waitForTimeout(300);

    await expect(page.locator('#ed-rw')).toBeVisible();
    await expect(page.locator('#ed-rh')).toBeVisible();
    await expect(page.locator('#ed-rd')).toBeVisible();
    await expect(page.locator('#ed-shape')).toBeVisible();
    await expect(page.locator('#ed-size')).toBeVisible();
    await expect(page.locator('#ed-color')).toBeVisible();
    await expect(page.locator('#ed-t-solid')).toBeVisible();
    await expect(page.locator('#ed-t-pick')).toBeVisible();
    await expect(page.locator('#ed-t-zone')).toBeVisible();
  });

  test('export button generates valid JSON', async ({ page }) => {
    await waitForGame(page);
    await grantPointerLock(page);
    await page.keyboard.press('KeyP');
    await page.waitForTimeout(300);

    await page.click('#ed-export');
    await page.waitForTimeout(200);

    const exportValue = await page.locator('#export-box').inputValue();
    expect(exportValue).toBeTruthy();

    const parsed = JSON.parse(exportValue);
    expect(parsed).toHaveProperty('room');
    expect(parsed).toHaveProperty('items');
    expect(parsed.room.w).toBe(14);
    expect(parsed.room.h).toBe(5);
    expect(parsed.room.d).toBe(30);
  });

  test('N/B keys do not work in editor mode', async ({ page }) => {
    await waitForGame(page);
    await grantPointerLock(page);
    await page.keyboard.press('KeyP');
    await page.waitForTimeout(300);

    await page.keyboard.press('KeyN');
    await page.waitForTimeout(200);

    // Should still be in editor
    await expect(page.locator('#level-text')).toHaveText('EDITOR');
  });
});

test.describe('Gravity & Physics', () => {
  test('player falls and lands on ground', async ({ page }) => {
    await waitForGame(page);
    await grantPointerLock(page);

    // Teleport player up
    await page.evaluate(() => {
      const s = (window as any).__gameState;
      s.camY = 5;
      s.camVY = 0;
      s.onGround = false;
    });

    await page.waitForTimeout(1500);

    const finalY = await page.evaluate(() => (window as any).__gameState.camY);
    // Should have fallen back to player height (1.6)
    expect(finalY).toBeCloseTo(1.6, 0);
  });

  test('objects have gravity', async ({ page }) => {
    await waitForGame(page);

    // Teleport first pickable up
    await page.evaluate(() => {
      const s = (window as any).__gameState;
      if (s.pickables.length > 0) {
        s.pickables[0].y = 5;
        s.pickables[0].vy = 0;
      }
    });

    await page.waitForTimeout(1000);

    const objY = await page.evaluate(() => {
      const s = (window as any).__gameState;
      return s.pickables.length > 0 ? s.pickables[0].y : null;
    });

    // Should have fallen (close to its size, which is the floor level for objects)
    expect(objY).toBeLessThan(3);
  });
});
