/**
 * HAUNTED GALLERY HEIST
 * A mobile-first stealth heist game built with Phaser 3
 *
 * HOW TO RUN:
 * - Open index.html in a modern browser (Chrome recommended)
 * - Or serve with: python3 -m http.server 8000
 *
 * NETLIFY DEPLOYMENT:
 * - Drag and drop the entire folder to Netlify
 * - No build step required
 * - Game is fully static and runs client-side
 */

// ============================================================================
// CONSTANTS AND CONFIGURATION
// ============================================================================

const GAME_WIDTH = 800;
const GAME_HEIGHT = 1200;
const PLAYER_SPEED = 180;
const ROUND_TIME = 60; // seconds

const LOOT_VALUES = {
    painting: 50,
    statue: 120,
    gem: 250
};

const SPEED_PENALTIES = {
    painting: 0.98,
    statue: 0.85,
    gem: 0.75
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// Check if point is inside a cone (spotlight detection)
function isPointInCone(px, py, coneX, coneY, coneAngle, coneRotation, coneLength) {
    // Calculate angle from cone origin to point
    const dx = px - coneX;
    const dy = py - coneY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > coneLength) return false;

    const angleToPoint = Math.atan2(dy, dx);
    const coneDirRad = Phaser.Math.DegToRad(coneRotation);

    // Normalize angle difference
    let angleDiff = angleToPoint - coneDirRad;
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

    const halfConeAngleRad = Phaser.Math.DegToRad(coneAngle / 2);

    return Math.abs(angleDiff) <= halfConeAngleRad;
}

// Random position not inside walls
function getValidPosition(walls, margin = 50) {
    let attempts = 0;
    while (attempts < 100) {
        const x = margin + Math.random() * (GAME_WIDTH - margin * 2);
        const y = margin + Math.random() * (GAME_HEIGHT - margin * 2);

        let valid = true;
        for (const wall of walls) {
            if (x >= wall.x && x <= wall.x + wall.width &&
                y >= wall.y && y <= wall.y + wall.height) {
                valid = false;
                break;
            }
        }

        if (valid) return { x, y };
        attempts++;
    }
    return { x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 };
}

// ============================================================================
// MAP LAYOUTS
// ============================================================================

const LAYOUTS = [
    // Layout 1: Center room with corridors
    [
        { x: 200, y: 300, width: 400, height: 30 },
        { x: 200, y: 600, width: 400, height: 30 },
        { x: 200, y: 300, width: 30, height: 330 },
        { x: 570, y: 300, width: 30, height: 330 },
        { x: 100, y: 800, width: 600, height: 30 }
    ],
    // Layout 2: Maze-like
    [
        { x: 150, y: 200, width: 200, height: 30 },
        { x: 450, y: 200, width: 200, height: 30 },
        { x: 250, y: 400, width: 300, height: 30 },
        { x: 150, y: 600, width: 200, height: 30 },
        { x: 450, y: 600, width: 200, height: 30 },
        { x: 350, y: 800, width: 30, height: 200 }
    ],
    // Layout 3: Side corridors
    [
        { x: 100, y: 250, width: 30, height: 700 },
        { x: 670, y: 250, width: 30, height: 700 },
        { x: 300, y: 450, width: 200, height: 30 },
        { x: 300, y: 750, width: 200, height: 30 }
    ],
    // Layout 4: Scattered rooms
    [
        { x: 150, y: 300, width: 150, height: 150 },
        { x: 500, y: 300, width: 150, height: 150 },
        { x: 150, y: 700, width: 150, height: 150 },
        { x: 500, y: 700, width: 150, height: 150 },
        { x: 350, y: 500, width: 100, height: 100 }
    ],
    // Layout 5: Long corridor
    [
        { x: 200, y: 200, width: 30, height: 800 },
        { x: 570, y: 200, width: 30, height: 800 },
        { x: 300, y: 450, width: 200, height: 30 },
        { x: 300, y: 750, width: 200, height: 30 }
    ],
    // Layout 6: Central pillar
    [
        { x: 300, y: 400, width: 200, height: 200 },
        { x: 150, y: 250, width: 150, height: 30 },
        { x: 500, y: 250, width: 150, height: 30 },
        { x: 150, y: 850, width: 150, height: 30 },
        { x: 500, y: 850, width: 150, height: 30 }
    ],
    // Layout 7: Diagonal-ish
    [
        { x: 150, y: 200, width: 250, height: 30 },
        { x: 400, y: 400, width: 250, height: 30 },
        { x: 150, y: 600, width: 250, height: 30 },
        { x: 400, y: 800, width: 250, height: 30 }
    ],
    // Layout 8: Open with few obstacles
    [
        { x: 250, y: 350, width: 100, height: 100 },
        { x: 450, y: 550, width: 100, height: 100 },
        { x: 250, y: 750, width: 100, height: 100 },
        { x: 550, y: 350, width: 100, height: 100 }
    ]
];

