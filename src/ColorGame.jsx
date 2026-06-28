import React, { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { audioService } from './audioService';
import { EXPERIMENTS, INITIAL_EXPERIMENT_STATUS, EXPERIMENT_STATUS, isExperimentLocked, getNextPendingExperiment, allExperimentsAttempted, allExperimentsPassed, countPassed, countPending } from './experiments';

const REDIRECT_COUNTDOWN_SECONDS = 10;
const ASSET_BOOST = 1.14;

function scaleAsset(value) {
  return value * ASSET_BOOST;
}

const MIXING_FLASK = { w: scaleAsset(80), h: scaleAsset(100) };
const TARGET_FLASK = { w: scaleAsset(70), h: scaleAsset(90) };
const SPEECH_BUBBLE_Y = -108;
const SPEECH_BUBBLE_FLOAT_Y = SPEECH_BUBBLE_Y - 15;
const MIXING_FLASK_SHIFT_X = 42;
const MOBILE_SHIFT_X = 65;

function getSceneLayout(viewportWidth) {
  if (viewportWidth < 600) {
    const x = MOBILE_SHIFT_X;
    return {
      profile: 'mobile',
      scientist: { x: 90 + x, y: 384 },
      mixingFlask: { x: 318 + x, y: 410 },
      dumpButton: { x: 318 + x, y: 522 },
      dumpFollowY: 112,
      mixingFlaskYOffset: 26,
      mixingLabelY: -76,
      targetColumnX: 548 + x,
      activeTargetY: 272,
      tubes: { startX: 48 + x, shelfY: 78, spacing: 96, shelfWidth: 296 },
      tubeScale: scaleAsset(0.94),
      scientistScale: scaleAsset(0.9),
      targetScale: scaleAsset(0.91),
      mixingFlaskScale: scaleAsset(1.05),
      dumpButtonScale: scaleAsset(0.98),
      fontSizes: { tube: 17, target: 18, mixing: 20, hint: 18, speech: 17, feedback: 22, dump: 14, star: 24 },
    };
  }

  if (viewportWidth < 1024) {
    return {
      profile: 'tablet',
      scientist: { x: 162, y: 388 },
      mixingFlask: { x: 304 + MIXING_FLASK_SHIFT_X, y: 413 },
      dumpButton: { x: 304 + MIXING_FLASK_SHIFT_X, y: 526 },
      dumpFollowY: 113,
      mixingFlaskYOffset: 25,
      mixingLabelY: -74,
      targetColumnX: 672,
      activeTargetY: 278,
      tubes: { startX: 136, shelfY: 82, spacing: 108, shelfWidth: 330 },
      tubeScale: scaleAsset(0.97),
      scientistScale: scaleAsset(0.94),
      targetScale: scaleAsset(0.96),
      mixingFlaskScale: scaleAsset(1.02),
      dumpButtonScale: scaleAsset(1),
      fontSizes: { tube: 18, target: 18, mixing: 21, hint: 18, speech: 17, feedback: 22, dump: 15, star: 24 },
    };
  }

  return {
    profile: 'desktop',
    scientist: { x: 210, y: 386 },
    mixingFlask: { x: 346 + MIXING_FLASK_SHIFT_X, y: 411 },
    dumpButton: { x: 346 + MIXING_FLASK_SHIFT_X, y: 521 },
    dumpFollowY: 110,
    mixingFlaskYOffset: 25,
    mixingLabelY: -72,
    targetColumnX: 758,
    activeTargetY: 276,
    tubes: { startX: 188, shelfY: 80, spacing: 124, shelfWidth: 352 },
    tubeScale: scaleAsset(1),
    scientistScale: scaleAsset(1),
    targetScale: scaleAsset(1),
    mixingFlaskScale: scaleAsset(1),
    dumpButtonScale: scaleAsset(1),
    fontSizes: { tube: 19, target: 19, mixing: 22, hint: 20, speech: 18, feedback: 24, dump: 16, star: 26 },
  };
}

export default function ColorGame({ onGameComplete }) {
  const [studentName, setStudentName] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isMusicOn, setIsMusicOn] = useState(false);

  const [experimentStatus, setExperimentStatus] = useState({ ...INITIAL_EXPERIMENT_STATUS });
  const [allPassed, setAllPassed] = useState(false);

  const [activeGoal, setActiveGoal] = useState(EXPERIMENTS[0].id);
  const [isPouring, setIsPouring] = useState(false);
  const [gameSessionId, setGameSessionId] = useState(0);
  const [redirectCountdown, setRedirectCountdown] = useState(REDIRECT_COUNTDOWN_SECONDS);

  const gameRef = useRef(null);
  const phaserGame = useRef(null);
  const activeGameSessionRef = useRef(0);
  const redirectTimerRef = useRef(null);

  const passedCount = countPassed(experimentStatus);

  useEffect(() => {
    document.body.classList.toggle('game-active', isAuthorized && !completed);
    return () => document.body.classList.remove('game-active');
  }, [isAuthorized, completed]);

  // Sound Controls
  const toggleSound = () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    audioService.toggleSFX(nextMute);
  };

  const toggleMusic = () => {
    const nextMusic = !isMusicOn;
    setIsMusicOn(nextMusic);
    audioService.toggleMusic(nextMusic);
  };

  // Phaser Initialization Effect
  useEffect(() => {
    if (!isAuthorized || !gameRef.current) return;

    // Initialize Audio Service
    audioService.init();
    audioService.toggleSFX(isMuted);
    audioService.toggleMusic(isMusicOn);

    const config = {
      type: Phaser.AUTO,
      parent: gameRef.current,
      transparent: true,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 1000,
        height: 580
      },
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { y: 0 },
          debug: false
        }
      },
      scene: {
        preload,
        create,
        update
      }
    };

    // Instantiate Phaser Game
    const game = new Phaser.Game(config);
    phaserGame.current = game;
    const session = gameSessionId;
    const isCurrentSession = () =>
      activeGameSessionRef.current === session && phaserGame.current === game;

    // Pass data registry parameters
    game.registry.set('studentName', studentName);
    game.registry.set('activeGoal', activeGoal);

    game.events.on('stats-updated', (data) => {
      if (!isCurrentSession()) return;
      setExperimentStatus(data.experimentStatus);
    });

    game.events.on('update-active-goal-react', (newGoal) => {
      if (!isCurrentSession()) return;
      setActiveGoal(newGoal);
    });

    game.events.on('pour-started', () => {
      if (!isCurrentSession()) return;
      setIsPouring(true);
    });
    game.events.on('pour-finished', () => {
      if (!isCurrentSession()) return;
      setIsPouring(false);
    });

    game.events.on('trigger-pour-sfx', () => {
      audioService.playPour();
    });

    game.events.on('trigger-success-sfx', () => {
      audioService.playSuccess();
      audioService.playMatchFill();
    });

    game.events.on('trigger-failure-sfx', () => {
      audioService.playFailure();
    });

    game.events.on('game-finished', (data) => {
      if (!isCurrentSession()) return;
      setCompleted(true);
      setAllPassed(data.allPassed);

      if (onGameComplete) {
        onGameComplete({
          studentName,
          successes: data.successes,
          totalExperiments: EXPERIMENTS.length,
          allPassed: data.allPassed,
          experimentStatus: data.experimentStatus,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Phaser Scenes
    function preload() {
      // Phaser's primitive drawings don't require preloaded textures,
      // but we will generate custom canvas-based particle textures here.
    }

    function create() {
      const scene = this;
 
      scene.activeGoal = scene.registry.get('activeGoal') || 'Violeta';
      scene.game.events.on('active-goal-changed', (newGoal) => {
        scene.activeGoal = newGoal;
        if (scene.updateScientistSpeech) {
          scene.updateScientistSpeech();
        }
        if (scene.updateActiveTargetDisplay) {
          scene.updateActiveTargetDisplay();
        }
      });

      // 1. Generate Sparkle Texture for Success
      const sparkleCanvas = scene.textures.createCanvas('sparkle', 10, 10);
      const sCtx = sparkleCanvas.context;
      sCtx.fillStyle = '#ffffff';
      sCtx.beginPath();
      sCtx.arc(5, 5, 5, 0, Math.PI * 2);
      sCtx.fill();
      sparkleCanvas.refresh();

      // 2. Generate Puff Smoke Texture for Explosion
      const smokeCanvas = scene.textures.createCanvas('smoke', 24, 24);
      const smCtx = smokeCanvas.context;
      const grad = smCtx.createRadialGradient(12, 12, 0, 12, 12, 12);
      grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
      grad.addColorStop(0.4, 'rgba(200, 200, 200, 0.8)');
      grad.addColorStop(1, 'rgba(100, 100, 100, 0)');
      smCtx.fillStyle = grad;
      smCtx.beginPath();
      smCtx.arc(12, 12, 12, 0, Math.PI * 2);
      smCtx.fill();
      smokeCanvas.refresh();

      // Setup State Variables
      scene.mixedIngredients = [];
      scene.currentColorHex = 0xffffff;
      scene.currentLiquidLevel = 0;
      scene.experimentStatus = { ...INITIAL_EXPERIMENT_STATUS };

      // Define Color Map
      scene.colors = {
        Rojo: { hex: 0xff4766, name: 'Rojo' },
        Azul: { hex: 0x3388ff, name: 'Azul' },
        Amarillo: { hex: 0xffd200, name: 'Amarillo' },
        Sludge: { hex: 0x5a6372, name: 'Lodo Gris (Inestable)' }
      };
      EXPERIMENTS.forEach((exp) => {
        scene.colors[exp.id] = { hex: exp.hex, name: exp.id };
      });

      // Add Ambient Floating Bubbles in Background
      scene.ambientBubbles = createSafeParticles(scene, 0, 0, 'sparkle', {
        x: { min: 20, max: 980 },
        y: 600,
        speedY: { min: -40, max: -80 },
        speedX: { min: -10, max: 10 },
        scale: { start: 0.3, end: 1.2 },
        alpha: { start: 0.1, end: 0.4 },
        lifespan: 8000,
        quantity: 1,
        frequency: 400,
        tint: 0xa855f7
      });

      // 3. Draw scientist
      scene.scientistContainer = scene.add.container(220, 390);
      scene.scientistGraphics = scene.add.graphics();
      scene.scientistContainer.add(scene.scientistGraphics);
      
      // Floating React Speech Bubble Container
      scene.speechContainer = scene.add.container(0, SPEECH_BUBBLE_Y);
      scene.speechBubble = scene.add.graphics();
      scene.speechText = scene.add.text(0, -2, '', {
        fontFamily: "'Fredoka', sans-serif",
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#1e293b',
        align: 'center'
      }).setOrigin(0.5);
      scene.speechContainer.add(scene.speechBubble);
      scene.speechContainer.add(scene.speechText);
      scene.speechContainer.alpha = 0;
      scene.scientistContainer.add(scene.speechContainer);

      scene.drawScientist = function (graphics, state = 'idle') {
        graphics.clear();

        // 1. Fluffy Cloud-like Crazy Hair
        graphics.fillStyle(0xe2e8f0, 1); // soft white-grey hair
        // Left fluffy cloud hair
        graphics.fillCircle(-30, -60, 24);
        graphics.fillCircle(-48, -40, 22);
        graphics.fillCircle(-46, -15, 20);
        // Right fluffy cloud hair
        graphics.fillCircle(30, -60, 24);
        graphics.fillCircle(48, -40, 22);
        graphics.fillCircle(46, -15, 20);
        // Top fluffy cloud hair
        graphics.fillCircle(0, -74, 28);
        graphics.fillCircle(-20, -70, 22);
        graphics.fillCircle(20, -70, 22);
        // Additional cute curls
        graphics.fillCircle(-10, -82, 10);
        graphics.fillCircle(10, -82, 10);

        // 2. Round Friendly Face
        graphics.fillStyle(0xffedd5, 1); // soft peach skin
        graphics.fillCircle(0, -25, 34);

        // 3. Cute Rosy Cheeks
        let blushScale = 1.0;
        if (state === 'happy') blushScale = 1.35;
        graphics.fillStyle(0xfca5a5, 0.7);
        graphics.fillCircle(-24, -14, 10 * blushScale);
        graphics.fillCircle(24, -14, 10 * blushScale);

        // 4. Oversized Round Glasses (Ghibli wizard style)
        // Glasses Temple Side Arms
        graphics.lineStyle(3, 0x78350f, 1);
        graphics.lineBetween(-32, -26, -44, -20);
        graphics.lineBetween(32, -26, 44, -20);

        // Frame
        graphics.lineStyle(3.5, 0x78350f, 1); // wood brown frame
        graphics.strokeCircle(-18, -26, 14);
        graphics.strokeCircle(18, -26, 14);
        // Bridge
        graphics.lineBetween(-4, -26, 4, -26);

        // Transparent cyan lenses
        graphics.fillStyle(0x22d3ee, 0.15);
        graphics.fillCircle(-18, -26, 13);
        graphics.fillCircle(18, -26, 13);

        // Lenses glare reflections
        graphics.fillStyle(0xffffff, 0.45);
        graphics.fillCircle(-14, -30, 4);
        graphics.fillCircle(22, -30, 4);

        // 5. Big Curious Eyes (drawn inside the frames)
        if (state === 'happy') {
          // Smiling eyes ^ ^
          graphics.lineStyle(3.5, 0x374151, 1);
          graphics.beginPath();
          graphics.arc(-18, -24, 7, Math.PI, 0, false);
          graphics.strokePath();
          graphics.beginPath();
          graphics.arc(18, -24, 7, Math.PI, 0, false);
          graphics.strokePath();
        } else {
          graphics.fillStyle(0xffffff, 1);
          graphics.fillCircle(-18, -26, 8);
          graphics.fillCircle(18, -26, 8);

          let pupilRadius = 4;
          let lookOffsetXLeft = 0;
          let lookOffsetXRight = 0;
          let lookOffsetY = 0;

          graphics.fillStyle(0x374151, 1);
          if (state === 'shocked') {
            pupilRadius = 2.5; // tiny shocked pupils
          } else if (state === 'confused') {
            // crossed eyes
            lookOffsetXLeft = 2;
            lookOffsetXRight = -2;
          }

          graphics.fillCircle(-18 + lookOffsetXLeft, -26 + lookOffsetY, pupilRadius);
          graphics.fillCircle(18 + lookOffsetXRight, -26 + lookOffsetY, pupilRadius);

          // Sparkly eye highlight
          if (state !== 'shocked') {
            graphics.fillStyle(0xffffff, 1);
            graphics.fillCircle(-17 + lookOffsetXLeft, -28 + lookOffsetY, 1.8);
            graphics.fillCircle(19 + lookOffsetXRight, -28 + lookOffsetY, 1.8);
          }
        }

        // 6. Fluffy Dynamic Eyebrows
        graphics.fillStyle(0xe2e8f0, 1);
        if (state === 'shocked') {
          graphics.fillEllipse(-18, -49, 10, 5);
          graphics.fillEllipse(18, -49, 10, 5);
        } else if (state === 'confused') {
          graphics.fillEllipse(-18, -40, 10, 5);
          graphics.fillEllipse(18, -47, 10, 5);
        } else if (state === 'happy') {
          graphics.fillEllipse(-18, -46, 10, 5);
          graphics.fillEllipse(18, -46, 10, 5);
        } else {
          graphics.fillEllipse(-18, -43, 10, 5);
          graphics.fillEllipse(18, -43, 10, 5);
        }

        // 7. Button Nose
        graphics.fillStyle(0xfca5a5, 1);
        graphics.fillCircle(0, -18, 4.5);

        // 8. Mouth Expressions
        graphics.lineStyle(3, 0x374151, 1);
        if (state === 'happy') {
          graphics.fillStyle(0x374151, 1);
          graphics.beginPath();
          graphics.arc(0, -8, 8, 0, Math.PI, false);
          graphics.closePath();
          graphics.fillPath();
          // tongue
          graphics.fillStyle(0xfecaca, 1);
          graphics.beginPath();
          graphics.arc(0, -5, 5, 0, Math.PI, false);
          graphics.closePath();
          graphics.fillPath();
        } else if (state === 'shocked') {
          graphics.fillStyle(0x374151, 1);
          graphics.fillCircle(0, -6, 6);
        } else if (state === 'confused') {
          graphics.beginPath();
          graphics.moveTo(-8, -8);
          graphics.lineTo(-4, -4);
          graphics.lineTo(0, -8);
          graphics.lineTo(4, -4);
          graphics.lineTo(8, -8);
          graphics.strokePath();
        } else {
          graphics.beginPath();
          graphics.arc(0, -10, 5, 0, Math.PI, false);
          graphics.strokePath();
        }

        // 9. White Lab Coat
        graphics.fillStyle(0xffffff, 1);
        graphics.fillRect(-38, 8, 76, 90);

        // Blue Shirt Collar
        graphics.fillStyle(0x60a5fa, 1);
        graphics.fillTriangle(-14, 8, 14, 8, 0, 24);

        // Red Bow Tie (extremely Ghibli/wizard style!)
        graphics.fillStyle(0xef4444, 1);
        graphics.fillTriangle(-12, 12, 0, 20, -12, 28);
        graphics.fillTriangle(12, 12, 0, 20, 12, 28);
        graphics.fillCircle(0, 20, 4);

        // Lab coat collar overlaps (lapels)
        graphics.lineStyle(2, 0xd1d5db, 1);
        graphics.lineBetween(-14, 8, -26, 38);
        graphics.lineBetween(14, 8, 26, 38);

        // Lab coat buttons
        graphics.fillStyle(0xd1d5db, 1);
        graphics.fillCircle(0, 50, 3.5);
        graphics.fillCircle(0, 68, 3.5);
        graphics.fillCircle(0, 86, 3.5);

        // Lab coat pocket & blue pen sticking out
        graphics.lineStyle(1.5, 0x78350f, 0.4);
        graphics.strokeRect(12, 38, 14, 18);
        graphics.fillStyle(0x3b82f6, 1); // Blue pen
        graphics.fillRect(16, 32, 3, 10);

        // 10. Angled Arms and Peach Hands holding the beaker
        // Left sleeve
        graphics.fillStyle(0xffffff, 1);
        graphics.lineStyle(2, 0xd1d5db, 1);
        graphics.beginPath();
        graphics.moveTo(-34, 40);
        graphics.lineTo(-14, 52);
        graphics.lineTo(-18, 64);
        graphics.lineTo(-36, 52);
        graphics.closePath();
        graphics.fillPath();
        graphics.strokePath();

        // Left hand skin (peach color with brown border)
        graphics.fillStyle(0xffedd5, 1);
        graphics.lineStyle(1.5, 0x78350f, 1);
        graphics.beginPath();
        graphics.arc(-13, 58, 8, 0, Math.PI * 2);
        graphics.closePath();
        graphics.fillPath();
        graphics.strokePath();

        // Left thumb
        graphics.beginPath();
        graphics.arc(-9, 54, 3, 0, Math.PI * 2);
        graphics.closePath();
        graphics.fillPath();
        graphics.strokePath();

        // Right sleeve
        graphics.fillStyle(0xffffff, 1);
        graphics.lineStyle(2, 0xd1d5db, 1);
        graphics.beginPath();
        graphics.moveTo(34, 40);
        graphics.lineTo(14, 52);
        graphics.lineTo(18, 64);
        graphics.lineTo(36, 52);
        graphics.closePath();
        graphics.fillPath();
        graphics.strokePath();

        // Right hand skin
        graphics.fillStyle(0xffedd5, 1);
        graphics.lineStyle(1.5, 0x78350f, 1);
        graphics.beginPath();
        graphics.arc(13, 58, 8, 0, Math.PI * 2);
        graphics.closePath();
        graphics.fillPath();
        graphics.strokePath();

        // Right thumb
        graphics.beginPath();
        graphics.arc(9, 54, 3, 0, Math.PI * 2);
        graphics.closePath();
        graphics.fillPath();
        graphics.strokePath();
      };

      // Draw initial Scientist state
      scene.drawScientist(scene.scientistGraphics, 'idle');

      scene.scientistBreathTween = null;

      scene.setScientistState = function(state) {
        scene.drawScientist(scene.scientistGraphics, state);
        
        let msg = "";
        if (state === 'happy') {
          const words = ["¡Fórmula mágica! 🧪", "¡Qué gran experimento! ✨", "¡Excelente mezcla! 🔬", "¡Súper científico! 🌟"];
          msg = words[Math.floor(Math.random() * words.length)];
        } else if (state === 'shocked') {
          const words = ["¡Uy! Poción equivocada 😮", "¡Oh no, qué sorpresa! ⚡", "¡Volvamos a intentar! 💕", "¡Casi lo logras! 🔬"];
          msg = words[Math.floor(Math.random() * words.length)];
        } else if (state === 'confused') {
          const words = ["¿Qué poción es esta? 🤔", "¡Se volvió inestable! ☁️", "¡Limpiemos el matraz! 🍃", "¡Vaciar el matraz! 🧪"];
          msg = words[Math.floor(Math.random() * words.length)];
        }
 
        if (msg) {
          scene.speechText.setText(msg);
          scene.speechBubble.clear();
          
          const w = scene.speechText.width + 24;
          const h = 32;
          
          // Draw Bubble container with soft cozy colors
          scene.speechBubble.fillStyle(0xffffff, 0.95);
          scene.speechBubble.lineStyle(2, 0x78350f, 1); // cozy brown
          scene.speechBubble.fillRoundedRect(-w/2, -h/2, w, h, 8);
          scene.speechBubble.strokeRoundedRect(-w/2, -h/2, w, h, 8);
          
          // Bubble tail
          scene.speechBubble.beginPath();
          scene.speechBubble.moveTo(-6, h/2);
          scene.speechBubble.lineTo(6, h/2);
          scene.speechBubble.lineTo(0, h/2 + 7);
          scene.speechBubble.closePath();
          scene.speechBubble.fillPath();
          scene.speechBubble.strokePath();
 
          scene.speechContainer.alpha = 1;
          scene.speechContainer.y = SPEECH_BUBBLE_Y;

          if (scene.speechTween) scene.speechTween.remove();
          scene.speechTween = scene.tweens.add({
            targets: scene.speechContainer,
            alpha: 0,
            y: SPEECH_BUBBLE_FLOAT_Y,
            delay: 2000,
            duration: 350,
            onComplete: () => {
              if (scene.scientistGraphics) {
                scene.drawScientist(scene.scientistGraphics, 'idle');
              }
            }
          });
        }
      };

      scene.updateScientistSpeech = function () {
        const exp = EXPERIMENTS.find((e) => e.id === scene.activeGoal) || EXPERIMENTS[0];
        const msg = `¡Hagamos la ${exp.label}! ${exp.emoji}`;

        scene.speechText.setText(msg.toUpperCase());
        scene.speechBubble.clear();
        
        const w = scene.speechText.width + 24;
        const h = 32;
        
        scene.speechBubble.fillStyle(0xffffff, 0.95);
        scene.speechBubble.lineStyle(2, 0x78350f, 1);
        scene.speechBubble.fillRoundedRect(-w/2, -h/2, w, h, 8);
        scene.speechBubble.strokeRoundedRect(-w/2, -h/2, w, h, 8);
        
        scene.speechBubble.beginPath();
        scene.speechBubble.moveTo(-6, h/2);
        scene.speechBubble.lineTo(6, h/2);
        scene.speechBubble.lineTo(0, h/2 + 7);
        scene.speechBubble.closePath();
        scene.speechBubble.fillPath();
        scene.speechBubble.strokePath();

        scene.speechContainer.alpha = 1;
        scene.speechContainer.y = SPEECH_BUBBLE_Y;

        if (scene.speechTween) scene.speechTween.remove();
      };

      // 4. Mixing Flask (El Mezclador)
      // Placed to the right of the scientist. Y synced in update()
      scene.mixingFlaskContainer = scene.add.container(350, 415);
      scene.mixingFlaskGraphics = scene.add.graphics();
      scene.mixingFlaskContainer.add(scene.mixingFlaskGraphics);
 
      // Label above mixing flask
      scene.mixingLabelText = scene.add.text(0, -72, 'MATRAZ VACÍO 🧪', {
        fontFamily: "'Fredoka', sans-serif",
        fontSize: '22px',
        fontStyle: 'bold',
        color: '#78350f',
        stroke: '#ffffff',
        strokeThickness: 4,
        align: 'center'
      }).setOrigin(0.5);
      scene.mixingFlaskContainer.add(scene.mixingLabelText);
 
      // Mixing hint (matraz-only flow)
      scene.dragHintText = scene.add.text(0, 72, '¡Mezcla 2 colores! 🧪', {
        fontFamily: "'Fredoka', sans-serif",
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#d97706',
        stroke: '#ffffff',
        strokeThickness: 4,
        align: 'center'
      }).setOrigin(0.5);
      scene.dragHintText.alpha = 0;
      scene.mixingFlaskContainer.add(scene.dragHintText);

      // Function to render the Mixing Flask state
      scene.drawMixingFlask = function () {
        const graphics = scene.mixingFlaskGraphics;
        const colorHex = scene.currentColorHex;
        const level = scene.currentLiquidLevel;

        graphics.clear();

        // 1. Draw glowing background silhouette if there's chemical reaction
        if (level > 0) {
          graphics.lineStyle(7, colorHex, 0.25);
          drawFlaskSilhouette(graphics, 0, 0, MIXING_FLASK.w, MIXING_FLASK.h);
        }

        // 2. Draw liquid inside matching the flask's inner geometry
        if (level > 0) {
          graphics.fillStyle(colorHex, 0.85);
          drawLiquidFill(graphics, 0, 0, MIXING_FLASK.w, MIXING_FLASK.h, level);
        }

        // 3. Draw outer glass container contour
        graphics.lineStyle(3.5, 0xffffff, 0.95);
        drawFlaskSilhouette(graphics, 0, 0, MIXING_FLASK.w, MIXING_FLASK.h);

        // 4. Graduation ticks (laboratory markings)
        graphics.lineStyle(1.5, 0xffffff, 0.4);
        const startY = 40 * ASSET_BOOST;
        const endY = -20 * ASSET_BOOST;
        for (let i = 1; i <= 3; i++) {
          const ratio = 0.25 * i;
          const markY = startY - (startY - endY) * ratio;
          const widthAtY = MIXING_FLASK.w - (MIXING_FLASK.w - 24 * ASSET_BOOST) * ratio;
          const halfW = widthAtY / 2;
          graphics.lineBetween(-halfW + 4, markY, -halfW + 12, markY);
        }

        // 5. White light glossy sheen highlight
        graphics.lineStyle(2, 0xffffff, 0.45);
        graphics.beginPath();
        graphics.arc(20 * ASSET_BOOST, 20 * ASSET_BOOST, 14 * ASSET_BOOST, -Math.PI / 4, Math.PI / 4, false);
        graphics.strokePath();

        // Update interaction state
        // Non-draggable beaker (evaluated automatically)
        scene.mixingFlaskContainer.disableInteractive();
        scene.dragHintText.alpha = 0;
      };

      // Initialize mixing flask drawing
      scene.drawMixingFlask();

        // 5. Draw Primary Test Tubes at the Top (Horizontal shelf)
        scene.tubes = [];
        const startX = 200;
        const shelfY = 85;
        const tubeSpacing = 120;
 
        // Draw a simple horizontal Ghibli wooden shelf bar
        scene.shelfBar = scene.add.graphics();
        scene.drawTubeShelf = function (layout) {
          const { startX, shelfY, shelfWidth } = layout.tubes;
          scene.shelfBar.clear();
          scene.shelfBar.fillStyle(0x78350f, 0.95);
          scene.shelfBar.lineStyle(2, 0x451a03, 0.8);
          scene.shelfBar.fillRoundedRect(startX - 50, shelfY + 45, shelfWidth, 10, 4);
          scene.shelfBar.strokeRoundedRect(startX - 50, shelfY + 45, shelfWidth, 10, 4);
        };
 
        const colorsData = [
          { colorKey: 'Rojo', hex: scene.colors.Rojo.hex, label: '🍓 ROJO' },
          { colorKey: 'Azul', hex: scene.colors.Azul.hex, label: '🫐 AZUL' },
          { colorKey: 'Amarillo', hex: scene.colors.Amarillo.hex, label: '🌻 AMARILLO' }
        ];
 
        colorsData.forEach((tubeInfo, index) => {
          const tx = startX + index * tubeSpacing;
          const ty = shelfY;
   
          const tubeContainer = scene.add.container(tx, ty);
          const tubeGraphics = scene.add.graphics();
          tubeContainer.add(tubeGraphics);
   
          // Draw tube graphics (static contents, filled 70%)
          scene.drawTestTubeGraphic = function (graphics, colorHex) {
            graphics.clear();
   
            // Liquid
            graphics.fillStyle(colorHex, 0.85);
            graphics.beginPath();
            const liqY = -15; // 70% fill line
            graphics.moveTo(-11, liqY);
            graphics.lineTo(11, liqY);
            graphics.lineTo(11, 28);
            // bottom curve
            graphics.arc(0, 28, 11, 0, Math.PI, false);
            graphics.lineTo(-11, 28);
            graphics.closePath();
            graphics.fillPath();
   
            // Glass outline
            graphics.lineStyle(3.5, 0xffffff, 0.95);
            graphics.beginPath();
            // Lip top
            graphics.moveTo(-15, -45);
            graphics.lineTo(15, -45);
            graphics.moveTo(-11, -45);
            // sides and bottom curve
            graphics.lineTo(-11, 28);
            graphics.arc(0, 28, 11, Math.PI, 0, true);
            graphics.lineTo(11, -45);
            graphics.strokePath();
   
            // Cork stopper
            graphics.fillStyle(0xa16207, 1); // wooden brown
            graphics.beginPath();
            graphics.moveTo(-9, -54);
            graphics.lineTo(9, -54);
            graphics.lineTo(11, -45);
            graphics.lineTo(-11, -45);
            graphics.closePath();
            graphics.fillPath();
   
            // Highlight reflect
            graphics.lineStyle(2, 0xffffff, 0.4);
            graphics.lineBetween(-7, -35, -7, 20);
          };
   
          scene.drawTestTubeGraphic(tubeGraphics, tubeInfo.hex);
   
          // Add Label Text below the tube
          const label = scene.add.text(0, 72, tubeInfo.label, {
            fontFamily: "'Fredoka', sans-serif",
            fontSize: '19px',
            fontStyle: 'bold',
            color: '#78350f',
            stroke: '#ffffff',
            strokeThickness: 4
          }).setOrigin(0.5);
          tubeContainer.add(label);
   
          // Setup interaction
          tubeContainer.setSize(scaleAsset(34), scaleAsset(115));
          tubeContainer.setInteractive({ draggable: true });
          
          // Store configurations
          tubeContainer.setData('colorKey', tubeInfo.colorKey);
          tubeContainer.setData('hex', tubeInfo.hex);
          tubeContainer.setData('startX', tx);
          tubeContainer.setData('startY', ty);
   
          scene.tubes.push(tubeContainer);
        });

      // 6. Target Flasks on the Right (Violeta, Verde, Anaranjado)
      scene.targets = {};
      const targetColumnX = 780;
      const targetColumnYStart = 120;
      const targetSpacing = 165;

      const targetsData = EXPERIMENTS.map((exp) => ({
        name: exp.id,
        hex: exp.hex,
        label: `${exp.label.toUpperCase()} ${exp.emoji}`
      }));

      targetsData.forEach((tgtInfo, index) => {
        const ty = targetColumnYStart + index * targetSpacing;

        const targetContainer = scene.add.container(targetColumnX, ty);
        const outlineGraphics = scene.add.graphics();
        const solvedGraphics = scene.add.graphics();
        targetContainer.add(outlineGraphics);
        targetContainer.add(solvedGraphics);

        // Labels (Clean Fredoka text displaying the target flask name without recipes)
        const titleText = scene.add.text(0, -66, tgtInfo.label, {
          fontFamily: "'Fredoka', sans-serif",
          fontSize: '19px',
          fontStyle: 'bold',
          color: '#78350f',
          stroke: '#ffffff',
          strokeThickness: 4
        }).setOrigin(0.5);
        targetContainer.add(titleText);

        // Star badge (hidden initially, pops up on solved)
        const starText = scene.add.text(42, -30, '⭐', {
          fontSize: '26px'
        }).setOrigin(0.5);
        starText.alpha = 0;
        targetContainer.add(starText);

        // Render the empty dashed outline
        scene.drawTargetOutline = function (graphics, colorHex) {
          graphics.clear();
          // Draw faint silhouette of target color
          graphics.fillStyle(colorHex, 0.2);
          drawLiquidFill(graphics, 0, 0, TARGET_FLASK.w, TARGET_FLASK.h, 0.8);

          // Draw dashed / faint outline
          graphics.lineStyle(3.5, colorHex, 0.9);
          drawFlaskSilhouette(graphics, 0, 0, TARGET_FLASK.w, TARGET_FLASK.h);
        };

        scene.drawTargetSolved = function (graphics, colorHex, isSolved) {
          graphics.clear();
          if (isSolved) {
            // Draw liquid filled
            graphics.fillStyle(colorHex, 0.85);
            drawLiquidFill(graphics, 0, 0, TARGET_FLASK.w, TARGET_FLASK.h, 0.85);

            // Draw clean white glass outline
            graphics.lineStyle(3.5, 0xffffff, 0.95);
            drawFlaskSilhouette(graphics, 0, 0, TARGET_FLASK.w, TARGET_FLASK.h);

            // Draw light gloss highlight
            graphics.lineStyle(2, 0xffffff, 0.45);
            graphics.beginPath();
            graphics.arc(16 * ASSET_BOOST, 16 * ASSET_BOOST, 12 * ASSET_BOOST, -Math.PI / 4, Math.PI / 4, false);
            graphics.strokePath();
          }
        };

        scene.drawTargetOutline(outlineGraphics, tgtInfo.hex);
        scene.drawTargetSolved(solvedGraphics, tgtInfo.hex, false);

        scene.targets[tgtInfo.name] = {
          container: targetContainer,
          outlineGraphics,
          solvedGraphics,
          starText,
          hex: tgtInfo.hex,
          name: tgtInfo.name,
          homeY: ty
        };
      });

      scene.targetColumnX = targetColumnX;
      scene.activeTargetY = 280;

      scene.updateActiveTargetDisplay = function () {
        Object.keys(scene.targets).forEach((key) => {
          const tgt = scene.targets[key];
          const isActive = key === scene.activeGoal;
          tgt.container.setVisible(isActive);
          if (isActive) {
            tgt.container.setPosition(scene.targetColumnX, scene.activeTargetY);
            const status = scene.experimentStatus[key];
            const isPassed = status === EXPERIMENT_STATUS.PASSED;
            if (isPassed) {
              tgt.solvedGraphics.clear();
              scene.drawTargetSolved(tgt.solvedGraphics, tgt.hex, true);
              tgt.starText.alpha = 1;
              tgt.starText.setScale(1.2);
            } else {
              scene.drawTargetOutline(tgt.outlineGraphics, tgt.hex);
              tgt.solvedGraphics.clear();
              tgt.starText.alpha = 0;
            }
          }
        });
      };

      scene.selectNextPendingExperiment = function () {
        const next = getNextPendingExperiment(scene.experimentStatus);
        if (!next) return;

        const onlyOneLeft = countPending(scene.experimentStatus) === 1;
        const currentLocked = scene.experimentStatus[scene.activeGoal] !== EXPERIMENT_STATUS.PENDING;

        if (onlyOneLeft || currentLocked) {
          scene.activeGoal = next.id;
          scene.game.events.emit('update-active-goal-react', next.id);
          scene.updateActiveTargetDisplay();
          scene.updateScientistSpeech();
        }
      };

      scene.handleExperimentSuccess = function (activeTarget) {
        scene.experimentStatus[activeTarget.name] = EXPERIMENT_STATUS.PASSED;

        activeTarget.solvedGraphics.clear();
        scene.drawTargetSolved(activeTarget.solvedGraphics, activeTarget.hex, true);
        activeTarget.starText.scale = 0;
        activeTarget.starText.alpha = 1;

        scene.tweens.add({
          targets: activeTarget.starText,
          scale: 1.2,
          duration: 400,
          ease: 'Back.easeOut'
        });

        scene.game.events.emit('trigger-success-sfx');

        const okText = scene.add.text(activeTarget.container.x, activeTarget.container.y - 45, '¡CORRECTO! ✅', {
          fontFamily: "'Fredoka', sans-serif",
          fontSize: `${getSceneLayout(window.innerWidth).fontSizes.feedback}px`,
          fontStyle: 'bold',
          color: '#16a34a',
          stroke: '#ffffff',
          strokeThickness: 4
        }).setOrigin(0.5);

        scene.tweens.add({
          targets: okText,
          y: activeTarget.container.y - 110,
          alpha: 0,
          duration: 1200,
          onComplete: () => okText.destroy()
        });

        const sparkleEmitter = createSafeParticles(scene, activeTarget.container.x, activeTarget.container.y, 'sparkle', {
          speed: { min: 80, max: 200 },
          angle: { min: 0, max: 360 },
          scale: { start: 1.5, end: 0 },
          lifespan: 1000,
          gravityY: 120,
          quantity: 35,
          frequency: -1,
          tint: activeTarget.hex
        });
        if (sparkleEmitter.explode) sparkleEmitter.explode();

        scene.setScientistState('happy');
        scene.syncStats();
        scene.updateActiveTargetDisplay();

        scene.time.delayedCall(600, () => {
          scene.emptyMixingFlask(false);
          scene.selectNextPendingExperiment();
          scene.checkGameCompletion();
        });
      };

      scene.handleExperimentFailure = function (activeTarget) {
        scene.experimentStatus[activeTarget.name] = EXPERIMENT_STATUS.FAILED;

        scene.game.events.emit('trigger-failure-sfx');
        scene.cameras.main.shake(250, 0.008);

        const flaskHomeX = scene.mixingFlaskHomeX ?? 350;
        scene.tweens.add({
          targets: scene.mixingFlaskContainer,
          x: flaskHomeX - 8,
          duration: 60,
          yoyo: true,
          repeat: 3,
          onComplete: () => {
            scene.mixingFlaskContainer.x = flaskHomeX;
          }
        });

        const failText = scene.add.text(activeTarget.container.x, activeTarget.container.y - 45, 'FALLIDO ❌', {
          fontFamily: "'Fredoka', sans-serif",
          fontSize: `${getSceneLayout(window.innerWidth).fontSizes.feedback}px`,
          fontStyle: 'bold',
          color: '#f43f5e',
          stroke: '#ffffff',
          strokeThickness: 4
        }).setOrigin(0.5);

        scene.tweens.add({
          targets: failText,
          y: activeTarget.container.y - 110,
          alpha: 0,
          duration: 1200,
          onComplete: () => failText.destroy()
        });

        const smokeEmitter = createSafeParticles(scene, scene.mixingFlaskContainer.x, scene.mixingFlaskContainer.y, 'smoke', {
          speed: { min: 40, max: 120 },
          angle: { min: 0, max: 360 },
          scale: { start: 0.6, end: 2.2 },
          alpha: { start: 0.7, end: 0 },
          lifespan: 1100,
          quantity: 25,
          frequency: -1,
          tint: 0x475569
        });
        if (smokeEmitter.explode) smokeEmitter.explode();

        scene.setScientistState('shocked');
        scene.syncStats();

        scene.time.delayedCall(600, () => {
          scene.emptyMixingFlask(false);
          scene.selectNextPendingExperiment();
          scene.checkGameCompletion();
        });
      };

      scene.evaluateActiveExperiment = function (mixName) {
        const activeTarget = scene.targets[scene.activeGoal];
        if (!activeTarget || scene.experimentStatus[scene.activeGoal] !== EXPERIMENT_STATUS.PENDING) return;

        if (mixName === scene.activeGoal) {
          scene.handleExperimentSuccess(activeTarget);
        } else {
          scene.handleExperimentFailure(activeTarget);
        }
      };

      scene.updateActiveTargetDisplay();
      scene.updateScientistSpeech();

      // 7. Manual Empty Button (Trash Bin / Drain)
      // Placed below the mixing flask
      const dumpBtnW = scaleAsset(80);
      const dumpBtnH = scaleAsset(16);
      const drawDumpButtonBg = (graphics, hover = false) => {
        graphics.clear();
        graphics.fillStyle(0x22c55e, hover ? 0.3 : 0.15);
        graphics.lineStyle(2, 0x15803d, hover ? 0.9 : 0.6);
        graphics.fillRoundedRect(-dumpBtnW, -dumpBtnH, dumpBtnW * 2, dumpBtnH * 2, 8);
        graphics.strokeRoundedRect(-dumpBtnW, -dumpBtnH, dumpBtnW * 2, dumpBtnH * 2, 8);
      };

      const dumpButtonContainer = scene.add.container(350, 525);
      scene.dumpButtonContainer = dumpButtonContainer;
      const dbGraphics = scene.add.graphics();
      drawDumpButtonBg(dbGraphics);
      dumpButtonContainer.add(dbGraphics);

      const dbText = scene.add.text(0, 0, '🧪 LIMPIAR MATRAZ', {
        fontFamily: "'Fredoka', sans-serif",
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#15803d',
        stroke: '#ffffff',
        strokeThickness: 4
      }).setOrigin(0.5);
      dumpButtonContainer.add(dbText);
      scene.dumpButtonText = dbText;

      dumpButtonContainer.setSize(scaleAsset(160), scaleAsset(32));
      dumpButtonContainer.setInteractive({ useHandCursor: true });
      
      dumpButtonContainer.on('pointerover', () => drawDumpButtonBg(dbGraphics, true));

      dumpButtonContainer.on('pointerout', () => drawDumpButtonBg(dbGraphics, false));

      dumpButtonContainer.on('pointerdown', () => {
        if (scene.currentLiquidLevel > 0) {
          scene.emptyMixingFlask(true); // empty with pouring effect
        }
      });

      // Drag Tube Logic
      scene.input.on('dragstart', function (pointer, gameObject) {
        scene.children.bringToTop(gameObject);
        const baseScale = gameObject.getData('tubeBaseScale') || 1;
        scene.tweens.add({
          targets: gameObject,
          scale: baseScale * 1.12,
          angle: 10,
          duration: 120,
          ease: 'Power1'
        });
      });

      scene.input.on('drag', function (pointer, gameObject, dragX, dragY) {
        gameObject.x = dragX;
        gameObject.y = dragY;
      });

      scene.input.on('dragend', function (pointer, gameObject) {
        const startX = gameObject.getData('startX');
        const startY = gameObject.getData('startY');

        const baseScale = gameObject.getData('tubeBaseScale') || 1;
        scene.tweens.add({
          targets: gameObject,
          scale: baseScale,
          angle: 0,
          duration: 150,
          ease: 'Power1'
        });

        const pourRadius = scene.layoutProfile === 'mobile' ? scaleAsset(115) : scaleAsset(100);
        const dist = Phaser.Math.Distance.Between(
          gameObject.x,
          gameObject.y,
          scene.mixingFlaskContainer.x,
          scene.mixingFlaskContainer.y - 45
        );

        if (dist < pourRadius) {
          scene.pourTube(gameObject, startX, startY);
        } else {
          scene.tweens.add({
            targets: gameObject,
            x: startX,
            y: startY,
            duration: 350,
            ease: 'Back.easeOut'
          });
        }
      });

      // Tube Pouring animation sequence
      scene.pourTube = function (tube, startX, startY) {
        tube.disableInteractive();
        scene.game.events.emit('pour-started');

        const targetPourX = scene.mixingFlaskContainer.x + 55;
        const targetPourY = scene.mixingFlaskContainer.y - 85;

        scene.tweens.add({
          targets: tube,
          x: targetPourX,
          y: targetPourY,
          duration: 300,
          ease: 'Cubic.easeOut',
          onComplete: () => {
            // Rotate tube to pour (-90 degrees)
            scene.tweens.add({
              targets: tube,
              angle: -95,
              duration: 250,
              ease: 'Power1',
              onComplete: () => {
                // Emit Pour Sound Event
                scene.game.events.emit('trigger-pour-sfx');

                // Spawn Pour liquid stream particles
                const colorKey = tube.getData('colorKey');
                const colorHex = tube.getData('hex');

                const pourEmitter = createSafeParticles(scene, scene.mixingFlaskContainer.x, scene.mixingFlaskContainer.y - 45, 'sparkle', {
                  speedY: { min: 120, max: 240 },
                  speedX: { min: -15, max: 15 },
                  gravityY: 400,
                  scale: { start: 1.4, end: 0.3 },
                  lifespan: 500,
                  quantity: 3,
                  frequency: 45,
                  tint: colorHex
                });

                // Start raising liquid inside flask
                let targetLevel = scene.currentLiquidLevel + 0.45;
                if (targetLevel > 0.95) targetLevel = 0.95;

                const mixResult = scene.processMixingChemistry(colorKey, colorHex);

                scene.tweens.add({
                  targets: scene,
                  currentLiquidLevel: targetLevel,
                  duration: 800,
                  onUpdate: () => {
                    scene.drawMixingFlask();
                  },
                  onComplete: () => {
                    if (pourEmitter.stop) {
                      pourEmitter.stop();
                    } else if (pourEmitter.destroy) {
                      pourEmitter.destroy();
                    }

                    if (mixResult?.shouldEvaluate) {
                      scene.time.delayedCall(200, () => {
                        scene.evaluateActiveExperiment(mixResult.mixName);
                      });
                    }

                    scene.tweens.add({
                      targets: tube,
                      angle: 0,
                      x: startX,
                      y: startY,
                      duration: 350,
                      ease: 'Power1',
                      onComplete: () => {
                        tube.setInteractive();
                        scene.game.events.emit('pour-finished');
                      }
                    });
                  }
                });
              }
            });
          }
        });
      };

      // Magic Color Mixing Equations
      scene.processMixingChemistry = function (newColorKey, newColorHex) {
        scene.mixedIngredients.push(newColorKey);

        const mapName = (k) => {
          if (k === 'Rojo') return 'Rojo 🍓';
          if (k === 'Azul') return 'Azul 🫐';
          if (k === 'Amarillo') return 'Amarillo 🌻';
          if (k === 'Violeta') return 'Poción Violeta 🪻';
          if (k === 'Verde') return 'Poción Verde 🍃';
          if (k === 'Anaranjado') return 'Poción Naranja 🍊';
          return k;
        };

        let shouldEvaluate = false;
        let mixName = '';

        if (scene.mixedIngredients.length === 1) {
          scene.currentColorHex = newColorHex;
          scene.currentColorName = newColorKey;
          scene.mixingLabelText.setText(mapName(newColorKey).toUpperCase());
        } else if (scene.mixedIngredients.length === 2) {
          const i1 = scene.mixedIngredients[0];
          const i2 = scene.mixedIngredients[1];

          let mixHex = 0x000000;

          if ((i1 === 'Rojo' && i2 === 'Azul') || (i1 === 'Azul' && i2 === 'Rojo')) {
            mixName = 'Violeta';
            mixHex = scene.colors.Violeta.hex;
          } else if ((i1 === 'Azul' && i2 === 'Amarillo') || (i1 === 'Amarillo' && i2 === 'Azul')) {
            mixName = 'Verde';
            mixHex = scene.colors.Verde.hex;
          } else if ((i1 === 'Rojo' && i2 === 'Amarillo') || (i1 === 'Amarillo' && i2 === 'Rojo')) {
            mixName = 'Anaranjado';
            mixHex = scene.colors.Anaranjado.hex;
          } else {
            mixName = i1;
            mixHex = scene.colors[i1].hex;
          }

          scene.currentColorHex = mixHex;
          scene.currentColorName = mixName;
          scene.mixingLabelText.setText(`POCIÓN: ${mapName(mixName).toUpperCase()}`);

          if (mixName !== i1 && mixName === scene.activeGoal) {
            scene.setScientistState('happy');
          }

          shouldEvaluate = scene.experimentStatus[scene.activeGoal] === EXPERIMENT_STATUS.PENDING;
        } else {
          scene.currentColorHex = scene.colors.Sludge.hex;
          scene.currentColorName = 'Sludge';
          scene.mixingLabelText.setText('MEZCLA: POCIÓN INESTABLE ☁️');
          scene.setScientistState('confused');
        }

        scene.drawMixingFlask();

        return shouldEvaluate ? { shouldEvaluate: true, mixName } : null;
      };

      // Empty Mixing Flask
      scene.emptyMixingFlask = function (showSplash) {
        if (showSplash) {
          scene.game.events.emit('trigger-pour-sfx');
 
          // Tilt flask to pour contents
          scene.mixingFlaskContainer.disableInteractive();
          scene.tweens.add({
            targets: scene.mixingFlaskContainer,
            angle: 110,
            x: 370,
            y: 435,
            duration: 350,
            ease: 'Power1',
            onComplete: () => {
              // Splash draining particles
              const drainEmitter = createSafeParticles(scene, scene.mixingFlaskContainer.x + 20, scene.mixingFlaskContainer.y + 30, 'sparkle', {
                speedY: 200,
                speedX: { min: -40, max: 40 },
                scale: { start: 1.2, end: 0.1 },
                lifespan: 500,
                quantity: 4,
                frequency: 25,
                tint: scene.currentColorHex
              });
 
              // Emptying tween
              scene.tweens.add({
                targets: scene,
                currentLiquidLevel: 0,
                duration: 600,
                onUpdate: () => {
                  scene.drawMixingFlask();
                },
                onComplete: () => {
                  if (drainEmitter.stop) {
                    drainEmitter.stop();
                  } else if (drainEmitter.destroy) {
                    drainEmitter.destroy();
                  }
 
                  // Restore flask posture
                  scene.tweens.add({
                    targets: scene.mixingFlaskContainer,
                    angle: 0,
                    x: 350,
                    y: 415,
                    duration: 300,
                    ease: 'Power1',
                    onComplete: () => {
                      scene.resetChemicalVariables();
                    }
                  });
                }
              });
            }
          });
        } else {
          scene.resetChemicalVariables();
        }
      };
 
      scene.resetChemicalVariables = function () {
        scene.mixedIngredients = [];
        scene.currentColorHex = 0xffffff;
        scene.currentColorName = '';
        scene.currentLiquidLevel = 0;
        scene.mixingLabelText.setText('MATRAZ VACÍO 🧪');
        scene.drawMixingFlask();
      };

      scene.syncStats = function () {
        scene.game.events.emit('stats-updated', {
          experimentStatus: scene.experimentStatus
        });
      };

      scene.checkGameCompletion = function () {
        if (allExperimentsAttempted(scene.experimentStatus)) {
          scene.time.delayedCall(1200, () => {
            scene.game.events.emit('game-finished', {
              successes: countPassed(scene.experimentStatus),
              allPassed: allExperimentsPassed(scene.experimentStatus),
              experimentStatus: { ...scene.experimentStatus }
            });
          });
        }
      };

      // Send initial state synchronization
      scene.applyResponsiveLayout = function () {
        const layout = getSceneLayout(window.innerWidth);
        if (scene.appliedLayoutProfile === layout.profile) {
          return;
        }
        scene.appliedLayoutProfile = layout.profile;
        scene.layoutProfile = layout.profile;
        scene.mixingFlaskHomeX = layout.mixingFlask.x;
        scene.targetColumnX = layout.targetColumnX;
        scene.activeTargetY = layout.activeTargetY;
        scene.mixingFlaskYOffset = layout.mixingFlaskYOffset ?? 25;
        scene.dumpButtonFollowY = layout.dumpFollowY ?? 112;

        scene.scientistContainer.setPosition(layout.scientist.x, layout.scientist.y);
        scene.scientistContainer.setScale(layout.scientistScale);
        scene.speechContainer.setPosition(0, SPEECH_BUBBLE_Y);
        scene.mixingFlaskContainer.setPosition(
          layout.mixingFlask.x,
          layout.scientist.y + scene.mixingFlaskYOffset
        );
        scene.mixingFlaskContainer.setScale(layout.mixingFlaskScale);
        scene.dumpButtonContainer.setPosition(
          layout.dumpButton.x,
          scene.mixingFlaskContainer.y + scene.dumpButtonFollowY
        );
        scene.dumpButtonContainer.setScale(layout.dumpButtonScale);

        scene.mixingLabelText.setFontSize(layout.fontSizes.mixing);
        scene.mixingLabelText.setY(layout.mixingLabelY ?? -72);
        scene.dragHintText.setFontSize(layout.fontSizes.hint);
        scene.speechText.setFontSize(layout.fontSizes.speech);
        if (scene.dumpButtonText) {
          scene.dumpButtonText.setFontSize(layout.fontSizes.dump);
        }

        scene.drawTubeShelf(layout);

        scene.tubes.forEach((tubeContainer, index) => {
          const tx = layout.tubes.startX + index * layout.tubes.spacing;
          const ty = layout.tubes.shelfY;
          tubeContainer.setPosition(tx, ty);
          tubeContainer.setScale(layout.tubeScale);
          tubeContainer.setData('tubeBaseScale', layout.tubeScale);
          tubeContainer.setData('startX', tx);
          tubeContainer.setData('startY', ty);
          const hitScale = layout.profile === 'mobile' ? 1.35 : 1.1;
          tubeContainer.setSize(scaleAsset(34) * hitScale, scaleAsset(115) * hitScale);
          const label = tubeContainer.list.find((child) => child.type === 'Text');
          if (label) {
            label.setFontSize(layout.fontSizes.tube);
          }
        });

        Object.values(scene.targets).forEach((tgt) => {
          tgt.container.setScale(layout.targetScale);
          const titleText = tgt.container.list.find((child) => child.type === 'Text' && child !== tgt.starText);
          if (titleText) {
            titleText.setFontSize(layout.fontSizes.target);
          }
          if (tgt.starText) {
            tgt.starText.setFontSize(layout.fontSizes.star);
          }
        });

        if (scene.scientistBreathTween) {
          scene.scientistBreathTween.remove();
        }
        scene.scientistBreathTween = scene.tweens.add({
          targets: scene.scientistContainer,
          y: layout.scientist.y + 6,
          duration: 2000,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });

        scene.updateActiveTargetDisplay();
      };

      scene.applyResponsiveLayout();

      scene.syncStats();
    }

    function update() {
      if (this.scientistContainer && this.mixingFlaskContainer) {
        const yOffset = this.mixingFlaskYOffset ?? 25;
        this.mixingFlaskContainer.y = this.scientistContainer.y + yOffset;
        if (this.dumpButtonContainer) {
          this.dumpButtonContainer.x = this.mixingFlaskContainer.x;
          this.dumpButtonContainer.y = this.mixingFlaskContainer.y + (this.dumpButtonFollowY ?? 112);
        }
      }
    }

    // Safe Particle Manager Factory (Version Compatible Helper)
    function createSafeParticles(scene, x, y, texture, config) {
      const px = x ?? 0;
      const py = y ?? 0;
      return scene.add.particles(px, py, texture, config);
    }

    // Geometry Helpers
    function drawFlaskSilhouette(graphics, x, y, width, height) {
      const halfW = width / 2;
      const halfH = height / 2;
      const neckW = 12;
      const neckH = 26;
      const neckTopY = y - halfH;
      const neckBaseY = neckTopY + neckH;

      graphics.beginPath();
      // Lip ring
      graphics.moveTo(x - neckW - 3, neckTopY);
      graphics.lineTo(x + neckW + 3, neckTopY);
      graphics.lineTo(x + neckW + 3, neckTopY + 4);
      graphics.lineTo(x + neckW, neckTopY + 4);
      // Neck
      graphics.lineTo(x + neckW, neckBaseY);
      // Body trapezoid
      graphics.lineTo(x + halfW, y + halfH - 8);
      // rounded bottom right
      graphics.lineTo(x + halfW - 8, y + halfH);
      // bottom plate
      graphics.lineTo(x - halfW + 8, y + halfH);
      // rounded bottom left
      graphics.lineTo(x - halfW, y + halfH - 8);
      graphics.lineTo(x - neckW, neckBaseY);
      graphics.lineTo(x - neckW, neckTopY + 4);
      graphics.lineTo(x - neckW - 3, neckTopY + 4);
      graphics.closePath();
      graphics.strokePath();
    }

    function drawLiquidFill(graphics, x, y, width, height, level) {
      const halfW = width / 2;
      const halfH = height / 2;
      const neckW = 12;
      const neckH = 26;
      const neckBaseY = (y - halfH) + neckH;
      const bottomY = y + halfH - 2.5;

      const fillHeight = (height - 8) * level;
      const liquidTopY = bottomY - fillHeight;

      graphics.beginPath();
      if (liquidTopY >= neckBaseY) {
        // Fill only within trapezoid body
        const bodyHeight = bottomY - neckBaseY;
        const progress = (bottomY - liquidTopY) / bodyHeight;
        const topHalfW = halfW - ((halfW - neckW) * progress);

        graphics.moveTo(x - topHalfW, liquidTopY);
        graphics.lineTo(x + topHalfW, liquidTopY);
        graphics.lineTo(x + halfW - 6, bottomY - 6);
        graphics.lineTo(x - halfW + 6, bottomY - 6);
      } else {
        // Fills neck too
        graphics.moveTo(x - neckW, liquidTopY);
        graphics.lineTo(x + neckW, liquidTopY);
        graphics.lineTo(x + neckW, neckBaseY);
        graphics.lineTo(x + halfW - 6, bottomY - 6);
        graphics.lineTo(x - halfW + 6, bottomY - 6);
        graphics.lineTo(x - neckW, neckBaseY);
      }
      graphics.closePath();
      graphics.fillPath();
    }

    const onResize = () => {
      if (phaserGame.current?.scale) {
        phaserGame.current.scale.refresh();
      }
      const activeScene = phaserGame.current?.scene?.scenes?.[0];
      if (activeScene?.applyResponsiveLayout) {
        activeScene.applyResponsiveLayout();
      }
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      // Destroy Phaser Instance on component unmount
      if (phaserGame.current) {
        phaserGame.current.destroy(true);
        phaserGame.current = null;
      }
    };
  }, [isAuthorized, gameSessionId]);

  useEffect(() => {
    if (!isAuthorized || completed) return;
    const next = getNextPendingExperiment(experimentStatus);
    if (!next) return;

    const onlyOneLeft = countPending(experimentStatus) === 1;
    const currentLocked = isExperimentLocked(experimentStatus[activeGoal]);

    if (onlyOneLeft || currentLocked) {
      setActiveGoal(next.id);
    }
  }, [experimentStatus, isAuthorized, completed, activeGoal]);

  useEffect(() => {
    if (phaserGame.current) {
      phaserGame.current.registry.set('activeGoal', activeGoal);
      phaserGame.current.events.emit('active-goal-changed', activeGoal);
    }
  }, [activeGoal]);

  const handleAuthorize = (e) => {
    e.preventDefault();
    if (!studentName.trim()) return;
    setIsAuthorized(true);
  };

  const finishAndReturnToStart = () => {
    if (redirectTimerRef.current) {
      clearInterval(redirectTimerRef.current);
      redirectTimerRef.current = null;
    }
    activeGameSessionRef.current += 1;
    setCompleted(false);
    setAllPassed(false);
    setExperimentStatus({ ...INITIAL_EXPERIMENT_STATUS });
    setActiveGoal(EXPERIMENTS[0].id);
    setIsPouring(false);
    setStudentName('');
    setRedirectCountdown(REDIRECT_COUNTDOWN_SECONDS);
    setIsAuthorized(false);
    setGameSessionId((id) => id + 1);
  };

  useEffect(() => {
    if (!completed) return;

    setRedirectCountdown(REDIRECT_COUNTDOWN_SECONDS);
    let remaining = REDIRECT_COUNTDOWN_SECONDS;

    redirectTimerRef.current = setInterval(() => {
      remaining -= 1;
      setRedirectCountdown(remaining);
      if (remaining <= 0) {
        finishAndReturnToStart();
      }
    }, 1000);

    return () => {
      if (redirectTimerRef.current) {
        clearInterval(redirectTimerRef.current);
        redirectTimerRef.current = null;
      }
    };
  }, [completed]);

  return (
    <div className="lab-container">
      {/* 1. Unauthorized Entry Portal */}
      {!isAuthorized && (
        <div className="credentials-overlay">
          <div className="terminal-card">
            <div className="terminal-header">
              <span className="dot red"></span>
              <span className="dot yellow"></span>
              <span className="dot green"></span>
            </div>
            
            <form className="terminal-body" onSubmit={handleAuthorize}>
              <h2 className="panel-heading">Prueba de mezcla de colores 🧪</h2>
              <p className="panel-desc">Escribe tu nombre para empezar.</p>
 
              <div className="input-group">
                <label htmlFor="student-name">Tu nombre:</label>
                <input
                  type="text"
                  id="student-name"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="Ej: María"
                  maxLength={25}
                  required
                  className="cyber-input"
                />
              </div>
 
              <button type="submit" className="cyber-btn primary-glow" disabled={!studentName.trim()}>
                Empezar prueba
              </button>
            </form>
          </div>
        </div>
      )}
 
      {/* 2. Main HUD & Active Board */}
      {isAuthorized && (
        <div className="lab-workspace">
          {/* Top Panel */}
          <header className="workspace-header">
            <div className="hud-metric client-name">
              <span className="value text-glow">{studentName}</span>
            </div>

            <div className="hud-metric stats-box simple-stats">
              <span className="value">{passedCount} / {EXPERIMENTS.length} correctas</span>
            </div>

            <div className="hud-actions">
              <button
                onClick={toggleMusic}
                className={`icon-btn ${isMusicOn ? 'active-green' : 'inactive-red'}`}
                title="Música"
              >
                {isMusicOn ? '🎵' : '🔇'}
              </button>
              <button
                onClick={toggleSound}
                className={`icon-btn ${!isMuted ? 'active-green' : 'inactive-red'}`}
                title="Sonido"
              >
                {!isMuted ? '🔊' : '🔇'}
              </button>
            </div>
          </header>
 
          {/* Center Play Area */}
          <div className="workspace-body">
            {/* Left Recipe Sidebar */}
            <aside className="recipe-sidebar">
              <div className="sidebar-section instructions">
                <h3 className="section-title">Instrucciones</h3>
                <ol className="inst-list">
                  <li>Elige una poción abajo.</li>
                  <li>Arrastra 2 colores al matraz.</li>
                  <li>Solo tienes <strong>un intento</strong> por poción.</li>
                </ol>
              </div>
 
              <div className="sidebar-section potion-picker">
                <h3 className="section-title">Elige tu poción</h3>
                <div className="active-experiment-selector">
                  {EXPERIMENTS.map((exp) => {
                    const status = experimentStatus[exp.id];
                    const locked = isExperimentLocked(status);
                    return (
                    <button
                      key={exp.id}
                      className={`experiment-select-btn ${exp.cssClass} ${activeGoal === exp.id ? 'selected' : ''} ${status === EXPERIMENT_STATUS.PASSED ? 'solved' : ''} ${status === EXPERIMENT_STATUS.FAILED ? 'failed' : ''}`}
                      onClick={() => setActiveGoal(exp.id)}
                      disabled={locked || isPouring}
                      aria-label={exp.label}
                    >
                      <span className="emoji">{exp.emoji}</span>
                      <div className="details">
                        <span className="name name-full">{exp.label}</span>
                        <span className="name name-short">{exp.shortLabel}</span>
                        <span className="status">
                          {status === EXPERIMENT_STATUS.PASSED
                            ? '✅ Correcta'
                            : status === EXPERIMENT_STATUS.FAILED
                              ? '❌ Incorrecta'
                              : activeGoal === exp.id
                                ? 'Activa'
                                : 'Elegir'}
                        </span>
                      </div>
                    </button>
                    );
                  })}
                </div>
              </div>
            </aside>
 
            {/* Core Game Render Canvas */}
            <main className="canvas-wrapper">
              <div ref={gameRef} key={gameSessionId} className="phaser-canvas-container" id="phaser-canvas-container" />
              <div className="canvas-scanner-overlay"></div>
            </main>
          </div>
        </div>
      )}
 
      {/* 3. Victory Report Modal Card */}
      {completed && (
        <div className="victory-overlay">
          <div className="diploma-card">
            <div className="badge-ribbon">{allPassed ? '🏆' : '💪'}</div>
            <h1 className="diploma-title">
              {allPassed ? '¡Prueba aprobada!' : '¡Buen intento!'}
            </h1>
            <p className="diploma-desc">
              {allPassed
                ? `¡Muy bien, ${studentName}! Mezclaste todos los colores correctamente.`
                : `${studentName}, sigue practicando la mezcla de colores con tu maestra.`}
            </p>

            <p className="diploma-score">
              Resultado: <strong>{passedCount} de {EXPERIMENTS.length}</strong> pociones correctas
            </p>

            <ul className="result-list">
              {EXPERIMENTS.map((exp) => {
                const status = experimentStatus[exp.id];
                return (
                  <li key={exp.id} className={`result-item ${status}`}>
                    <span>{exp.emoji} {exp.label}</span>
                    <span>
                      {status === EXPERIMENT_STATUS.PASSED ? '✅' : status === EXPERIMENT_STATUS.FAILED ? '❌' : '—'}
                    </span>
                  </li>
                );
              })}
            </ul>

            <p className="redirect-notice">
              Volviendo al inicio en {redirectCountdown}s…
            </p>

            <div className="diploma-actions">
              <button
                type="button"
                className="cyber-btn primary-glow diploma-done-btn"
                onClick={finishAndReturnToStart}
              >
                Listo — Volver al inicio
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
