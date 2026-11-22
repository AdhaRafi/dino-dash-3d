import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface LoadedModels {
  cactusDouble?: THREE.Mesh;
  cactusSingle?: THREE.Mesh;
  rocks: THREE.Mesh[];
  terrain?: THREE.Group;
}

export class AssetLoader {
  private static instance: AssetLoader;
  private loader: GLTFLoader;

  public models: LoadedModels = {
    rocks: [],
  };

  public isLoaded: boolean = false;
  private loadPromise: Promise<void> | null = null;

  private constructor() {
    this.loader = new GLTFLoader();
  }

  public static getInstance(): AssetLoader {
    if (!AssetLoader.instance) {
      AssetLoader.instance = new AssetLoader();
    }
    return AssetLoader.instance;
  }

  public loadAll(): Promise<void> {
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = Promise.all([
      this.loadCactus(),
      this.loadRocks(),
      this.loadTerrain(),
    ]).then(() => {
      this.isLoaded = true;
    }).catch((err) => {
      console.warn('AssetLoader: fallback to procedural models due to load error:', err);
      this.isLoaded = false;
    });

    return this.loadPromise;
  }

  private loadCactus(): Promise<void> {
    return new Promise((resolve) => {
      this.loader.load(
        '/models/desert_cactus.glb',
        (gltf) => {
          gltf.scene.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              mesh.castShadow = true;
              mesh.receiveShadow = true;
              if (mesh.name === 'Cactus_Double') {
                this.models.cactusDouble = mesh;
              } else if (mesh.name === 'Cactus_Single') {
                this.models.cactusSingle = mesh;
              }
            }
          });
          resolve();
        },
        undefined,
        (err) => {
          console.warn('Could not load desert_cactus.glb:', err);
          resolve();
        }
      );
    });
  }

  private loadRocks(): Promise<void> {
    return new Promise((resolve) => {
      this.loader.load(
        '/models/desert_rocks.glb',
        (gltf) => {
          gltf.scene.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              mesh.castShadow = true;
              mesh.receiveShadow = true;
              this.models.rocks.push(mesh);
            }
          });
          resolve();
        },
        undefined,
        (err) => {
          console.warn('Could not load desert_rocks.glb:', err);
          resolve();
        }
      );
    });
  }

  private loadTerrain(): Promise<void> {
    return new Promise((resolve) => {
      this.loader.load(
        '/models/desert_terrain.glb',
        (gltf) => {
          gltf.scene.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              mesh.receiveShadow = true;
            }
          });
          this.models.terrain = gltf.scene;
          resolve();
        },
        undefined,
        (err) => {
          console.warn('Could not load desert_terrain.glb:', err);
          resolve();
        }
      );
    });
  }

  public getCactusDouble(): THREE.Mesh | null {
    if (!this.models.cactusDouble) return null;
    return this.models.cactusDouble.clone();
  }

  public getCactusSingle(): THREE.Mesh | null {
    if (!this.models.cactusSingle) return null;
    return this.models.cactusSingle.clone();
  }

  public getRandomRock(): THREE.Mesh | null {
    if (this.models.rocks.length === 0) return null;
    const idx = Math.floor(Math.random() * this.models.rocks.length);
    return this.models.rocks[idx].clone();
  }

  public getTerrainClone(): THREE.Group | null {
    if (!this.models.terrain) return null;
    return this.models.terrain.clone();
  }
}
