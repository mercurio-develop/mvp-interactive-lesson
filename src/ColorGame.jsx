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

        // Crazy hair back
        graphics.fillStyle(0xd1d5db, 1);
        graphics.fillCircle(-25, -60, 24);
        graphics.fillCircle(25, -60, 24);
        graphics.fillCircle(-45, -35, 22);
        graphics.fillCircle(45, -35, 22);
        graphics.fillCircle(-45, -10, 20);
        graphics.fillCircle(45, -10, 20);
        graphics.fillCircle(0, -75, 28);

        // Head/Face skin based on reaction
        let skinColor = 0xfde047; // standard crazy yellow
        if (state === 'happy') skinColor = 0xa7f3d0; // green-blue positive
        if (state === 'shocked') skinColor = 0xfecaca; // red blushing negative
        if (state === 'confused') skinColor = 0xe2e8f0; // pale grey confused

        graphics.fillStyle(skinColor, 1);
        graphics.fillCircle(0, -25, 32);

        // Eyebrows
        graphics.lineStyle(3, 0x1e293b, 1);
        if (state === 'shocked') {
          // Eyebrows raised high
          graphics.lineBetween(-25, -48, -5, -45);
          graphics.lineBetween(5, -45, 25, -48);
        } else if (state === 'confused') {
          // Curved asymmetrical eyebrows
          graphics.lineBetween(-22, -42, -6, -45);
          graphics.lineBetween(6, -42, 22, -46);
        } else {
          // Standard crazy eyebrows
          graphics.lineBetween(-22, -45, -8, -41);
          graphics.lineBetween(8, -41, 22, -45);
        }

        // Cyber lab Goggles
        graphics.lineStyle(4, 0x06b6d4, 1); // Glowing cyan rim
        let lensGlowAlpha = 0.55;
        let lensColor = 0x0891b2;
        if (state === 'happy') {
          lensGlowAlpha = 0.85;
          lensColor = 0x10b981; // green glow
        } else if (state === 'shocked') {
          lensGlowAlpha = 0.9;
          lensColor = 0xef4444; // red alert glow
        }
        
        graphics.fillStyle(lensColor, lensGlowAlpha);
        graphics.fillCircle(-16, -30, 13);
        graphics.strokeCircle(-16, -30, 13);
        graphics.fillCircle(16, -30, 13);
        graphics.strokeCircle(16, -30, 13);

        // Goggles strap
        graphics.lineStyle(3, 0x0f172a, 1);
        graphics.lineBetween(-32, -30, -16, -30);
        graphics.lineBetween(16, -30, 32, -30);
        graphics.lineBetween(-16, -30, 16, -30);

        // Goggles Reflection
        graphics.fillStyle(0xffffff, 0.4);
        graphics.fillCircle(-12, -34, 4);
        graphics.fillCircle(20, -34, 4);

        // Mouth Reacts
        graphics.lineStyle(3, 0x0f172a, 1);
        if (state === 'happy') {
          // Big smiling mouth
          graphics.fillStyle(0x0f172a, 1);
          graphics.beginPath();
          graphics.arc(0, -12, 10, 0, Math.PI, false);
          graphics.closePath();
          graphics.fillPath();
          graphics.strokePath();
        } else if (state === 'shocked') {
          // Big circular gasp
          graphics.fillStyle(0x0f172a, 1);
          graphics.fillCircle(0, -10, 8);
          graphics.strokeCircle(0, -10, 8);
        } else if (state === 'confused') {
          // Squiggly line mouth
          graphics.beginPath();
          graphics.moveTo(-10, -12);
          graphics.lineTo(-4, -8);
          graphics.lineTo(2, -13);
          graphics.lineTo(8, -9);
          graphics.strokePath();
        } else {
          // Standard funny smile
          graphics.beginPath();
          graphics.arc(0, -14, 8, 0, Math.PI, false);
          graphics.strokePath();
        }

        // Lab coat
        graphics.fillStyle(0xffffff, 1);
        // Triangle collar
        graphics.fillTriangle(-26, 8, 26, 8, 0, 42);
        // Coat base
        graphics.fillRect(-38, 8, 76, 90);
        graphics.lineStyle(3, 0xe2e8f0, 1);
        graphics.lineBetween(0, 42, 0, 98); // button line
        
        // Shirt/Tie
        graphics.fillStyle(0x4f46e5, 1); // Purple shirt
        graphics.fillTriangle(-10, 8, 10, 8, 0, 25);
        graphics.fillStyle(0xf43f5e, 1); // Pink tie
        graphics.fillTriangle(-3, 20, 3, 20, 0, 36);

        // Arms holding the flask
        graphics.fillStyle(0xffffff, 1);
        graphics.fillRoundedRect(-58, 45, 28, 15, 6);
        graphics.fillRoundedRect(30, 45, 28, 15, 6);
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
          const words = ["¡ESPECTACULAR!", "¡QUÍMICA PERFECTA!", "¡EXCELENTE!", "¡FÓRMULA ÉPICA!"];
          msg = words[Math.floor(Math.random() * words.length)];
        } else if (state === 'shocked') {
          const words = ["¡CUIDADO!", "¡BUM!", "¡VAYA EXPLOSIÓN!", "¡FÓRMULA ERRÓNEA!"];
          msg = words[Math.floor(Math.random() * words.length)];
        } else if (state === 'confused') {
          const words = ["¿QUÉ ES ESTO?", "¡LODO GRIS!", "MEZCLA INESTABLE", "VACIAR FLASCO"];
          msg = words[Math.floor(Math.random() * words.length)];
        }

        if (msg) {
          scene.speechText.setText(msg);
          scene.speechBubble.clear();
          
          const w = scene.speechText.width + 24;
          const h = 32;
          
          // Draw Bubble container
          scene.speechBubble.fillStyle(0xffffff, 0.95);
          scene.speechBubble.lineStyle(2, 0x0f172a, 1);
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
      // Placed exactly centered between scientist's hands. Y synced in update()
      scene.mixingFlaskContainer = scene.add.container(220, 440);
      scene.mixingFlaskGraphics = scene.add.graphics();
      scene.mixingFlaskContainer.add(scene.mixingFlaskGraphics);

      // Label above mixing flask
      scene.mixingLabelText = scene.add.text(0, -68, 'MATRAZ VACÍO', {
        fontFamily: 'Courier, Monaco, monospace',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#94a3b8',
        align: 'center'
      }).setOrigin(0.5);
      scene.mixingFlaskContainer.add(scene.mixingLabelText);

      // Drag instruction hint
      scene.dragHintText = scene.add.text(0, 68, '¡Arrastrar al objetivo!', {
        fontFamily: 'Courier, Monaco, monospace',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#f43f5e',
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
      const tubeSpacing = 160;
      const startX = 350;
      const shelfY = 85;

      // Draw standard laboratory wooden/metallic shelf bar
      const shelfBar = scene.add.graphics();
      shelfBar.fillStyle(0x1e293b, 0.8);
      shelfBar.lineStyle(2, 0x3b82f6, 0.4);
      shelfBar.fillRoundedRect(startX - 70, shelfY + 50, 360, 12, 4);
      shelfBar.strokeRoundedRect(startX - 70, shelfY + 50, 360, 12, 4);

      const colorsData = [
        { colorKey: 'Rojo', hex: scene.colors.Rojo.hex, label: 'ROJO' },
        { colorKey: 'Azul', hex: scene.colors.Azul.hex, label: 'AZUL' },
        { colorKey: 'Amarillo', hex: scene.colors.Amarillo.hex, label: 'AMARILLO' }
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
          fontFamily: 'Courier, Monaco, monospace',
          fontSize: '12px',
          fontStyle: 'bold',
          color: '#cbd5e1'
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
        { name: 'Violeta', hex: scene.colors.Violeta.hex, label: 'VIOLETA (Rojo + Azul)' },
        { name: 'Verde', hex: scene.colors.Verde.hex, label: 'VERDE (Azul + Amarillo)' },
        { name: 'Anaranjado', hex: scene.colors.Anaranjado.hex, label: 'ANARANJADO (Rojo + Amarillo)' }
      ];

      targetsData.forEach((tgtInfo, index) => {
        const ty = targetColumnYStart + index * targetSpacing;

        const targetContainer = scene.add.container(targetColumnX, ty);
        const outlineGraphics = scene.add.graphics();
        const solvedGraphics = scene.add.graphics();
        targetContainer.add(outlineGraphics);
        targetContainer.add(solvedGraphics);

        // Labels
        const titleText = scene.add.text(0, -62, tgtInfo.name.toUpperCase(), {
          fontFamily: 'Courier, Monaco, monospace',
          fontSize: '13px',
          fontStyle: 'bold',
          color: tgtInfo.hex
        }).setOrigin(0.5);
        targetContainer.add(titleText);

        const subText = scene.add.text(0, 60, tgtInfo.label, {
          fontFamily: 'Courier, Monaco, monospace',
          fontSize: '10px',
          color: '#64748b'
        }).setOrigin(0.5);
        targetContainer.add(subText);

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
      // Placed below the scientist
      const dumpButtonContainer = scene.add.container(220, 525);
      const dbGraphics = scene.add.graphics();
      dbGraphics.fillStyle(0xef4444, 0.15);
      dbGraphics.lineStyle(2, 0xef4444, 0.6);
      dbGraphics.fillRoundedRect(-50, -15, 100, 30, 6);
      dbGraphics.strokeRoundedRect(-50, -15, 100, 30, 6);
      dumpButtonContainer.add(dbGraphics);

      const dbText = scene.add.text(0, 0, '⚠️ VACIAR', {
        fontFamily: 'Courier, Monaco, monospace',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#f87171'
      }).setOrigin(0.5);
      dumpButtonContainer.add(dbText);

      dumpButtonContainer.setSize(100, 30);
      dumpButtonContainer.setInteractive({ useHandCursor: true });
      
      dumpButtonContainer.on('pointerover', () => {
        dbGraphics.clear();
        dbGraphics.fillStyle(0xef4444, 0.3);
        dbGraphics.lineStyle(2, 0xef4444, 0.9);
        dbGraphics.fillRoundedRect(-50, -15, 100, 30, 6);
        dbGraphics.strokeRoundedRect(-50, -15, 100, 30, 6);
      });

      dumpButtonContainer.on('pointerout', () => {
        dbGraphics.clear();
        dbGraphics.fillStyle(0xef4444, 0.15);
        dbGraphics.lineStyle(2, 0xef4444, 0.6);
        dbGraphics.fillRoundedRect(-50, -15, 100, 30, 6);
        dbGraphics.strokeRoundedRect(-50, -15, 100, 30, 6);
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
                x: 220,
                y: 440,
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
                x: 220,
                y: 440,
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
                x: 220,
                y: 440,
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
              x: 220,
              y: 440,
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

                    // Process mix chemistry logic
                    scene.processMixingChemistry(colorKey, colorHex);

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

      // Chemical Color Mixing Equations
      scene.processMixingChemistry = function (newColorKey, newColorHex) {
        scene.mixedIngredients.push(newColorKey);

        if (scene.mixedIngredients.length === 1) {
          // First ingredient added
          scene.currentColorHex = newColorHex;
          scene.currentColorName = newColorKey;
          scene.mixingLabelText.setText(newColorKey.toUpperCase());
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
          scene.mixingLabelText.setText(`MEZCLA: ${mixName.toUpperCase()}`);
          
          if (mixName !== i1) {
            scene.setScientistState('happy');
          }
        } else {
          // 3 or more colors = mud/sludge
          scene.currentColorHex = scene.colors.Sludge.hex;
          scene.currentColorName = 'Sludge';
          scene.mixingLabelText.setText('MEZCLA: LODO INESTABLE');
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
            x: 240,
            y: 460,
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
                    x: 220,
                    y: 440,
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
        scene.mixingLabelText.setText('MATRAZ VACÍO');
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
        this.mixingFlaskContainer.y = this.scientistContainer.y + 50;
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
      {/* 1. Unauthorized Credentials Entry Portal */}
      {!isAuthorized && (
        <div className="credentials-overlay">
          <div className="terminal-card">
            <div className="terminal-header">
              <span className="dot red"></span>
              <span className="dot yellow"></span>
              <span className="dot green"></span>
              <span className="terminal-title">THRUMAFORGE CREDENTIALS GATEWAY</span>
            </div>
            
            <form className="terminal-body" onSubmit={handleAuthorize}>
              <div className="hologram-seal">
                <svg viewBox="0 0 100 100" width="80" height="80" className="flask-logo">
                  <path d="M40 20 h20 v10 h-20 z" fill="#c084fc" opacity="0.8" />
                  <path d="M47 30 h6 v15 h-6 z" fill="#c084fc" opacity="0.6" />
                  <path d="M30 75 L45 45 h10 L70 75 Z" fill="none" stroke="#a855f7" strokeWidth="4" />
                  <path d="M34 70 L48 48 h4 L66 70 Z" fill="#aa3bff" opacity="0.3" />
                  <circle cx="50" cy="62" r="5" fill="#3b82f6" className="bubble-anim" />
                  <circle cx="43" cy="55" r="3" fill="#10b981" />
                </svg>
              </div>

              <h2 className="panel-heading">AUTORIZACIÓN DE ACCESO</h2>
              <p className="panel-desc">Ingresa tus datos para ingresar al Laboratorio de Química de Colores.</p>

              <div className="input-group">
                <label htmlFor="student-name">IDENTIFICACIÓN DEL CIENTÍFICO:</label>
                <input
                  type="text"
                  id="student-name"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="Ej. Dra. Marie Curie"
                  maxLength={25}
                  required
                  className="cyber-input"
                />
              </div>

              <div className="input-group">
                <label htmlFor="lab-rank">RANGO PROFESIONAL:</label>
                <select
                  id="lab-rank"
                  value={labRank}
                  onChange={(e) => setLabRank(e.target.value)}
                  className="cyber-select"
                >
                  <option value="Apprentice">⚙️ Alquimista Aprendiz</option>
                  <option value="Researcher">🔬 Investigador de Colores</option>
                  <option value="MadScientist">⚡ Científico Loco del Cobre</option>
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
                  Acepto las Normas de Bioseguridad: No beber los reactivos, limpiar los tubos y no alimentar al científico bobo.
                </label>
              </div>

              <button type="submit" className="cyber-btn primary-glow" disabled={!studentName.trim() || !safetyApproved}>
                INICIAR SISTEMA DE MEZCLA
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 2. Main Scientific HUD & Active Lab Board */}
      {isAuthorized && (
        <div className="lab-workspace">
          {/* Top Cybernetic Status Indicator Panel */}
          <header className="workspace-header">
            <div className="hud-metric client-name">
              <span className="label">CIENTÍFICO:</span>
              <span className="value text-glow">{studentName.toUpperCase()}</span>
              <span className="badge">{labRank === 'Apprentice' ? 'APRENDIZ' : labRank === 'Researcher' ? 'INVESTIGADOR' : 'MAD SCIENTIST'}</span>
            </div>

            <div className="hud-metric stats-box">
              <div className="stat-node">
                <span className="label">EXPERIENCIA:</span>
                <span className="value text-gold">{score} EXP</span>
              </div>
              <div className="stat-separator"></div>
              <div className="stat-node">
                <span className="label">INTENTOS:</span>
                <span className="value">{attempts}</span>
              </div>
              <div className="stat-separator"></div>
              <div className="stat-node">
                <span className="label">EFICACIA:</span>
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
                {isMusicOn ? '🔊 MÚSICA' : '🔇 MÚSICA'}
              </button>
              <button 
                onClick={toggleSound} 
                className={`icon-btn ${!isMuted ? 'active-green' : 'inactive-red'}`} 
                title="Sonido SFX"
              >
                {!isMuted ? '🔊 EFECTOS' : '🔇 EFECTOS'}
              </button>
              <button onClick={handleRestart} className="icon-btn danger" title="Reiniciar Partida">
                🔄 REINICIAR
              </button>
            </div>
          </header>

          {/* Center Play Area Grid */}
          <div className="workspace-body">
            {/* Left Hand Reference Board */}
            <aside className="recipe-sidebar">
              <div className="sidebar-section">
                <h3 className="section-title">🧬 FÓRMULAS QUÍMICAS</h3>
                <ul className="recipe-list">
                  <li>
                    <span className="beaker red">🔴</span> + <span className="beaker blue">🔵</span> = <span className="beaker purple">🟣 Violeta</span>
                  </li>
                  <li>
                    <span className="beaker blue">🔵</span> + <span className="beaker yellow">🟡</span> = <span className="beaker green">🟢 Verde</span>
                  </li>
                  <li>
                    <span className="beaker red">🔴</span> + <span className="beaker yellow">🟡</span> = <span className="beaker orange">🟠 Anaranjado</span>
                  </li>
                  <li className="warning-note">
                    ⚠️ Agregar 3 o más componentes produce <span className="beaker gray">🛢️ Lodo Inestable</span>.
                  </li>
                </ul>
              </div>

              <div className="sidebar-section">
                <h3 className="section-title">🎯 OBJETIVOS DE HOY</h3>
                <div className="checklist">
                  <div className={`check-node ${targets.Violeta ? 'solved' : 'pending'}`}>
                    <span className="check-box">{targets.Violeta ? '✅' : '🔬'}</span>
                    <span className="check-label">Matraz Violeta</span>
                  </div>
                  <div className={`check-node ${targets.Verde ? 'solved' : 'pending'}`}>
                    <span className="check-box">{targets.Verde ? '✅' : '🔬'}</span>
                    <span className="check-label">Matraz Verde</span>
                  </div>
                  <div className={`check-node ${targets.Anaranjado ? 'solved' : 'pending'}`}>
                    <span className="check-box">{targets.Anaranjado ? '✅' : '🔬'}</span>
                    <span className="check-label">Matraz Anaranjado</span>
                  </div>
                </div>
              </div>

              <div className="sidebar-section instructions">
                <h3 className="section-title">💡 ¿CÓMO JUGAR?</h3>
                <ol className="inst-list">
                  <li>Arrastra los tubos de color primario a la boca del matraz del científico loco.</li>
                  <li>Mezcla los colores hasta obtener un matraz secundario correcto.</li>
                  <li>Arrastra el matraz mezclado hacia su silueta correspondiente en la derecha.</li>
                  <li>Si fallas o creas lodo, haz clic en <strong>VACIAR</strong> para limpiar el matraz.</li>
                </ol>
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
            <div className="badge-ribbon">⭐</div>
            <h1 className="diploma-title">INFORME CIENTÍFICO APROBADO</h1>
            <p className="diploma-desc">
              Por cuanto el alumno(a) ha completado satisfactoriamente los experimentos químicos de refracción cromática en los laboratorios de Thrumaforge.
            </p>

            <div className="diploma-details">
              <div className="detail-row">
                <span className="lbl">INVESTIGADOR PRINCIPAL:</span>
                <span className="val text-glow">{studentName}</span>
              </div>
              <div className="detail-row">
                <span className="lbl">RANGO ACADÉMICO:</span>
                <span className="val">
                  {labRank === 'Apprentice' ? '⚙️ Alquimista Aprendiz' : labRank === 'Researcher' ? '🔬 Investigador de Colores' : '⚡ Científico Loco'}
                </span>
              </div>
              <div className="detail-row">
                <span className="lbl">PUNTUACIÓN DE EFICIENCIA:</span>
                <span className="val text-gold">{score} PUNTOS EXP</span>
              </div>
              <div className="detail-row">
                <span className="lbl">TOTAL DE MEZCLAS:</span>
                <span className="val">{attempts} INTENTOS</span>
              </div>
              <div className="detail-row">
                <span className="lbl">PRECISIÓN DE COMBINACIÓN:</span>
                <span className="val text-cyan">
                  {attempts > 0 ? Math.round((successes / attempts) * 100) : 100}%
                </span>
              </div>
              <div className="detail-row">
                <span className="lbl">TIEMPO CIENTÍFICO:</span>
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
                VOLVER A COMPROBAR MEZCLAS (NUEVO INTENTO)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
