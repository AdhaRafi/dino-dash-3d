import * as THREE from 'three';
import { AssetLoader } from './AssetLoader';

export interface DayNightPhase {
  name: string;
  skyTop: string;
  skyHorizon: string;
  fogColor: number;
  hemiSky: number;
  hemiGround: number;
  sunColor: number;
  sunIntensity: number;
  starOpacity: number;
  celestialColor: number;
}

export class Environment {
  private scene: THREE.Scene;

  // Static vast foundation floor that covers the entire horizon (never moves, prevents all voids)
  private baseGroundMesh!: THREE.Mesh;

  // Dynamic moving parallax layers
  private trackDetailChunks: THREE.Group[] = [];
  private nearDuneChunks: THREE.Group[] = [];
  private midDuneChunks: THREE.Group[] = [];
  private farMountainChunks: THREE.Group[] = [];
  private utilityPoleChunks: THREE.Group[] = [];
  private clouds: THREE.Group[] = [];
  private distantBirds!: THREE.Group;
  private tumbleweeds: { mesh: THREE.Mesh; speed: number; rotSpeed: number }[] = [];
  private starsGroup!: THREE.Points;
  private celestialBody!: THREE.Mesh;
  private celestialGlow!: THREE.Mesh;
  public dinoShadow!: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;

  // Sky Backdrop with authentic desert sky texture & smooth procedural day/night tinting
  private skyBackdrop!: THREE.Mesh;
  private skyCanvas!: HTMLCanvasElement;
  private skyContext!: CanvasRenderingContext2D;
  private skyTexture!: THREE.CanvasTexture;
  private desertSkyImage: HTMLImageElement | null = null;
  private isSkyImageLoaded: boolean = false;

  // Flora billboard materials
  private floraMaterials: THREE.SpriteMaterial[] = [];

  // Lights
  private hemiLight!: THREE.HemisphereLight;
  private sunLight!: THREE.DirectionalLight;
  private skyFillLight!: THREE.DirectionalLight;

  private readonly chunkSize: number = 40.0;
  private readonly numChunks: number = 5;

  // Day / Night Cycle (cycle duration e.g. 100 seconds)
  private dayTime: number = 0;
  private readonly cycleDuration: number = 100.0;
  public currentPhaseName: string = 'Siang';

