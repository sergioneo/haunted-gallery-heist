/**
 * SNOWBALL SHOWDOWN 3D
 * A first-person 3D snowball shooter game using Three.js
 *
 * DEPLOYMENT:
 * - Static site, works on Netlify with drag & drop
 * - No build step required
 */

// ============================================================================
// GAME CONFIGURATION
// ============================================================================

const CONFIG = {
    PLAYER_SPEED: 5,
    PLAYER_HEIGHT: 1.6,
    CAMERA_SENSITIVITY: 0.002,
    SNOWBALL_SPEED: 15,
    SNOWBALL_SIZE: 0.3,
    AI_SPEED: 3,
    AI_REACTION_TIME: 1500,
    AI_SHOOT_INTERVAL: 3000,
    SNOW_PATCH_DISTANCE: 3,
    WIN_SCORE: 10
};

// ============================================================================
// GAME STATE
// ============================================================================

class GameState {
    constructor() {
        this.reset();
    }

    reset() {
        this.playerScore = 0;
        this.aiScore = 0;
        this.hasSnowball = false;
        this.gameStarted = false;
        this.gameOver = false;
        this.nearSnow = false;
    }

    addPlayerScore() {
        this.playerScore++;
        this.checkWin();
    }

    addAIScore() {
        this.aiScore++;
        this.checkWin();
    }

    checkWin() {
        if (this.playerScore >= CONFIG.WIN_SCORE) {
            this.gameOver = true;
            return 'player';
        }
        if (this.aiScore >= CONFIG.WIN_SCORE) {
            this.gameOver = true;
            return 'ai';
        }
        return null;
    }
}

// ============================================================================
// MAIN GAME CLASS
// ============================================================================

class SnowballGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.state = new GameState();

        this.initThree();
        this.initScene();
        this.initControls();
        this.initUI();

        this.clock = new THREE.Clock();
        this.snowballs = [];
        this.aiSnowballs = [];

        this.animate();
    }

    initThree() {
        // Renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB); // Sky blue
        this.scene.fog = new THREE.Fog(0x87CEEB, 50, 100);

        // Camera (First Person)
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.camera.position.set(0, CONFIG.PLAYER_HEIGHT, 0);

        // Player position (camera follows this)
        this.playerPosition = new THREE.Vector3(0, 0, 0);
        this.cameraRotation = { yaw: 0, pitch: 0 };

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const sunLight = new THREE.DirectionalLight(0xffffee, 0.8);
        sunLight.position.set(20, 30, 10);
        sunLight.castShadow = true;
        sunLight.shadow.camera.left = -40;
        sunLight.shadow.camera.right = 40;
        sunLight.shadow.camera.top = 40;
        sunLight.shadow.camera.bottom = -40;
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        this.scene.add(sunLight);

        // Resize handler
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    initScene() {
        // Ground
        const groundGeometry = new THREE.PlaneGeometry(100, 100);
        const groundMaterial = new THREE.MeshStandardMaterial({
            color: 0x90EE90,
            roughness: 0.8
        });
        this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
        this.ground.rotation.x = -Math.PI / 2;
        this.ground.receiveShadow = true;
        this.scene.add(this.ground);

        // Snow patches (where you can roll snowballs)
        this.snowPatches = [];
        const snowPositions = [
            { x: 5, z: 5 },
            { x: -8, z: 3 },
            { x: 0, z: -10 },
            { x: 12, z: -5 },
            { x: -10, z: -8 },
            { x: 8, z: 12 }
        ];

        snowPositions.forEach(pos => {
            const snowGeometry = new THREE.CircleGeometry(2.5, 32);
            const snowMaterial = new THREE.MeshStandardMaterial({
                color: 0xFFFFFF,
                roughness: 0.9
            });
            const snow = new THREE.Mesh(snowGeometry, snowMaterial);
            snow.rotation.x = -Math.PI / 2;
            snow.position.set(pos.x, 0.01, pos.z);
            snow.receiveShadow = true;
            this.scene.add(snow);
            this.snowPatches.push(new THREE.Vector3(pos.x, 0, pos.z));
        });

        // House
        this.createHouse(-15, -15);

        // Bushes
        this.createBush(10, 8, 0x228B22);
        this.createBush(-5, -5, 0x2F4F2F);
        this.createBush(15, -10, 0x228B22);
        this.createBush(-12, 10, 0x2F4F2F);

        // Trees
        this.createTree(18, 15);
        this.createTree(-18, 12);
        this.createTree(12, -18);
        this.createTree(-15, -18);

        // Walls (invisible boundaries)
        this.boundaries = [
            { min: new THREE.Vector3(-48, 0, -48), max: new THREE.Vector3(48, 10, 48) }
        ];

        // AI Opponent
        this.createAI();
    }

    createHouse(x, z) {
        // Main house body
        const houseGeometry = new THREE.BoxGeometry(8, 5, 8);
        const houseMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
        const house = new THREE.Mesh(houseGeometry, houseMaterial);
        house.position.set(x, 2.5, z);
        house.castShadow = true;
        house.receiveShadow = true;
        this.scene.add(house);

        // Roof
        const roofGeometry = new THREE.ConeGeometry(6, 3, 4);
        const roofMaterial = new THREE.MeshStandardMaterial({ color: 0x8B0000 });
        const roof = new THREE.Mesh(roofGeometry, roofMaterial);
        roof.position.set(x, 6.5, z);
        roof.rotation.y = Math.PI / 4;
        roof.castShadow = true;
        this.scene.add(roof);

        // Door
        const doorGeometry = new THREE.BoxGeometry(1.5, 3, 0.2);
        const doorMaterial = new THREE.MeshStandardMaterial({ color: 0x654321 });
        const door = new THREE.Mesh(doorGeometry, doorMaterial);
        door.position.set(x, 1.5, z + 4);
        this.scene.add(door);

        // Windows
        const windowGeometry = new THREE.BoxGeometry(1.2, 1.2, 0.2);
        const windowMaterial = new THREE.MeshStandardMaterial({ color: 0x87CEEB });

        const window1 = new THREE.Mesh(windowGeometry, windowMaterial);
        window1.position.set(x - 2.5, 3, z + 4);
        this.scene.add(window1);

        const window2 = new THREE.Mesh(windowGeometry, windowMaterial);
        window2.position.set(x + 2.5, 3, z + 4);
        this.scene.add(window2);

        // Add collision for house
        this.houseCollision = {
            min: new THREE.Vector3(x - 4, 0, z - 4),
            max: new THREE.Vector3(x + 4, 5, z + 4)
        };
    }

    createBush(x, z, color) {
        const bushGeometry = new THREE.SphereGeometry(1.5, 8, 8);
        const bushMaterial = new THREE.MeshStandardMaterial({
            color: color,
            roughness: 0.9
        });
        const bush = new THREE.Mesh(bushGeometry, bushMaterial);
        bush.position.set(x, 1, z);
        bush.scale.y = 0.8;
        bush.castShadow = true;
        this.scene.add(bush);
    }

    createTree(x, z) {
        // Trunk
        const trunkGeometry = new THREE.CylinderGeometry(0.5, 0.6, 4, 8);
        const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.set(x, 2, z);
        trunk.castShadow = true;
        this.scene.add(trunk);

        // Foliage
        const foliageGeometry = new THREE.ConeGeometry(2.5, 5, 8);
        const foliageMaterial = new THREE.MeshStandardMaterial({ color: 0x228B22 });
        const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
        foliage.position.set(x, 6, z);
        foliage.castShadow = true;
        this.scene.add(foliage);
    }

    createAI() {
        // AI body (simple character representation)
        const aiGeometry = new THREE.CapsuleGeometry(0.5, 1, 8, 16);
        const aiMaterial = new THREE.MeshStandardMaterial({ color: 0xFF4444 });
        this.ai = new THREE.Mesh(aiGeometry, aiMaterial);
        this.ai.position.set(20, 1, 20);
        this.ai.castShadow = true;
        this.scene.add(this.ai);

        // AI state
        this.aiState = {
            position: new THREE.Vector3(20, 0, 20),
            hasSnowball: false,
            targetSnowPatch: null,
            lastShot: 0,
            moveDirection: new THREE.Vector3()
        };
    }

    initControls() {
        // Joystick
        this.joystick = {
            active: false,
            startX: 0,
            startY: 0,
            currentX: 0,
            currentY: 0
        };

        const joystickContainer = document.getElementById('joystick-container');
        const joystickStick = document.getElementById('joystick-stick');

        joystickContainer.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const rect = joystickContainer.getBoundingClientRect();
            this.joystick.active = true;
            this.joystick.startX = rect.left + rect.width / 2;
            this.joystick.startY = rect.top + rect.height / 2;
        });

        joystickContainer.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (!this.joystick.active) return;

            const touch = e.touches[0];
            const deltaX = touch.clientX - this.joystick.startX;
            const deltaY = touch.clientY - this.joystick.startY;

            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            const maxDistance = 40;

            if (distance > maxDistance) {
                const angle = Math.atan2(deltaY, deltaX);
                this.joystick.currentX = Math.cos(angle) * maxDistance;
                this.joystick.currentY = Math.sin(angle) * maxDistance;
            } else {
                this.joystick.currentX = deltaX;
                this.joystick.currentY = deltaY;
            }

            joystickStick.style.transform = `translate(calc(-50% + ${this.joystick.currentX}px), calc(-50% + ${this.joystick.currentY}px))`;
        });

        const endJoystick = () => {
            this.joystick.active = false;
            this.joystick.currentX = 0;
            this.joystick.currentY = 0;
            joystickStick.style.transform = 'translate(-50%, -50%)';
        };

        joystickContainer.addEventListener('touchend', endJoystick);
        joystickContainer.addEventListener('touchcancel', endJoystick);

        // Camera control (drag to look)
        this.lookControl = {
            active: false,
            lastX: 0,
            lastY: 0
        };

        this.canvas.addEventListener('touchstart', (e) => {
            // Only use touches outside joystick area for camera control
            const touch = e.touches[0];
            const rect = joystickContainer.getBoundingClientRect();

            if (touch.clientX < rect.right || touch.clientY < rect.top) {
                this.lookControl.active = true;
                this.lookControl.lastX = touch.clientX;
                this.lookControl.lastY = touch.clientY;
            }
        });

        this.canvas.addEventListener('touchmove', (e) => {
            if (!this.lookControl.active) return;

            const touch = e.touches[0];
            const deltaX = touch.clientX - this.lookControl.lastX;
            const deltaY = touch.clientY - this.lookControl.lastY;

            this.cameraRotation.yaw -= deltaX * CONFIG.CAMERA_SENSITIVITY;
            this.cameraRotation.pitch -= deltaY * CONFIG.CAMERA_SENSITIVITY;

            // Clamp pitch
            this.cameraRotation.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.cameraRotation.pitch));

            this.lookControl.lastX = touch.clientX;
            this.lookControl.lastY = touch.clientY;
        });

        this.canvas.addEventListener('touchend', () => {
            this.lookControl.active = false;
        });

        // Action buttons
        document.getElementById('roll-btn').addEventListener('click', () => {
            this.rollSnowball();
        });

        document.getElementById('throw-btn').addEventListener('click', () => {
            this.throwSnowball();
        });
    }

    initUI() {
        // Start button
        document.getElementById('start-btn').addEventListener('click', () => {
            document.getElementById('start-screen').classList.add('hidden');
            this.state.gameStarted = true;
        });

        // Restart button
        document.getElementById('restart-btn').addEventListener('click', () => {
            this.restart();
        });

        this.updateUI();
    }

    updateUI() {
        document.getElementById('player-score').textContent = this.state.playerScore;
        document.getElementById('ai-score').textContent = this.state.aiScore;

        // Snowball status
        const statusEl = document.getElementById('snowball-status');
        if (this.state.hasSnowball) {
            statusEl.textContent = '❄️ Snowball Ready!';
            statusEl.style.background = 'rgba(79, 195, 247, 0.8)';
        } else if (this.state.nearSnow) {
            statusEl.textContent = '⚪ Near Snow - Roll a Snowball!';
            statusEl.style.background = 'rgba(255, 255, 255, 0.6)';
        } else {
            statusEl.textContent = 'Find Snow Patches';
            statusEl.style.background = 'rgba(0, 0, 0, 0.5)';
        }

        // Button states
        const rollBtn = document.getElementById('roll-btn');
        const throwBtn = document.getElementById('throw-btn');

        rollBtn.disabled = !this.state.nearSnow || this.state.hasSnowball;
        throwBtn.disabled = !this.state.hasSnowball;
    }

    rollSnowball() {
        if (this.state.nearSnow && !this.state.hasSnowball) {
            this.state.hasSnowball = true;
            this.updateUI();
            this.showMessage('Snowball Rolled! ❄️');
        }
    }

    throwSnowball() {
        if (!this.state.hasSnowball) return;

        this.state.hasSnowball = false;

        // Create snowball
        const direction = new THREE.Vector3(
            -Math.sin(this.cameraRotation.yaw) * Math.cos(this.cameraRotation.pitch),
            Math.sin(this.cameraRotation.pitch),
            -Math.cos(this.cameraRotation.yaw) * Math.cos(this.cameraRotation.pitch)
        );

        const snowball = this.createSnowballObject(
            this.playerPosition.clone().add(new THREE.Vector3(0, CONFIG.PLAYER_HEIGHT, 0)),
            direction
        );

        this.snowballs.push(snowball);
        this.updateUI();
        this.showMessage('Throw! 💨');
    }

    createSnowballObject(position, direction) {
        const geometry = new THREE.SphereGeometry(CONFIG.SNOWBALL_SIZE, 16, 16);
        const material = new THREE.MeshStandardMaterial({
            color: 0xFFFFFF,
            roughness: 0.8
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(position);
        mesh.castShadow = true;
        this.scene.add(mesh);

        return {
            mesh: mesh,
            velocity: direction.multiplyScalar(CONFIG.SNOWBALL_SPEED),
            lifetime: 5
        };
    }

    updatePlayer(delta) {
        if (!this.state.gameStarted || this.state.gameOver) return;

        // Movement from joystick
        if (this.joystick.active) {
            const forward = new THREE.Vector3(
                -Math.sin(this.cameraRotation.yaw),
                0,
                -Math.cos(this.cameraRotation.yaw)
            );

            const right = new THREE.Vector3(
                Math.cos(this.cameraRotation.yaw),
                0,
                -Math.sin(this.cameraRotation.yaw)
            );

            const moveX = this.joystick.currentX / 40;
            const moveZ = -this.joystick.currentY / 40;

            const movement = new THREE.Vector3();
            movement.add(forward.multiplyScalar(moveZ));
            movement.add(right.multiplyScalar(moveX));

            if (movement.length() > 0) {
                movement.normalize();
                const newPosition = this.playerPosition.clone().add(
                    movement.multiplyScalar(CONFIG.PLAYER_SPEED * delta)
                );

                // Check collisions
                if (!this.checkCollision(newPosition)) {
                    this.playerPosition.copy(newPosition);
                }
            }
        }

        // Update camera position
        this.camera.position.set(
            this.playerPosition.x,
            this.playerPosition.y + CONFIG.PLAYER_HEIGHT,
            this.playerPosition.z
        );

        // Update camera rotation
        this.camera.rotation.order = 'YXZ';
        this.camera.rotation.y = this.cameraRotation.yaw;
        this.camera.rotation.x = this.cameraRotation.pitch;

        // Check if near snow
        this.state.nearSnow = false;
        for (const snowPatch of this.snowPatches) {
            const distance = this.playerPosition.distanceTo(snowPatch);
            if (distance < CONFIG.SNOW_PATCH_DISTANCE) {
                this.state.nearSnow = true;
                break;
            }
        }

        this.updateUI();
    }

    checkCollision(position) {
        // Check house collision
        if (this.houseCollision) {
            if (position.x > this.houseCollision.min.x && position.x < this.houseCollision.max.x &&
                position.z > this.houseCollision.min.z && position.z < this.houseCollision.max.z) {
                return true;
            }
        }

        // Check boundaries
        if (position.x < -45 || position.x > 45 || position.z < -45 || position.z > 45) {
            return true;
        }

        return false;
    }

    updateAI(delta) {
        if (!this.state.gameStarted || this.state.gameOver) return;

        const currentTime = Date.now();

        // AI behavior: Get snowball if doesn't have one
        if (!this.aiState.hasSnowball) {
            if (!this.aiState.targetSnowPatch) {
                // Find nearest snow patch
                let nearest = null;
                let minDist = Infinity;
                for (const patch of this.snowPatches) {
                    const dist = this.aiState.position.distanceTo(patch);
                    if (dist < minDist) {
                        minDist = dist;
                        nearest = patch;
                    }
                }
                this.aiState.targetSnowPatch = nearest;
            }

            // Move towards snow patch
            if (this.aiState.targetSnowPatch) {
                const direction = this.aiState.targetSnowPatch.clone()
                    .sub(this.aiState.position)
                    .normalize();

                const newPosition = this.aiState.position.clone().add(
                    direction.multiplyScalar(CONFIG.AI_SPEED * delta)
                );

                this.aiState.position.copy(newPosition);
                this.ai.position.set(newPosition.x, 1, newPosition.z);

                // Check if reached snow
                const distance = this.aiState.position.distanceTo(this.aiState.targetSnowPatch);
                if (distance < CONFIG.SNOW_PATCH_DISTANCE) {
                    this.aiState.hasSnowball = true;
                    this.aiState.targetSnowPatch = null;
                }
            }
        } else {
            // Has snowball - shoot at player
            if (currentTime - this.aiState.lastShot > CONFIG.AI_SHOOT_INTERVAL) {
                this.aiShoot();
                this.aiState.lastShot = currentTime;
            }

            // Move randomly while shooting
            if (Math.random() < 0.02) {
                this.aiState.moveDirection = new THREE.Vector3(
                    (Math.random() - 0.5) * 2,
                    0,
                    (Math.random() - 0.5) * 2
                ).normalize();
            }

            const newPosition = this.aiState.position.clone().add(
                this.aiState.moveDirection.clone().multiplyScalar(CONFIG.AI_SPEED * 0.5 * delta)
            );

            if (!this.checkCollision(newPosition)) {
                this.aiState.position.copy(newPosition);
                this.ai.position.set(newPosition.x, 1, newPosition.z);
            }
        }
    }

    aiShoot() {
        if (!this.aiState.hasSnowball) return;

        this.aiState.hasSnowball = false;

        // Calculate direction to player (with some randomness)
        const direction = this.playerPosition.clone()
            .sub(this.aiState.position)
            .normalize();

        // Add some inaccuracy
        direction.x += (Math.random() - 0.5) * 0.3;
        direction.z += (Math.random() - 0.5) * 0.3;
        direction.normalize();

        const snowball = this.createSnowballObject(
            this.aiState.position.clone().add(new THREE.Vector3(0, 1.5, 0)),
            direction
        );

        this.aiSnowballs.push(snowball);
    }

    updateSnowballs(delta) {
        // Update player snowballs
        for (let i = this.snowballs.length - 1; i >= 0; i--) {
            const snowball = this.snowballs[i];

            snowball.mesh.position.add(
                snowball.velocity.clone().multiplyScalar(delta)
            );

            snowball.lifetime -= delta;

            // Check collision with AI
            const distToAI = snowball.mesh.position.distanceTo(this.ai.position);
            if (distToAI < 1) {
                this.state.addPlayerScore();
                this.showMessage('HIT! 🎯 +1');
                this.scene.remove(snowball.mesh);
                this.snowballs.splice(i, 1);
                this.updateUI();

                const winner = this.state.checkWin();
                if (winner) this.endGame(winner);
                continue;
            }

            // Remove if lifetime expired or out of bounds
            if (snowball.lifetime <= 0 || Math.abs(snowball.mesh.position.x) > 50 ||
                Math.abs(snowball.mesh.position.z) > 50 || snowball.mesh.position.y < 0) {
                this.scene.remove(snowball.mesh);
                this.snowballs.splice(i, 1);
            }
        }

        // Update AI snowballs
        for (let i = this.aiSnowballs.length - 1; i >= 0; i--) {
            const snowball = this.aiSnowballs[i];

            snowball.mesh.position.add(
                snowball.velocity.clone().multiplyScalar(delta)
            );

            snowball.lifetime -= delta;

            // Check collision with player
            const distToPlayer = snowball.mesh.position.distanceTo(
                this.playerPosition.clone().add(new THREE.Vector3(0, CONFIG.PLAYER_HEIGHT / 2, 0))
            );
            if (distToPlayer < 1) {
                this.state.addAIScore();
                this.showMessage('YOU GOT HIT! 💥');
                this.scene.remove(snowball.mesh);
                this.aiSnowballs.splice(i, 1);
                this.updateUI();

                const winner = this.state.checkWin();
                if (winner) this.endGame(winner);
                continue;
            }

            // Remove if lifetime expired or out of bounds
            if (snowball.lifetime <= 0 || Math.abs(snowball.mesh.position.x) > 50 ||
                Math.abs(snowball.mesh.position.z) > 50 || snowball.mesh.position.y < 0) {
                this.scene.remove(snowball.mesh);
                this.aiSnowballs.splice(i, 1);
            }
        }
    }

    showMessage(text) {
        const messageEl = document.getElementById('hit-message');
        messageEl.textContent = text;
        messageEl.classList.add('show');

        setTimeout(() => {
            messageEl.classList.remove('show');
        }, 1500);
    }

    endGame(winner) {
        this.state.gameOver = true;

        const gameOverScreen = document.getElementById('game-over-screen');
        const title = document.getElementById('game-over-title');
        const finalScore = document.getElementById('final-score');

        if (winner === 'player') {
            title.textContent = '🎉 YOU WIN! 🎉';
            title.style.color = '#4FC3F7';
        } else {
            title.textContent = '💀 AI WINS! 💀';
            title.style.color = '#FF4444';
        }

        finalScore.textContent = `Final Score: ${this.state.playerScore} - ${this.state.aiScore}`;
        gameOverScreen.classList.remove('hidden');
    }

    restart() {
        // Hide game over screen
        document.getElementById('game-over-screen').classList.add('hidden');

        // Reset state
        this.state.reset();
        this.state.gameStarted = true;

        // Reset player
        this.playerPosition.set(0, 0, 0);
        this.cameraRotation.yaw = 0;
        this.cameraRotation.pitch = 0;

        // Reset AI
        this.aiState.position.set(20, 0, 20);
        this.ai.position.set(20, 1, 20);
        this.aiState.hasSnowball = false;
        this.aiState.targetSnowPatch = null;
        this.aiState.lastShot = 0;

        // Clear snowballs
        for (const snowball of this.snowballs) {
            this.scene.remove(snowball.mesh);
        }
        for (const snowball of this.aiSnowballs) {
            this.scene.remove(snowball.mesh);
        }
        this.snowballs = [];
        this.aiSnowballs = [];

        this.updateUI();
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        const delta = this.clock.getDelta();

        if (this.state.gameStarted && !this.state.gameOver) {
            this.updatePlayer(delta);
            this.updateAI(delta);
            this.updateSnowballs(delta);
        }

        this.renderer.render(this.scene, this.camera);
    }
}

// ============================================================================
// START GAME
// ============================================================================

window.addEventListener('DOMContentLoaded', () => {
    new SnowballGame();
});
