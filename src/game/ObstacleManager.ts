import * as THREE from 'three';
import { AssetLoader } from './AssetLoader';

export interface ObstacleItem {
  group: THREE.Group;
  type: 'cactus' | 'rock' | 'bird';
  altitude?: 'low' | 'mid';
  baseY?: number;
  box: THREE.Box3;
  wings?: THREE.Group[];
  animOffset?: number;
  cleared?: boolean;
}

export class ObstacleManager {
  public obstacles: ObstacleItem[] = [];
  private scene: THREE.Scene;
  public onObstacleCleared?: (x: number, y: number) => void;
  private assetLoader: AssetLoader;

  // Materials matching desert palette and fallback
  private cactusMat: THREE.MeshLambertMaterial;
  private thornMat: THREE.MeshLambertMaterial;
  private rockMat1: THREE.MeshLambertMaterial;
  private rockMat2: THREE.MeshLambertMaterial;
  private rockMat3: THREE.MeshLambertMaterial;
  private birdMat: THREE.MeshLambertMaterial;
  private beakMat: THREE.MeshLambertMaterial;
  private wingMat: THREE.MeshLambertMaterial;
  private eyeWhiteMat: THREE.MeshLambertMaterial;

  // Spawning logic
  private nextSpawnX: number = 32.0;
  private readonly spawnAheadX: number = 32.0;
  private readonly despawnBehindX: number = -14.0;
  private animTimer: number = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.assetLoader = AssetLoader.getInstance();