  // Materials with warm, rich desert tones matching the Blender scene
  private sandMat: THREE.MeshLambertMaterial;
  private trackMarkMat: THREE.MeshLambertMaterial;
  private nearDuneMat: THREE.MeshLambertMaterial;
  private midDuneMat1: THREE.MeshLambertMaterial;
  private midDuneMat2: THREE.MeshLambertMaterial;
  private farMountainMat: THREE.MeshLambertMaterial;
  private poleWoodMat: THREE.MeshLambertMaterial;
  private distantCactusMat: THREE.MeshLambertMaterial;
  private cloudMat: THREE.MeshLambertMaterial;
  private celestialMat: THREE.MeshBasicMaterial;
  private glowMat: THREE.MeshBasicMaterial;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Authentic warm desert palette
    this.sandMat = new THREE.MeshLambertMaterial({
      color: 0xdeb872,
      flatShading: true,
    });
    this.trackMarkMat = new THREE.MeshLambertMaterial({
      color: 0xc29750,
      flatShading: true,
    });
    this.nearDuneMat = new THREE.MeshLambertMaterial({
      color: 0xd4a558,
      flatShading: true,
    });
    this.midDuneMat1 = new THREE.MeshLambertMaterial({
      color: 0xc47844,
      flatShading: true,
    });
    this.midDuneMat2 = new THREE.MeshLambertMaterial({
      color: 0xaf5630,
      flatShading: true,
    });
    this.farMountainMat = new THREE.MeshLambertMaterial({
      color: 0x72557a,
      flatShading: true,
    });
    this.poleWoodMat = new THREE.MeshLambertMaterial({
      color: 0x5a4028,
      flatShading: true,
    });
    this.distantCactusMat = new THREE.MeshLambertMaterial({
      color: 0x486b36,
      flatShading: true,
    });
    this.cloudMat = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      flatShading: true,
    });
    this.celestialMat = new THREE.MeshBasicMaterial({ color: 0xfff5dc });
    this.glowMat = new THREE.MeshBasicMaterial({
      color: 0xffe088,
      transparent: true,
      opacity: 0.35,
    });

    this.loadFloraTextures();
    this.setupLighting();
    this.createSkyBackdrop();
    this.createCelestialAndStars();
    this.createDistantBirds();
    this.createBaseVastFloor();
    this.createTrackDetailChunks();
    this.createUtilityPoles();
    this.createNearDunes();
    this.createMidDesertDunes();
    this.createFarMountains();
    this.createClouds();
    this.createTumbleweeds();
    this.createDinoShadow();

    // Initial sky update
    this.updateDayNightCycle(0);
  }

  private loadFloraTextures() {
    const texLoader = new THREE.TextureLoader();
    const floraPaths = [
      '/textures/nopal-cactus.png',
      '/textures/cactus_05_small.png',
      '/textures/agave_angustifolial_1_.png.004.png',
    ];

    floraPaths.forEach((path) => {
      texLoader.load(
        path,
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
          this.floraMaterials.push(mat);
        },
        undefined,
        (err) => console.warn('Could not load flora texture:', path, err)
      );
    });
  }

  private setupLighting() {
    // Warm hemisphere ambient light: golden sky bounce, terracotta ground bounce
    this.hemiLight = new THREE.HemisphereLight(0xffecd0, 0xc49048, 1.25);
    this.hemiLight.position.set(0, 25, 0);
    this.scene.add(this.hemiLight);

    // Warm Sun Main matching Blender scene
    this.sunLight = new THREE.DirectionalLight(0xfff5e0, 1.4);
    this.sunLight.position.set(10, 18, 12);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 1024;
    this.sunLight.shadow.mapSize.height = 1024;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 65;
    this.sunLight.shadow.camera.left = -25;
    this.sunLight.shadow.camera.right = 40;
    this.sunLight.shadow.camera.top = 20;
    this.sunLight.shadow.camera.bottom = -10;
    this.sunLight.shadow.bias = -0.0005;
    this.scene.add(this.sunLight);

    // Cool skylight fill matching Blender Sun Blue
    this.skyFillLight = new THREE.DirectionalLight(0x90b8e8, 0.6);
    this.skyFillLight.position.set(-10, 14, -8);
    this.scene.add(this.skyFillLight);
  }

  private createSkyBackdrop() {
    this.skyCanvas = document.createElement('canvas');
    this.skyCanvas.width = 512;
    this.skyCanvas.height = 512;
    this.skyContext = this.skyCanvas.getContext('2d')!;

    this.skyTexture = new THREE.CanvasTexture(this.skyCanvas);
    this.skyTexture.generateMipmaps = false;
    this.skyTexture.minFilter = THREE.LinearFilter;

    // Load authentic desert sky photo from Blender scene
    this.desertSkyImage = new Image();
    this.desertSkyImage.src = '/textures/sky159.jpg';
    this.desertSkyImage.onload = () => {
      this.isSkyImageLoaded = true;
      this.updateDayNightCycle(0);
    };

    const backdropGeo = new THREE.PlaneGeometry(260, 90);
    const backdropMat = new THREE.MeshBasicMaterial({
      map: this.skyTexture,
      depthWrite: false,
    });
    this.skyBackdrop = new THREE.Mesh(backdropGeo, backdropMat);
    this.skyBackdrop.position.set(10, 24, -75);
    this.scene.add(this.skyBackdrop);
  }

  private renderSkyGradient(topColor: string, horizonColor: string, isDay: boolean) {
    if (!this.skyContext) return;
    const ctx = this.skyContext;
    const w = 512;
    const h = 512;

    ctx.clearRect(0, 0, w, h);

    if (this.isSkyImageLoaded && this.desertSkyImage) {
      ctx.drawImage(this.desertSkyImage, 0, 0, w, h);

      ctx.save();
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, topColor);
      grad.addColorStop(0.70, horizonColor);
      grad.addColorStop(1, '#deb872');

      if (isDay) {
        ctx.globalCompositeOperation = 'overlay';
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
      } else {
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
      }
      ctx.restore();
    } else {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, topColor);
      grad.addColorStop(0.70, horizonColor);
      grad.addColorStop(1, '#deb872');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }

    this.skyTexture.needsUpdate = true;
  }

  private createCelestialAndStars() {
    const celestialGroup = new THREE.Group();
    celestialGroup.position.set(18, 18, -48);

    const sunGeo = new THREE.CircleGeometry(2.8, 24);
    this.celestialBody = new THREE.Mesh(sunGeo, this.celestialMat);
    celestialGroup.add(this.celestialBody);

    const glowGeo = new THREE.CircleGeometry(5.0, 24);
    this.celestialGlow = new THREE.Mesh(glowGeo, this.glowMat);
    this.celestialGlow.position.z = -0.05;
    celestialGroup.add(this.celestialGlow);

    this.scene.add(celestialGroup);

    const starCount = 180;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      starPos[i * 3] = (Math.random() - 0.5) * 120;
      starPos[i * 3 + 1] = 6 + Math.random() * 35;
      starPos[i * 3 + 2] = -40 - Math.random() * 15;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.22,
      transparent: true,
      opacity: 0,
    });
    this.starsGroup = new THREE.Points(starGeo, starMat);
    this.scene.add(this.starsGroup);
  }

  private createDistantBirds() {
    this.distantBirds = new THREE.Group();
    this.distantBirds.position.set(15, 14, -30);

    const birdMat = new THREE.MeshBasicMaterial({ color: 0x3a2a1a });
    const offsets = [
      [0, 0],
      [-0.8, -0.4],
      [-1.6, -0.8],
      [0.8, -0.4],
      [1.6, -0.8],
    ];
    for (const [ox, oy] of offsets) {
      const bird = new THREE.Group();
      bird.position.set(ox * 1.2, oy * 0.8, (Math.random() - 0.5) * 2);

      const wingGeo = new THREE.BoxGeometry(0.4, 0.04, 0.12);
      const leftW = new THREE.Mesh(wingGeo, birdMat);
      leftW.position.set(-0.18, 0, 0);
      leftW.rotation.z = 0.25;
      const rightW = new THREE.Mesh(wingGeo, birdMat);
      rightW.position.set(0.18, 0, 0);
      rightW.rotation.z = -0.25;

      bird.add(leftW);
      bird.add(rightW);
      bird.scale.setScalar(0.7);
      this.distantBirds.add(bird);
    }
    this.scene.add(this.distantBirds);
  }

  private createDinoShadow() {
    const shadowGeo = new THREE.CircleGeometry(0.85, 24);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.22,
    });
    this.dinoShadow = new THREE.Mesh(shadowGeo, shadowMat);
    this.dinoShadow.rotation.x = -Math.PI / 2;
    this.dinoShadow.position.set(0, 0.02, 0);
    this.scene.add(this.dinoShadow);
  }

  /**
   * Massive, static, seamless desert foundation floor.
   * Spans x = -150 to +250, z = +35 to -120, and extends 15 units downwards (y = 0 to y = -15).
   * Guarantees that no camera angle can ever expose a void or floating ground edge!
   */
  private createBaseVastFloor() {
    const width = 400.0;
    const depth = 160.0;
    const thickness = 15.0;

    const baseGeo = new THREE.BoxGeometry(width, thickness, depth);
    this.baseGroundMesh = new THREE.Mesh(baseGeo, this.sandMat);
    // Center at x = 50, y = -7.5 (so top surface is exactly at y = 0), z = -45
    this.baseGroundMesh.position.set(50.0, -thickness / 2, -45.0);
    this.baseGroundMesh.receiveShadow = true;
    this.scene.add(this.baseGroundMesh);

    // Fill the entire runner lane top with sand-colored plane to eliminate any color gap
    const laneFill = new THREE.Mesh(
      new THREE.PlaneGeometry(400.0, 20.0),
      this.sandMat
    );
    laneFill.rotation.x = -Math.PI / 2;
    laneFill.position.set(50.0, 0.001, 0.0);
    laneFill.receiveShadow = true;
    this.scene.add(laneFill);
  }

  /**
   * Moving track markings along the running lane to convey high-speed velocity.
   * Subtle parallel tire ruts and small scattered desert pebbles.
   */
  private createTrackDetailChunks() {
    const rutGeo = new THREE.PlaneGeometry(this.chunkSize, 0.22);
    rutGeo.rotateX(-Math.PI / 2);

    for (let i = 0; i < this.numChunks; i++) {
      const chunk = new THREE.Group();
      chunk.position.x = (i - 2.0) * this.chunkSize;

      // Parallel vehicle tracks in the sand
      const leftRut = new THREE.Mesh(rutGeo, this.trackMarkMat);
      leftRut.position.set(this.chunkSize / 2, 0.006, -1.15);
      chunk.add(leftRut);

      const rightRut = new THREE.Mesh(rutGeo, this.trackMarkMat);
      rightRut.position.set(this.chunkSize / 2, 0.006, 1.15);
      chunk.add(rightRut);

      // Organic low-poly desert pebbles scattered on the sand
      for (let j = 0; j < 14; j++) {
        const pebbleR = 0.06 + Math.random() * 0.07;
        const pebbleGeo = new THREE.DodecahedronGeometry(pebbleR, 0);
        const pebble = new THREE.Mesh(pebbleGeo, this.trackMarkMat);
        pebble.scale.set(1.0, 0.35, 1.0);
        const px = Math.random() * this.chunkSize;
        const pz = (Math.random() - 0.5) * 5.5;
        pebble.position.set(px, 0.02, pz);
        pebble.rotation.y = Math.random() * Math.PI;
        chunk.add(pebble);
      }

      this.scene.add(chunk);
      this.trackDetailChunks.push(chunk);
    }
  }

  /**
   * Utility poles along the shoulder: deeply rooted 3.5 units into the ground slab.
   */
  private createUtilityPoles() {
    for (let i = 0; i < this.numChunks; i++) {
      const chunk = new THREE.Group();
      chunk.position.x = (i - 2.0) * this.chunkSize;

      for (let p = 0; p < 2; p++) {
        const pole = new THREE.Group();
        pole.position.set(p * 20 + 5, 0, -2.8);

        // Vertical post: total height 8.0, buried from y = -3.5 to y = 4.5
        const postH = 8.0;
        const postGeo = new THREE.CylinderGeometry(0.09, 0.13, postH, 6);
        const post = new THREE.Mesh(postGeo, this.poleWoodMat);
        post.position.y = postH / 2 - 3.5;
        post.castShadow = true;
        pole.add(post);

        // Crossbeam
        const beamGeo = new THREE.BoxGeometry(0.12, 0.12, 1.3);
        const beam = new THREE.Mesh(beamGeo, this.poleWoodMat);
        beam.position.set(0, 4.0, 0);
        pole.add(beam);

        // Insulator pegs
        const pegMat = new THREE.MeshBasicMaterial({ color: 0xeeeeee });
        for (const oz of [-0.48, 0, 0.48]) {
          const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 4), pegMat);
          peg.position.set(0, 4.12, oz);
          pole.add(peg);
        }

        // Broad flat sand footing mound
        const footing = new THREE.Mesh(
          new THREE.CylinderGeometry(0.18, 0.55, 0.18, 8),
          this.trackMarkMat
        );
        footing.position.y = 0.06;
        pole.add(footing);

        chunk.add(pole);
      }

      this.scene.add(chunk);
      this.utilityPoleChunks.push(chunk);
    }
  }

  /**
   * Layer 1: Smooth rolling sand dunes created with half-buried oblong spheres.
   * Naturally melds with the vast floor with zero sharp cut edges.
   */
  private createNearDunes() {
    const loader = AssetLoader.getInstance();

    for (let i = 0; i < this.numChunks; i++) {
      const chunk = new THREE.Group();
      chunk.position.x = (i - 2.0) * this.chunkSize;

      for (let d = 0; d < 3; d++) {
        const duneW = 16 + Math.random() * 5;
        const duneH = 1.8 + Math.random() * 0.8;
        const duneD = 12 + Math.random() * 4;

        const sphereRadius = 4.5;
        const duneGeo = new THREE.SphereGeometry(sphereRadius, 20, 10);
        const dune = new THREE.Mesh(duneGeo, this.nearDuneMat);
        dune.scale.set(duneW / (sphereRadius * 2), duneH / sphereRadius, duneD / (sphereRadius * 2));

        const dx = d * 13 + Math.random() * 2;
        const dz = -8.5 - Math.random() * 3.0;
        // Half-buried so bottom curves smoothly underneath y = 0
        dune.position.set(dx, -duneH * 0.35, dz);
        dune.rotation.y = Math.random() * Math.PI;
        chunk.add(dune);

        // Perched authentic Saguaro cactus firmly rooted on dune crest
        const miniCactus = new THREE.Group();
        miniCactus.position.set(dx + (Math.random() - 0.5) * 2, duneH * 0.62, dz);
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 1.4, 6), this.distantCactusMat);
        stem.position.y = 0.7;
        miniCactus.add(stem);
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.6, 5), this.distantCactusMat);
        arm.position.set(0.24, 0.85, 0);
        arm.rotation.z = -Math.PI / 3;
        miniCactus.add(arm);
        chunk.add(miniCactus);
      }

      // Decorative authentic 3D desert rocks safely along the dune foot (away from runner track)
      loader.loadAll().then(() => {
        const rock = loader.getRandomRock();
        if (rock) {
          rock.scale.setScalar(0.48);
          rock.position.set(Math.random() * this.chunkSize, 0, -6.8 - Math.random() * 2.2);
          chunk.add(rock);
        }
      });

      this.scene.add(chunk);
      this.nearDuneChunks.push(chunk);
    }
  }

  /**
   * Layer 2: Broad, rolling terracotta desert ridges (smooth, continuous, NO floating cones).
   */
  private createMidDesertDunes() {
    for (let i = 0; i < this.numChunks; i++) {
      const chunk = new THREE.Group();
      chunk.position.x = (i - 2.0) * this.chunkSize;

      for (let c = 0; c < 3; c++) {
        const ridgeW = 24 + Math.random() * 8;
        const ridgeH = 4.5 + Math.random() * 1.5;
        const ridgeD = 18 + Math.random() * 5;

        const sphereRadius = 5.5;
        const ridgeGeo = new THREE.SphereGeometry(sphereRadius, 20, 10);
        const mat = c % 2 === 0 ? this.midDuneMat1 : this.midDuneMat2;
        const ridge = new THREE.Mesh(ridgeGeo, mat);
        ridge.scale.set(ridgeW / (sphereRadius * 2), ridgeH / sphereRadius, ridgeD / (sphereRadius * 2));

        const rx = c * 13 + 4 + (Math.random() - 0.5) * 3;
        const rz = -20 - Math.random() * 6;
        // Deeply submerged into the vast floor
        ridge.position.set(rx, -ridgeH * 0.4, rz);
        ridge.rotation.y = Math.random() * Math.PI;
        chunk.add(ridge);
      }

      this.scene.add(chunk);
      this.midDuneChunks.push(chunk);
    }
  }

  /**
   * Layer 3: Grand distant canyon mesas & rolling mountain plateaus on the horizon.
   * Flat-topped red-rock mesas matching authentic Monument Valley desert landscapes.
   */
  private createFarMountains() {
    for (let i = 0; i < this.numChunks; i++) {
      const chunk = new THREE.Group();
      chunk.position.x = (i - 2.0) * this.chunkSize;

      // 1. Flat-topped Canyon Mesas / Buttes
      for (let m = 0; m < 2; m++) {
        const topR = 9 + Math.random() * 4;
        const botR = topR + 4 + Math.random() * 3;
        const mesaH = 14 + Math.random() * 6;
        const mesaGeo = new THREE.CylinderGeometry(topR, botR, mesaH, 8);
        mesaGeo.scale(1.4, 1.0, 0.65);
        const mesa = new THREE.Mesh(mesaGeo, this.farMountainMat);
        const mx = m * 20 + 8 + (Math.random() - 0.5) * 4;
        // Submerge base deeply (y = -4.0 to -6.0)
        mesa.position.set(mx, mesaH * 0.35 - 4.0, -48 - Math.random() * 8);
        mesa.rotation.y = Math.random() * Math.PI;
        chunk.add(mesa);
      }

      // 2. Sweeping rolling mountain ridges
      for (let r = 0; r < 2; r++) {
        const domeR = 16 + Math.random() * 6;
        const domeGeo = new THREE.SphereGeometry(domeR, 16, 8);
        domeGeo.scale(1.6, 0.75, 0.7);
        const ridge = new THREE.Mesh(domeGeo, this.farMountainMat);
        const rx = r * 20 + (Math.random() - 0.5) * 6;
        ridge.position.set(rx, -domeR * 0.42, -54 - Math.random() * 6);
        chunk.add(ridge);
      }

      this.scene.add(chunk);
      this.farMountainChunks.push(chunk);
    }
  }

  private createClouds() {
    for (let i = 0; i < 6; i++) {
      const cloud = new THREE.Group();
      cloud.position.set(
        (Math.random() - 0.3) * 60,
        10.0 + Math.random() * 5.0,
        -20.0 - Math.random() * 14.0
      );

      const puffCount = 3 + Math.floor(Math.random() * 3);
      for (let p = 0; p < puffCount; p++) {
        const radius = 0.8 + Math.random() * 0.6;
        const puffGeo = new THREE.DodecahedronGeometry(radius, 0);
        const puff = new THREE.Mesh(puffGeo, this.cloudMat);
        puff.position.set((p - puffCount / 2) * 0.9, (Math.random() - 0.5) * 0.3, 0);
        puff.scale.set(1.2, 0.65, 0.9);
        cloud.add(puff);
      }

      this.scene.add(cloud);
      this.clouds.push(cloud);
    }
  }

  private createTumbleweeds() {
    const tumbleMat = new THREE.MeshLambertMaterial({
      color: 0x9b7a48,
      flatShading: true,
    });
    for (let i = 0; i < 2; i++) {
      const geo = new THREE.DodecahedronGeometry(0.35 + Math.random() * 0.15, 0);
      const mesh = new THREE.Mesh(geo, tumbleMat);
      mesh.position.set(10 + i * 16, 0.3, -3.8 - Math.random() * 2.0);
      this.scene.add(mesh);

      this.tumbleweeds.push({
        mesh,
        speed: 1.5 + Math.random() * 1.5,
        rotSpeed: 4.0 + Math.random() * 3.0,
      });
    }
  }

  private updateDayNightCycle(delta: number) {
    this.dayTime = (this.dayTime + delta) % this.cycleDuration;
    const progress = this.dayTime / this.cycleDuration;

    let topColor: string;
    let horizonColor: string;
    let hemiSky: number;
    let hemiGround: number;
    let sunColor: number;
    let sunIntensity: number;
    let starOpacity = 0;
    let celestialColor: number;
    let isDay = true;

    if (progress < 0.35) {
      // Siang (Sunlit azure fading into warm golden horizon)
      this.currentPhaseName = 'Siang';
      topColor = '#87CEEB';
      horizonColor = '#FDE6B8';
      hemiSky = 0xffecd0;
      hemiGround = 0xc49048;
      sunColor = 0xfff5e0;
      sunIntensity = 1.4;
      celestialColor = 0xfff5dc;
      this.farMountainMat.color.set(0x72557a);
      isDay = true;
    } else if (progress < 0.50) {
      // Senja (Dramatic sunset orange and crimson)
      this.currentPhaseName = 'Senja';
      topColor = '#4B2A59';
      horizonColor = '#E06D3B';
      hemiSky = 0xe08852;
      hemiGround = 0x6e4024;
      sunColor = 0xff7a33;
      sunIntensity = 0.95;
      celestialColor = 0xff6622;
      this.farMountainMat.color.set(0x543a59);
      isDay = true;
    } else if (progress < 0.85) {
      // Malam (Deep star-filled indigo navy, cool moonlight)
      this.currentPhaseName = 'Malam';
      topColor = '#0F1626';
      horizonColor = '#1F2A3E';
      hemiSky = 0x2a3b59;
      hemiGround = 0x161d26;
      sunColor = 0x8fa8d6;
      sunIntensity = 0.5;
      celestialColor = 0xe6f0ff;
      starOpacity = 0.85;
      this.farMountainMat.color.set(0x222030);
      isDay = false;
    } else {
      // Fajar (Soft apricot & lavender sunrise)
      this.currentPhaseName = 'Fajar';
      topColor = '#433D6B';
      horizonColor = '#E8A374';
      hemiSky = 0xe8b48a;
      hemiGround = 0x5c4632;
      sunColor = 0xffc07a;
      sunIntensity = 0.95;
      celestialColor = 0xffe2a8;
      this.farMountainMat.color.set(0x61486b);
      isDay = true;
    }

    this.renderSkyGradient(topColor, horizonColor, isDay);

    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.color.setStyle(horizonColor);
    }
    if (this.scene.background instanceof THREE.Color) {
      this.scene.background.setStyle(horizonColor);
    }

    this.hemiLight.color.setHex(hemiSky);
    this.hemiLight.groundColor.setHex(hemiGround);
    this.sunLight.color.setHex(sunColor);
    this.sunLight.intensity = sunIntensity;
    if (this.skyFillLight) {
      this.skyFillLight.intensity = isDay ? 0.6 : 0.2;
    }
    this.celestialMat.color.setHex(celestialColor);
    this.glowMat.color.setHex(celestialColor);

    (this.starsGroup.material as THREE.PointsMaterial).opacity = starOpacity;
  }

  public update(delta: number, currentSpeed: number, dinoY: number) {
    if (!Number.isFinite(delta) || !Number.isFinite(currentSpeed) || delta <= 0) return;

    this.updateDayNightCycle(delta);

    // Dynamic contact shadow below Dino
    const safeDinoY = Number.isFinite(dinoY) ? Math.max(0, dinoY) : 0;
    const shadowScale = Math.max(0.35, 1.0 - safeDinoY * 0.28);
    this.dinoShadow.scale.set(shadowScale * 1.3, shadowScale, shadowScale);
    (this.dinoShadow.material as THREE.MeshBasicMaterial).opacity = Math.max(0.08, 0.22 - safeDinoY * 0.05);

    // Parallax Layer 0: Track details & Utility Poles (100% full speed)
    const groundMove = currentSpeed * delta;
    this.recycleChunkList(this.trackDetailChunks, groundMove);
    this.recycleChunkList(this.utilityPoleChunks, groundMove);

    // Parallax Layer 1: Near Sand Dunes (50% speed)
    const duneMove = currentSpeed * delta * 0.50;
    this.recycleChunkList(this.nearDuneChunks, duneMove);

    // Parallax Layer 2: Mid Desert Dunes (24% speed)
    const midDuneMove = currentSpeed * delta * 0.24;
    this.recycleChunkList(this.midDuneChunks, midDuneMove);

    // Parallax Layer 3: Far Mountain Ridge (8% speed)
    const mountainMove = currentSpeed * delta * 0.08;
    this.recycleChunkList(this.farMountainChunks, mountainMove);

    // Clouds drift slowly
    const cloudSpeed = (currentSpeed * 0.04 + 0.3) * delta;
    for (const cloud of this.clouds) {
      cloud.position.x -= cloudSpeed;
      if (cloud.position.x < -35.0) {
        cloud.position.x = 35.0 + Math.random() * 8.0;
        cloud.position.y = 10.0 + Math.random() * 5.0;
      }
    }

    // Distant birds soar across the sky
    this.distantBirds.position.x -= (currentSpeed * 0.12 + 1.2) * delta;
    this.distantBirds.position.y += Math.sin(this.dayTime * 0.8) * 0.005;
    if (this.distantBirds.position.x < -35.0) {
      this.distantBirds.position.x = 40.0;
    }

    // Tumbleweeds roll and bounce
    for (const tw of this.tumbleweeds) {
      tw.mesh.position.x -= (currentSpeed * 0.8 + tw.speed) * delta;
      tw.mesh.rotation.z += tw.rotSpeed * delta;
      tw.mesh.position.y = 0.35 + Math.abs(Math.sin(tw.mesh.position.x * 1.2)) * 0.25;

      if (tw.mesh.position.x < -20.0) {
        tw.mesh.position.x = 30.0 + Math.random() * 12.0;
      }
    }
  }

  private recycleChunkList(list: THREE.Group[], moveDist: number) {
    for (const chunk of list) {
      chunk.position.x -= moveDist;
    }
    const leftmost = list[0];
    if (leftmost && leftmost.position.x <= -this.chunkSize * 2.5) {
      const rightmost = list[list.length - 1];
      leftmost.position.x = rightmost.position.x + this.chunkSize;
      list.push(list.shift()!);
    }
  }

  public reset() {
    const resetList = (list: THREE.Group[]) => {
      for (let i = 0; i < list.length; i++) {
        list[i].position.x = (i - 2.0) * this.chunkSize;
      }
    };
    resetList(this.trackDetailChunks);
    resetList(this.utilityPoleChunks);
    resetList(this.nearDuneChunks);
    resetList(this.midDuneChunks);
    resetList(this.farMountainChunks);
  }
}
