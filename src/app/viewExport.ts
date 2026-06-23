/**
 * Shared "export the current framed view" plumbing for the demos.
 *
 * Every viewer's HUD has a button that serialises the current camera + chart
 * into a `ViewPreset` and ships it to the offline render script, via the Vite
 * dev-server middleware (which writes scripts/<family>-view-preset.json) with a
 * clipboard fallback. The camera/viewport extraction and the POST/clipboard
 * dance are identical everywhere; only the bundle's `projection` (or `embedding`)
 * field is family-specific, so each demo builds its own bundle and calls
 * `saveViewPreset`.
 */

import * as THREE from 'three';
import type { App } from './App.ts';

/** The 7 camera fields every ViewPreset stores, read from the live app. */
export function cameraSpecFromApp(app: App): {
  position: [number, number, number];
  target: [number, number, number];
  up: [number, number, number];
  fov: number; aspect: number; near: number; far: number;
} {
  const cam = app.camera as THREE.PerspectiveCamera;
  const t = app.controls.target;
  return {
    position: [cam.position.x, cam.position.y, cam.position.z],
    target:   [t.x, t.y, t.z],
    up:       [cam.up.x, cam.up.y, cam.up.z],
    fov: cam.fov, aspect: cam.aspect, near: cam.near, far: cam.far,
  };
}

export function viewportFromApp(app: App): { width: number; height: number } {
  const c = app.renderManager.renderer.domElement;
  return { width: c.clientWidth, height: c.clientHeight };
}

/**
 * POST `bundle` to the dev-server's /__save-view/<family> middleware (writing
 * scripts/<family>-view-preset.json); fall back to the clipboard if the server
 * isn't there (built bundle). `onStatus(msg, ok)` reports the outcome to the HUD.
 */
export async function saveViewPreset(
  family: string,
  bundle: unknown,
  onStatus: (msg: string, ok: boolean) => void,
): Promise<void> {
  const json = JSON.stringify(bundle, null, 2);
  console.log(`[${family}-render] view JSON:\n` + json);

  let saved = false;
  try {
    const r = await fetch(`/__save-view/${family}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: json,
    });
    if (r.ok) {
      saved = true;
      onStatus(`saved to scripts/${family}-view-preset.json — run the ${family} render script`, true);
    }
  } catch { /* fall through to clipboard */ }

  if (!saved) {
    try {
      await navigator.clipboard.writeText(json);
      onStatus('dev server unavailable — copied to clipboard instead', false);
    } catch {
      onStatus('clipboard blocked — see console for JSON', false);
    }
  }
}