// ============================================================================
// PLAYER CLASS
// ============================================================================

class Player {
    constructor(scene, x, y) {
        this.scene = scene;

        // Create player sprite using graphics
        const graphics = scene.add.graphics();
        graphics.fillStyle(0x2a2a2a, 1);
        graphics.fillCircle(0, 0, 20);
        graphics.fillStyle(0x000000, 1);
        graphics.fillCircle(0, -5, 6);
        graphics.fillCircle(-8, -5, 6);
        graphics.generateTexture('player', 40, 40);
        graphics.destroy();

        this.sprite = scene.physics.add.sprite(x, y, 'player');
        this.sprite.setCollideWorldBounds(true);

        this.baseSpeed = PLAYER_SPEED;
        this.carriedLoot = null;
        this.spooked = false;
        this.spookedTime = 0;
    }

    update(delta) {
        // Handle spooked debuff
        if (this.spooked) {
            this.spookedTime -= delta;
            if (this.spookedTime <= 0) {
                this.spooked = false;
            }
        }

        // Update carried loot position
        if (this.carriedLoot) {
            this.carriedLoot.sprite.x = this.sprite.x;
            this.carriedLoot.sprite.y = this.sprite.y - 30;
        }
    }

    moveTowards(angle, magnitude) {
        magnitude = Math.min(magnitude, 1);

        let speed = this.baseSpeed;

        // Apply speed penalties
        if (this.carriedLoot) {
            speed *= SPEED_PENALTIES[this.carriedLoot.type];
        }

        if (this.spooked) {
            speed *= 0.6; // 40% reduction when spooked
        }

        const vx = Math.cos(angle) * magnitude * speed;
        const vy = Math.sin(angle) * magnitude * speed;

        this.sprite.setVelocity(vx, vy);
    }

    stop() {
        this.sprite.setVelocity(0, 0);
    }

    pickupLoot(loot) {
        this.carriedLoot = loot;
        loot.sprite.setAlpha(0.7);
        loot.sprite.setScale(0.8);
    }

    dropLoot() {
        if (this.carriedLoot) {
            this.carriedLoot.sprite.setAlpha(1);
            this.carriedLoot.sprite.setScale(1);
            this.carriedLoot.sprite.x = this.sprite.x + (Math.random() - 0.5) * 60;
            this.carriedLoot.sprite.y = this.sprite.y + (Math.random() - 0.5) * 60;
            this.carriedLoot = null;
        }
    }

    applySpooked() {
        this.spooked = true;
        this.spookedTime = 1000; // 1 second
        this.dropLoot();
    }
}

// ============================================================================
// SPOTLIGHT CLASS
// ============================================================================

class Spotlight {
    constructor(scene, x, y, pattern) {
        this.scene = scene;
        this.x = x;
        this.y = y;
        this.coneAngle = 60;
        this.coneLength = 220;
        this.rotation = Math.random() * 360;
        this.pattern = pattern; // 'rotate' or 'sweep'
        this.rotationSpeed = 30 + Math.random() * 20;
        this.sweepRange = 120;
        this.sweepDirection = 1;
        this.initialRotation = this.rotation;
        this.cooldown = 0;

        this.graphics = scene.add.graphics();
    }

    update(delta, timeMultiplier = 1) {
        const dt = delta / 1000;

        // Update cooldown
        if (this.cooldown > 0) {
            this.cooldown -= delta;
        }

        // Update rotation based on pattern
        if (this.pattern === 'rotate') {
            this.rotation += this.rotationSpeed * dt * timeMultiplier;
            if (this.rotation >= 360) this.rotation -= 360;
        } else if (this.pattern === 'sweep') {
            this.rotation += this.rotationSpeed * this.sweepDirection * dt * timeMultiplier;

            const diff = this.rotation - this.initialRotation;
            if (Math.abs(diff) > this.sweepRange / 2) {
                this.sweepDirection *= -1;
                this.rotation = this.initialRotation + (this.sweepRange / 2) * Math.sign(diff);
            }
        }
    }

