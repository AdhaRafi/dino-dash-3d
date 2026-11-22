import * as THREE from 'three';

export interface Particle {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  scaleStart: number;
  scaleEnd: number;
}

export class ParticleSystem {
  private scene: THREE.Scene;
  private particles: Particle[] = [];
  private dustGeo: THREE.DodecahedronGeometry;
  private dustMat: THREE.MeshBasicMaterial;
  private sparkMat: THREE.MeshBasicMaterial;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.dustGeo = new THREE.DodecahedronGeometry(0.12, 0);
    this.dustMat = new THREE.MeshBasicMaterial({
      color: 0xE2C288,
      transparent: true,
      opacity: 0.65,
    });
    this.sparkMat = new THREE.MeshBasicMaterial({
      color: 0xE76F51,
      transparent: true,
      opacity: 0.9,
    });
  }

  /**
   * Spawns small dust puff behind running foot.
   */
  public spawnFootstepDust(x: number, y: number, z: number) {
    const count = 2;
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(this.dustGeo, this.dustMat.clone());
      mesh.position.set(
        x - 0.2 - Math.random() * 0.2,
        Math.max(0.04, y + Math.random() * 0.08),
        z + (Math.random() - 0.5) * 0.3
      );
      mesh.rotation.set(Math.random() * 3, Math.random() * 3, 0);
      this.scene.add(mesh);

      this.particles.push({
        mesh,
        vx: -1.8 - Math.random() * 1.5,
        vy: 0.4 + Math.random() * 0.8,
        vz: (Math.random() - 0.5) * 0.6,
        life: 0,
        maxLife: 0.35 + Math.random() * 0.2,
        scaleStart: 0.8 + Math.random() * 0.4,
        scaleEnd: 0.05,
      });
    }
  }

  /**
   * Spawns an explosive ring of dust when landing from jump.
   */
  public spawnLandingDust(x: number, z: number) {
    const count = 10;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const speed = 2.2 + Math.random() * 1.2;
      const mesh = new THREE.Mesh(this.dustGeo, this.dustMat.clone());
      mesh.position.set(x + Math.cos(angle) * 0.2, 0.06, z + Math.sin(angle) * 0.2);
      this.scene.add(mesh);

      this.particles.push({
        mesh,
        vx: Math.cos(angle) * speed - 1.0,
        vy: 0.6 + Math.random() * 0.8,
        vz: Math.sin(angle) * speed,
        life: 0,
        maxLife: 0.45 + Math.random() * 0.2,
        scaleStart: 1.2 + Math.random() * 0.5,
        scaleEnd: 0.05,
      });
    }
  }

  /**
   * Spawns collision sparks and rock debris on crash.
   */
  public spawnCrashExplosion(x: number, y: number, z: number) {
    const count = 16;
    for (let i = 0; i < count; i++) {
      const isSpark = i % 2 === 0;
      const mat = isSpark ? this.sparkMat.clone() : this.dustMat.clone();
      const mesh = new THREE.Mesh(this.dustGeo, mat);
      mesh.position.set(x, y + 0.5, z);
      this.scene.add(mesh);

      const vx = (Math.random() - 0.5) * 6.0;
      const vy = 2.0 + Math.random() * 5.0;
      const vz = (Math.random() - 0.5) * 5.0;

      this.particles.push({
        mesh,
        vx,
        vy,
        vz,
        life: 0,
        maxLife: 0.6 + Math.random() * 0.4,
        scaleStart: 1.4 + Math.random() * 0.6,
        scaleEnd: 0.1,
      });
    }
  }

  public update(delta: number) {
    if (!Number.isFinite(delta) || delta <= 0) return;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += delta;

      if (p.life >= p.maxLife) {
        this.scene.remove(p.mesh);
        this.particles.splice(i, 1);
        continue;
      }

      // Physics
      p.mesh.position.x += p.vx * delta;
      p.mesh.position.y += p.vy * delta;
      p.mesh.position.z += p.vz * delta;

      // Gravity and ground friction
      p.vy -= 9.8 * delta;
      if (p.mesh.position.y <= 0.03) {
        p.mesh.position.y = 0.03;
        p.vx *= 0.85;
        p.vz *= 0.85;
      }

      // Scale and opacity interpolation
      const progress = p.life / p.maxLife;
      const currentScale = p.scaleStart + (p.scaleEnd - p.scaleStart) * progress;
      p.mesh.scale.setScalar(Math.max(0.01, currentScale));

      const mat = p.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = (1 - progress) * 0.7;
    }
  }

  public reset() {
    for (const p of this.particles) {
      this.scene.remove(p.mesh);
    }
    this.particles = [];
  }
}
