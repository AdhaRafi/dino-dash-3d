import * as THREE from 'three';
import { Dino, DinoSkinColor } from './Dino';
import { ObstacleManager } from './ObstacleManager';
import { Environment } from './Environment';
import { ParticleSystem } from './Particles';
import { SoundEffects } from '../audio/SoundEffects';
import { AssetLoader } from './AssetLoader';

export type GameEngineState = 'start' | 'playing' | 'paused' | 'gameover';
export type CameraViewMode = 'cinematic' | 'side';

export interface GameEngineOptions {
  canvas: HTMLCanvasElement;
  sound: SoundEffects;
  onScoreUpdate: (score: number, highScore: number) => void;
  onGameOver: (score: number, isNewHighScore: boolean) => void;
  onStateChange: (state: GameEngineState) => void;
  onDayNightChange?: (phaseName: string) => void;
  onScorePopup?: (text: string, x: number, y: number) => void;
}

export class GameEngine {
  public state: GameEngineState = 'start';
  public cameraMode: CameraViewMode = 'cinematic';
  private canvas: HTMLCanvasElement;
  private sound: SoundEffects;

  // Three.js Core
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;

  // Entities & Systems
  public dino: Dino;
  private obstacles: ObstacleManager;
  private environment: Environment;
  private particles: ParticleSystem;

  // Gameplay Settings & Variables
  private score: number = 0;
  private highScore: number = 0;
  private lastMilestone: number = 0;
  private readonly baseSpeed: number = 11.0;
  private currentSpeed: number = 11.0;
  private readonly maxSpeed: number = 24.0;
  private distanceTraveled: number = 0;

  // Animation & Loop
  private lastFrameTime: number = 0;
  private animationFrameId: number | null = null;

  // Camera Shake & Dynamic Camera
  public enableScreenShake: boolean = true;
  private shakeDuration: number = 0;
  private shakeIntensity: number = 0;
  private currentCamPos = new THREE.Vector3();
  private currentCamLook = new THREE.Vector3();

  // Camera Presets
  // 1. Cinematic 3/4 Chase Angle: Look from rear-left towards the track horizon
  private readonly cinematicPos = new THREE.Vector3(-2.8, 3.2, 5.8);
  private readonly cinematicLook = new THREE.Vector3(5.8, 1.1, -0.4);

  // 2. Classic 3D Side Angle: Classic side runner perspective
  private readonly sidePos = new THREE.Vector3(3.2, 2.7, 8.4);
  private readonly sideLook = new THREE.Vector3(3.2, 1.3, 0);

  // Callbacks
  private onScoreUpdate: (score: number, highScore: number) => void;
  private onGameOver: (score: number, isNewHighScore: boolean) => void;
  private onStateChange: (state: GameEngineState) => void;
  private onDayNightChange?: (phaseName: string) => void;
  private onScorePopup?: (text: string, x: number, y: number) => void;

  constructor(options: GameEngineOptions) {
    this.canvas = options.canvas;
    this.sound = options.sound;
    this.onScoreUpdate = options.onScoreUpdate;
    this.onGameOver = options.onGameOver;
    this.onStateChange = options.onStateChange;
    this.onDayNightChange = options.onDayNightChange;
    this.onScorePopup = options.onScorePopup;

    // Load High Score safely
    const savedHighScore = localStorage.getItem('dino_dash_highscore');
    const parsed = savedHighScore ? parseInt(savedHighScore, 10) : 0;
    this.highScore = Number.isFinite(parsed) && !isNaN(parsed) ? Math.max(0, parsed) : 0;

    // Load preferences
    const savedShake = localStorage.getItem('dino_dash_screenshake');
    this.enableScreenShake = savedShake !== 'false';

    const savedCam = localStorage.getItem('dino_dash_cameramode') as CameraViewMode;
    if (savedCam === 'cinematic' || savedCam === 'side') {
      this.cameraMode = savedCam;
    }

    // Three.js Scene Setup (Fog distance tuned so mountains and sky gradient are crisp and majestic)
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xFDE6B8);
    this.scene.fog = new THREE.Fog(0xE8CE9A, 30, 95);

    const aspect = this.canvas.clientWidth / this.canvas.clientHeight || 16 / 9;
    this.camera = new THREE.PerspectiveCamera(44, aspect, 0.1, 100);

    const initialPos = this.cameraMode === 'cinematic' ? this.cinematicPos : this.sidePos;
    const initialLook = this.cameraMode === 'cinematic' ? this.cinematicLook : this.sideLook;
    this.currentCamPos.copy(initialPos);
    this.currentCamLook.copy(initialLook);
    this.camera.position.copy(this.currentCamPos);
    this.camera.lookAt(this.currentCamLook);

    // WebGLRenderer setup
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Preload authentic 3D models and textures from Blender scene
    AssetLoader.getInstance().loadAll();