    draw() {
        this.graphics.clear();

        // Draw spotlight cone
        const startAngle = Phaser.Math.DegToRad(this.rotation - this.coneAngle / 2);
        const endAngle = Phaser.Math.DegToRad(this.rotation + this.coneAngle / 2);

        this.graphics.fillStyle(0xffff00, 0.15);
        this.graphics.beginPath();
        this.graphics.moveTo(this.x, this.y);
        this.graphics.arc(this.x, this.y, this.coneLength, startAngle, endAngle, false);
        this.graphics.closePath();
        this.graphics.fillPath();

        // Draw spotlight source
        this.graphics.fillStyle(0xffff00, 0.8);
        this.graphics.fillCircle(this.x, this.y, 8);
    }

    isPlayerDetected(player) {
        if (this.cooldown > 0) return false;

        return isPointInCone(
            player.sprite.x,
            player.sprite.y,
            this.x,
            this.y,
            this.coneAngle,
            this.rotation,
            this.coneLength
        );
    }

    startCooldown() {
        this.cooldown = 800; // 0.8 second grace period
    }

    destroy() {
        this.graphics.destroy();
    }
}

// ============================================================================
// GHOST CLASS
// ============================================================================

class Ghost {
    constructor(scene, waypoints) {
        this.scene = scene;
        this.waypoints = waypoints;
        this.currentWaypointIndex = 0;
        this.baseSpeed = 100;
        this.speed = this.baseSpeed;
        this.cooldown = 0;

        // Create ghost sprite
        const graphics = scene.add.graphics();
        graphics.fillStyle(0x8888ff, 0.5);
        graphics.fillCircle(0, 0, 18);
        graphics.fillStyle(0xaaaaff, 0.3);
        graphics.fillCircle(0, 0, 25);
        graphics.generateTexture('ghost', 50, 50);
        graphics.destroy();

        const startPos = waypoints[0];
        this.sprite = scene.physics.add.sprite(startPos.x, startPos.y, 'ghost');
        this.sprite.setAlpha(0.7);

        // Trail effect
        this.trail = scene.add.graphics();
    }

    update(delta, timeElapsed) {
        // Update cooldown
        if (this.cooldown > 0) {
            this.cooldown -= delta;
        }

        // Speed increases in last 20 seconds
        if (timeElapsed > 40) {
            this.speed = this.baseSpeed * 1.3;
        } else {
            this.speed = this.baseSpeed;
        }

        // Move towards current waypoint
        const target = this.waypoints[this.currentWaypointIndex];
        const dx = target.x - this.sprite.x;
        const dy = target.y - this.sprite.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 20) {
            this.currentWaypointIndex = (this.currentWaypointIndex + 1) % this.waypoints.length;
        } else {
            const angle = Math.atan2(dy, dx);
            this.sprite.setVelocity(
                Math.cos(angle) * this.speed,
                Math.sin(angle) * this.speed
            );
        }

        // Update trail
        this.trail.clear();
        this.trail.fillStyle(0x8888ff, 0.1);
        this.trail.fillCircle(this.sprite.x, this.sprite.y, 30);
    }

    isCollidingWithPlayer(player) {
        if (this.cooldown > 0) return false;

        const dx = this.sprite.x - player.sprite.x;
        const dy = this.sprite.y - player.sprite.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        return distance < 35;
    }

    startCooldown() {
        this.cooldown = 1000; // 1 second cooldown
    }

    destroy() {
        this.sprite.destroy();
        this.trail.destroy();
    }
}

// ============================================================================
// LOOT CLASS
// ============================================================================