    // Fallback materials
    this.cactusMat = new THREE.MeshLambertMaterial({ color: 0x4f8f3c, flatShading: true });
    this.thornMat = new THREE.MeshLambertMaterial({ color: 0xf3ecc0, flatShading: true });
    this.rockMat1 = new THREE.MeshLambertMaterial({ color: 0x6b5a4c, flatShading: true });
    this.rockMat2 = new THREE.MeshLambertMaterial({ color: 0x7d6a58, flatShading: true });
    this.rockMat3 = new THREE.MeshLambertMaterial({ color: 0x5a4c40, flatShading: true });
    this.birdMat = new THREE.MeshLambertMaterial({ color: 0x8a7766, flatShading: true });
    this.beakMat = new THREE.MeshLambertMaterial({ color: 0xf0a030, flatShading: true });
    this.wingMat = new THREE.MeshLambertMaterial({ color: 0xa8927e, flatShading: true });
    this.eyeWhiteMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
  }

  private box(
    w: number,
    h: number,
    d: number,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
    parent: THREE.Group
  ): THREE.Mesh {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  /**
   * Saguaro Cactus obstacle: uses authentic 3D model from Blender Desert Scene if loaded,
   * with procedural fallback.
   */
  private createCactus(): THREE.Group {
    const group = new THREE.Group();

    // Try authentic 3D Saguaro model from Blender scene
    const isDouble = Math.random() < 0.6;
    const model = isDouble ? this.assetLoader.getCactusDouble() : this.assetLoader.getCactusSingle();

    if (model) {
      const scale = isDouble ? 0.62 : 0.68;
      model.scale.setScalar(scale);
      model.position.set(0, 0, 0);
      model.rotation.y = (Math.random() - 0.5) * 0.4;
      group.add(model);
      return group;
    }

    // Fallback procedural cactus
    this.box(0.55, 2.4, 0.55, this.cactusMat, 0, 1.2, 0, group);
    for (const s of [-1, 1]) {
      this.box(0.6, 0.26, 0.26, this.cactusMat, s * 0.45, 1.2 + (s > 0 ? 0.2 : -0.1), 0, group);
      this.box(0.26, 0.9, 0.26, this.cactusMat, s * 0.75, 1.55 + (s > 0 ? 0.2 : -0.1), 0, group);
    }
    for (let i = 0; i < 6; i++) {
      this.box(0.06, 0.06, 0.06, this.thornMat, i % 2 ? 0.28 : -0.28, 0.5 + i * 0.35, 0.28, group);
    }
    group.scale.setScalar(0.55);
    return group;
  }

  /**
   * Desert Rock obstacle: uses authentic 3D rock model from Blender Desert Scene if loaded,
   * with procedural fallback.
   */
  private createRock(): THREE.Group {
    const group = new THREE.Group();

    // Try authentic 3D rock from Blender scene
    const rockMesh = this.assetLoader.getRandomRock();
    if (rockMesh) {
      const s = 0.65 + Math.random() * 0.2;
      rockMesh.scale.setScalar(s);
      rockMesh.position.set(0, 0, 0);
      rockMesh.rotation.y = Math.random() * Math.PI * 2;
      group.add(rockMesh);
      return group;
    }

    // Fallback procedural rock
    const rockMaterials = [this.rockMat1, this.rockMat2, this.rockMat3];
    const mat = rockMaterials[Math.floor(Math.random() * rockMaterials.length)];
    const s = 0.7 + Math.random() * 0.3;
    const geo = new THREE.DodecahedronGeometry(s, 0);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.scale.y = 0.7;
    mesh.position.y = s * 0.5;
    mesh.rotation.set(Math.random() * 3, Math.random() * 3, 0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    const s2 = 0.3;
    const pebble = new THREE.Mesh(new THREE.DodecahedronGeometry(s2, 0), this.rockMat3);
    pebble.scale.y = 0.6;
    pebble.position.set(0.6, s2 * 0.4, 0.2);
    pebble.castShadow = true;
    group.add(pebble);

    return group;
  }

  /**
   * Pterodactyl Bird obstacle:
   * Faces oncoming player (-X) and actively swoops forward.
   * - 'mid': chest/head level (baseY = 1.05), player MUST JONGKOK (duck) to pass underneath!
   * - 'low': shin/ground level (baseY = 0.38), player MUST LOMPAT (jump) to clear!
   */
  private createBird(altitude: 'mid' | 'low' = 'mid'): { group: THREE.Group; wings: THREE.Group[] } {
    const group = new THREE.Group();

    // Body & head (Facing negative X, towards oncoming dinosaur)
    this.box(1.1, 0.44, 0.55, this.birdMat, 0, 0, 0, group);
    this.box(0.5, 0.40, 0.46, this.birdMat, -0.75, 0.18, 0, group); // Head forward (-X)
    this.box(0.55, 0.12, 0.20, this.beakMat, -1.25, 0.14, 0, group); // Sharp orange beak (-X)
    this.box(0.5, 0.14, 0.28, this.birdMat, 0.78, 0.10, 0, group);   // Tail behind (+X)

    // Intense eyes on the sides
    this.box(0.1, 0.1, 0.02, this.eyeWhiteMat, -0.85, 0.28, 0.24, group);
    this.box(0.1, 0.1, 0.02, this.eyeWhiteMat, -0.85, 0.28, -0.24, group);

    // Flapping Wings
    const wings: THREE.Group[] = [];
    for (const s of [-1, 1]) {
      const p = new THREE.Group();
      p.position.set(-0.08, 0.20, s * 0.28);
      this.box(0.68, 0.07, 1.05, this.wingMat, 0, 0, s * 0.52, p);
      group.add(p);
      wings.push(p);
    }

    // Scale and position at target altitude
    group.scale.setScalar(0.55);
    const baseY = altitude === 'mid' ? 1.05 : 0.36;
    group.position.y = baseY;

    return { group, wings };
  }

  public update(delta: number, currentSpeed: number) {
    if (!Number.isFinite(delta) || !Number.isFinite(currentSpeed) || delta <= 0) return;
    this.animTimer += delta;

    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const item = this.obstacles[i];

      // Birds fly towards the player faster with their own airspeed!
      const itemSpeed = item.type === 'bird' ? currentSpeed + 2.5 : currentSpeed;
      const moveDist = itemSpeed * delta;
      item.group.position.x -= moveDist;

      // Animate bird wings & flight bobbing
      if (item.type === 'bird' && item.wings && item.wings.length >= 2) {
        const flap = Math.sin(this.animTimer * 16 + (item.animOffset || 0)) * 0.65;
        item.wings[0].rotation.x = flap;
        item.wings[1].rotation.x = -flap;

        // Soaring flight hover around its altitude baseY
        const baseY = item.baseY ?? (item.altitude === 'low' ? 0.36 : 1.05);
        item.group.position.y = baseY + Math.sin(this.animTimer * 5.0 + (item.animOffset || 0)) * 0.035;
      }

      // Update player-friendly tight bounding box (strictly valid coords, no inversion)
      const px = item.group.position.x;
      const py = item.group.position.y;

      if (item.type === 'cactus') {
        item.box.min.set(px - 0.14, 0.0, -0.14);
        item.box.max.set(px + 0.14, 1.05, 0.14);
      } else if (item.type === 'rock') {
        item.box.min.set(px - 0.22, 0.0, -0.20);
        item.box.max.set(px + 0.22, 0.42, 0.20);
      } else if (item.type === 'bird') {
        // Tight bird hitbox: body torso only, wings excluded for fairness
        // mid bird: py ~1.05, hitbox y = [0.85, 1.25]  -> duck max 0.55 clears by 0.30
        // low bird: py ~0.36, hitbox y = [0.18, 0.54]  -> standing min 0.16 collides, jumping clears
        item.box.min.set(px - 0.24, py - 0.20, -0.18);
        item.box.max.set(px + 0.24, py + 0.20, 0.18);
      }

      // Check if obstacle has been successfully leaped over or ducked under
      if (!item.cleared && item.group.position.x < -0.3) {
        item.cleared = true;
        if (this.onObstacleCleared) {
          this.onObstacleCleared(item.group.position.x, item.group.position.y + 1.2);
        }
      }

      // Despawn if past screen
      if (item.group.position.x < this.despawnBehindX) {
        this.scene.remove(item.group);
        this.obstacles.splice(i, 1);
      }
    }

    const groundDist = currentSpeed * delta;
    this.nextSpawnX -= groundDist;

    if (this.nextSpawnX <= this.spawnAheadX) {
      this.spawnNextObstacle(currentSpeed);
    }
  }

  private spawnNextObstacle(currentSpeed: number) {
    const rand = Math.random();
    let type: ObstacleItem['type'] = 'cactus';
    let group: THREE.Group;
    let wings: THREE.Group[] | undefined;
    let altitude: 'low' | 'mid' | undefined;
    let baseY: number | undefined;

    if (rand < 0.44) {
      type = 'cactus';
      group = this.createCactus();
    } else if (rand < 0.70) {
      type = 'rock';
      group = this.createRock();
    } else {
      type = 'bird';
      altitude = Math.random() < 0.55 ? 'mid' : 'low';
      baseY = altitude === 'mid' ? 1.05 : 0.36;
      const birdData = this.createBird(altitude);
      group = birdData.group;
      wings = birdData.wings;
    }

    const spawnX = Math.max(this.spawnAheadX, this.nextSpawnX);
    group.position.x = spawnX;
    this.scene.add(group);

    const box = new THREE.Box3().setFromObject(group);
    this.obstacles.push({
      group,
      type,
      altitude,
      baseY,
      box,
      wings,
      animOffset: Math.random() * 10
    });

    // Minimum safe gap proportional to speed
    const minSafeReactionTime = 1.35;
    const minDistance = currentSpeed * minSafeReactionTime;
    const randomExtraDistance = 5.0 + Math.random() * 8.0;

    this.nextSpawnX = spawnX + minDistance + randomExtraDistance;
  }

  public checkCollision(dinoBox: THREE.Box3): boolean {
    for (const obs of this.obstacles) {
      if (obs.box.intersectsBox(dinoBox)) {
        return true;
      }
    }
    return false;
  }

  public reset() {
    for (const obs of this.obstacles) {
      this.scene.remove(obs.group);
    }
    this.obstacles = [];
    this.nextSpawnX = 32.0;
  }
}