    (window as any).__gameEngine = this;

    // Entities & VFX
    this.environment = new Environment(this.scene);
    this.particles = new ParticleSystem(this.scene);
    this.obstacles = new ObstacleManager(this.scene);
    this.dino = new Dino();
    this.scene.add(this.dino.mesh);

    // Setup Dino VFX callbacks
    this.dino.onFootstep = (x, y, z) => {
      this.particles.spawnFootstepDust(x, y, z);
      this.sound.playFootstep();
    };

    this.dino.onLand = (x, z) => {
      this.particles.spawnLandingDust(x, z);
      this.sound.playLand();
      if (this.enableScreenShake) {
        this.triggerShake(0.12, 0.15);
      }
    };

    // Setup obstacle jump-over reward callback
    this.obstacles.onObstacleCleared = (x, y) => {
      // Award bonus distance and trigger popup
      this.distanceTraveled += 25;
      this.sound.playScoreBonus();
      if (this.onScorePopup) {
        const screenPos = this.toScreenCoordinates(new THREE.Vector3(x, y, 0));
        this.onScorePopup('+50', screenPos.x, screenPos.y);
      }
    };

    this.render();
    this.onScoreUpdate(this.score, this.highScore);
  }

  public toggleCameraMode(): CameraViewMode {
    this.cameraMode = this.cameraMode === 'cinematic' ? 'side' : 'cinematic';
    localStorage.setItem('dino_dash_cameramode', this.cameraMode);
    return this.cameraMode;
  }

  public setDinoSkin(skin: DinoSkinColor) {
    this.dino.setSkinColor(skin);
    this.render();
  }

  public start() {
    if (this.state === 'playing') return;
    this.state = 'playing';
    this.dino.state = 'run';
    this.onStateChange(this.state);

    this.lastFrameTime = performance.now();
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.animationFrameId = requestAnimationFrame(this.loop);
  }

  public jump(): boolean {
    if (this.state === 'start') {
      this.start();
      const didJump = this.dino.jump();
      if (didJump) this.sound.playJump();
      return didJump;
    }

    if (this.state === 'playing') {
      const didJump = this.dino.jump();
      if (didJump) {
        this.sound.playJump();
      }
      return didJump;
    }

    if (this.state === 'gameover') {
      this.restart();
      return true;
    }

    return false;
  }

  public duck(isDucking: boolean) {
    if (this.state !== 'playing') return;
    this.dino.duck(isDucking);
    // Note: duck sound is triggered from main.ts on first keydown only (no loop)
  }

  public pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.onStateChange(this.state);
  }

  public resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.onStateChange(this.state);

    this.lastFrameTime = performance.now();
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.animationFrameId = requestAnimationFrame(this.loop);
  }

  public restart() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this.score = 0;
    this.distanceTraveled = 0;
    this.lastMilestone = 0;
    this.currentSpeed = this.baseSpeed;
    this.shakeDuration = 0;

    this.dino.reset();
    this.obstacles.reset();
    this.environment.reset();
    this.particles.reset();

    const targetPos = this.cameraMode === 'cinematic' ? this.cinematicPos : this.sidePos;
    const targetLook = this.cameraMode === 'cinematic' ? this.cinematicLook : this.sideLook;
    this.currentCamPos.copy(targetPos);
    this.currentCamLook.copy(targetLook);
    this.camera.position.copy(this.currentCamPos);
    this.camera.lookAt(this.currentCamLook);

    this.start();
    this.onScoreUpdate(this.score, this.highScore);
  }

  public toggleScreenShake(enabled: boolean) {
    this.enableScreenShake = enabled;
    localStorage.setItem('dino_dash_screenshake', String(enabled));
  }

  private triggerShake(intensity: number, duration: number) {
    if (!this.enableScreenShake) return;
    this.shakeIntensity = intensity;
    this.shakeDuration = duration;
  }

  private toScreenCoordinates(worldPos: THREE.Vector3): { x: number; y: number } {
    const p = worldPos.clone().project(this.camera);
    const hw = this.canvas.clientWidth / 2;
    const hh = this.canvas.clientHeight / 2;
    return {
      x: p.x * hw + hw,
      y: -(p.y * hh) + hh,
    };
  }

  private update(delta: number) {
    if (this.state !== 'playing') {
      this.dino.update(delta, this.currentSpeed);
      this.particles.update(delta);
      return;
    }

    if (!Number.isFinite(delta) || delta <= 0) return;
    if (!Number.isFinite(this.currentSpeed) || this.currentSpeed < this.baseSpeed) {
      this.currentSpeed = this.baseSpeed;
    }

    // Distance and score calculation
    this.distanceTraveled = Math.max(0, this.distanceTraveled + this.currentSpeed * delta);
    this.score = Math.floor(this.distanceTraveled * 1.2);
    if (!Number.isFinite(this.score) || isNaN(this.score)) {
      this.score = 0;
    }

    // Smooth speed scaling
    const progress = Math.max(0, this.distanceTraveled / 120);
    this.currentSpeed = Math.min(
      this.maxSpeed,
      this.baseSpeed + Math.pow(progress, 0.75) * 1.8
    );
    if (!Number.isFinite(this.currentSpeed)) {
      this.currentSpeed = this.baseSpeed;
    }

    // Score Milestone sound
    const currentMilestone = Math.floor(this.score / 100);
    if (currentMilestone > this.lastMilestone) {
      this.lastMilestone = currentMilestone;
      this.sound.playMilestone();
    }

    // Update scene elements and systems
    this.dino.update(delta, this.currentSpeed);
    this.obstacles.update(delta, this.currentSpeed);
    this.environment.update(delta, this.currentSpeed, this.dino.y);
    this.particles.update(delta);

    if (this.onDayNightChange) {
      this.onDayNightChange(this.environment.currentPhaseName);
    }

    // Collision check
    const dinoBox = this.dino.getBoundingBox();
    if (this.obstacles.checkCollision(dinoBox)) {
      this.handleGameOver();
      return;
    }

    this.onScoreUpdate(this.score, this.highScore);
  }

  private handleGameOver() {
    this.state = 'gameover';
    this.dino.setHit();
    this.sound.playCollision();
    this.triggerShake(0.45, 0.4);

    // Collision particle burst
    this.particles.spawnCrashExplosion(this.dino.mesh.position.x + 0.4, 0.6, 0);

    let isNewHighScore = false;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      isNewHighScore = true;
      localStorage.setItem('dino_dash_highscore', String(this.highScore));
    }

    this.onScoreUpdate(this.score, this.highScore);
    this.onGameOver(this.score, isNewHighScore);
    this.onStateChange(this.state);
  }

  private loop = (currentTime: number) => {
    if (this.state !== 'playing' && this.state !== 'gameover') return;

    if (!currentTime || !Number.isFinite(currentTime)) {
      currentTime = performance.now();
    }
    if (!this.lastFrameTime || !Number.isFinite(this.lastFrameTime)) {
      this.lastFrameTime = currentTime;
    }

    const rawDelta = (currentTime - this.lastFrameTime) / 1000;
    this.lastFrameTime = currentTime;
    const delta = (!Number.isFinite(rawDelta) || rawDelta < 0) ? 0 : Math.min(rawDelta, 0.08);

    this.update(delta);

    // Dynamic Camera Tracking & Zoom
    const targetBasePos = this.cameraMode === 'cinematic' ? this.cinematicPos : this.sidePos;
    const targetBaseLook = this.cameraMode === 'cinematic' ? this.cinematicLook : this.sideLook;

    // Speed zoom-out effect
    const speedRatio = (this.currentSpeed - this.baseSpeed) / (this.maxSpeed - this.baseSpeed);
    const zoomOffset = speedRatio * 1.5;

    // Jump vertical tracking (soft float)
    const jumpCamY = this.dino.y * 0.35;

    const destX = targetBasePos.x;
    const destY = targetBasePos.y + jumpCamY;
    const destZ = targetBasePos.z + zoomOffset;

    // Smooth interpolation to destination
    this.currentCamPos.x += (destX - this.currentCamPos.x) * 8 * delta;
    this.currentCamPos.y += (destY - this.currentCamPos.y) * 8 * delta;
    this.currentCamPos.z += (destZ - this.currentCamPos.z) * 8 * delta;

    this.currentCamLook.x += (targetBaseLook.x - this.currentCamLook.x) * 8 * delta;
    this.currentCamLook.y += (targetBaseLook.y + jumpCamY * 0.4 - this.currentCamLook.y) * 8 * delta;
    this.currentCamLook.z += (targetBaseLook.z - this.currentCamLook.z) * 8 * delta;

    // Handle screen shake
    if (this.shakeDuration > 0) {
      this.shakeDuration -= delta;
      const ox = (Math.random() - 0.5) * this.shakeIntensity;
      const oy = (Math.random() - 0.5) * this.shakeIntensity;
      this.camera.position.set(
        this.currentCamPos.x + ox,
        this.currentCamPos.y + oy,
        this.currentCamPos.z
      );
    } else {
      this.camera.position.copy(this.currentCamPos);
    }
    this.camera.lookAt(this.currentCamLook);

    this.render();

    if (this.state === 'playing') {
      this.animationFrameId = requestAnimationFrame(this.loop);
    }
  };

  private render() {
    this.renderer.render(this.scene, this.camera);
  }

  public handleResize() {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    if (width === 0 || height === 0) return;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.render();
  }

  public destroy() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.renderer.dispose();
  }
}
