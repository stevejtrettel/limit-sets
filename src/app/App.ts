/**
 * Minimal three.js app for the limit-set demos.
 *
 * Exposes exactly what the demos use:
 *   scene, camera, controls (OrbitControls), renderManager.renderer, start(), screenshot().
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export interface AppOptions {
  antialias?: boolean;
}

export class App {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  // Shim so demos can write `app.renderManager.renderer.domElement` —
  // the only surface they touch on the renderer.
  renderManager: { renderer: THREE.WebGLRenderer };

  private renderer: THREE.WebGLRenderer;

  constructor(options: AppOptions = {}) {
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000,
    );
    this.camera.position.set(0, 0, 5);

    // preserveDrawingBuffer lets toBlob() read the canvas after the rAF
    // tick has already cleared it; without it screenshots come back blank.
    this.renderer = new THREE.WebGLRenderer({
      antialias: options.antialias ?? true,
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(this.renderer.domElement);

    this.renderManager = { renderer: this.renderer };

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;

    window.addEventListener('resize', this.onResize);
  }

  private onResize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  start(): void {
    const tick = (): void => {
      requestAnimationFrame(tick);
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    tick();
  }

  screenshot(filename = 'screenshot.png'): void {
    this.renderer.render(this.scene, this.camera);
    this.renderer.domElement.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    });
  }
}
