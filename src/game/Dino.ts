import * as THREE from 'three';

export type DinoAnimationState = 'idle' | 'run' | 'jump' | 'hit' | 'duck';
export type DinoSkinColor = 'ijo' | 'cokelat';

export class Dino {
  public mesh: THREE.Group;
  public y: number = 0;
  public vy: number = 0;
  public isGrounded: boolean = true;
  public isDucking: boolean = false;
  public state: DinoAnimationState = 'idle';

  // Physics constants (Tuned for player-friendly jump clearance and floaty apex)
  private readonly gravity: number = -31.0;
  private readonly jumpForce: number = 13.0;
  private readonly groundY: number = 0;

  // Jump buffering (prevents dropped inputs right before landing)
  private jumpBufferTimer: number = 0;

  // Scale & Pivot
  private readonly modelScale: number = 0.48;

  // Model parts
  private dinoRoot: THREE.Group;
  private bodyGroup!: THREE.Group;
  private jawGroup!: THREE.Group;
  private arms: THREE.Group[] = [];
  private tailSegments: THREE.Group[] = [];
  private legs: THREE.Group[] = [];
  private animTimer: number = 0;

  // Footstep dust callbacks
  public onFootstep?: (x: number, y: number, z: number) => void;
  public onLand?: (x: number, z: number) => void;
  private lastFootstepPhase: number = 0;

  // Materials with Lambert shading for crisp, vibrant cartoon lighting
  private bodyMat: THREE.MeshLambertMaterial;
  private darkMat: THREE.MeshLambertMaterial;
  private bellyMat: THREE.MeshLambertMaterial;
  private eyeWhiteMat: THREE.MeshLambertMaterial;
  private irisMat: THREE.MeshLambertMaterial;
  private pupilMat: THREE.MeshLambertMaterial;
  private teethMat: THREE.MeshLambertMaterial;
  private clawMat: THREE.MeshLambertMaterial;

  // Collision bounding box
  private boxHelper: THREE.Box3 = new THREE.Box3();

