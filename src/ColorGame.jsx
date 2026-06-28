import React, { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { audioService } from './audioService';

export default function ColorGame({ onGameComplete }) {
  // Screen and Authentication State
  const [studentName, setStudentName] = useState('');
  const [labRank, setLabRank] = useState('Apprentice');
  const [safetyApproved, setSafetyApproved] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  
  // Gameplay Metrics (Synchronized from Phaser)
  const [score, setScore] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [successes, setSuccesses] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isMusicOn, setIsMusicOn] = useState(false);
  
  // Mission Target Completion Checklist (Synchronized from Phaser)
  const [targets, setTargets] = useState({
    Violeta: false,
    Verde: false,
    Anaranjado: false,
  });

  const gameRef = useRef(null);
  const phaserGame = useRef(null);
  const timerInterval = useRef(null);

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

  // Timer Effect
  useEffect(() => {
    if (isAuthorized && !completed) {
      timerInterval.current = setInterval(() => {
        setTimeElapsed((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (timerInterval.current) clearInterval(timerInterval.current);
    };
  }, [isAuthorized, completed]);

  // Phaser Initialization Effect
  useEffect(() => {
    if (!isAuthorized || !gameRef.current) return;

    // Initialize Audio Service
    audioService.init();
    audioService.toggleSFX(isMuted);
    audioService.toggleMusic(isMusicOn);

    const config = {
      type: Phaser.AUTO,
      width: 1000,
      height: 580,
      parent: gameRef.current,
      transparent: true,
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

    // Pass data registry parameters
    game.registry.set('studentName', studentName);
    game.registry.set('labRank', labRank);

    // Phaser -> React Event Subscriptions
    game.events.on('stats-updated', (data) => {
      setScore(data.score);
      setAttempts(data.attempts);
      setSuccesses(data.successes);
      setTargets(data.targets);
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
      setCompleted(true);
      if (timerInterval.current) clearInterval(timerInterval.current);
      
      if (onGameComplete) {
        onGameComplete({
          studentName,
          labRank,
          score: data.score,
          attempts: data.attempts,
          successes: data.successes,
          timeSeconds: timeElapsed,
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
      scene.score = 0;
      scene.attempts = 0;
      scene.successes = 0;
      scene.mixedIngredients = []; // Array of string colors
      scene.currentColorHex = 0xffffff;
      scene.currentLiquidLevel = 0; // 0 to 1
      scene.isFlaskDragging = false;

      // Target Completion Flags
      scene.targetCompletion = {
        Violeta: false,
        Verde: false,
        Anaranjado: false
      };

      // Define Color Map
      scene.colors = {
        Rojo: { hex: 0xff4766, name: 'Rojo' },
        Azul: { hex: 0x3388ff, name: 'Azul' },
        Amarillo: { hex: 0xffd200, name: 'Amarillo' },
        Violeta: { hex: 0xa855f7, name: 'Violeta' },
        Verde: { hex: 0x10b981, name: 'Verde' },
        Anaranjado: { hex: 0xf97316, name: 'Anaranjado' },
        Sludge: { hex: 0x5a6372, name: 'Lodo Gris (Inestable)' }
      };

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
      scene.speechContainer = scene.add.container(0, -90);
      scene.speechBubble = scene.add.graphics();
      scene.speechText = scene.add.text(0, -2, '', {
        fontFamily: 'Courier, Monaco, monospace',
        fontSize: '13px',
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

      // Scientist Breathing Tween
      scene.tweens.add({
        targets: scene.scientistContainer,
        y: 396,
        duration: 2000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });

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
          scene.speechContainer.y = -90;

          if (scene.speechTween) scene.speechTween.remove();
          scene.speechTween = scene.tweens.add({
            targets: scene.speechContainer,
            alpha: 0,
            y: -105,
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

      // 4. Mixing Flask (El Mezclador)
      // Placed to the right of the scientist. Y synced in update()
      scene.mixingFlaskContainer = scene.add.container(350, 415);
      scene.mixingFlaskGraphics = scene.add.graphics();
      scene.mixingFlaskContainer.add(scene.mixingFlaskGraphics);
 
      // Label above mixing flask
      scene.mixingLabelText = scene.add.text(0, -68, 'MATRAZ VACÍO 🧪', {
        fontFamily: "'Fredoka', sans-serif",
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#78350f',
        align: 'center'
      }).setOrigin(0.5);
      scene.mixingFlaskContainer.add(scene.mixingLabelText);
 
      // Drag instruction hint
      scene.dragHintText = scene.add.text(0, 68, '¡Arrastra al objetivo! 🧪', {
        fontFamily: "'Fredoka', sans-serif",
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#d97706',
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
          drawFlaskSilhouette(graphics, 0, 0, 80, 100);
        }

        // 2. Draw liquid inside matching the flask's inner geometry
        if (level > 0) {
          graphics.fillStyle(colorHex, 0.85);
          drawLiquidFill(graphics, 0, 0, 80, 100, level);
        }

        // 3. Draw outer glass container contour
        graphics.lineStyle(3, 0xffffff, 0.7);
        drawFlaskSilhouette(graphics, 0, 0, 80, 100);

        // 4. Graduation ticks (laboratory markings)
        graphics.lineStyle(1.5, 0xffffff, 0.4);
        const startY = 40; // bottom
        const endY = -20;  // neck base
        for (let i = 1; i <= 3; i++) {
          const ratio = 0.25 * i;
          const markY = startY - (startY - endY) * ratio;
          // Interpolate width at height
          const widthAtY = 80 - (80 - 24) * ratio;
          const halfW = widthAtY / 2;
          graphics.lineBetween(-halfW + 4, markY, -halfW + 12, markY);
        }

        // 5. White light glossy sheen highlight
        graphics.lineStyle(2, 0xffffff, 0.45);
        graphics.beginPath();
        graphics.arc(20, 20, 14, -Math.PI / 4, Math.PI / 4, false);
        graphics.strokePath();

        // Update interaction state
        if (level > 0) {
          scene.mixingFlaskContainer.setSize(85, 115);
          scene.mixingFlaskContainer.setInteractive({ draggable: true });
          scene.dragHintText.alpha = 1;
        } else {
          scene.mixingFlaskContainer.disableInteractive();
          scene.dragHintText.alpha = 0;
        }
      };

      // Initialize mixing flask drawing
      scene.drawMixingFlask();

        // 5. Draw Primary Test Tubes at the Top (Horizontal shelf)
        scene.tubes = [];
        const startX = 200;
        const shelfY = 85;
        const tubeSpacing = 120;
 
        // Draw a simple horizontal Ghibli wooden shelf bar
        const shelfBar = scene.add.graphics();
        shelfBar.fillStyle(0x78350f, 0.95); // wood brown
        shelfBar.lineStyle(2, 0x451a03, 0.8);
        shelfBar.fillRoundedRect(startX - 50, shelfY + 45, 340, 10, 4);
        shelfBar.strokeRoundedRect(startX - 50, shelfY + 45, 340, 10, 4);
 
        const colorsData = [
          { colorKey: 'Rojo', hex: scene.colors.Rojo.hex, label: '🍓 FRESA' },
          { colorKey: 'Azul', hex: scene.colors.Azul.hex, label: '🫐 ARÁNDANO' },
          { colorKey: 'Amarillo', hex: scene.colors.Amarillo.hex, label: '🌻 GIRASOL' }
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
            graphics.lineStyle(3, 0xffffff, 0.65);
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
          const label = scene.add.text(0, 68, tubeInfo.label, {
            fontFamily: "'Fredoka', sans-serif",
            fontSize: '11px',
            fontStyle: 'bold',
            color: '#78350f'
          }).setOrigin(0.5);
          tubeContainer.add(label);
   
          // Setup interaction
          tubeContainer.setSize(34, 115);
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

      const targetsData = [
        { name: 'Violeta', hex: scene.colors.Violeta.hex, label: 'POCIÓN VIOLETA 🪻' },
        { name: 'Verde', hex: scene.colors.Verde.hex, label: 'POCIÓN VERDE 🍃' },
        { name: 'Anaranjado', hex: scene.colors.Anaranjado.hex, label: 'POCIÓN NARANJA 🍊' }
      ];

      targetsData.forEach((tgtInfo, index) => {
        const ty = targetColumnYStart + index * targetSpacing;

        const targetContainer = scene.add.container(targetColumnX, ty);
        const outlineGraphics = scene.add.graphics();
        const solvedGraphics = scene.add.graphics();
        targetContainer.add(outlineGraphics);
        targetContainer.add(solvedGraphics);

        // Labels (Clean Fredoka text displaying the target flask name without recipes)
        const titleText = scene.add.text(0, -62, tgtInfo.label, {
          fontFamily: "'Fredoka', sans-serif",
          fontSize: '12px',
          fontStyle: 'bold',
          color: '#78350f'
        }).setOrigin(0.5);
        targetContainer.add(titleText);

        // Star badge (hidden initially, pops up on solved)
        const starText = scene.add.text(42, -30, '⭐', {
          fontSize: '20px'
        }).setOrigin(0.5);
        starText.alpha = 0;
        targetContainer.add(starText);

        // Render the empty dashed outline
        scene.drawTargetOutline = function (graphics, colorHex) {
          graphics.clear();
          // Draw faint silhouette of target color
          graphics.fillStyle(colorHex, 0.08);
          drawLiquidFill(graphics, 0, 0, 70, 90, 0.8);

          // Draw dashed / faint outline
          graphics.lineStyle(2.5, colorHex, 0.45);
          drawFlaskSilhouette(graphics, 0, 0, 70, 90);
        };

        scene.drawTargetSolved = function (graphics, colorHex, isSolved) {
          graphics.clear();
          if (isSolved) {
            // Draw liquid filled
            graphics.fillStyle(colorHex, 0.85);
            drawLiquidFill(graphics, 0, 0, 70, 90, 0.85);

            // Draw clean white glass outline
            graphics.lineStyle(3, 0xffffff, 0.7);
            drawFlaskSilhouette(graphics, 0, 0, 70, 90);

            // Draw light gloss highlight
            graphics.lineStyle(2, 0xffffff, 0.45);
            graphics.beginPath();
            graphics.arc(16, 16, 12, -Math.PI / 4, Math.PI / 4, false);
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
          name: tgtInfo.name
        };
      });

      // 7. Manual Empty Button (Trash Bin / Drain)
      // Placed below the mixing flask
      const dumpButtonContainer = scene.add.container(350, 525);
      const dbGraphics = scene.add.graphics();
      dbGraphics.fillStyle(0x22c55e, 0.15); // soft leaf green
      dbGraphics.lineStyle(2, 0x15803d, 0.6);
      dbGraphics.fillRoundedRect(-60, -15, 120, 30, 8);
      dbGraphics.strokeRoundedRect(-60, -15, 120, 30, 8);
      dumpButtonContainer.add(dbGraphics);

      const dbText = scene.add.text(0, 0, '🧪 LIMPIAR MATRAZ', {
        fontFamily: "'Fredoka', sans-serif",
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#15803d'
      }).setOrigin(0.5);
      dumpButtonContainer.add(dbText);

      dumpButtonContainer.setSize(120, 30);
      dumpButtonContainer.setInteractive({ useHandCursor: true });
      
      dumpButtonContainer.on('pointerover', () => {
        dbGraphics.clear();
        dbGraphics.fillStyle(0x22c55e, 0.3);
        dbGraphics.lineStyle(2, 0x15803d, 0.9);
        dbGraphics.fillRoundedRect(-60, -15, 120, 30, 8);
        dbGraphics.strokeRoundedRect(-60, -15, 120, 30, 8);
      });

      dumpButtonContainer.on('pointerout', () => {
        dbGraphics.clear();
        dbGraphics.fillStyle(0x22c55e, 0.15);
        dbGraphics.lineStyle(2, 0x15803d, 0.6);
        dbGraphics.fillRoundedRect(-60, -15, 120, 30, 8);
        dbGraphics.strokeRoundedRect(-60, -15, 120, 30, 8);
      });

      dumpButtonContainer.on('pointerdown', () => {
        if (scene.currentLiquidLevel > 0) {
          scene.emptyMixingFlask(true); // empty with pouring effect
        }
      });

      // Drag Tube Logic
      scene.input.on('dragstart', function (pointer, gameObject) {
        if (gameObject === scene.mixingFlaskContainer) {
          scene.isFlaskDragging = true;
          scene.children.bringToTop(gameObject);
          scene.tweens.add({
            targets: gameObject,
            scale: 1.08,
            duration: 120,
            ease: 'Power1'
          });
        } else {
          // A primary test tube is being dragged
          scene.children.bringToTop(gameObject);
          scene.tweens.add({
            targets: gameObject,
            scale: 1.12,
            angle: 10,
            duration: 120,
            ease: 'Power1'
          });
        }
      });

      scene.input.on('drag', function (pointer, gameObject, dragX, dragY) {
        gameObject.x = dragX;
        gameObject.y = dragY;
      });

      scene.input.on('dragend', function (pointer, gameObject) {
        if (gameObject === scene.mixingFlaskContainer) {
          scene.isFlaskDragging = false;
          scene.tweens.add({
            targets: gameObject,
            scale: 1.0,
            duration: 120,
            ease: 'Power1'
          });

          // Check target collision
          let matchFound = false;
          let activeTarget = null;

          for (const key in scene.targets) {
            const tgt = scene.targets[key];
            const dist = Phaser.Math.Distance.Between(gameObject.x, gameObject.y, tgt.container.x, tgt.container.y);
            
            if (dist < 90) {
              matchFound = true;
              activeTarget = tgt;
              break;
            }
          }

          if (matchFound && activeTarget) {
            // Evaluate Match Color
            const isMatch = (scene.currentColorName === activeTarget.name);
            const isAlreadySolved = scene.targetCompletion[activeTarget.name];

            if (isAlreadySolved) {
              // Target already completed, return back
              scene.tweens.add({
                targets: gameObject,
                x: 350,
                y: 415,
                duration: 400,
                ease: 'Back.easeOut'
              });
              scene.setScientistState('confused');
            } else if (isMatch) {
              // CORRECT MATCH SUCCESS
              scene.targetCompletion[activeTarget.name] = true;
              scene.attempts += 1;
              scene.successes += 1;
              scene.score += 100;

              // Fill Target Flask
              activeTarget.solvedGraphics.clear();
              scene.drawTargetSolved(activeTarget.solvedGraphics, activeTarget.hex, true);
              activeTarget.starText.scale = 0;
              activeTarget.starText.alpha = 1;
              
              // Animate star badge pop
              scene.tweens.add({
                targets: activeTarget.starText,
                scale: 1.2,
                duration: 400,
                ease: 'Back.easeOut'
              });

              // Play chimes SFX via React callback wrapper
              scene.game.events.emit('trigger-success-sfx');

              // Float arcade scoring indicator
              const rewardText = scene.add.text(activeTarget.container.x, activeTarget.container.y - 45, '+100 EXP', {
                fontFamily: 'Courier, Monaco, monospace',
                fontSize: '18px',
                fontStyle: 'bold',
                color: '#eab308'
              }).setOrigin(0.5);

              scene.tweens.add({
                targets: rewardText,
                y: activeTarget.container.y - 110,
                alpha: 0,
                duration: 1200,
                onComplete: () => rewardText.destroy()
              });

              // Sparkle particle burst (matching color)
              const sparkleEmitter = createSafeParticles(scene, activeTarget.container.x, activeTarget.container.y, 'sparkle', {
                speed: { min: 80, max: 200 },
                angle: { min: 0, max: 360 },
                scale: { start: 1.5, end: 0 },
                lifespan: 1000,
                gravityY: 120,
                quantity: 35,
                frequency: -1, // one-shot
                tint: activeTarget.hex
              });
              if (sparkleEmitter.explode) sparkleEmitter.explode(); // trigger one-shot

              // Reaction happy
              scene.setScientistState('happy');

              // Return flask and clean it
              scene.tweens.add({
                targets: gameObject,
                x: 350,
                y: 415,
                duration: 400,
                ease: 'Power1',
                onComplete: () => {
                  scene.emptyMixingFlask(false); // standard clean
                  scene.syncStats();
                  scene.checkGameCompletion();
                }
              });

            } else {
              // INCORRECT MATCH FAIL
              scene.attempts += 1;
              scene.score = Math.max(0, scene.score - 25);

              // Play failure sound
              scene.game.events.emit('trigger-failure-sfx');

              // Shake Target & Camera
              scene.cameras.main.shake(250, 0.008);
              scene.tweens.add({
                targets: activeTarget.container,
                x: activeTarget.container.x - 8,
                duration: 60,
                yoyo: true,
                repeat: 3,
                onComplete: () => {
                  activeTarget.container.x = targetColumnX;
                }
              });

              // Red Error float score indicator
              const failText = scene.add.text(activeTarget.container.x, activeTarget.container.y - 45, '-25 EXP', {
                fontFamily: 'Courier, Monaco, monospace',
                fontSize: '18px',
                fontStyle: 'bold',
                color: '#f43f5e'
              }).setOrigin(0.5);

              scene.tweens.add({
                targets: failText,
                y: activeTarget.container.y - 110,
                alpha: 0,
                duration: 1200,
                onComplete: () => failText.destroy()
              });

              // Smoke puff explosion particles
              const smokeEmitter = createSafeParticles(scene, activeTarget.container.x, activeTarget.container.y, 'smoke', {
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

              // Scientist shocked reaction
              scene.setScientistState('shocked');

              // Return flask and clean it
              scene.tweens.add({
                targets: gameObject,
                x: 350,
                y: 415,
                duration: 400,
                ease: 'Power1',
                onComplete: () => {
                  scene.emptyMixingFlask(false);
                  scene.syncStats();
                }
              });
            }
          } else {
            // Not dropped on targets, return home safely
            scene.tweens.add({
              targets: gameObject,
              x: 350,
              y: 415,
              duration: 350,
              ease: 'Back.easeOut'
            });
          }
        } else {
          // Draggable tube drag end
          const startX = gameObject.getData('startX');
          const startY = gameObject.getData('startY');

          // Reset tube rotation and scale
          scene.tweens.add({
            targets: gameObject,
            scale: 1.0,
            angle: 0,
            duration: 150,
            ease: 'Power1'
          });

          // Check if hovering near mixing flask mouth (X=220, Y=375 offset)
          const dist = Phaser.Math.Distance.Between(gameObject.x, gameObject.y, scene.mixingFlaskContainer.x, scene.mixingFlaskContainer.y - 45);
          
          if (dist < 100 && !scene.isFlaskDragging) {
            scene.pourTube(gameObject, startX, startY);
          } else {
            // Return back to the wooden shelf
            scene.tweens.add({
              targets: gameObject,
              x: startX,
              y: startY,
              duration: 350,
              ease: 'Back.easeOut'
            });
          }
        }
      });

      // Tube Pouring animation sequence
      scene.pourTube = function (tube, startX, startY) {
        // disable interactivity on tube during animation
        tube.disableInteractive();

        // Target pour coordinates (upper right of the flask mouth)
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

                // Process mix chemistry logic immediately so color updates before tween bobs
                scene.processMixingChemistry(colorKey, colorHex);

                scene.tweens.add({
                  targets: scene,
                  currentLiquidLevel: targetLevel,
                  duration: 800,
                  onUpdate: () => {
                    scene.drawMixingFlask();
                  },
                  onComplete: () => {
                    // Turn off pour particles
                    if (pourEmitter.stop) {
                      pourEmitter.stop();
                    } else if (pourEmitter.destroy) {
                      pourEmitter.destroy();
                    }

                    // Return tube home
                    scene.tweens.add({
                      targets: tube,
                      angle: 0,
                      x: startX,
                      y: startY,
                      duration: 350,
                      ease: 'Power1',
                      onComplete: () => {
                        tube.setInteractive();
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
          if (k === 'Rojo') return 'Fresa 🍓';
          if (k === 'Azul') return 'Arándano 🫐';
          if (k === 'Amarillo') return 'Girasol 🌻';
          if (k === 'Violeta') return 'Poción Violeta 🪻';
          if (k === 'Verde') return 'Poción Verde 🍃';
          if (k === 'Anaranjado') return 'Poción Naranja 🍊';
          return k;
        };

        if (scene.mixedIngredients.length === 1) {
          // First ingredient added
          scene.currentColorHex = newColorHex;
          scene.currentColorName = newColorKey;
          scene.mixingLabelText.setText(mapName(newColorKey).toUpperCase());
        } else if (scene.mixedIngredients.length === 2) {
          // Second ingredient added
          const i1 = scene.mixedIngredients[0];
          const i2 = scene.mixedIngredients[1];

          let mixName = '';
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
            // Duplicate colors e.g. Rojo + Rojo
            mixName = i1;
            mixHex = scene.colors[i1].hex;
          }

          scene.currentColorHex = mixHex;
          scene.currentColorName = mixName;
          scene.mixingLabelText.setText(`POCIÓN: ${mapName(mixName).toUpperCase()}`);
          
          if (mixName !== i1) {
            scene.setScientistState('happy');
          }
        } else {
          // 3 or more colors = mud/sludge
          scene.currentColorHex = scene.colors.Sludge.hex;
          scene.currentColorName = 'Sludge';
          scene.mixingLabelText.setText('MEZCLA: POCIÓN INESTABLE ☁️');
          scene.setScientistState('confused');
        }

        scene.drawMixingFlask();
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
          score: scene.score,
          attempts: scene.attempts,
          successes: scene.successes,
          targets: scene.targetCompletion
        });
      };

      scene.checkGameCompletion = function () {
        const { Violeta, Verde, Anaranjado } = scene.targetCompletion;
        if (Violeta && Verde && Anaranjado) {
          // Play fanfare chord
          scene.time.delayedCall(1200, () => {
            // Trigger game finished
            scene.game.events.emit('game-finished', {
              score: scene.score,
              attempts: scene.attempts,
              successes: scene.successes
            });
          });
        }
      };

      // Send initial state synchronization
      scene.syncStats();
    }

    function update() {
      // Bob mixing flask Container in sync with scientist bobbing when not dragged
      if (!this.isFlaskDragging && this.scientistContainer && this.mixingFlaskContainer) {
        this.mixingFlaskContainer.y = this.scientistContainer.y + 25;
      }
    }

    // Safe Particle Manager Factory (Version Compatible Helper)
    function createSafeParticles(scene, x, y, texture, config) {
      try {
        const emitter = scene.add.particles(texture, config);
        if (x !== undefined && y !== undefined) {
          emitter.setPosition(x, y);
        }
        return emitter;
      } catch (err) {
        // Fallback for older Phaser 3.50 API
        const manager = scene.add.particles(texture);
        const emitter = manager.createEmitter(config);
        if (x !== undefined && y !== undefined) {
          emitter.setPosition(x, y);
        }
        return emitter;
      }
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

    return () => {
      // Destroy Phaser Instance on component unmount
      if (phaserGame.current) {
        phaserGame.current.destroy(true);
        phaserGame.current = null;
      }
    };
  }, [isAuthorized]);

  // Handle Login Credentials Submission
  const handleAuthorize = (e) => {
    e.preventDefault();
    if (!studentName.trim()) return;
    if (!safetyApproved) return;
    setIsAuthorized(true);
  };

  // Restart Experiment reset variables
  const handleRestart = () => {
    setScore(0);
    setAttempts(0);
    setSuccesses(0);
    setTimeElapsed(0);
    setCompleted(false);
    setTargets({ Violeta: false, Verde: false, Anaranjado: false });
    
    // Refresh authorization triggers
    setIsAuthorized(false);
    setTimeout(() => {
      setIsAuthorized(true);
    }, 100);
  };

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
              <span className="terminal-title">ENTRADA AL LABORATORIO MÁGICO</span>
            </div>
            
            <form className="terminal-body" onSubmit={handleAuthorize}>

              <h2 className="panel-heading">¡HOLA, PEQUEÑO CIENTÍFICO! 🧪</h2>
              <p className="panel-desc">Escribe tu nombre para empezar a experimentar en el lab del bosque.</p>
 
              <div className="input-group">
                <label htmlFor="student-name">¿CÓMO TE LLAMAS?:</label>
                <input
                  type="text"
                  id="student-name"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="Escribe tu lindo nombre aquí..."
                  maxLength={25}
                  required
                  className="cyber-input"
                />
              </div>
 
              <div className="input-group">
                <label htmlFor="lab-rank">ELIGE TU TÍTULO MÁGICO:</label>
                <select
                  id="lab-rank"
                  value={labRank}
                  onChange={(e) => setLabRank(e.target.value)}
                  className="cyber-select"
                >
                  <option value="Apprentice">🌱 Ayudante de Lab (Aprendiz)</option>
                  <option value="Researcher">🔬 Científico del Bosque (Experto)</option>
                  <option value="MadScientist">🌳 Gran Sabio del Lab (Maestro)</option>
                </select>
              </div>
 
              <div className="safety-checkbox">
                <input
                  type="checkbox"
                  id="safety-lock"
                  checked={safetyApproved}
                  onChange={(e) => setSafetyApproved(e.target.checked)}
                  required
                />
                <label htmlFor="safety-lock">
                  ¡Prometo cuidar el material de vidrio, no beber las pociones y divertirme haciendo experimentos! 🧪
                </label>
              </div>
 
              <button type="submit" className="cyber-btn primary-glow" disabled={!studentName.trim() || !safetyApproved}>
                ¡INICIAR EXPERIMENTOS! 🌟
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
              <span className="label">CIENTÍFICO(A):</span>
              <span className="value text-glow">{studentName.toUpperCase()}</span>
              <span className="badge">{labRank === 'Apprentice' ? 'AYUDANTE 🌱' : labRank === 'Researcher' ? 'CIENTÍFICO 🔬' : 'GRAN SABIO 🌳'}</span>
            </div>
 
            <div className="hud-metric stats-box">
              <div className="stat-node">
                <span className="label">CIENCIA:</span>
                <span className="value text-gold">{score} CIENCIA ✨</span>
              </div>
              <div className="stat-separator"></div>
              <div className="stat-node">
                <span className="label">INTENTOS:</span>
                <span className="value">{attempts}</span>
              </div>
              <div className="stat-separator"></div>
              <div className="stat-node">
                <span className="label">PRECISIÓN:</span>
                <span className="value text-cyan">
                  {attempts > 0 ? Math.round((successes / attempts) * 100) : 100}%
                </span>
              </div>
              <div className="stat-separator"></div>
              <div className="stat-node">
                <span className="label">TIEMPO:</span>
                <span className="value">
                  {Math.floor(timeElapsed / 60)}:{(timeElapsed % 60).toString().padStart(2, '0')}
                </span>
              </div>
            </div>
 
            <div className="hud-actions">
              <button 
                onClick={toggleMusic} 
                className={`icon-btn ${isMusicOn ? 'active-green' : 'inactive-red'}`} 
                title="Música de Fondo"
              >
                {isMusicOn ? '🎵 MÚSICA SÍ' : '🔇 MÚSICA NO'}
              </button>
              <button 
                onClick={toggleSound} 
                className={`icon-btn ${!isMuted ? 'active-green' : 'inactive-red'}`} 
                title="Sonido SFX"
              >
                {!isMuted ? '✨ EFECTOS SÍ' : '🔇 EFECTOS NO'}
              </button>
              <button onClick={handleRestart} className="icon-btn danger" title="Reiniciar Partida">
                🔄 REINICIAR LAB
              </button>
            </div>
          </header>
 
          {/* Center Play Area */}
          <div className="workspace-body">
            {/* Left Recipe Sidebar */}
            <aside className="recipe-sidebar">
              <div className="sidebar-section instructions">
                <h3 className="section-title">💡 ¿CÓMO EXPERIMENTAR?</h3>
                <ol className="inst-list">
                  <li>Arrastra las pociones primarias (Fresa, Arándano, Girasol) al matraz del científico.</li>
                  <li>Mezcla los colores para crear las pociones de la receta.</li>
                  <li>Arrastra el matraz mezclado hacia su silueta correspondiente en la derecha.</li>
                  <li>Si te equivocas o creas una mezcla inestable, haz clic en <strong>🧪 LIMPIAR MATRAZ</strong> para vaciarlo.</li>
                </ol>
              </div>
 
              <div className="sidebar-section">
                <h3 className="section-title">🎯 EXPERIMENTOS DE HOY</h3>
                <div className="checklist">
                  <div className={`check-node ${targets.Violeta ? 'solved' : 'pending'}`}>
                    <span className="check-box">{targets.Violeta ? '✅' : '🧪'}</span>
                    <span className="check-label">Poción Violeta 🪻</span>
                  </div>
                  <div className={`check-node ${targets.Verde ? 'solved' : 'pending'}`}>
                    <span className="check-box">{targets.Verde ? '✅' : '🧪'}</span>
                    <span className="check-label">Poción Verde 🍃</span>
                  </div>
                  <div className={`check-node ${targets.Anaranjado ? 'solved' : 'pending'}`}>
                    <span className="check-box">{targets.Anaranjado ? '✅' : '🧪'}</span>
                    <span className="check-label">Poción Naranja 🍊</span>
                  </div>
                </div>
              </div>
            </aside>
 
            {/* Core Game Render Canvas */}
            <main className="canvas-wrapper">
              <div ref={gameRef} className="phaser-canvas-container" id="phaser-canvas-container" />
              <div className="canvas-scanner-overlay"></div>
            </main>
          </div>
        </div>
      )}
 
      {/* 3. Victory Report Modal Card */}
      {completed && (
        <div className="victory-overlay">
          <div className="diploma-card">
            <div className="badge-ribbon">🏆</div>
            <h1 className="diploma-title">¡DIPLOMA DE PEQUEÑO CIENTÍFICO!</h1>
            <p className="diploma-desc">
              ¡Felicidades! Has completado con éxito todos los experimentos del laboratorio del bosque mágico y aprendido sobre la mezcla de colores.
            </p>
 
            <div className="diploma-details">
              <div className="detail-row">
                <span className="lbl">CIENTÍFICO(A) PRINCIPAL:</span>
                <span className="val text-glow">{studentName}</span>
              </div>
              <div className="detail-row">
                <span className="lbl">RANGO CIENTÍFICO:</span>
                <span className="val">
                  {labRank === 'Apprentice' ? '🌱 Ayudante de Lab' : labRank === 'Researcher' ? '🔬 Científico(a) del Bosque' : '🌳 Gran Sabio del Lab'}
                </span>
              </div>
              <div className="detail-row">
                <span className="lbl">CIENCIA ACUMULADA:</span>
                <span className="val text-gold">{score} CIENCIA ✨</span>
              </div>
              <div className="detail-row">
                <span className="lbl">EXPERIMENTOS REALIZADOS:</span>
                <span className="val">{attempts} INTENTOS</span>
              </div>
              <div className="detail-row">
                <span className="lbl">PRECISIÓN DE MEZCLA:</span>
                <span className="val text-cyan">
                  {attempts > 0 ? Math.round((successes / attempts) * 100) : 100}%
                </span>
              </div>
              <div className="detail-row">
                <span className="lbl">TIEMPO DE EXPERIMENTOS:</span>
                <span className="val">
                  {Math.floor(timeElapsed / 60)}m {(timeElapsed % 60)}s
                </span>
              </div>
              <div className="detail-row">
                <span className="lbl">FECHA DE EMISIÓN:</span>
                <span className="val">{new Date().toLocaleDateString()}</span>
              </div>
            </div>
 
            <div className="diploma-actions">
              <button onClick={handleRestart} className="cyber-btn primary-glow">
                🧪 ¡HACER NUEVOS EXPERIMENTOS!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