class Loot {
    constructor(scene, x, y, type) {
        this.scene = scene;
        this.type = type;
        this.value = LOOT_VALUES[type];

        // Create loot sprite based on type
        const graphics = scene.add.graphics();

        if (type === 'painting') {
            graphics.fillStyle(0xd4af37, 1);
            graphics.fillRect(-20, -25, 40, 50);
            graphics.fillStyle(0x8b7355, 1);
            graphics.fillRect(-22, -27, 44, 5);
            graphics.generateTexture('loot_painting', 50, 60);
        } else if (type === 'statue') {
            graphics.fillStyle(0xc0c0c0, 1);
            graphics.fillRect(-12, -30, 24, 50);
            graphics.fillRect(-18, 20, 36, 10);
            graphics.generateTexture('loot_statue', 50, 60);
        } else if (type === 'gem') {
            graphics.fillStyle(0xff00ff, 1);
            graphics.fillRect(-15, -15, 30, 30);
            graphics.fillStyle(0xff88ff, 0.6);
            graphics.fillCircle(0, 0, 12);
            graphics.generateTexture('loot_gem', 50, 50);
        }

        graphics.destroy();

        this.sprite = scene.add.sprite(x, y, `loot_${type}`);
        this.sprite.setScale(0.8);
    }

    destroy() {
        this.sprite.destroy();
    }
}

// ============================================================================
// GAME SCENE
// ============================================================================

class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    create() {
        // Initialize game state
        this.setupGameState();

        // Create world
        this.createWorld();

        // Create player
        this.player = new Player(this, 100, GAME_HEIGHT - 150);

        // Setup input
        this.setupInput();

        // Create loot
        this.createLoot();

        // Create threats
        this.createSpotlights();
        this.createGhosts();

        // Create UI
        this.createUI();

        // Setup collisions
        this.setupCollisions();

