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
        this.scene.background = new THREE.Color(0xB8D8E8); // Winter sky
        this.scene.fog = new THREE.Fog(0xD0E8F0, 60, 120);

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

        // Lighting - winter atmosphere
        const ambientLight = new THREE.AmbientLight(0xE8F4FF, 0.7);  // Cool blue-white ambient
        this.scene.add(ambientLight);

        // Main sun light (winter sun)
        const sunLight = new THREE.DirectionalLight(0xFFFFF0, 0.9);
        sunLight.position.set(20, 30, 10);
        sunLight.castShadow = true;
        sunLight.shadow.camera.left = -40;
        sunLight.shadow.camera.right = 40;
        sunLight.shadow.camera.top = 40;
        sunLight.shadow.camera.bottom = -40;
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.bias = -0.0001;
        this.scene.add(sunLight);

        // Add a subtle fill light from the opposite side
        const fillLight = new THREE.DirectionalLight(0xB8D8FF, 0.3);
        fillLight.position.set(-15, 15, -10);
        this.scene.add(fillLight);

        // Add a subtle sky light from above
        const skyLight = new THREE.HemisphereLight(0xE0F0FF, 0xC0D8E8, 0.4);
        this.scene.add(skyLight);

        // Resize handler
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    initScene() {
        // Initialize obstacle list for snowball collision
        this.obstacles = [];

        // Create multi-layered ground with different surfaces

        // Base ground layer - snowy field with gradient
        const groundGeometry = new THREE.PlaneGeometry(100, 100, 10, 10);
        const groundVertices = groundGeometry.attributes.position;

        // Add gentle height variations to the ground
        for (let i = 0; i < groundVertices.count; i++) {
            const x = groundVertices.getX(i);
            const z = groundVertices.getY(i);
            const height = Math.sin(x * 0.1) * 0.3 + Math.cos(z * 0.1) * 0.3;
            groundVertices.setZ(i, height);
        }
        groundGeometry.computeVertexNormals();

        const groundMaterial = new THREE.MeshStandardMaterial({
            color: 0xF0F8FF,  // Alice blue - snowy white
            roughness: 0.9,
            metalness: 0.1
        });
        this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
        this.ground.rotation.x = -Math.PI / 2;
        this.ground.receiveShadow = true;
        this.scene.add(this.ground);

        // Add dirt/grass patches for variety
        this.createDirtPatches();

        // Add ice patches (slippery-looking areas)
        this.createIcePatches();

        // Snow patches (where you can roll snowballs) - elevated and visible
        this.snowPatches = [];
        const snowPositions = [
            { x: 5, z: 5 },
            { x: -8, z: 3 },
            { x: 0, z: -10 },
            { x: 12, z: -5 },
            { x: -10, z: -8 },
            { x: 8, z: 12 }
        ];

        // Create snowmen at each position with varying styles
        snowPositions.forEach((pos, index) => {
            this.createSnowman(pos.x, pos.z, index);
            this.snowPatches.push(new THREE.Vector3(pos.x, 0, pos.z));
            // Add snowman as obstacle for snowball collision
            this.obstacles.push({
                position: new THREE.Vector3(pos.x, 0, pos.z),
                radius: 1.5
            });
        });

        // House
        this.createHouse(-15, -15);
        // Add house as obstacle
        this.obstacles.push({
            position: new THREE.Vector3(-15, 0, -15),
            radius: 7
        });

        // Bushes
        const bushPositions = [
            { x: 10, z: 8 },
            { x: -5, z: -5 },
            { x: 15, z: -10 },
            { x: -12, z: 10 }
        ];
        bushPositions.forEach((pos, i) => {
            const color = i % 2 === 0 ? 0x228B22 : 0x2F4F2F;
            this.createBush(pos.x, pos.z, color);
            this.obstacles.push({
                position: new THREE.Vector3(pos.x, 0, pos.z),
                radius: 2
            });
        });

        // Trees
        const treePositions = [
            { x: 18, z: 15 },
            { x: -18, z: 12 },
            { x: 12, z: -18 },
            { x: -15, z: -18 }
        ];
        treePositions.forEach(pos => {
            this.createTree(pos.x, pos.z);
            this.obstacles.push({
                position: new THREE.Vector3(pos.x, 0, pos.z),
                radius: 2
            });
        });

        // Add decorative snow piles around the map
        this.createSnowPiles();

        // Walls (invisible boundaries)
        this.boundaries = [
            { min: new THREE.Vector3(-48, 0, -48), max: new THREE.Vector3(48, 10, 48) }
        ];

        // AI Opponent
        this.createAI();
    }

    createDirtPatches() {
        // Add brown/gray dirt patches for visual variety
        const dirtPositions = [
            { x: -20, z: 10, size: 4 },
            { x: 15, z: 18, size: 3 },
            { x: -5, z: -15, size: 3.5 },
            { x: 18, z: -12, size: 2.5 }
        ];

        dirtPositions.forEach(pos => {
            const geometry = new THREE.CircleGeometry(pos.size, 32);
            const material = new THREE.MeshStandardMaterial({
                color: 0x8B7355,  // Brown-gray dirt
                roughness: 1.0
            });
            const patch = new THREE.Mesh(geometry, material);
            patch.rotation.x = -Math.PI / 2;
            patch.position.set(pos.x, 0.02, pos.z);
            patch.receiveShadow = true;
            this.scene.add(patch);
        });
    }

    createIcePatches() {
        // Add shiny ice patches with gradient effect
        const icePositions = [
            { x: -15, z: 5, size: 3 },
            { x: 10, z: -8, size: 2.5 },
            { x: -8, z: -18, size: 3.5 },
            { x: 20, z: 8, size: 2 }
        ];

        icePositions.forEach(pos => {
            const geometry = new THREE.CircleGeometry(pos.size, 32);
            const material = new THREE.MeshStandardMaterial({
                color: 0xC0E0FF,  // Light blue ice
                roughness: 0.1,
                metalness: 0.6,
                emissive: 0x4080FF,
                emissiveIntensity: 0.05
            });
            const patch = new THREE.Mesh(geometry, material);
            patch.rotation.x = -Math.PI / 2;
            patch.position.set(pos.x, 0.03, pos.z);
            patch.receiveShadow = true;
            this.scene.add(patch);
        });
    }

    createSnowPiles() {
        // Add decorative snow piles scattered around the map
        const pilePositions = [
            { x: -22, z: -5, size: 1 },
            { x: 16, z: 3, size: 0.8 },
            { x: -3, z: 18, size: 1.2 },
            { x: 22, z: -15, size: 0.9 },
            { x: -18, z: 20, size: 1.1 },
            { x: 6, z: -20, size: 0.7 },
            { x: -25, z: -20, size: 1.3 },
            { x: 25, z: 20, size: 1 }
        ];

        pilePositions.forEach(pos => {
            // Main pile
            const pileGeometry = new THREE.SphereGeometry(pos.size, 12, 12);
            const pileMaterial = new THREE.MeshStandardMaterial({
                color: 0xFFFFFF,
                roughness: 0.9
            });
            const pile = new THREE.Mesh(pileGeometry, pileMaterial);
            pile.position.set(pos.x, pos.size * 0.5, pos.z);
            pile.scale.y = 0.6;
            pile.castShadow = true;
            pile.receiveShadow = true;
            this.scene.add(pile);

            // Add some smaller piles around for detail
            for (let i = 0; i < 3; i++) {
                const angle = (i / 3) * Math.PI * 2;
                const radius = pos.size * 1.2;
                const smallPile = new THREE.Mesh(
                    new THREE.SphereGeometry(pos.size * 0.4, 8, 8),
                    pileMaterial
                );
                smallPile.position.set(
                    pos.x + Math.cos(angle) * radius,
                    pos.size * 0.2,
                    pos.z + Math.sin(angle) * radius
                );
                smallPile.scale.y = 0.5;
                this.scene.add(smallPile);
            }
        });
    }

    createSnowman(x, z, index) {
        // Vary the snowman styles based on index
        const styles = [
            { baseSize: 0.8, midSize: 0.6, headSize: 0.4, height: 0 },
            { baseSize: 1.0, midSize: 0.75, headSize: 0.5, height: 0 },
            { baseSize: 0.7, midSize: 0.5, headSize: 0.35, height: 0 },
            { baseSize: 1.1, midSize: 0.85, headSize: 0.6, height: 0 },
            { baseSize: 0.9, midSize: 0.65, headSize: 0.45, height: 0 },
            { baseSize: 0.85, midSize: 0.7, headSize: 0.5, height: 0 }
        ];

        const style = styles[index % styles.length];
        const snowMaterial = new THREE.MeshStandardMaterial({
            color: 0xFFFFFF,
            roughness: 0.9
        });

        // Base snowball
        const baseGeometry = new THREE.SphereGeometry(style.baseSize, 16, 16);
        const base = new THREE.Mesh(baseGeometry, snowMaterial);
        base.position.set(x, style.baseSize, z);
        base.castShadow = true;
        base.receiveShadow = true;
        this.scene.add(base);

        // Middle snowball
        const midGeometry = new THREE.SphereGeometry(style.midSize, 16, 16);
        const mid = new THREE.Mesh(midGeometry, snowMaterial);
        mid.position.set(x, style.baseSize * 2 + style.midSize * 0.8, z);
        mid.castShadow = true;
        mid.receiveShadow = true;
        this.scene.add(mid);

        // Head snowball
        const headGeometry = new THREE.SphereGeometry(style.headSize, 16, 16);
        const head = new THREE.Mesh(headGeometry, snowMaterial);
        head.position.set(x, style.baseSize * 2 + style.midSize * 1.6 + style.headSize * 0.9, z);
        head.castShadow = true;
        head.receiveShadow = true;
        this.scene.add(head);

        // Eyes (coal)
        const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });
        const eyeGeometry = new THREE.SphereGeometry(0.06, 8, 8);

        const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        leftEye.position.set(
            x + style.headSize * 0.3,
            style.baseSize * 2 + style.midSize * 1.6 + style.headSize * 1.1,
            z + style.headSize * 0.8
        );
        this.scene.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        rightEye.position.set(
            x - style.headSize * 0.3,
            style.baseSize * 2 + style.midSize * 1.6 + style.headSize * 1.1,
            z + style.headSize * 0.8
        );
        this.scene.add(rightEye);

        // Carrot nose
        const noseGeometry = new THREE.ConeGeometry(0.08, 0.4, 8);
        const noseMaterial = new THREE.MeshStandardMaterial({ color: 0xFF8C00 });
        const nose = new THREE.Mesh(noseGeometry, noseMaterial);
        nose.position.set(
            x,
            style.baseSize * 2 + style.midSize * 1.6 + style.headSize * 0.9,
            z + style.headSize * 0.9
        );
        nose.rotation.x = Math.PI / 2;
        this.scene.add(nose);

        // Coal buttons on middle section
        for (let i = 0; i < 3; i++) {
            const button = new THREE.Mesh(
                new THREE.SphereGeometry(0.08, 8, 8),
                eyeMaterial
            );
            button.position.set(
                x,
                style.baseSize * 2 + style.midSize * 1.2 - i * style.midSize * 0.4,
                z + style.midSize * 0.9
            );
            this.scene.add(button);
        }

        // Stick arms (different poses)
        const armMaterial = new THREE.MeshStandardMaterial({ color: 0x654321 });
        const armGeometry = new THREE.CylinderGeometry(0.05, 0.05, 1, 8);

        const leftArm = new THREE.Mesh(armGeometry, armMaterial);
        leftArm.position.set(
            x + style.midSize * 0.9,
            style.baseSize * 2 + style.midSize,
            z
        );
        leftArm.rotation.z = -Math.PI / 3 - (index * 0.2);
        leftArm.castShadow = true;
        this.scene.add(leftArm);

        const rightArm = new THREE.Mesh(armGeometry, armMaterial);
        rightArm.position.set(
            x - style.midSize * 0.9,
            style.baseSize * 2 + style.midSize,
            z
        );
        rightArm.rotation.z = Math.PI / 3 + (index * 0.2);
        rightArm.castShadow = true;
        this.scene.add(rightArm);

        // Hat (varies by index)
        if (index % 3 === 0) {
            // Top hat
            const hatBrimGeometry = new THREE.CylinderGeometry(style.headSize * 1.2, style.headSize * 1.2, 0.1, 16);
            const hatMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });
            const hatBrim = new THREE.Mesh(hatBrimGeometry, hatMaterial);
            hatBrim.position.set(x, style.baseSize * 2 + style.midSize * 1.6 + style.headSize * 1.8, z);
            this.scene.add(hatBrim);

            const hatTopGeometry = new THREE.CylinderGeometry(style.headSize * 0.7, style.headSize * 0.7, 0.6, 16);
            const hatTop = new THREE.Mesh(hatTopGeometry, hatMaterial);
            hatTop.position.set(x, style.baseSize * 2 + style.midSize * 1.6 + style.headSize * 1.8 + 0.35, z);
            this.scene.add(hatTop);
        } else if (index % 3 === 1) {
            // Bucket hat
            const bucketGeometry = new THREE.CylinderGeometry(style.headSize * 0.9, style.headSize * 1.1, 0.8, 8);
            const bucketMaterial = new THREE.MeshStandardMaterial({ color: 0x808080 });
            const bucket = new THREE.Mesh(bucketGeometry, bucketMaterial);
            bucket.position.set(x, style.baseSize * 2 + style.midSize * 1.6 + style.headSize * 1.7, z);
            this.scene.add(bucket);
        } else {
            // Santa hat
            const santaHatGeometry = new THREE.ConeGeometry(style.headSize * 0.8, 1, 16);
            const santaHatMaterial = new THREE.MeshStandardMaterial({ color: 0xDC143C });
            const santaHat = new THREE.Mesh(santaHatGeometry, santaHatMaterial);
            santaHat.position.set(x, style.baseSize * 2 + style.midSize * 1.6 + style.headSize * 1.8, z);
            santaHat.rotation.z = 0.3;
            this.scene.add(santaHat);

            const pompomGeometry = new THREE.SphereGeometry(0.15, 8, 8);
            const pompomMaterial = new THREE.MeshStandardMaterial({ color: 0xFFFFFF });
            const pompom = new THREE.Mesh(pompomGeometry, pompomMaterial);
            pompom.position.set(x + 0.3, style.baseSize * 2 + style.midSize * 1.6 + style.headSize * 2.5, z);
            this.scene.add(pompom);
        }
    }

    createHouse(x, z) {
        // Foundation/base
        const foundationGeometry = new THREE.BoxGeometry(8.5, 0.5, 8.5);
        const foundationMaterial = new THREE.MeshStandardMaterial({ color: 0x5A5A5A });
        const foundation = new THREE.Mesh(foundationGeometry, foundationMaterial);
        foundation.position.set(x, 0.25, z);
        foundation.receiveShadow = true;
        this.scene.add(foundation);

        // Main house body
        const houseGeometry = new THREE.BoxGeometry(8, 5, 8);
        const houseMaterial = new THREE.MeshStandardMaterial({
            color: 0x8B4513,
            roughness: 0.8
        });
        const house = new THREE.Mesh(houseGeometry, houseMaterial);
        house.position.set(x, 3, z);
        house.castShadow = true;
        house.receiveShadow = true;
        this.scene.add(house);

        // Roof with snow
        const roofGeometry = new THREE.ConeGeometry(6, 3, 4);
        const roofMaterial = new THREE.MeshStandardMaterial({
            color: 0x8B0000,
            roughness: 0.7
        });
        const roof = new THREE.Mesh(roofGeometry, roofMaterial);
        roof.position.set(x, 7, z);
        roof.rotation.y = Math.PI / 4;
        roof.castShadow = true;
        roof.receiveShadow = true;
        this.scene.add(roof);

        // Snow on roof
        const roofSnowGeometry = new THREE.ConeGeometry(6.2, 0.8, 4);
        const roofSnowMaterial = new THREE.MeshStandardMaterial({
            color: 0xFFFFFF,
            roughness: 0.9
        });
        const roofSnow = new THREE.Mesh(roofSnowGeometry, roofSnowMaterial);
        roofSnow.position.set(x, 8.6, z);
        roofSnow.rotation.y = Math.PI / 4;
        this.scene.add(roofSnow);

        // Door
        const doorGeometry = new THREE.BoxGeometry(1.5, 3, 0.3);
        const doorMaterial = new THREE.MeshStandardMaterial({
            color: 0x654321,
            roughness: 0.9
        });
        const door = new THREE.Mesh(doorGeometry, doorMaterial);
        door.position.set(x, 2, z + 4.1);
        door.castShadow = true;
        this.scene.add(door);

        // Door handle
        const handleGeometry = new THREE.SphereGeometry(0.1, 8, 8);
        const handleMaterial = new THREE.MeshStandardMaterial({
            color: 0xFFD700,
            metalness: 0.8,
            roughness: 0.2
        });
        const handle = new THREE.Mesh(handleGeometry, handleMaterial);
        handle.position.set(x + 0.5, 2, z + 4.2);
        this.scene.add(handle);

        // Windows with frames
        const windowGeometry = new THREE.BoxGeometry(1.2, 1.2, 0.15);
        const windowMaterial = new THREE.MeshStandardMaterial({
            color: 0x87CEEB,
            metalness: 0.5,
            roughness: 0.1,
            emissive: 0x4080A0,
            emissiveIntensity: 0.2
        });

        const window1 = new THREE.Mesh(windowGeometry, windowMaterial);
        window1.position.set(x - 2.5, 3.5, z + 4.05);
        this.scene.add(window1);

        const window2 = new THREE.Mesh(windowGeometry, windowMaterial);
        window2.position.set(x + 2.5, 3.5, z + 4.05);
        this.scene.add(window2);

        // Window frames
        const frameGeometry = new THREE.BoxGeometry(1.3, 1.3, 0.1);
        const frameMaterial = new THREE.MeshStandardMaterial({ color: 0xFFFFFF });

        const frame1 = new THREE.Mesh(frameGeometry, frameMaterial);
        frame1.position.set(x - 2.5, 3.5, z + 4);
        this.scene.add(frame1);

        const frame2 = new THREE.Mesh(frameGeometry, frameMaterial);
        frame2.position.set(x + 2.5, 3.5, z + 4);
        this.scene.add(frame2);

        // Chimney with smoke suggestion
        const chimneyGeometry = new THREE.BoxGeometry(0.8, 2, 0.8);
        const chimneyMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
        const chimney = new THREE.Mesh(chimneyGeometry, chimneyMaterial);
        chimney.position.set(x + 2, 9.5, z - 2);
        chimney.castShadow = true;
        this.scene.add(chimney);

        // Snow drifts around house
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const radius = 4.5 + Math.random() * 0.5;
            const driftGeometry = new THREE.SphereGeometry(0.3 + Math.random() * 0.2, 8, 8);
            const driftMaterial = new THREE.MeshStandardMaterial({ color: 0xFFFFFF });
            const drift = new THREE.Mesh(driftGeometry, driftMaterial);
            drift.position.set(
                x + Math.cos(angle) * radius,
                0.15,
                z + Math.sin(angle) * radius
            );
            drift.scale.y = 0.5;
            this.scene.add(drift);
        }

        // Add collision for house
        this.houseCollision = {
            min: new THREE.Vector3(x - 4.5, 0, z - 4.5),
            max: new THREE.Vector3(x + 4.5, 9, z + 4.5)
        };
    }

    createBush(x, z, color) {
        // Base bush
        const bushGeometry = new THREE.SphereGeometry(1.5, 8, 8);
        const bushMaterial = new THREE.MeshStandardMaterial({
            color: color,
            roughness: 0.9
        });
        const bush = new THREE.Mesh(bushGeometry, bushMaterial);
        bush.position.set(x, 1, z);
        bush.scale.y = 0.8;
        bush.castShadow = true;
        bush.receiveShadow = true;
        this.scene.add(bush);

        // Snow cap on bush
        const snowCapGeometry = new THREE.SphereGeometry(1.6, 8, 8);
        const snowCapMaterial = new THREE.MeshStandardMaterial({
            color: 0xFFFFFF,
            roughness: 0.9
        });
        const snowCap = new THREE.Mesh(snowCapGeometry, snowCapMaterial);
        snowCap.position.set(x, 1.5, z);
        snowCap.scale.set(1, 0.3, 1);
        this.scene.add(snowCap);
    }

    createTree(x, z) {
        // Trunk with texture variation
        const trunkGeometry = new THREE.CylinderGeometry(0.5, 0.7, 5, 8);
        const trunkMaterial = new THREE.MeshStandardMaterial({
            color: 0x6B4423,
            roughness: 1.0
        });
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.set(x, 2.5, z);
        trunk.castShadow = true;
        trunk.receiveShadow = true;
        this.scene.add(trunk);

        // Multi-layer pine foliage (3 tiers)
        const foliageColors = [0x1a5a1a, 0x228B22, 0x2d692d];

        for (let i = 0; i < 3; i++) {
            const foliageGeometry = new THREE.ConeGeometry(2.8 - i * 0.6, 2.5, 8);
            const foliageMaterial = new THREE.MeshStandardMaterial({
                color: foliageColors[i],
                roughness: 0.9
            });
            const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
            foliage.position.set(x, 5.5 + i * 1.5, z);
            foliage.castShadow = true;
            foliage.receiveShadow = true;
            this.scene.add(foliage);

            // Snow on each tier
            const snowGeometry = new THREE.ConeGeometry(2.9 - i * 0.6, 0.3, 8);
            const snowMaterial = new THREE.MeshStandardMaterial({
                color: 0xFFFFFF,
                roughness: 0.9
            });
            const snow = new THREE.Mesh(snowGeometry, snowMaterial);
            snow.position.set(x, 6.6 + i * 1.5, z);
            this.scene.add(snow);
        }

        // Tree top (star point)
        const topGeometry = new THREE.ConeGeometry(0.3, 1, 8);
        const topMaterial = new THREE.MeshStandardMaterial({
            color: 0x1a5a1a
        });
        const top = new THREE.Mesh(topGeometry, topMaterial);
        top.position.set(x, 10, z);
        top.castShadow = true;
        this.scene.add(top);
    }

    createAI() {
        // Create AI as a snowman (enemy snowman)
        this.aiSnowman = new THREE.Group();
        const snowMaterial = new THREE.MeshStandardMaterial({
            color: 0xFFFFFF,
            roughness: 0.9
        });

        // Base snowball
        const baseGeometry = new THREE.SphereGeometry(0.7, 16, 16);
        const base = new THREE.Mesh(baseGeometry, snowMaterial);
        base.position.set(0, 0.7, 0);
        base.castShadow = true;
        base.receiveShadow = true;
        this.aiSnowman.add(base);

        // Middle snowball
        const midGeometry = new THREE.SphereGeometry(0.5, 16, 16);
        const mid = new THREE.Mesh(midGeometry, snowMaterial);
        mid.position.set(0, 1.6, 0);
        mid.castShadow = true;
        mid.receiveShadow = true;
        this.aiSnowman.add(mid);

        // Head snowball
        const headGeometry = new THREE.SphereGeometry(0.35, 16, 16);
        const head = new THREE.Mesh(headGeometry, snowMaterial);
        head.position.set(0, 2.3, 0);
        head.castShadow = true;
        head.receiveShadow = true;
        this.aiSnowman.add(head);

        // Evil red eyes
        const eyeMaterial = new THREE.MeshStandardMaterial({
            color: 0xFF0000,
            emissive: 0xFF0000,
            emissiveIntensity: 0.5
        });
        const eyeGeometry = new THREE.SphereGeometry(0.08, 8, 8);

        const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        leftEye.position.set(0.1, 2.4, 0.3);
        this.aiSnowman.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        rightEye.position.set(-0.1, 2.4, 0.3);
        this.aiSnowman.add(rightEye);

        // Black coal nose
        const noseGeometry = new THREE.ConeGeometry(0.06, 0.3, 8);
        const noseMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });
        const nose = new THREE.Mesh(noseGeometry, noseMaterial);
        nose.position.set(0, 2.3, 0.35);
        nose.rotation.x = Math.PI / 2;
        this.aiSnowman.add(nose);

        // Red scarf
        const scarfGeometry = new THREE.TorusGeometry(0.55, 0.08, 8, 16);
        const scarfMaterial = new THREE.MeshStandardMaterial({ color: 0xFF0000 });
        const scarf = new THREE.Mesh(scarfGeometry, scarfMaterial);
        scarf.position.set(0, 1.4, 0);
        scarf.rotation.x = Math.PI / 2;
        this.aiSnowman.add(scarf);

        // Stick arms
        const armMaterial = new THREE.MeshStandardMaterial({ color: 0x654321 });
        const armGeometry = new THREE.CylinderGeometry(0.04, 0.04, 0.8, 8);

        const leftArm = new THREE.Mesh(armGeometry, armMaterial);
        leftArm.position.set(0.6, 1.6, 0);
        leftArm.rotation.z = -Math.PI / 3;
        leftArm.castShadow = true;
        this.aiSnowman.add(leftArm);

        const rightArm = new THREE.Mesh(armGeometry, armMaterial);
        rightArm.position.set(-0.6, 1.6, 0);
        rightArm.rotation.z = Math.PI / 3;
        rightArm.castShadow = true;
        this.aiSnowman.add(rightArm);

        // Top hat (villain hat)
        const hatBrimGeometry = new THREE.CylinderGeometry(0.45, 0.45, 0.08, 16);
        const hatMaterial = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
        const hatBrim = new THREE.Mesh(hatBrimGeometry, hatMaterial);
        hatBrim.position.set(0, 2.65, 0);
        this.aiSnowman.add(hatBrim);

        const hatTopGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.5, 16);
        const hatTop = new THREE.Mesh(hatTopGeometry, hatMaterial);
        hatTop.position.set(0, 2.95, 0);
        hatTop.castShadow = true;
        this.aiSnowman.add(hatTop);

        this.aiSnowman.position.set(20, 0, 20);
        this.scene.add(this.aiSnowman);

        // Store reference for easy access
        this.ai = this.aiSnowman;

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
            // Removed distracting message
        }
    }

    throwSnowball() {
        if (!this.state.hasSnowball) return;

        this.state.hasSnowball = false;

        // Auto-aim at AI opponent
        const throwPosition = this.playerPosition.clone().add(new THREE.Vector3(0, CONFIG.PLAYER_HEIGHT, 0));
        const aiTargetPos = this.aiState.position.clone().add(new THREE.Vector3(0, 1, 0));
        const direction = aiTargetPos.sub(throwPosition).normalize();

        const snowball = this.createSnowballObject(throwPosition, direction);

        this.snowballs.push(snowball);
        this.updateUI();
        // Removed distracting message
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

        // Movement from joystick (relative to camera direction to AI)
        if (this.joystick.active) {
            // Calculate direction to AI for relative movement
            const dirToAI = new THREE.Vector3(
                this.aiState.position.x - this.playerPosition.x,
                0,
                this.aiState.position.z - this.playerPosition.z
            ).normalize();

            // Forward is towards AI, right is perpendicular
            const forward = dirToAI;
            const right = new THREE.Vector3(-dirToAI.z, 0, dirToAI.x);

            const moveX = this.joystick.currentX / 40;
            const moveZ = -this.joystick.currentY / 40;

            const movement = new THREE.Vector3();
            movement.add(forward.clone().multiplyScalar(moveZ));
            movement.add(right.clone().multiplyScalar(moveX));

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

        // Auto-aim camera at AI opponent
        const aiTargetPosition = new THREE.Vector3(
            this.aiState.position.x,
            this.aiState.position.y + 1,  // Aim at AI center
            this.aiState.position.z
        );
        this.camera.lookAt(aiTargetPosition);

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
                this.ai.position.set(newPosition.x, 0, newPosition.z);
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

    checkSnowballObstacleCollision(snowballPosition) {
        // Check if snowball hits any obstacle
        for (const obstacle of this.obstacles) {
            const dist = new THREE.Vector2(
                snowballPosition.x - obstacle.position.x,
                snowballPosition.z - obstacle.position.z
            ).length();

            if (dist < obstacle.radius) {
                return true;
            }
        }
        return false;
    }

    updateSnowballs(delta) {
        // Update player snowballs
        for (let i = this.snowballs.length - 1; i >= 0; i--) {
            const snowball = this.snowballs[i];

            snowball.mesh.position.add(
                snowball.velocity.clone().multiplyScalar(delta)
            );

            snowball.lifetime -= delta;

            // Check collision with obstacles
            if (this.checkSnowballObstacleCollision(snowball.mesh.position)) {
                this.scene.remove(snowball.mesh);
                this.snowballs.splice(i, 1);
                continue;
            }

            // Check collision with AI
            const distToAI = snowball.mesh.position.distanceTo(this.ai.position);
            if (distToAI < 1) {
                this.state.addPlayerScore();
                // Removed distracting message - score updates in HUD
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

            // Check collision with obstacles
            if (this.checkSnowballObstacleCollision(snowball.mesh.position)) {
                this.scene.remove(snowball.mesh);
                this.aiSnowballs.splice(i, 1);
                continue;
            }

            // Check collision with player
            const distToPlayer = snowball.mesh.position.distanceTo(
                this.playerPosition.clone().add(new THREE.Vector3(0, CONFIG.PLAYER_HEIGHT / 2, 0))
            );
            if (distToPlayer < 1) {
                this.state.addAIScore();
                // Removed distracting message - score updates in HUD
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
        this.ai.position.set(20, 0, 20);
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
