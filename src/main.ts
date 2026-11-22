import { GameEngine, GameEngineState, CameraViewMode } from './game/GameEngine';
import { SoundEffects } from './audio/SoundEffects';
import { DinoSkinColor } from './game/Dino';

// WebGL 2 Support Detection
function checkWebGL2Support(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(window.WebGL2RenderingContext && canvas.getContext('webgl2'));
  } catch {
    return false;
  }
}

function initApp() {
  const isWebGL2Supported = checkWebGL2Support();
  if (!isWebGL2Supported) {
    const webglErrorScreen = document.getElementById('webgl-error-screen');
    const startScreen = document.getElementById('start-screen');
    if (webglErrorScreen) webglErrorScreen.classList.remove('hidden');
    if (startScreen) startScreen.classList.add('hidden');
    return;
  }

  // DOM Elements
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const startScreen = document.getElementById('start-screen') as HTMLElement;
  const pauseScreen = document.getElementById('pause-screen') as HTMLElement;
  const gameoverScreen = document.getElementById('gameover-screen') as HTMLElement;
  const gameHud = document.getElementById('game-hud') as HTMLElement;
  const mobileControls = document.getElementById('mobile-controls') as HTMLElement;
  const scorePopupsContainer = document.getElementById('score-popups') as HTMLElement;

  // HUD & Score Elements
  const hudCurrentScore = document.getElementById('hud-current-score') as HTMLElement;
  const hudHighScore = document.getElementById('hud-high-score') as HTMLElement;
  const startHighScore = document.getElementById('start-high-score') as HTMLElement;
  const gameoverFinalScore = document.getElementById('gameover-final-score') as HTMLElement;
  const gameoverHighScore = document.getElementById('gameover-high-score') as HTMLElement;
  const newRecordBadge = document.getElementById('new-record-badge') as HTMLElement;

  // Day / Night Phase Elements
  const hudPhaseIcon = document.getElementById('hud-phase-icon') as HTMLElement;
  const hudPhaseText = document.getElementById('hud-phase-text') as HTMLElement;

  // Buttons
  const startPlayBtn = document.getElementById('start-play-btn') as HTMLButtonElement;
  const pauseResumeBtn = document.getElementById('pause-resume-btn') as HTMLButtonElement;
  const pauseRestartBtn = document.getElementById('pause-restart-btn') as HTMLButtonElement;
  const gameoverRestartBtn = document.getElementById('gameover-restart-btn') as HTMLButtonElement;
  const hudPauseBtn = document.getElementById('hud-pause-btn') as HTMLButtonElement;
  const mobileJumpBtn = document.getElementById('mobile-jump-btn') as HTMLButtonElement;
  const mobileDuckBtn = document.getElementById('mobile-duck-btn') as HTMLButtonElement;

  // Camera Toggle Elements
  const hudCamBtn = document.getElementById('hud-cam-btn') as HTMLButtonElement;
  const hudCamText = document.getElementById('hud-cam-text') as HTMLElement;
  const startCamToggle = document.getElementById('start-cam-toggle') as HTMLButtonElement;
  const startCamLabel = document.getElementById('start-cam-label') as HTMLElement;

  // Audio & Settings Elements
  const hudMuteBtn = document.getElementById('hud-mute-btn') as HTMLButtonElement;
  const hudMuteIcon = document.getElementById('hud-mute-icon') as HTMLElement;
  const startMuteToggle = document.getElementById('start-mute-toggle') as HTMLButtonElement;
  const startMuteIcon = document.getElementById('start-mute-icon') as HTMLElement;
  const startMuteLabel = document.getElementById('start-mute-label') as HTMLElement;

  const startShakeToggle = document.getElementById('start-shake-toggle') as HTMLButtonElement;
  const startShakeIcon = document.getElementById('start-shake-icon') as HTMLElement;
  const startShakeLabel = document.getElementById('start-shake-label') as HTMLElement;

  const startSkinToggle = document.getElementById('start-skin-toggle') as HTMLButtonElement;
  const startSkinLabel = document.getElementById('start-skin-label') as HTMLElement;

  // Sound Controller
  const sound = new SoundEffects();

  // Duck state guard: prevents sound from repeating on keydown auto-repeat
  let isDuckKeyHeld = false;

  const updateSoundUI = (muted: boolean) => {
    const icon = muted ? '🔇' : '🔊';
    const text = muted ? 'Suara: Mati' : 'Suara: Aktif';

    hudMuteIcon.textContent = icon;
    startMuteIcon.textContent = icon;
    startMuteLabel.textContent = text;
    startMuteToggle.setAttribute('aria-pressed', String(!muted));
  };
  updateSoundUI(sound.muted);

  // Floating Score Popup Trigger
  const triggerScorePopup = (text: string, screenX: number, screenY: number) => {
    if (!scorePopupsContainer) return;
    const el = document.createElement('div');
    el.className = 'score-popup-item';
    el.textContent = text;
    el.style.left = `${Math.round(screenX)}px`;
    el.style.top = `${Math.round(screenY)}px`;
    scorePopupsContainer.appendChild(el);

    setTimeout(() => {
      el.remove();
    }, 750);
  };

  // Day/Night UI Update
  const updateDayNightUI = (phaseName: string) => {
    let icon = '☀️';
    if (phaseName === 'Senja') icon = '🌅';
    else if (phaseName === 'Malam') icon = '🌙';
    else if (phaseName === 'Fajar') icon = '🌄';

    hudPhaseIcon.textContent = icon;
    hudPhaseText.textContent = phaseName;
  };

  // Initialize Game Engine
  const engine = new GameEngine({
    canvas,
    sound,
    onScoreUpdate: (score: number, highScore: number) => {
      hudCurrentScore.textContent = String(score);
      hudHighScore.textContent = String(highScore);
      startHighScore.textContent = String(highScore);
      gameoverFinalScore.textContent = String(score);
      gameoverHighScore.textContent = String(highScore);
    },
    onGameOver: (_score: number, isNewHighScore: boolean) => {
      if (isNewHighScore) {
        newRecordBadge.classList.remove('hidden');
      } else {
        newRecordBadge.classList.add('hidden');
      }
    },
    onStateChange: (state: GameEngineState) => {
      syncScreenState(state);
    },
    onDayNightChange: (phaseName: string) => {
      updateDayNightUI(phaseName);
    },
    onScorePopup: (text: string, x: number, y: number) => {
      triggerScorePopup(text, x, y);
    },
  });

  // Camera Mode UI Update
  const updateCamUI = (mode: CameraViewMode) => {
    const isCinematic = mode === 'cinematic';
    hudCamText.textContent = isCinematic ? 'Kamera 3/4' : 'Kamera Samping';
    startCamLabel.textContent = isCinematic ? 'Sudut Kamera: 3/4 Dinamis' : 'Sudut Kamera: Samping 3D';
  };
  updateCamUI(engine.cameraMode);

  const handleToggleCamera = () => {
    sound.playClick();
    const newMode = engine.toggleCameraMode();
    updateCamUI(newMode);
  };
  hudCamBtn.addEventListener('click', handleToggleCamera);
  startCamToggle.addEventListener('click', handleToggleCamera);

  // Dino Skin Selection
  let currentSkin: DinoSkinColor = (localStorage.getItem('dino_dash_skin') as DinoSkinColor) || 'ijo';
  const updateSkinUI = (skin: DinoSkinColor) => {
    startSkinLabel.textContent = skin === 'ijo' ? 'Warna: T-Rex Ijo' : 'Warna: Cokelat';
  };
  updateSkinUI(currentSkin);
  engine.setDinoSkin(currentSkin);

  startSkinToggle.addEventListener('click', () => {
    sound.playClick();
    currentSkin = currentSkin === 'ijo' ? 'cokelat' : 'ijo';
    localStorage.setItem('dino_dash_skin', currentSkin);
    engine.setDinoSkin(currentSkin);
    updateSkinUI(currentSkin);
  });

  const updateShakeUI = (enabled: boolean) => {
    const icon = enabled ? '📳' : '📴';
    const text = enabled ? 'Guncangan Layar: Aktif' : 'Guncangan Layar: Nonaktif';
    startShakeIcon.textContent = icon;
    startShakeLabel.textContent = text;
    startShakeToggle.setAttribute('aria-pressed', String(enabled));
  };
  updateShakeUI(engine.enableScreenShake);

  // Screen State Synchronization
  function syncScreenState(state: GameEngineState) {
    switch (state) {
      case 'start':
        startScreen.classList.remove('hidden');
        pauseScreen.classList.add('hidden');
        gameoverScreen.classList.add('hidden');
        gameHud.classList.add('hidden');
        mobileControls.classList.add('hidden');
        break;

      case 'playing':
        startScreen.classList.add('hidden');
        pauseScreen.classList.add('hidden');
        gameoverScreen.classList.add('hidden');
        gameHud.classList.remove('hidden');
        if (window.matchMedia('(hover: none) and (pointer: coarse)').matches || window.innerWidth <= 768) {
          mobileControls.classList.remove('hidden');
        }
        break;

      case 'paused':
        pauseScreen.classList.remove('hidden');
        break;

      case 'gameover':
        gameoverScreen.classList.remove('hidden');
        mobileControls.classList.add('hidden');
        break;
    }
  }

  // User Actions
  startPlayBtn.addEventListener('click', () => {
    sound.unlockAudio();
    sound.playClick();
    engine.start();
  });

  pauseResumeBtn.addEventListener('click', () => {
    sound.playClick();
    engine.resume();
  });

  pauseRestartBtn.addEventListener('click', () => {
    sound.playClick();
    engine.restart();
  });

  gameoverRestartBtn.addEventListener('click', () => {
    sound.playClick();
    engine.restart();
  });

  hudPauseBtn.addEventListener('click', () => {
    sound.playClick();
    engine.pause();
  });

  mobileJumpBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    sound.unlockAudio();
    engine.jump();
  });

  if (mobileDuckBtn) {
    mobileDuckBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      sound.unlockAudio();
      sound.playDuck();
      mobileDuckBtn.classList.add('is-pressed');
      engine.duck(true);
    });
    const handleEndDuck = (e: Event) => {
      e.preventDefault();
      mobileDuckBtn.classList.remove('is-pressed');
      engine.duck(false);
    };
    mobileDuckBtn.addEventListener('pointerup', handleEndDuck);
    mobileDuckBtn.addEventListener('pointercancel', handleEndDuck);
    mobileDuckBtn.addEventListener('pointerleave', handleEndDuck);
  }

  // Sound Toggle Handlers
  const handleToggleSound = () => {
    const muted = sound.toggleMute();
    updateSoundUI(muted);
  };
  hudMuteBtn.addEventListener('click', handleToggleSound);
  startMuteToggle.addEventListener('click', handleToggleSound);

  // Screen Shake Toggle Handler
  startShakeToggle.addEventListener('click', () => {
    sound.playClick();
    const newShakeState = !engine.enableScreenShake;
    engine.toggleScreenShake(newShakeState);
    updateShakeUI(newShakeState);
  });

  // Tap on canvas to jump
  canvas.addEventListener('pointerdown', (e) => {
    if (e.target === canvas) {
      sound.unlockAudio();
      engine.jump();
    }
  });

  // Keyboard Navigation & Shortcuts
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
      e.preventDefault();
      sound.unlockAudio();
      engine.jump();
    } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
      e.preventDefault();
      if (!isDuckKeyHeld) {
        isDuckKeyHeld = true;
        sound.unlockAudio();
        sound.playDuck();
        engine.duck(true);
      }
    } else if (e.code === 'KeyC') {
      // Toggle Camera Mode via keyboard 'C'
      e.preventDefault();
      handleToggleCamera();
    } else if (e.code === 'Escape') {
      e.preventDefault();
      sound.playClick();
      if (engine.state === 'playing') {
        engine.pause();
      } else if (engine.state === 'paused') {
        engine.resume();
      }
    }
  });

  window.addEventListener('keyup', (e: KeyboardEvent) => {
    if (e.code === 'ArrowDown' || e.code === 'KeyS') {
      isDuckKeyHeld = false;
      e.preventDefault();
      engine.duck(false);
    }
  });

  // Tab Inactivity Auto-Pause (FR-08)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && engine.state === 'playing') {
      engine.pause();
    }
  });

  window.addEventListener('blur', () => {
    if (engine.state === 'playing') {
      engine.pause();
    }
  });

  // Responsive Window Resize
  window.addEventListener('resize', () => {
    engine.handleResize();
  });

  engine.handleResize();

  // Service Worker Management (FR-07)
  if ('serviceWorker' in navigator) {
    if (import.meta.env.DEV) {
      // In development mode, actively unregister any SW and clear caches to guarantee fresh live-reload
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const reg of registrations) {
          reg.unregister();
        }
      });
      if ('caches' in window) {
        caches.keys().then((keys) => {
          for (const key of keys) {
            caches.delete(key);
          }
        });
      }
    } else if (window.location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('./sw.js').then((reg) => {
        reg.update();
      }).catch(() => {});
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