  constructor() {
    this.mesh = new THREE.Group();
    this.mesh.name = 'DinoDashTRex';

    // Rich desert-reptilian palette
    this.bodyMat = new THREE.MeshLambertMaterial({
      color: 0x589446,
      flatShading: true,
    });
    this.darkMat = new THREE.MeshLambertMaterial({
      color: 0x325c26,
      flatShading: true,
    });
    this.bellyMat = new THREE.MeshLambertMaterial({
      color: 0xecd9b0,
      flatShading: true,
    });
    this.eyeWhiteMat = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      flatShading: true,
    });
    this.irisMat = new THREE.MeshLambertMaterial({
      color: 0xf0a018,
      flatShading: true,
    });
    this.pupilMat = new THREE.MeshLambertMaterial({
      color: 0x181818,
      flatShading: true,
    });
    this.teethMat = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      flatShading: true,
    });
    this.clawMat = new THREE.MeshLambertMaterial({
      color: 0x222222,
      flatShading: true,
    });

    this.dinoRoot = new THREE.Group();
    this.buildSculptedTRex();

    // Scale and position so feet rest cleanly on y = 0
    this.dinoRoot.scale.setScalar(this.modelScale);
    this.dinoRoot.position.set(-0.2, 0, 0);

    this.mesh.add(this.dinoRoot);
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
   * Builds the sculpted, expressive T-Rex with:
   * - Articulated predatory chomping jaw and sharp white teeth
   * - Expressive eyes with brow ridges, iris, and specular highlight
   * - Desert counter-shading on throat and belly
   * - Dorsal spine plates and segmented fluid wave tail
   * - Muscular three-toed feet with dark talons
   */
  private buildSculptedTRex() {
    this.bodyGroup = new THREE.Group();
    this.bodyGroup.position.x = 0;
    this.dinoRoot.add(this.bodyGroup);

    const b = this.bodyGroup;
    const BODY = this.bodyMat;
    const DARK = this.darkMat;
    const BELLY = this.bellyMat;
    const TEETH = this.teethMat;
    const CLAW = this.clawMat;

    // Main torso and chest
    this.box(1.5, 1.35, 1.05, BODY, 0, 1.75, 0, b);
    // Counter-shaded warm belly
    this.box(1.1, 0.75, 1.08, BELLY, 0.18, 1.38, 0, b);

    // Powerful arched neck
    this.box(0.85, 0.95, 0.85, BODY, 0.65, 2.4, 0, b);
    this.box(0.65, 0.8, 0.87, BELLY, 0.72, 2.3, 0, b);

    // Head: Main skull & brow ridge
    this.box(1.25, 0.95, 0.92, BODY, 1.15, 3.02, 0, b);
    // Upper snout
    this.box(0.75, 0.55, 0.82, BODY, 1.9, 2.92, 0, b);
    // Nostrils
    this.box(0.08, 0.08, 0.08, DARK, 2.24, 3.05, 0.2, b);
    this.box(0.08, 0.08, 0.08, DARK, 2.24, 3.05, -0.2, b);

    // Upper jaw teeth
    for (let t = 0; t < 4; t++) {
      const tx = 1.6 + t * 0.16;
      this.box(0.07, 0.12, 0.05, TEETH, tx, 2.62, 0.38, b);
      this.box(0.07, 0.12, 0.05, TEETH, tx, 2.62, -0.38, b);
    }

    // Expressive Eyes with brow ridges
    for (const s of [-1, 1]) {
      // Overhanging brow ridge gives intense focus
      const brow = this.box(0.35, 0.14, 0.12, DARK, 1.38, 3.42, s * 0.46, b);
      brow.rotation.z = -0.15;

      // Sclera
      this.box(0.24, 0.24, 0.04, this.eyeWhiteMat, 1.36, 3.22, s * 0.47, b);
      // Iris
      this.box(0.16, 0.16, 0.05, this.irisMat, 1.39, 3.22, s * 0.48, b);
      // Pupil
      this.box(0.08, 0.12, 0.06, this.pupilMat, 1.41, 3.22, s * 0.49, b);
      // Catchlight sparkle
      this.box(0.04, 0.04, 0.07, this.eyeWhiteMat, 1.43, 3.25, s * 0.495, b);
    }

    // Articulated Lower Jaw
    this.jawGroup = new THREE.Group();
    this.jawGroup.position.set(1.4, 2.55, 0);
    b.add(this.jawGroup);

    // Jawbone
    this.box(0.95, 0.22, 0.78, DARK, 0.45, -0.05, 0, this.jawGroup);
    // Lower jaw teeth
    for (let t = 0; t < 3; t++) {
      const tx = 0.35 + t * 0.16;
      this.box(0.06, 0.10, 0.05, TEETH, tx, 0.09, 0.36, this.jawGroup);
      this.box(0.06, 0.10, 0.05, TEETH, tx, 0.09, -0.36, this.jawGroup);
    }

    // Forearms with sharp claws
    this.arms = [];
    for (const s of [-1, 1]) {
      const armGroup = new THREE.Group();
      armGroup.position.set(0.65, 2.05, s * 0.58);
      b.add(armGroup);

      const upperArm = this.box(0.32, 0.48, 0.3, BODY, 0.1, -0.2, 0, armGroup);
      upperArm.rotation.z = 0.35;
      const lowerArm = this.box(0.38, 0.26, 0.24, BODY, 0.38, -0.42, 0, armGroup);
      lowerArm.rotation.z = -0.15;

      // Two sharp claws per hand
      const c1 = this.box(0.14, 0.08, 0.08, CLAW, 0.62, -0.42, -0.06, armGroup);
      c1.rotation.z = -0.3;
      const c2 = this.box(0.14, 0.08, 0.08, CLAW, 0.62, -0.42, 0.06, armGroup);
      c2.rotation.z = -0.3;

      this.arms.push(armGroup);
    }

    // Spine Dorsal Plates / Scutes along back
    const dorsalRidges: [number, number, number][] = [
      [0.6, 2.9, 0.26],
      [0.1, 2.48, 0.28],
      [-0.4, 2.45, 0.28],
      [-0.9, 2.15, 0.26],
    ];
    dorsalRidges.forEach(([x, y, s]) => {
      const finGeo = new THREE.ConeGeometry(s / 2, s * 1.2, 4);
      finGeo.rotateX(Math.PI / 4);
      const fin = new THREE.Mesh(finGeo, DARK);
      fin.position.set(x, y, 0);
      fin.rotation.z = -0.2;
      fin.castShadow = true;
      b.add(fin);
    });

    // Segmented Fluid Wave Tail with dorsal scutes
    this.tailSegments = [];
    const tailData: [number, number, number, number][] = [
      [-0.95, 1.55, 0.85, 0.80],
      [-1.75, 1.40, 0.70, 0.66],
      [-2.48, 1.25, 0.56, 0.52],
      [-3.15, 1.10, 0.42, 0.40],
      [-3.75, 0.96, 0.32, 0.30],
      [-4.28, 0.84, 0.22, 0.20],
    ];

    tailData.forEach(([x, y, h, d], i) => {
      const segGroup = new THREE.Group();
      segGroup.position.set(x, y, 0);

      // Tail meat block
      const segMesh = this.box(0.85 - i * 0.08, h, d, BODY, 0, 0, 0, segGroup);
      segMesh.castShadow = true;

      // Tail dorsal plate
      if (i < 4) {
        const plate = this.box(0.16, 0.16, 0.08, DARK, 0, h / 2 + 0.08, 0, segGroup);
        plate.rotation.z = -0.3;
      }

      b.add(segGroup);
      this.tailSegments.push(segGroup);
    });

    // Muscular Hind Legs with digitigrade joints and taloned feet
    this.legs = [];
    for (const z of [-0.38, 0.38]) {
      const legPivot = new THREE.Group();
      legPivot.position.set(-0.1, 1.1, z);

      // Muscular thigh
      const thigh = this.box(0.62, 0.95, 0.52, BODY, 0, -0.42, 0, legPivot);
      thigh.rotation.z = -0.15;

      // Shin / calf
      const shin = this.box(0.42, 0.82, 0.40, BODY, -0.05, -0.92, 0, legPivot);
      shin.rotation.z = 0.22;

      // Three-toed foot with talons
      const footGroup = new THREE.Group();
      footGroup.position.set(0.12, -1.25, 0);
      legPivot.add(footGroup);

      // Foot base
      this.box(0.72, 0.22, 0.52, DARK, 0, 0.08, 0, footGroup);

      // Three toe talons
      for (const tz of [-0.16, 0, 0.16]) {
        const claw = this.box(0.24, 0.12, 0.10, CLAW, 0.44, 0.04, tz, footGroup);
        claw.rotation.z = -0.2;
      }

      b.add(legPivot);
      this.legs.push(legPivot);
    }
  }

  public setSkinColor(color: DinoSkinColor) {
    if (color === 'ijo') {
      this.bodyMat.color.set(0x589446);
      this.darkMat.color.set(0x325c26);
      this.bellyMat.color.set(0xecd9b0);
    } else {
      this.bodyMat.color.set(0x9e6038);
      this.darkMat.color.set(0x5c3218);
      this.bellyMat.color.set(0xecd9b0);
    }
  }

  public jump(): boolean {
    if (this.state === 'hit') return false;

    if (!this.isGrounded) {
      // Buffer jump if pressed shortly before landing (within 0.14s)
      this.jumpBufferTimer = 0.14;
      return false;
    }
    this.vy = this.jumpForce;
    this.isGrounded = false;
    this.state = 'jump';
    this.jumpBufferTimer = 0;

    // Dynamic jump stretch
    this.dinoRoot.scale.set(this.modelScale * 0.92, this.modelScale * 1.12, this.modelScale * 0.92);
    return true;
  }

  public duck(shouldDuck: boolean) {
    if (this.state === 'hit') return;
    this.isDucking = shouldDuck;

    if (shouldDuck) {
      if (this.isGrounded) {
        this.state = 'duck';
      } else {
        // Fast-fall mechanic in mid-air
        if (this.vy > -12.0) {
          this.vy = -18.0;
        }
      }
    } else {
      if (this.state === 'duck') {
        this.state = this.isGrounded ? 'run' : 'jump';
      }
    }
  }

  public update(delta: number, currentSpeed: number = 11.0) {
    if (!Number.isFinite(delta) || delta <= 0) return;
    this.animTimer += delta;

    if (this.jumpBufferTimer > 0) {
      this.jumpBufferTimer -= delta;
    }

    // Smooth scale recovery from squash/stretch
    this.dinoRoot.scale.x += (this.modelScale - this.dinoRoot.scale.x) * 10 * delta;
    this.dinoRoot.scale.y += (this.modelScale - this.dinoRoot.scale.y) * 10 * delta;
    this.dinoRoot.scale.z += (this.modelScale - this.dinoRoot.scale.z) * 10 * delta;

    // Vertical physics simulation
    if (!this.isGrounded) {
      this.vy += this.gravity * delta;
      this.y += this.vy * delta;

      if (this.y <= this.groundY) {
        this.y = this.groundY;
        this.vy = 0;
        this.isGrounded = true;

        // Check if a jump was buffered right before landing
        if (this.jumpBufferTimer > 0) {
          this.jump();
          return;
        }

        // Landing impact shockwave
        if (this.onLand) {
          this.onLand(this.mesh.position.x, this.mesh.position.z);
        }

        // Landing squash
        this.dinoRoot.scale.set(this.modelScale * 1.14, this.modelScale * 0.86, this.modelScale * 1.14);

        if (this.state !== 'hit') {
          this.state = this.isDucking ? 'duck' : 'run';
        }
      }
    }

    this.mesh.position.y = this.y;

    const L = this.legs;
    if (L.length < 2) return;

    switch (this.state) {
      case 'duck': {
        const runFreq = 14.0 + (currentSpeed - 11.0) * 0.4;
        const swing = Math.sin(this.animTimer * runFreq) * 0.42;
        L[0].rotation.z = swing;
        L[1].rotation.z = -swing;

        // Frequent sliding dust kicks up from underneath
        const currentPhase = Math.floor(this.animTimer * runFreq / (Math.PI * 0.65));
        if (currentPhase !== this.lastFootstepPhase) {
          this.lastFootstepPhase = currentPhase;
          if (this.onFootstep) {
            this.onFootstep(this.mesh.position.x - 0.22, 0, (Math.random() - 0.5) * 0.2);
          }
        }

        // Sleek horizontal sliding crouch
        this.bodyGroup.position.set(0.14, -0.42, 0);
        this.mesh.rotation.z = 0.24; // Aerodynamic forward lean
        this.jawGroup.rotation.z = -0.06;

        // Arms tucked back
        for (let i = 0; i < this.arms.length; i++) {
          this.arms[i].rotation.z = -0.45;
        }

        // Tail straight and low along the sand
        this.tailSegments.forEach((seg, idx) => {
          seg.position.z = Math.sin(this.animTimer * runFreq * 0.8 - idx * 0.5) * (0.03 + idx * 0.015);
          seg.rotation.y = Math.cos(this.animTimer * runFreq * 0.8 - idx * 0.5) * 0.05;
        });
        break;
      }
      case 'run': {
        const runFreq = 12.0 + (currentSpeed - 11.0) * 0.4;
        const swing = Math.sin(this.animTimer * runFreq) * 0.72;
        L[0].rotation.z = swing;
        L[1].rotation.z = -swing;

        // Footstep dust emission when foot strikes ground
        const currentPhase = Math.floor(this.animTimer * runFreq / Math.PI);
        if (currentPhase !== this.lastFootstepPhase) {
          this.lastFootstepPhase = currentPhase;
          if (this.onFootstep) {
            const footZ = currentPhase % 2 === 0 ? 0.18 : -0.18;
            this.onFootstep(this.mesh.position.x - 0.1, 0, footZ);
          }
        }

        // Torso running bounce & sprint lean forward
        this.bodyGroup.position.y = Math.abs(Math.sin(this.animTimer * runFreq)) * 0.12;
        const sprintLean = Math.min(0.2, (currentSpeed - 11.0) * 0.012);
        this.mesh.rotation.z = sprintLean;

        // Rhythmic arm pumping
        for (let i = 0; i < this.arms.length; i++) {
          const armSwing = Math.cos(this.animTimer * runFreq + i * Math.PI) * 0.35;
          this.arms[i].rotation.z = armSwing;
        }

        // Animated jaw chomp
        this.jawGroup.rotation.z = -0.14 * (0.5 + 0.5 * Math.sin(this.animTimer * 6.0));

        // Fluid tail wave physics across segments
        this.tailSegments.forEach((seg, idx) => {
          seg.position.z = Math.sin(this.animTimer * runFreq * 0.7 - idx * 0.6) * (0.05 + idx * 0.02);
          seg.rotation.y = Math.cos(this.animTimer * runFreq * 0.7 - idx * 0.6) * 0.08;
        });
        break;
      }
      case 'jump': {
        // Legs tuck back in air
        L[0].rotation.z = -0.55;
        L[1].rotation.z = -0.55;
        this.bodyGroup.position.y = 0;
        this.mesh.rotation.z = -0.05; // Slight rise tilt

        // Wide open jaw
        this.jawGroup.rotation.z = -0.42;

        // Claws clutched forward
        for (const arm of this.arms) {
          arm.rotation.z = 0.5;
        }

        // Stabilize tail
        this.tailSegments.forEach((seg) => {
          seg.position.z = 0;
          seg.rotation.y = 0;
        });
        break;
      }
      case 'hit': {
        // Stumble backward
        this.mesh.rotation.z = -0.6;
        L[0].rotation.z = 0.65;
        L[1].rotation.z = -0.65;
        this.jawGroup.rotation.z = -0.55;
        break;
      }
      case 'idle':
      default: {
        L[0].rotation.z = 0;
        L[1].rotation.z = 0;
        this.bodyGroup.position.y = Math.sin(this.animTimer * 2.5) * 0.04;
        this.jawGroup.rotation.z = -0.08 * (0.5 + 0.5 * Math.sin(this.animTimer * 2.0));
        this.mesh.rotation.z = 0;

        for (let i = 0; i < this.arms.length; i++) {
          this.arms[i].rotation.z = Math.sin(this.animTimer * 2.0 + i) * 0.1;
        }

        this.tailSegments.forEach((seg, idx) => {
          seg.position.z = Math.sin(this.animTimer * 2.0 - idx * 0.4) * 0.04;
        });
        break;
      }
    }
  }

  public setHit() {
    this.state = 'hit';
  }

  public reset() {
    this.y = 0;
    this.vy = 0;
    this.isGrounded = true;
    this.isDucking = false;
    this.state = 'idle';
    this.mesh.position.set(0, 0, 0);
    this.mesh.rotation.set(0, 0, 0);
    this.dinoRoot.scale.setScalar(this.modelScale);
    if (this.legs.length >= 2) {
      this.legs[0].rotation.set(0, 0, 0);
      this.legs[1].rotation.set(0, 0, 0);
    }
    this.bodyGroup.position.set(0, 0, 0);
    this.jawGroup.rotation.set(0, 0, 0);
    this.tailSegments.forEach((seg) => {
      seg.position.z = 0;
      seg.rotation.y = 0;
    });
  }

  /**
   * Player-friendly tight hitbox.
   * Strictly covers the torso and hips, completely excluding the trailing tail
   * and far snout tip, and lifts the bottom slightly by 0.12 units so jumping
   * over obstacles is responsive, fair, and exhilarating!
   */
  public getBoundingBox(): THREE.Box3 {
    const center = this.mesh.position;
    const y = this.y;

    if (this.isDucking && this.isGrounded) {
      // Flat sliding crouch: wide-and-low to slide cleanly under mid-altitude birds
      this.boxHelper.min.set(
        center.x - 0.24,
        y + 0.08,
        center.z - 0.16
      );
      this.boxHelper.max.set(
        center.x + 0.32,
        y + 0.55,  // max 0.55 - clears mid bird min of 0.85 by 0.30 units
        center.z + 0.16
      );
    } else {
      this.boxHelper.min.set(
        center.x - 0.20,
        y + 0.16,
        center.z - 0.18
      );
      this.boxHelper.max.set(
        center.x + 0.30,
        y + 1.26,
        center.z + 0.18
      );
    }
    return this.boxHelper;
  }
}