        // Show start overlay
        this.showStartOverlay();
    }

    setupGameState() {
        this.gameStarted = false;
        this.timeRemaining = ROUND_TIME * 1000;
        this.score = 0;
        this.multiplier = 1.0;
        this.perfectStealth = true;
        this.currentExtractionStreak = 0;
        this.totalExtractions = 0;

        // Select random layout
        this.currentLayout = Phaser.Utils.Array.GetRandom(LAYOUTS);
    }

    createWorld() {
        // Background
        this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x1a1a2e).setOrigin(0);

        // Vignette effect
        const vignette = this.add.graphics();
        vignette.fillStyle(0x000000, 0);
        for (let i = 0; i < 5; i++) {
            const alpha = i * 0.08;
            const size = i * 80;
            vignette.fillStyle(0x000000, alpha);
            vignette.fillRect(0, 0, GAME_WIDTH, size);
            vignette.fillRect(0, GAME_HEIGHT - size, GAME_WIDTH, size);
            vignette.fillRect(0, 0, size, GAME_HEIGHT);
            vignette.fillRect(GAME_WIDTH - size, 0, size, GAME_HEIGHT);
        }

        // Create walls
        this.walls = this.physics.add.staticGroup();
        for (const wallData of this.currentLayout) {
            const wall = this.add.rectangle(
                wallData.x + wallData.width / 2,
                wallData.y + wallData.height / 2,
                wallData.width,
                wallData.height,
                0x4a4a4a
            );
            this.walls.add(wall);
            this.physics.add.existing(wall, true);
        }

        // Create van exit zone (bottom-left)
        this.vanZone = this.add.rectangle(80, GAME_HEIGHT - 80, 120, 120, 0x00ff00, 0.3);
        this.physics.add.existing(this.vanZone, true);

        // Van label
        this.add.text(80, GAME_HEIGHT - 80, 'VAN\nEXIT', {
            fontSize: '16px',
            fill: '#00ff00',
            align: 'center',
            fontStyle: 'bold'
        }).setOrigin(0.5);
    }

    setupInput() {
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.isDragging = false;

        this.input.on('pointerdown', (pointer) => {
            if (!this.gameStarted) return;
            this.dragStartX = pointer.x;
            this.dragStartY = pointer.y;
            this.isDragging = true;
        });

        this.input.on('pointermove', (pointer) => {
            if (!this.gameStarted || !this.isDragging) return;

            const dx = pointer.x - this.dragStartX;
            const dy = pointer.y - this.dragStartY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > 5) {
                const angle = Math.atan2(dy, dx);
                const magnitude = Math.min(distance / 80, 1);
                this.player.moveTowards(angle, magnitude);
            } else {
                this.player.stop();
            }
        });

        this.input.on('pointerup', () => {
            this.isDragging = false;
            this.player.stop();
        });
    }

    createLoot() {
        this.lootItems = [];
        const lootCount = 6 + Math.floor(Math.random() * 5);
        const types = ['painting', 'statue', 'gem'];

        // Ensure at least one gem
        let hasGem = false;

        for (let i = 0; i < lootCount; i++) {
            let type;
            if (i === 0 && Math.random() < 0.7) {
                type = 'gem';
                hasGem = true;
            } else if (!hasGem && i === lootCount - 1) {
                type = 'gem';
                hasGem = true;
            } else {
                type = Phaser.Utils.Array.GetRandom(types);
            }

            const pos = getValidPosition(this.currentLayout, 100);

            // Don't place too close to van
            if (pos.x < 200 && pos.y > GAME_HEIGHT - 300) continue;

            const loot = new Loot(this, pos.x, pos.y, type);
            this.lootItems.push(loot);
        }
    }

    createSpotlights() {
        this.spotlights = [];
        const spotlightCount = 3 + Math.floor(Math.random() * 3);
        const patterns = ['rotate', 'sweep'];

        for (let i = 0; i < spotlightCount; i++) {
            const pos = getValidPosition(this.currentLayout, 150);
            const pattern = Phaser.Utils.Array.GetRandom(patterns);
            const spotlight = new Spotlight(this, pos.x, pos.y, pattern);
            this.spotlights.push(spotlight);
        }
    }

    createGhosts() {
        this.ghosts = [];
        this.ghostSpawnSchedule = [
            { time: 15000, count: 1 },
            { time: 35000, count: 2 }
        ];
        this.ghostsSpawned = 0;

        // Prepare waypoint paths
        this.ghostWaypoints = [
            [
                { x: 200, y: 300 },
                { x: 600, y: 300 },
                { x: 600, y: 700 },
                { x: 200, y: 700 }
            ],
            [
                { x: 150, y: 400 },
                { x: 400, y: 500 },
                { x: 650, y: 400 },
                { x: 400, y: 300 }
            ],
            [
                { x: 300, y: 250 },
                { x: 300, y: 900 },
                { x: 500, y: 900 },
                { x: 500, y: 250 }
            ]
        ];
    }

    spawnGhost() {
        const waypoints = Phaser.Utils.Array.GetRandom(this.ghostWaypoints);
        const ghost = new Ghost(this, waypoints);
        this.ghosts.push(ghost);
    }

    createUI() {
        // Timer
        this.timerText = this.add.text(GAME_WIDTH / 2, 30, '60', {
            fontSize: '48px',
            fill: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Score
        this.scoreText = this.add.text(20, 20, 'Score: 0', {
            fontSize: '24px',
            fill: '#ffffff'
        });

        // Multiplier
        this.multiplierText = this.add.text(20, 55, 'x1.0', {
            fontSize: '20px',
            fill: '#ffff00'
        });

        // Stealth status
        this.stealthText = this.add.text(GAME_WIDTH - 20, 20, 'PERFECT STEALTH', {
            fontSize: '18px',
            fill: '#00ff00'
        }).setOrigin(1, 0);

        // Alert flash (hidden by default)
        this.alertFlash = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xff0000, 0);
    }

    setupCollisions() {
        this.physics.add.collider(this.player.sprite, this.walls);
    }

    showStartOverlay() {
        const overlay = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.8).setOrigin(0);
        overlay.setDepth(1000);

        const title = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 150, 'HAUNTED GALLERY HEIST', {
            fontSize: '42px',
            fill: '#ffffff',
            fontStyle: 'bold',
            align: 'center'
        }).setOrigin(0.5).setDepth(1001);

        const instructions = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 50,
            'Steal loot and bring it to the VAN\n\n' +
            'Avoid spotlights and ghosts\n\n' +
            'Drag anywhere to move\n\n' +
            '60 seconds to score big!', {
            fontSize: '20px',
            fill: '#cccccc',
            align: 'center'
        }).setOrigin(0.5).setDepth(1001);

        const startButton = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 150, 'TAP TO START', {
            fontSize: '32px',
            fill: '#00ff00',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(1001);

        startButton.setInteractive({ useHandCursor: true });
        startButton.on('pointerdown', () => {
            overlay.destroy();
            title.destroy();
            instructions.destroy();
            startButton.destroy();
            this.gameStarted = true;
        });

        // Pulse animation
        this.tweens.add({
            targets: startButton,
            alpha: 0.5,
            duration: 800,
            yoyo: true,
            repeat: -1
        });
    }

    showResultsOverlay() {
        const overlay = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.9).setOrigin(0);
        overlay.setDepth(1000);

        const title = this.add.text(GAME_WIDTH / 2, 150, 'MISSION COMPLETE', {
            fontSize: '40px',
            fill: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(1001);

        // Load stats
        const stats = this.loadStats();
        const wasPerfect = this.perfectStealth;

        // Update stats
        stats.lastScore = this.score;
        if (this.score > stats.bestScore) {
            stats.bestScore = this.score;
        }
        if (wasPerfect && this.score > stats.bestPerfectScore) {
            stats.bestPerfectScore = this.score;
        }
        if (this.currentExtractionStreak > stats.longestStreak) {
            stats.longestStreak = this.currentExtractionStreak;
        }
        stats.last10Scores.unshift(this.score);
        if (stats.last10Scores.length > 10) {
            stats.last10Scores = stats.last10Scores.slice(0, 10);
        }
        this.saveStats(stats);

        // Display results
        const resultsText = this.add.text(GAME_WIDTH / 2, 280,
            `Score: ${this.score}\n\n` +
            `Best Score: ${stats.bestScore}\n\n` +
            `Perfect Stealth: ${wasPerfect ? 'YES!' : 'NO'}\n\n` +
            `Extraction Streak: ${this.currentExtractionStreak}\n\n` +
            `Best Streak: ${stats.longestStreak}`, {
            fontSize: '24px',
            fill: '#ffffff',
            align: 'center'
        }).setOrigin(0.5).setDepth(1001);

        const playAgainButton = this.add.text(GAME_WIDTH / 2, 550, 'PLAY AGAIN', {
            fontSize: '32px',
            fill: '#00ff00',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(1001);

        playAgainButton.setInteractive({ useHandCursor: true });
        playAgainButton.on('pointerdown', () => {
            this.scene.restart();
        });

        const resetButton = this.add.text(GAME_WIDTH / 2, 620, 'Reset Stats', {
            fontSize: '20px',
            fill: '#ff6666'
        }).setOrigin(0.5).setDepth(1001);

        let resetClickCount = 0;
        resetButton.setInteractive({ useHandCursor: true });
        resetButton.on('pointerdown', () => {
            resetClickCount++;
            if (resetClickCount === 1) {
                resetButton.setText('Tap again to confirm');
            } else {
                this.resetStats();
                resultsText.setText('Stats Reset!\n\nTap Play Again to continue');
                resetButton.destroy();
            }
        });
    }

    update(time, delta) {
        if (!this.gameStarted) return;

        // Update timer
        this.timeRemaining -= delta;
        if (this.timeRemaining <= 0) {
            this.timeRemaining = 0;
            this.endRound();
            return;
        }

        const seconds = Math.ceil(this.timeRemaining / 1000);
        this.timerText.setText(seconds.toString());

        if (seconds <= 10) {
            this.timerText.setColor('#ff0000');
        }

        const timeElapsed = (ROUND_TIME * 1000 - this.timeRemaining) / 1000;

        // Update player
        this.player.update(delta);

        // Update and draw spotlights
        const timeMultiplier = timeElapsed > 40 ? 1.3 : 1;
        for (const spotlight of this.spotlights) {
            spotlight.update(delta, timeMultiplier);
            spotlight.draw();

            if (spotlight.isPlayerDetected(this.player)) {
                this.onPlayerSpotted(spotlight);
            }
        }

        // Spawn ghosts based on schedule
        for (const schedule of this.ghostSpawnSchedule) {
            if (timeElapsed * 1000 >= schedule.time && this.ghosts.length < schedule.count) {
                this.spawnGhost();
            }
        }

        // Update ghosts
        for (const ghost of this.ghosts) {
            ghost.update(delta, timeElapsed);

            if (ghost.isCollidingWithPlayer(this.player)) {
                this.onGhostCollision(ghost);
            }
        }

        // Check loot pickup
        if (!this.player.carriedLoot) {
            for (const loot of this.lootItems) {
                const dx = loot.sprite.x - this.player.sprite.x;
                const dy = loot.sprite.y - this.player.sprite.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < 40) {
                    this.player.pickupLoot(loot);
                    break;
                }
            }
        }

        // Check extraction
        if (this.player.carriedLoot) {
            const dx = this.vanZone.x - this.player.sprite.x;
            const dy = this.vanZone.y - this.player.sprite.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < 70) {
                this.extractLoot();
            }
        }

        // Fade alert flash
        if (this.alertFlash.alpha > 0) {
            this.alertFlash.alpha -= delta / 200;
        }
    }

    onPlayerSpotted(spotlight) {
        spotlight.startCooldown();

        // Flash alert
        this.alertFlash.setAlpha(0.4);

        // Update stealth status
        this.perfectStealth = false;
        this.stealthText.setText('ALERTED');
        this.stealthText.setColor('#ff0000');

        // Reset extraction streak
        this.currentExtractionStreak = 0;

        // Penalty to multiplier
        this.multiplier = Math.max(1.0, this.multiplier - 0.5);
        this.updateMultiplierUI();
    }

    onGhostCollision(ghost) {
        ghost.startCooldown();

        // Flash alert
        this.alertFlash.setAlpha(0.5);

        // Apply spooked effect
        this.player.applySpooked();

        // Update stealth status
        this.perfectStealth = false;
        this.stealthText.setText('SPOOKED!');
        this.stealthText.setColor('#ff00ff');

        // Reset extraction streak
        this.currentExtractionStreak = 0;

        // Penalty to multiplier
        this.multiplier = Math.max(1.0, this.multiplier - 0.5);
        this.updateMultiplierUI();

        // Camera shake
        this.cameras.main.shake(200, 0.01);
    }

    extractLoot() {
        const loot = this.player.carriedLoot;
        const baseValue = loot.value;
        const extractionBonus = baseValue * 0.25;
        const totalValue = (baseValue + extractionBonus) * this.multiplier;

        this.score += Math.floor(totalValue);
        this.totalExtractions++;
        this.currentExtractionStreak++;

        // Increase multiplier
        this.multiplier = Math.min(3.0, this.multiplier + 0.15);

        // Remove loot
        const index = this.lootItems.indexOf(loot);
        if (index > -1) {
            this.lootItems.splice(index, 1);
        }
        loot.destroy();
        this.player.carriedLoot = null;

        // Update UI
        this.updateUI();

        // Flash effect
        this.tweens.add({
            targets: this.vanZone,
            alpha: 1,
            duration: 100,
            yoyo: true
        });
    }

    updateUI() {
        this.scoreText.setText(`Score: ${this.score}`);
        this.updateMultiplierUI();
    }

    updateMultiplierUI() {
        this.multiplierText.setText(`x${this.multiplier.toFixed(1)}`);

        if (this.multiplier >= 2.5) {
            this.multiplierText.setColor('#ff00ff');
        } else if (this.multiplier >= 2.0) {
            this.multiplierText.setColor('#ff8800');
        } else if (this.multiplier >= 1.5) {
            this.multiplierText.setColor('#ffff00');
        } else {
            this.multiplierText.setColor('#ffffff');
        }
    }

    endRound() {
        this.gameStarted = false;
        this.player.stop();
        this.showResultsOverlay();
    }

    loadStats() {
        const defaultStats = {
            bestScore: 0,
            bestPerfectScore: 0,
            longestStreak: 0,
            last10Scores: [],
            lastScore: 0
        };

        try {
            const saved = localStorage.getItem('hauntedGalleryStats');
            if (saved) {
                return { ...defaultStats, ...JSON.parse(saved) };
            }
        } catch (e) {
            console.error('Failed to load stats:', e);
        }

        return defaultStats;
    }

    saveStats(stats) {
        try {
            localStorage.setItem('hauntedGalleryStats', JSON.stringify(stats));
        } catch (e) {
            console.error('Failed to save stats:', e);
        }
    }

    resetStats() {
        try {
            localStorage.removeItem('hauntedGalleryStats');
        } catch (e) {
            console.error('Failed to reset stats:', e);
        }
    }
}

// ============================================================================
// BOOT SCENE
// ============================================================================

class BootScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BootScene' });
    }

    preload() {
        // Create loading text
        const loadingText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'Loading...', {
            fontSize: '32px',
            fill: '#ffffff'
        }).setOrigin(0.5);
    }

    create() {
        // Start game scene
        this.scene.start('GameScene');
    }
}

// ============================================================================
// PHASER CONFIGURATION
// ============================================================================

const config = {
    type: Phaser.AUTO,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    parent: 'game-container',
    backgroundColor: '#000000',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    scene: [BootScene, GameScene]
};

// Start the game
const game = new Phaser.Game(config);
