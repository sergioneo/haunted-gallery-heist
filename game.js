/**
 * SNOWBALL SHOWDOWN 3D
 * A first-person 3D snowball shooter game using Three.js
 *
 * DEPLOYMENT:
 * - Static site, works on Netlify with drag & drop
 * - Supports both AI and Online Multiplayer modes
 * - See FIREBASE_SETUP.md for online multiplayer setup
 */

// ============================================================================
// FIREBASE CONFIGURATION
// ============================================================================

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyCN5d3PF28l7asUv-K_-HKLxO5y4_vk9wU",
    authDomain: "snowball-7fede.firebaseapp.com",
    databaseURL: "https://snowball-7fede-default-rtdb.firebaseio.com",
    projectId: "snowball-7fede",
    storageBucket: "snowball-7fede.firebasestorage.app",
    messagingSenderId: "487418056506",
    appId: "1:487418056506:web:25bdd59df6a1b1e86d8a03",
    measurementId: "G-SMMZTKS0QN"
};

// Initialize Firebase
let database = null;
let firebaseInitialized = false;

function initFirebase() {
    try {
        if (typeof firebase === 'undefined') {
            console.warn("Firebase SDK not loaded");
            return false;
        }

        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        database = firebase.database();
        firebaseInitialized = true;
        console.log("Firebase initialized successfully");
        return true;
    } catch (error) {
        console.error("Firebase initialization error:", error);
        return false;
    }
}

// ============================================================================
// MULTIPLAYER MANAGER
// ============================================================================

class MultiplayerManager {
    constructor() {
        this.roomCode = null;
        this.playerId = this.generatePlayerId();
        this.isHost = false;
        this.opponentId = null;
        this.roomRef = null;
        this.playerRef = null;
        this.connected = false;
    }

    generatePlayerId() {
        return 'player_' + Math.random().toString(36).substr(2, 9) + Date.now();
    }

    generateRoomCode() {
        return Math.random().toString(36).substr(2, 6).toUpperCase();
    }

    async createRoom() {
        if (!firebaseInitialized) {
            throw new Error("Firebase not initialized. See FIREBASE_SETUP.md");
        }

        this.roomCode = this.generateRoomCode();
        this.isHost = true;
        this.roomRef = database.ref('rooms/' + this.roomCode);

        const roomData = {
            host: this.playerId,
            players: {
                [this.playerId]: {
                    id: this.playerId,
                    ready: false,
                    score: 0,
                    position: { x: 0, y: 0, z: 0 },
                    hasSnowball: false,
                    connectedAt: Date.now()
                }
            },
            gameState: 'waiting',
            createdAt: Date.now()
        };

        try {
            await this.roomRef.set(roomData);
            this.playerRef = this.roomRef.child('players/' + this.playerId);
            this.connected = true;

            // Auto-remove room after 10 minutes of inactivity
            this.roomRef.onDisconnect().remove();

            return this.roomCode;
        } catch (error) {
            console.error("Error creating room:", error);
            throw error;
        }
    }

    async joinRoom(roomCode) {
        if (!firebaseInitialized) {
            throw new Error("Firebase not initialized. See FIREBASE_SETUP.md");
        }

        this.roomCode = roomCode.toUpperCase();
        this.isHost = false;
        this.roomRef = database.ref('rooms/' + this.roomCode);

        try {
            const snapshot = await this.roomRef.once('value');
            if (!snapshot.exists()) {
                throw new Error("Room not found");
            }

            const roomData = snapshot.val();
            const playerCount = Object.keys(roomData.players || {}).length;

            if (playerCount >= 2) {
                throw new Error("Room is full");
            }

            // Find host player ID
            this.opponentId = roomData.host;

            // Add this player to the room
            this.playerRef = this.roomRef.child('players/' + this.playerId);
            await this.playerRef.set({
                id: this.playerId,
                ready: false,
                score: 0,
                position: { x: 20, y: 0, z: 20 },
                hasSnowball: false,
                connectedAt: Date.now()
            });

            this.playerRef.onDisconnect().remove();
            this.connected = true;

            return this.roomCode;
        } catch (error) {
            console.error("Error joining room:", error);
            throw error;
        }
    }

    onPlayerJoined(callback) {
        if (!this.roomRef) return;

        const playersRef = this.roomRef.child('players');

        // Use 'once' to only fire when player joins, not on every update
        const checkForPlayer = (snapshot) => {
            const players = snapshot.val() || {};
            const playerIds = Object.keys(players);

            if (playerIds.length === 2) {
                this.opponentId = playerIds.find(id => id !== this.playerId);
                callback(this.opponentId);
                // Stop listening after player joined
                playersRef.off('value', checkForPlayer);
            }
        };

        playersRef.on('value', checkForPlayer);
    }

    onOpponentPosition(callback) {
        if (!this.roomRef || !this.opponentId) return;

        const opponentRef = this.roomRef.child('players/' + this.opponentId + '/position');
        opponentRef.on('value', (snapshot) => {
            const position = snapshot.val();
            if (position) {
                callback(position);
            }
        });
    }

    updatePosition(x, y, z) {
        if (!this.playerRef || !this.connected) return;
        this.playerRef.child('position').set({ x, y, z });
    }

    onOpponentSnowball(callback) {
        if (!this.roomRef || !this.opponentId) return;

        const snowballRef = this.roomRef.child('players/' + this.opponentId + '/lastSnowball');
        snowballRef.on('value', (snapshot) => {
            const snowball = snapshot.val();
            if (snowball && snowball.timestamp > (this.lastSnowballTime || 0)) {
                this.lastSnowballTime = snowball.timestamp;
                callback(snowball);
            }
        });
    }

    throwSnowball(position, direction, power) {
        if (!this.playerRef || !this.connected) return;

        this.playerRef.child('lastSnowball').set({
            position: position,
            direction: direction,
            power: power,
            timestamp: Date.now()
        });
    }

    updateScore(score) {
        if (!this.playerRef || !this.connected) return;
        this.playerRef.child('score').set(score);
    }

    onOpponentScore(callback) {
        if (!this.roomRef || !this.opponentId) return;

        const scoreRef = this.roomRef.child('players/' + this.opponentId + '/score');
        scoreRef.on('value', (snapshot) => {
            const score = snapshot.val();
            if (score !== null && score !== undefined) {
                callback(score);
            }
        });
    }

    updateHasSnowball(hasSnowball) {
        if (!this.playerRef || !this.connected) return;
        this.playerRef.child('hasSnowball').set(hasSnowball);
    }

    onOpponentHasSnowball(callback) {
        if (!this.roomRef || !this.opponentId) return;

        const hasSnowballRef = this.roomRef.child('players/' + this.opponentId + '/hasSnowball');
        hasSnowballRef.on('value', (snapshot) => {
            const hasSnowball = snapshot.val();
            if (hasSnowball !== null) {
                callback(hasSnowball);
            }
        });
    }

    setReady() {
        if (!this.playerRef || !this.connected) return;
        this.playerRef.child('ready').set(true);
    }

    onBothReady(callback) {
        if (!this.roomRef) return;

        const playersRef = this.roomRef.child('players');
        playersRef.on('value', (snapshot) => {
            const players = snapshot.val() || {};
            const playerList = Object.values(players);
            const allReady = playerList.every(p => p.ready === true);
            const bothJoined = playerList.length === 2;

            if (allReady && bothJoined) {
                callback();
            }
        });
    }

    onOpponentDisconnect(callback) {
        if (!this.roomRef || !this.opponentId) return;

        const opponentRef = this.roomRef.child('players/' + this.opponentId);
        opponentRef.on('value', (snapshot) => {
            if (!snapshot.exists() && this.opponentId && this.connected) {
                callback();
            }
        });
    }

    async leaveRoom() {
        if (this.playerRef) {
            await this.playerRef.remove();
        }

        if (this.roomRef) {
            this.roomRef.off();
        }

        this.roomCode = null;
        this.opponentId = null;
        this.isHost = false;
        this.connected = false;
    }
}

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
        this.gameMode = null; // 'ai', 'multiplayer', or 'tutorial'
        this.multiplayer = null;
        this.opponent = null;  // For multiplayer mode
        this.positionUpdateThrottle = 0;  // For throttling position updates
        this.tutorialTargets = [];  // Practice targets for tutorial
        this.tutorialHits = 0;  // Track tutorial progress

        this.initThree();
        this.initScene();
        this.initControls();
        this.initUI();
        this.initModeSelection();
        this.createSnowflakes();

        this.clock = new THREE.Clock();
        this.snowballs = [];
        this.aiSnowballs = [];
        this.explosions = [];  // Track active explosions
        this.positionUpdateThrottle = 0;

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

        // Create skybox
        this.createSkybox();

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

    createSkybox() {
        // Create a gradient skybox for winter atmosphere
        const vertexShader = `
            varying vec3 vWorldPosition;
            void main() {
                vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                vWorldPosition = worldPosition.xyz;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `;

        const fragmentShader = `
            varying vec3 vWorldPosition;
            void main() {
                // Create gradient from horizon to sky
                float h = normalize(vWorldPosition).y;

                // Winter sky colors
                vec3 skyTop = vec3(0.4, 0.6, 0.9);      // Bright winter blue
                vec3 skyHorizon = vec3(0.8, 0.9, 1.0);  // Light blue-white

                // Mix based on height
                vec3 skyColor = mix(skyHorizon, skyTop, max(h, 0.0));

                gl_FragColor = vec4(skyColor, 1.0);
            }
        `;

        const skyGeo = new THREE.SphereGeometry(500, 32, 15);
        const skyMat = new THREE.ShaderMaterial({
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            side: THREE.BackSide
        });

        const sky = new THREE.Mesh(skyGeo, skyMat);
        this.scene.add(sky);

        // Add distant mountains with parallax
        this.createMountains();
    }

    createMountains() {
        // Create mountain range in the distance
        const mountainGroup = new THREE.Group();

        // Create multiple mountain layers for parallax
        const layers = [
            { distance: 80, height: 25, color: 0x8899AA, opacity: 0.4 },
            { distance: 100, height: 30, color: 0x99AABB, opacity: 0.3 },
            { distance: 120, height: 35, color: 0xAABBCC, opacity: 0.2 }
        ];

        layers.forEach((layer, layerIndex) => {
            const mountainCount = 8;
            for (let i = 0; i < mountainCount; i++) {
                const angle = (i / mountainCount) * Math.PI * 2;
                const x = Math.cos(angle) * layer.distance;
                const z = Math.sin(angle) * layer.distance;

                // Random mountain shape
                const width = 15 + Math.random() * 10;
                const height = layer.height + Math.random() * 10;

                const mountainGeometry = new THREE.ConeGeometry(width, height, 4);
                const mountainMaterial = new THREE.MeshBasicMaterial({
                    color: layer.color,
                    transparent: true,
                    opacity: layer.opacity,
                    fog: false
                });

                const mountain = new THREE.Mesh(mountainGeometry, mountainMaterial);
                mountain.position.set(x, height / 2, z);
                mountain.rotation.y = Math.random() * Math.PI;

                mountainGroup.add(mountain);

                // Add snow caps
                const capGeometry = new THREE.ConeGeometry(width * 0.6, height * 0.4, 4);
                const capMaterial = new THREE.MeshBasicMaterial({
                    color: 0xFFFFFF,
                    transparent: true,
                    opacity: layer.opacity * 1.5,
                    fog: false
                });
                const cap = new THREE.Mesh(capGeometry, capMaterial);
                cap.position.set(x, height * 0.8, z);
                cap.rotation.y = Math.random() * Math.PI;
                mountainGroup.add(cap);
            }
        });

        this.scene.add(mountainGroup);
        this.mountainGroup = mountainGroup;
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
            // Add snowman as obstacle for snowball collision (tighter radius)
            this.obstacles.push({
                position: new THREE.Vector3(pos.x, 0, pos.z),
                radius: 0.9  // Reduced from 1.5 for more precise collision
            });
        });

        // House
        this.createHouse(-15, -15);
        // Add house as obstacle (tighter radius)
        this.obstacles.push({
            position: new THREE.Vector3(-15, 0, -15),
            radius: 5  // Reduced from 7 for better gameplay
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
                radius: 1.3  // Reduced from 2 for tighter collision
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
                radius: 0.8  // Reduced from 2 for trunk-only collision
            });
        });

        // Add decorative snow piles around the map
        this.createSnowPiles();

        // Add rocks scattered around the map
        this.createRocks();

        // Add wooden fence sections
        this.createFences();

        // Add snow-covered logs
        this.createLogs();

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
        // Add LARGE collectible snow hills/piles
        const collectibleHills = [
            { x: -22, z: -5, size: 1.8 },
            { x: 16, z: 3, size: 1.6 },
            { x: -3, z: 18, size: 2.0 },
            { x: 22, z: -15, size: 1.7 },
            { x: -18, z: 20, size: 1.9 },
            { x: 6, z: -20, size: 1.5 },
            { x: -25, z: -20, size: 2.1 },
            { x: 25, z: 20, size: 1.8 },
            { x: -12, z: -15, size: 1.6 },
            { x: 15, z: -8, size: 1.7 },
            { x: -20, z: 8, size: 1.9 },
            { x: 18, z: 18, size: 1.6 }
        ];

        collectibleHills.forEach(pos => {
            // Main hill - larger and more prominent
            const hillGeometry = new THREE.SphereGeometry(pos.size, 16, 16);
            const hillMaterial = new THREE.MeshStandardMaterial({
                color: 0xFFFFFF,
                roughness: 0.9
            });
            const hill = new THREE.Mesh(hillGeometry, hillMaterial);
            hill.position.set(pos.x, pos.size * 0.6, pos.z);
            hill.scale.set(1.2, 0.7, 1.2);  // Make it wider and flatter
            hill.castShadow = true;
            hill.receiveShadow = true;
            this.scene.add(hill);

            // Add layer on top for extra height
            const topLayer = new THREE.Mesh(
                new THREE.SphereGeometry(pos.size * 0.6, 12, 12),
                hillMaterial
            );
            topLayer.position.set(pos.x, pos.size * 0.9, pos.z);
            topLayer.scale.set(1, 0.6, 1);
            topLayer.castShadow = true;
            this.scene.add(topLayer);

            // Add this hill as a collectible snow source
            this.snowPatches.push(new THREE.Vector3(pos.x, 0, pos.z));

            // Add smaller piles around for detail
            for (let i = 0; i < 4; i++) {
                const angle = (i / 4) * Math.PI * 2;
                const radius = pos.size * 1.5;
                const smallPile = new THREE.Mesh(
                    new THREE.SphereGeometry(pos.size * 0.3, 8, 8),
                    hillMaterial
                );
                smallPile.position.set(
                    pos.x + Math.cos(angle) * radius,
                    pos.size * 0.15,
                    pos.z + Math.sin(angle) * radius
                );
                smallPile.scale.y = 0.5;
                this.scene.add(smallPile);
            }
        });
    }

    createRocks() {
        // Add rocks scattered around the map for visual interest
        const rockPositions = [
            { x: -8, z: 8, size: 0.6 },
            { x: 3, z: -7, size: 0.8 },
            { x: -20, z: -10, size: 0.5 },
            { x: 18, z: 5, size: 0.7 },
            { x: -12, z: -20, size: 0.9 },
            { x: 22, z: -18, size: 0.6 },
            { x: -25, z: 15, size: 0.8 },
            { x: 14, z: 15, size: 0.5 },
            { x: 6, z: -18, size: 0.7 },
            { x: -18, z: 6, size: 0.6 }
        ];

        rockPositions.forEach(pos => {
            // Main rock - irregular shape using dodecahedron
            const rockGeometry = new THREE.DodecahedronGeometry(pos.size, 0);
            const rockMaterial = new THREE.MeshStandardMaterial({
                color: 0x6B7280,  // Gray rock
                roughness: 0.9,
                flatShading: true
            });
            const rock = new THREE.Mesh(rockGeometry, rockMaterial);
            rock.position.set(pos.x, pos.size * 0.4, pos.z);
            rock.rotation.set(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI
            );
            rock.scale.set(
                1 + Math.random() * 0.3,
                0.7 + Math.random() * 0.3,
                1 + Math.random() * 0.3
            );
            rock.castShadow = true;
            rock.receiveShadow = true;
            this.scene.add(rock);

            // Snow on top of rock
            const snowCapGeometry = new THREE.SphereGeometry(pos.size * 0.6, 8, 8);
            const snowCapMaterial = new THREE.MeshStandardMaterial({
                color: 0xFFFFFF,
                roughness: 0.9
            });
            const snowCap = new THREE.Mesh(snowCapGeometry, snowCapMaterial);
            snowCap.position.set(pos.x, pos.size * 0.9, pos.z);
            snowCap.scale.set(1, 0.4, 1);
            this.scene.add(snowCap);

            // Add some smaller rocks around
            for (let i = 0; i < 2; i++) {
                const angle = Math.random() * Math.PI * 2;
                const radius = pos.size * 1.5;
                const smallSize = pos.size * 0.3;
                const smallRock = new THREE.Mesh(
                    new THREE.DodecahedronGeometry(smallSize, 0),
                    rockMaterial
                );
                smallRock.position.set(
                    pos.x + Math.cos(angle) * radius,
                    smallSize * 0.3,
                    pos.z + Math.sin(angle) * radius
                );
                smallRock.rotation.set(
                    Math.random() * Math.PI,
                    Math.random() * Math.PI,
                    Math.random() * Math.PI
                );
                smallRock.castShadow = true;
                this.scene.add(smallRock);
            }
        });
    }

    createFences() {
        // Create wooden fence sections for visual detail
        const fenceMaterial = new THREE.MeshStandardMaterial({
            color: 0x8B6F47,  // Wood brown
            roughness: 0.9
        });

        // Fence along one side of the map
        const fenceSegments = [
            { x: -30, z: -25, rotation: 0, length: 5 },
            { x: -25, z: -25, rotation: 0, length: 5 },
            { x: -20, z: -25, rotation: 0, length: 5 },
            { x: 25, z: 25, rotation: Math.PI / 2, length: 5 },
            { x: 25, z: 20, rotation: Math.PI / 2, length: 5 },
            { x: 25, z: 15, rotation: Math.PI / 2, length: 5 }
        ];

        fenceSegments.forEach(segment => {
            const fenceGroup = new THREE.Group();

            // Horizontal rails (2)
            for (let rail = 0; rail < 2; rail++) {
                const railGeometry = new THREE.BoxGeometry(segment.length, 0.1, 0.1);
                const railMesh = new THREE.Mesh(railGeometry, fenceMaterial);
                railMesh.position.set(0, 0.5 + rail * 0.4, 0);
                railMesh.castShadow = true;
                fenceGroup.add(railMesh);
            }

            // Vertical posts (3)
            for (let post = 0; post < 3; post++) {
                const postGeometry = new THREE.BoxGeometry(0.15, 1, 0.15);
                const postMesh = new THREE.Mesh(postGeometry, fenceMaterial);
                postMesh.position.set(-segment.length / 2 + post * (segment.length / 2), 0.5, 0);
                postMesh.castShadow = true;
                fenceGroup.add(postMesh);

                // Snow on top of posts
                const snowGeometry = new THREE.BoxGeometry(0.2, 0.1, 0.2);
                const snowMaterial = new THREE.MeshStandardMaterial({ color: 0xFFFFFF });
                const snow = new THREE.Mesh(snowGeometry, snowMaterial);
                snow.position.set(-segment.length / 2 + post * (segment.length / 2), 1, 0);
                fenceGroup.add(snow);
            }

            fenceGroup.position.set(segment.x, 0, segment.z);
            fenceGroup.rotation.y = segment.rotation;
            this.scene.add(fenceGroup);
        });
    }

    createLogs() {
        // Add fallen logs with snow on them
        const logPositions = [
            { x: -18, z: -3, rotation: 0.5, length: 4 },
            { x: 12, z: -12, rotation: 1.2, length: 3.5 },
            { x: -6, z: 15, rotation: 0.8, length: 3 },
            { x: 20, z: -8, rotation: 2.1, length: 3.8 }
        ];

        logPositions.forEach(pos => {
            const logGroup = new THREE.Group();

            // Log body
            const logGeometry = new THREE.CylinderGeometry(0.3, 0.35, pos.length, 8);
            const logMaterial = new THREE.MeshStandardMaterial({
                color: 0x654321,
                roughness: 0.9
            });
            const log = new THREE.Mesh(logGeometry, logMaterial);
            log.rotation.z = Math.PI / 2;
            log.castShadow = true;
            log.receiveShadow = true;
            logGroup.add(log);

            // Snow on top of log
            const snowGeometry = new THREE.BoxGeometry(pos.length, 0.15, 0.4);
            const snowMaterial = new THREE.MeshStandardMaterial({ color: 0xFFFFFF });
            const snow = new THREE.Mesh(snowGeometry, snowMaterial);
            snow.position.set(0, 0.25, 0);
            snow.rotation.z = Math.PI / 2;
            logGroup.add(snow);

            // Wood rings on ends
            const ringGeometry = new THREE.RingGeometry(0.1, 0.3, 16);
            const ringMaterial = new THREE.MeshStandardMaterial({
                color: 0x8B6F47,
                side: THREE.DoubleSide
            });

            const ring1 = new THREE.Mesh(ringGeometry, ringMaterial);
            ring1.position.set(pos.length / 2, 0, 0);
            ring1.rotation.y = Math.PI / 2;
            logGroup.add(ring1);

            const ring2 = new THREE.Mesh(ringGeometry, ringMaterial);
            ring2.position.set(-pos.length / 2, 0, 0);
            ring2.rotation.y = Math.PI / 2;
            logGroup.add(ring2);

            logGroup.position.set(pos.x, 0.3, pos.z);
            logGroup.rotation.y = pos.rotation;
            this.scene.add(logGroup);

            // Add as obstacle for collision
            this.obstacles.push({
                position: new THREE.Vector3(pos.x, 0, pos.z),
                radius: 0.5
            });
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
        // Create AI as a person character
        this.aiCharacter = new THREE.Group();

        // Materials
        const skinMaterial = new THREE.MeshStandardMaterial({
            color: 0xFFDBAC,  // Skin tone
            roughness: 0.7
        });
        const clothesMaterial = new THREE.MeshStandardMaterial({
            color: 0x2C3E50,  // Dark blue/gray clothes
            roughness: 0.8
        });
        const pantsMaterial = new THREE.MeshStandardMaterial({
            color: 0x34495E,  // Darker pants
            roughness: 0.9
        });
        const hairMaterial = new THREE.MeshStandardMaterial({
            color: 0x3D2817,  // Brown hair
            roughness: 0.9
        });

        // Legs
        const legGeometry = new THREE.CylinderGeometry(0.15, 0.15, 0.9, 8);

        const leftLeg = new THREE.Mesh(legGeometry, pantsMaterial);
        leftLeg.position.set(0.15, 0.45, 0);
        leftLeg.castShadow = true;
        this.aiCharacter.add(leftLeg);

        const rightLeg = new THREE.Mesh(legGeometry, pantsMaterial);
        rightLeg.position.set(-0.15, 0.45, 0);
        rightLeg.castShadow = true;
        this.aiCharacter.add(rightLeg);

        // Body/torso
        const bodyGeometry = new THREE.BoxGeometry(0.6, 0.8, 0.3);
        const body = new THREE.Mesh(bodyGeometry, clothesMaterial);
        body.position.set(0, 1.3, 0);
        body.castShadow = true;
        body.receiveShadow = true;
        this.aiCharacter.add(body);

        // Arms
        const armGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.7, 8);

        const leftArm = new THREE.Mesh(armGeometry, clothesMaterial);
        leftArm.position.set(0.4, 1.3, 0);
        leftArm.rotation.z = 0.3;
        leftArm.castShadow = true;
        this.aiCharacter.add(leftArm);

        const rightArm = new THREE.Mesh(armGeometry, clothesMaterial);
        rightArm.position.set(-0.4, 1.3, 0);
        rightArm.rotation.z = -0.3;
        rightArm.castShadow = true;
        this.aiCharacter.add(rightArm);

        // Hands
        const handGeometry = new THREE.SphereGeometry(0.12, 8, 8);

        const leftHand = new THREE.Mesh(handGeometry, skinMaterial);
        leftHand.position.set(0.52, 0.95, 0);
        leftHand.castShadow = true;
        this.aiCharacter.add(leftHand);

        const rightHand = new THREE.Mesh(handGeometry, skinMaterial);
        rightHand.position.set(-0.52, 0.95, 0);
        rightHand.castShadow = true;
        this.aiCharacter.add(rightHand);

        // Neck
        const neckGeometry = new THREE.CylinderGeometry(0.12, 0.12, 0.15, 8);
        const neck = new THREE.Mesh(neckGeometry, skinMaterial);
        neck.position.set(0, 1.8, 0);
        this.aiCharacter.add(neck);

        // Head
        const headGeometry = new THREE.SphereGeometry(0.25, 16, 16);
        const head = new THREE.Mesh(headGeometry, skinMaterial);
        head.position.set(0, 2.05, 0);
        head.castShadow = true;
        head.receiveShadow = true;
        this.aiCharacter.add(head);

        // Hair
        const hairGeometry = new THREE.SphereGeometry(0.26, 16, 16);
        const hair = new THREE.Mesh(hairGeometry, hairMaterial);
        hair.position.set(0, 2.15, 0);
        hair.scale.set(1, 0.6, 1);
        hair.castShadow = true;
        this.aiCharacter.add(hair);

        // Eyes (menacing look)
        const eyeMaterial = new THREE.MeshStandardMaterial({
            color: 0xFF3333,
            emissive: 0xFF0000,
            emissiveIntensity: 0.3
        });
        const eyeGeometry = new THREE.SphereGeometry(0.05, 8, 8);

        const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        leftEye.position.set(0.08, 2.08, 0.22);
        this.aiCharacter.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        rightEye.position.set(-0.08, 2.08, 0.22);
        this.aiCharacter.add(rightEye);

        // Mouth (angry expression)
        const mouthGeometry = new THREE.BoxGeometry(0.15, 0.03, 0.02);
        const mouthMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
        const mouth = new THREE.Mesh(mouthGeometry, mouthMaterial);
        mouth.position.set(0, 1.92, 0.24);
        this.aiCharacter.add(mouth);

        // Beanie/winter hat
        const beanieGeometry = new THREE.SphereGeometry(0.27, 16, 16);
        const beanieMaterial = new THREE.MeshStandardMaterial({
            color: 0xC41E3A,  // Red beanie
            roughness: 0.9
        });
        const beanie = new THREE.Mesh(beanieGeometry, beanieMaterial);
        beanie.position.set(0, 2.2, 0);
        beanie.scale.set(1, 0.7, 1);
        beanie.castShadow = true;
        this.aiCharacter.add(beanie);

        // Pompom on beanie
        const pompomGeometry = new THREE.SphereGeometry(0.1, 8, 8);
        const pompomMaterial = new THREE.MeshStandardMaterial({ color: 0xFFFFFF });
        const pompom = new THREE.Mesh(pompomGeometry, pompomMaterial);
        pompom.position.set(0, 2.4, 0);
        this.aiCharacter.add(pompom);

        this.aiCharacter.position.set(20, 0, 20);
        this.scene.add(this.aiCharacter);

        // Store reference for easy access
        this.ai = this.aiCharacter;

        // AI state
        this.aiState = {
            position: new THREE.Vector3(20, 0, 20),
            hasSnowball: false,
            targetSnowPatch: null,
            lastShot: 0,
            moveDirection: new THREE.Vector3(),
            currentHidingSpot: null,
            hidingSpots: [
                new THREE.Vector3(-15, 0, -15),  // Near house
                new THREE.Vector3(18, 0, 15),    // Near tree
                new THREE.Vector3(-18, 0, 12),   // Near tree
                new THREE.Vector3(12, 0, -18),   // Near tree
                new THREE.Vector3(-25, 0, -20),  // Behind snow hill
                new THREE.Vector3(25, 0, 20),    // Behind snow hill
                new THREE.Vector3(16, 0, 3),     // Behind snow hill
                new THREE.Vector3(-20, 0, 8)     // Behind snow hill
            ],
            // Smart AI tracking
            lastPlayerPosition: this.playerPosition.clone(),
            playerVelocity: new THREE.Vector3(),
            dodgeDirection: null,
            isDodging: false,
            stuckTimer: 0,
            lastPosition: new THREE.Vector3(20, 0, 20)
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

        // Throw button with charge mechanic
        const throwBtn = document.getElementById('throw-btn');
        this.throwChargeStart = 0;
        this.throwChargeLevel = 0;
        this.isCharging = false;

        const startCharge = (e) => {
            if (!this.state.hasSnowball || this.state.gameOver) return;
            e.preventDefault();
            this.throwChargeStart = Date.now();
            this.isCharging = true;
            throwBtn.style.transform = 'scale(1)';
        };

        const endCharge = (e) => {
            if (!this.isCharging) return;
            e.preventDefault();
            this.isCharging = false;
            const chargeDuration = Date.now() - this.throwChargeStart;
            this.throwChargeLevel = Math.min(chargeDuration / 1000, 2); // Max 2 seconds
            this.throwSnowball(this.throwChargeLevel);
            throwBtn.style.transform = 'scale(1)';
            throwBtn.style.background = '';
        };

        throwBtn.addEventListener('touchstart', startCharge);
        throwBtn.addEventListener('touchend', endCharge);
        throwBtn.addEventListener('touchcancel', endCharge);
        throwBtn.addEventListener('mousedown', startCharge);
        throwBtn.addEventListener('mouseup', endCharge);
    }

    initModeSelection() {
        // Initialize Firebase
        initFirebase();

        // AI Mode button - show tutorial selection
        document.getElementById('ai-mode-btn').addEventListener('click', () => {
            document.getElementById('mode-screen').classList.add('hidden');
            document.getElementById('tutorial-selection-screen').classList.remove('hidden');
        });

        // Play Tutorial button
        document.getElementById('play-tutorial-btn').addEventListener('click', () => {
            this.gameMode = 'tutorial';
            document.getElementById('tutorial-selection-screen').classList.add('hidden');
            this.startTutorial();
        });

        // Skip Tutorial button
        document.getElementById('skip-tutorial-btn').addEventListener('click', () => {
            this.gameMode = 'ai';
            document.getElementById('tutorial-selection-screen').classList.add('hidden');
            document.getElementById('start-screen').classList.remove('hidden');
        });

        // Exit Tutorial button
        document.getElementById('exit-tutorial-btn').addEventListener('click', () => {
            this.exitTutorial();
        });

        // Multiplayer Mode button
        document.getElementById('multiplayer-mode-btn').addEventListener('click', () => {
            if (!firebaseInitialized) {
                alert('Firebase not configured. Check the console for details.');
                return;
            }
            this.gameMode = 'multiplayer';
            document.getElementById('mode-screen').classList.add('hidden');
            document.getElementById('lobby-screen').classList.remove('hidden');
        });

        // Create Room button
        document.getElementById('create-room-btn').addEventListener('click', async () => {
            try {
                this.multiplayer = new MultiplayerManager();
                const roomCode = await this.multiplayer.createRoom();
                document.getElementById('lobby-screen').classList.add('hidden');
                document.getElementById('waiting-screen').classList.remove('hidden');
                document.getElementById('room-code-display').textContent = roomCode;

                // Wait for opponent
                this.multiplayer.onPlayerJoined(() => {
                    document.getElementById('waiting-screen').classList.add('hidden');
                    document.getElementById('start-screen').classList.remove('hidden');
                    this.setupMultiplayerSync();
                });
            } catch (error) {
                this.showLobbyMessage('Error creating room: ' + error.message, 'error');
            }
        });

        // Join Room button
        document.getElementById('join-room-btn').addEventListener('click', async () => {
            const roomCode = document.getElementById('room-code-input').value.trim();
            if (!roomCode) {
                this.showLobbyMessage('Please enter a room code', 'error');
                return;
            }

            try {
                this.multiplayer = new MultiplayerManager();
                await this.multiplayer.joinRoom(roomCode);
                document.getElementById('lobby-screen').classList.add('hidden');
                document.getElementById('start-screen').classList.remove('hidden');
                this.setupMultiplayerSync();
            } catch (error) {
                this.showLobbyMessage(error.message, 'error');
            }
        });

        // Cancel Room button
        document.getElementById('cancel-room-btn').addEventListener('click', async () => {
            if (this.multiplayer) {
                await this.multiplayer.leaveRoom();
                this.multiplayer = null;
            }
            document.getElementById('waiting-screen').classList.add('hidden');
            document.getElementById('lobby-screen').classList.remove('hidden');
        });

        // Back to Mode button
        document.getElementById('back-to-mode-btn').addEventListener('click', () => {
            document.getElementById('lobby-screen').classList.add('hidden');
            document.getElementById('mode-screen').classList.remove('hidden');
        });
    }

    showLobbyMessage(message, type) {
        const messageEl = document.getElementById('lobby-message');
        messageEl.textContent = message;
        messageEl.className = type;
    }

    setupMultiplayerSync() {
        if (!this.multiplayer) return;

        // Sync opponent position (store as target for interpolation)
        this.multiplayer.onOpponentPosition((position) => {
            if (this.opponentTargetPosition) {
                this.opponentTargetPosition.set(position.x, position.y, position.z);
            }
        });

        // Sync opponent snowballs
        this.multiplayer.onOpponentSnowball((snowball) => {
            const pos = new THREE.Vector3(snowball.position.x, snowball.position.y, snowball.position.z);
            const dir = new THREE.Vector3(snowball.direction.x, snowball.direction.y, snowball.direction.z);
            const snowballObj = this.createSnowballObject(pos, dir, snowball.power || 1.0);
            this.aiSnowballs.push(snowballObj);
        });

        // Sync opponent score
        this.multiplayer.onOpponentScore((score) => {
            this.state.aiScore = score;
            this.updateUI();
        });

        // Handle opponent disconnect
        this.multiplayer.onOpponentDisconnect(() => {
            alert('Opponent disconnected!');
            this.restart();
        });

        // Create opponent character
        this.createOpponentCharacter();
    }

    createOpponentCharacter() {
        // Create the opponent character (same as AI character)
        this.opponent = this.aiCharacter;  // Reuse the AI character as opponent

        // Add interpolation target for smooth movement
        this.opponentTargetPosition = new THREE.Vector3();
        this.opponentTargetPosition.copy(this.opponent.position);
    }

    startTutorial() {
        // Show tutorial UI
        document.getElementById('tutorial-ui').classList.remove('hidden');
        this.state.gameStarted = true;
        this.tutorialHits = 0;

        // Hide score display in tutorial mode
        document.getElementById('score-display').classList.add('hidden');

        // Position player at origin facing the target
        this.playerPosition.set(0, 0, 0);

        // Update tutorial step
        this.updateTutorialStep();

        // Create practice target (single target)
        this.createTutorialTargets();
    }

    createTutorialTargets() {
        // Create single bullseye target in front of player
        const pos = { x: 0, z: 10 }; // 10 units in front

        // Create a simple bullseye target stand
        const targetGroup = new THREE.Group();

        // Stand pole
        const poleGeometry = new THREE.CylinderGeometry(0.1, 0.1, 3, 8);
        const poleMaterial = new THREE.MeshStandardMaterial({
            color: 0x8B4513,
            roughness: 0.8
        });
        const pole = new THREE.Mesh(poleGeometry, poleMaterial);
        pole.position.y = 1.5;
        pole.castShadow = true;
        targetGroup.add(pole);

        // Bullseye backing (white circle)
        const backingGeometry = new THREE.CircleGeometry(1.2, 32);
        const backingMaterial = new THREE.MeshStandardMaterial({
            color: 0xFFFFFF,
            side: THREE.DoubleSide
        });
        const backing = new THREE.Mesh(backingGeometry, backingMaterial);
        backing.position.y = 2.5;
        backing.position.z = 0.05;
        targetGroup.add(backing);

        // Red outer ring
        const outerRingGeometry = new THREE.RingGeometry(0.8, 1.0, 32);
        const outerRingMaterial = new THREE.MeshStandardMaterial({
            color: 0xFF0000,
            side: THREE.DoubleSide
        });
        const outerRing = new THREE.Mesh(outerRingGeometry, outerRingMaterial);
        outerRing.position.y = 2.5;
        outerRing.position.z = 0.06;
        targetGroup.add(outerRing);

        // White middle ring
        const middleRingGeometry = new THREE.RingGeometry(0.5, 0.8, 32);
        const middleRingMaterial = new THREE.MeshStandardMaterial({
            color: 0xFFFFFF,
            side: THREE.DoubleSide
        });
        const middleRing = new THREE.Mesh(middleRingGeometry, middleRingMaterial);
        middleRing.position.y = 2.5;
        middleRing.position.z = 0.07;
        targetGroup.add(middleRing);

        // Red inner ring
        const innerRingGeometry = new THREE.RingGeometry(0.2, 0.5, 32);
        const innerRingMaterial = new THREE.MeshStandardMaterial({
            color: 0xFF0000,
            side: THREE.DoubleSide
        });
        const innerRing = new THREE.Mesh(innerRingGeometry, innerRingMaterial);
        innerRing.position.y = 2.5;
        innerRing.position.z = 0.08;
        targetGroup.add(innerRing);

        // White bullseye center
        const bullseyeGeometry = new THREE.CircleGeometry(0.2, 32);
        const bullseyeMaterial = new THREE.MeshStandardMaterial({
            color: 0xFFFFFF,
            side: THREE.DoubleSide
        });
        const bullseye = new THREE.Mesh(bullseyeGeometry, bullseyeMaterial);
        bullseye.position.y = 2.5;
        bullseye.position.z = 0.09;
        targetGroup.add(bullseye);

        targetGroup.position.set(pos.x, 0, pos.z);
        this.scene.add(targetGroup);

        this.tutorialTargets.push({
            mesh: targetGroup,
            position: new THREE.Vector3(pos.x, 2.5, pos.z), // Center of target
            hit: false
        });

        // Store target position for camera aiming
        this.tutorialTargetPosition = new THREE.Vector3(pos.x, 2.5, pos.z);
    }

    updateTutorialStep() {
        const stepText = document.getElementById('tutorial-step');
        const hitsDisplay = document.getElementById('tutorial-hits');

        hitsDisplay.textContent = this.tutorialHits;

        if (this.tutorialHits === 0) {
            stepText.textContent = 'Find snow pile, then quick tap THROW!';
        } else if (this.tutorialHits === 1) {
            stepText.textContent = 'Good! Now HOLD throw for 1 sec!';
            // Move player back 5 units
            this.playerPosition.z = -5;
        } else if (this.tutorialHits === 2) {
            stepText.textContent = 'Nice! Now HOLD throw for 2 sec!';
            // Move player back 10 more units
            this.playerPosition.z = -15;
        } else if (this.tutorialHits === 3) {
            stepText.textContent = '🎉 Complete! Ready for AI!';
            setTimeout(() => {
                this.exitTutorial();
            }, 2000);
        }
    }

    exitTutorial() {
        // Hide tutorial UI
        document.getElementById('tutorial-ui').classList.add('hidden');

        // Show score display again
        document.getElementById('score-display').classList.remove('hidden');

        // Remove tutorial targets
        this.tutorialTargets.forEach(target => {
            this.scene.remove(target.mesh);
            target.mesh.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            });
        });
        this.tutorialTargets = [];
        this.tutorialTargetPosition = null;

        // Reset state
        this.state.reset();
        this.state.gameStarted = false;
        this.tutorialHits = 0;

        // Reset player position to safe starting position
        this.playerPosition.set(0, 0, 0);

        // Switch to AI mode
        this.gameMode = 'ai';
        document.getElementById('start-screen').classList.remove('hidden');
    }

    initUI() {
        // Start button
        document.getElementById('start-btn').addEventListener('click', () => {
            document.getElementById('start-screen').classList.add('hidden');
            this.state.gameStarted = true;

            // Show score display for AI and multiplayer modes
            document.getElementById('score-display').classList.remove('hidden');

            // Update opponent label based on game mode
            const opponentLabel = document.getElementById('opponent-label');
            if (this.gameMode === 'multiplayer') {
                opponentLabel.textContent = 'OPPONENT';
            } else {
                opponentLabel.textContent = 'AI';
            }

            // Mark player as ready in multiplayer
            if (this.gameMode === 'multiplayer' && this.multiplayer) {
                this.multiplayer.setReady();
                // Wait for both players to be ready
                this.multiplayer.onBothReady(() => {
                    console.log('Both players ready!');
                });
            }
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

        // Snowball indicator
        const snowballIcon = document.getElementById('snowball-icon');
        if (this.state.hasSnowball) {
            snowballIcon.classList.remove('empty');
            snowballIcon.classList.add('loaded');
            snowballIcon.textContent = '❄️';
        } else {
            snowballIcon.classList.remove('loaded');
            snowballIcon.classList.add('empty');
            snowballIcon.textContent = '⚪';
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

    throwSnowball(chargeLevel = 0.5) {
        if (!this.state.hasSnowball) return;

        this.state.hasSnowball = false;

        // Auto-aim at target
        const throwPosition = this.playerPosition.clone().add(new THREE.Vector3(0, CONFIG.PLAYER_HEIGHT, 0));
        let targetPos;
        if (this.gameMode === 'tutorial' && this.tutorialTargetPosition) {
            targetPos = this.tutorialTargetPosition.clone();
        } else if (this.gameMode === 'multiplayer' && this.opponent) {
            targetPos = this.opponent.position.clone().add(new THREE.Vector3(0, 1, 0));
        } else {
            targetPos = this.aiState.position.clone().add(new THREE.Vector3(0, 1, 0));
        }
        const direction = targetPos.sub(throwPosition).normalize();

        // Calculate power multiplier (0.5x to 2.5x based on charge)
        // chargeLevel ranges from 0 to 2 seconds
        const powerMultiplier = 0.5 + (chargeLevel * 1.0); // 0.5x at instant, 2.5x at max charge

        const snowball = this.createSnowballObject(throwPosition, direction, powerMultiplier);

        this.snowballs.push(snowball);
        this.updateUI();

        // Sync with multiplayer if in online mode
        if (this.gameMode === 'multiplayer' && this.multiplayer) {
            this.multiplayer.throwSnowball(
                {x: throwPosition.x, y: throwPosition.y, z: throwPosition.z},
                {x: direction.x, y: direction.y, z: direction.z},
                powerMultiplier
            );
        }
        // Removed distracting message
    }

    createSnowballObject(position, direction, powerMultiplier = 1.0) {
        const geometry = new THREE.SphereGeometry(CONFIG.SNOWBALL_SIZE, 16, 16);
        const material = new THREE.MeshStandardMaterial({
            color: 0xFFFFFF,
            roughness: 0.8
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(position);
        mesh.castShadow = true;
        this.scene.add(mesh);

        // Add upward velocity for arc trajectory
        // Scale both horizontal speed and arc height by power multiplier
        const velocity = direction.clone().multiplyScalar(CONFIG.SNOWBALL_SPEED * powerMultiplier);
        velocity.y += 3 * powerMultiplier;  // Add upward component for arc, scaled by power

        return {
            mesh: mesh,
            velocity: velocity,
            lifetime: 5
        };
    }

    createExplosion(position, size = 1) {
        // Create particle explosion effect
        const particleCount = 15;
        const particles = [];

        for (let i = 0; i < particleCount; i++) {
            const particleGeometry = new THREE.SphereGeometry(0.08 * size, 4, 4);
            const particleMaterial = new THREE.MeshBasicMaterial({
                color: 0xFFFFFF,
                transparent: true,
                opacity: 1
            });
            const particle = new THREE.Mesh(particleGeometry, particleMaterial);

            // Random direction
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;
            const speed = 2 + Math.random() * 3;

            particle.position.copy(position);
            particle.userData.velocity = new THREE.Vector3(
                Math.sin(phi) * Math.cos(theta) * speed,
                Math.sin(phi) * Math.sin(theta) * speed,
                Math.cos(phi) * speed
            );

            this.scene.add(particle);
            particles.push(particle);
        }

        // Add to explosions list with lifetime
        this.explosions.push({
            particles: particles,
            lifetime: 0.5,
            age: 0
        });
    }

    updatePlayer(delta) {
        if (!this.state.gameStarted || this.state.gameOver) return;

        // Movement from joystick (relative to camera direction)
        if (this.joystick.active) {
            // Calculate direction to target for relative movement
            let dirToTarget;
            if (this.gameMode === 'tutorial' && this.tutorialTargetPosition) {
                dirToTarget = new THREE.Vector3(
                    this.tutorialTargetPosition.x - this.playerPosition.x,
                    0,
                    this.tutorialTargetPosition.z - this.playerPosition.z
                ).normalize();
            } else {
                dirToTarget = new THREE.Vector3(
                    this.aiState.position.x - this.playerPosition.x,
                    0,
                    this.aiState.position.z - this.playerPosition.z
                ).normalize();
            }

            // Forward is towards target, right is perpendicular
            const forward = dirToTarget;
            const right = new THREE.Vector3(-dirToTarget.z, 0, dirToTarget.x);

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

        // Auto-aim camera at target
        let targetPosition;
        if (this.gameMode === 'tutorial' && this.tutorialTargetPosition) {
            // Aim at tutorial target
            targetPosition = this.tutorialTargetPosition.clone();
        } else if (this.gameMode === 'multiplayer' && this.opponent) {
            targetPosition = new THREE.Vector3(
                this.opponent.position.x,
                this.opponent.position.y + 1,
                this.opponent.position.z
            );
        } else {
            targetPosition = new THREE.Vector3(
                this.aiState.position.x,
                this.aiState.position.y + 1,  // Aim at AI center
                this.aiState.position.z
            );
        }
        this.camera.lookAt(targetPosition);

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

        // Sync position in multiplayer (throttled to ~10 updates/sec)
        if (this.gameMode === 'multiplayer' && this.multiplayer) {
            this.positionUpdateThrottle += delta;
            if (this.positionUpdateThrottle > 0.1) {
                this.multiplayer.updatePosition(
                    this.playerPosition.x,
                    this.playerPosition.y,
                    this.playerPosition.z
                );
                this.positionUpdateThrottle = 0;
            }
        }
    }

    checkCollision(position) {
        // Check house collision
        if (this.houseCollision) {
            if (position.x > this.houseCollision.min.x && position.x < this.houseCollision.max.x &&
                position.z > this.houseCollision.min.z && position.z < this.houseCollision.max.z) {
                return true;
            }
        }

        // Check obstacle collisions (bushes, snowmen, trees)
        for (const obstacle of this.obstacles) {
            const dist = new THREE.Vector2(
                position.x - obstacle.position.x,
                position.z - obstacle.position.z
            ).length();

            // Use slightly larger radius for character collision than snowball collision
            if (dist < obstacle.radius + 0.3) {
                return true;
            }
        }

        // Check boundaries
        if (position.x < -45 || position.x > 45 || position.z < -45 || position.z > 45) {
            return true;
        }

        return false;
    }

    updateOpponentPosition(delta) {
        // Smoothly interpolate opponent position for multiplayer
        if (!this.opponent || !this.opponentTargetPosition) return;

        // Use lerp for smooth interpolation (20% per frame = smooth but responsive)
        const lerpFactor = Math.min(delta * 10, 1); // Adaptive based on frame rate
        this.opponent.position.lerp(this.opponentTargetPosition, lerpFactor);
    }

    checkAndDodgeSnowballs(delta) {
        // SMART FEATURE 4: Dodge incoming snowballs
        let nearestThreat = null;
        let nearestDist = Infinity;

        // Check all player snowballs
        for (const snowball of this.snowballs) {
            const distToAI = snowball.mesh.position.distanceTo(this.aiState.position);

            // If snowball is within danger range and heading towards AI
            if (distToAI < 10) {
                const snowballToAI = this.aiState.position.clone().sub(snowball.mesh.position);
                const velocityDir = snowball.velocity.clone().normalize();
                const dotProduct = velocityDir.dot(snowballToAI.normalize());

                // If snowball is heading towards AI (dot product > 0.7 means it's aimed at us)
                if (dotProduct > 0.7 && distToAI < nearestDist) {
                    nearestDist = distToAI;
                    nearestThreat = snowball;
                }
            }
        }

        // If there's an incoming snowball, dodge it!
        if (nearestThreat && nearestDist < 8) {
            if (!this.aiState.isDodging) {
                // Start dodging - pick perpendicular direction to snowball velocity
                const snowballVel = nearestThreat.velocity.clone().normalize();
                this.aiState.dodgeDirection = new THREE.Vector3(
                    -snowballVel.z, // Perpendicular to velocity
                    0,
                    snowballVel.x
                );
                // Randomly choose left or right
                if (Math.random() < 0.5) {
                    this.aiState.dodgeDirection.multiplyScalar(-1);
                }
                this.aiState.isDodging = true;
            }

            // Execute dodge
            const dodgePosition = this.aiState.position.clone().add(
                this.aiState.dodgeDirection.clone().multiplyScalar(CONFIG.AI_SPEED * 1.5 * delta)
            );

            if (!this.checkCollision(dodgePosition)) {
                this.aiState.position.copy(dodgePosition);
                this.ai.position.set(dodgePosition.x, 0, dodgePosition.z);
            }
        } else {
            // No threat, stop dodging
            this.aiState.isDodging = false;
            this.aiState.dodgeDirection = null;
        }
    }

    updateAI(delta) {
        if (!this.state.gameStarted || this.state.gameOver) return;

        const currentTime = Date.now();
        const distanceToPlayer = this.aiState.position.distanceTo(this.playerPosition);

        // SMART FEATURE: Track player velocity for prediction
        this.aiState.playerVelocity = this.playerPosition.clone()
            .sub(this.aiState.lastPlayerPosition)
            .multiplyScalar(1 / delta);
        this.aiState.lastPlayerPosition.copy(this.playerPosition);

        // Stuck detection - if AI hasn't moved much, it's stuck
        const distanceMoved = this.aiState.position.distanceTo(this.aiState.lastPosition);
        if (distanceMoved < 0.1 * delta * 60) { // Expected to move more than this
            this.aiState.stuckTimer += delta;
            if (this.aiState.stuckTimer > 2) { // Stuck for 2 seconds
                // Force AI to pick new target/hiding spot
                this.aiState.targetSnowPatch = null;
                this.aiState.currentHidingSpot = this.getRandomHidingSpot();
                this.aiState.stuckTimer = 0;

                // Move in a random direction to get unstuck
                const randomDir = new THREE.Vector3(
                    (Math.random() - 0.5) * 2,
                    0,
                    (Math.random() - 0.5) * 2
                ).normalize();
                const unstuckPos = this.aiState.position.clone().add(
                    randomDir.multiplyScalar(2)
                );
                if (!this.checkCollision(unstuckPos)) {
                    this.aiState.position.copy(unstuckPos);
                    this.ai.position.set(unstuckPos.x, 0, unstuckPos.z);
                }
            }
        } else {
            this.aiState.stuckTimer = 0;
        }
        this.aiState.lastPosition.copy(this.aiState.position);

        // SMART FEATURE 4: Dodge incoming snowballs
        // Only dodge if not currently getting snowball
        if (this.aiState.hasSnowball || this.aiState.targetSnowPatch) {
            this.checkAndDodgeSnowballs(delta);
        }

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

                if (!this.checkCollision(newPosition)) {
                    this.aiState.position.copy(newPosition);
                    this.ai.position.set(newPosition.x, 0, newPosition.z);
                }

                // Check if reached snow
                const distance = this.aiState.position.distanceTo(this.aiState.targetSnowPatch);
                if (distance < CONFIG.SNOW_PATCH_DISTANCE) {
                    this.aiState.hasSnowball = true;
                    this.aiState.targetSnowPatch = null;
                    // Pick a hiding spot when we get a snowball
                    this.aiState.currentHidingSpot = this.getRandomHidingSpot();
                }
            }
        } else {
            // Has snowball - move to hiding spots and shoot

            // SMART FEATURE 5: Tactical awareness
            // If player has snowball and is close, prioritize cover
            // If player doesn't have snowball, be more aggressive
            const playerHasSnowball = this.state.hasSnowball;
            const shouldBeCautious = playerHasSnowball && distanceToPlayer < 15;

            // If player gets too close OR we should be cautious, switch hiding spots
            if (distanceToPlayer < 10 || (shouldBeCautious && Math.random() < 0.3)) {
                this.aiState.currentHidingSpot = this.getRandomHidingSpot();
            }

            // Move to hiding spot
            if (this.aiState.currentHidingSpot) {
                const distToSpot = this.aiState.position.distanceTo(this.aiState.currentHidingSpot);

                if (distToSpot > 2) {
                    // Move towards hiding spot
                    const direction = this.aiState.currentHidingSpot.clone()
                        .sub(this.aiState.position)
                        .normalize();

                    // Move faster when vulnerable (no cover and player has snowball)
                    const speedMultiplier = shouldBeCautious ? 1.0 : 0.7;
                    const newPosition = this.aiState.position.clone().add(
                        direction.multiplyScalar(CONFIG.AI_SPEED * speedMultiplier * delta)
                    );

                    if (!this.checkCollision(newPosition)) {
                        this.aiState.position.copy(newPosition);
                        this.ai.position.set(newPosition.x, 0, newPosition.z);
                    }
                } else {
                    // At hiding spot, strafe side to side
                    if (Math.random() < 0.02) {
                        this.aiState.moveDirection = new THREE.Vector3(
                            (Math.random() - 0.5) * 2,
                            0,
                            (Math.random() - 0.5) * 2
                        ).normalize();
                    }

                    const newPosition = this.aiState.position.clone().add(
                        this.aiState.moveDirection.clone().multiplyScalar(CONFIG.AI_SPEED * 0.3 * delta)
                    );

                    if (!this.checkCollision(newPosition)) {
                        this.aiState.position.copy(newPosition);
                        this.ai.position.set(newPosition.x, 0, newPosition.z);
                    }
                }
            }

            // SMART FEATURE 6: Adaptive shooting interval
            // Shoot faster when player is close and doesn't have snowball
            let shootInterval = CONFIG.AI_SHOOT_INTERVAL;
            if (!playerHasSnowball && distanceToPlayer < 15) {
                shootInterval = 2000; // Faster when player is vulnerable
            } else if (distanceToPlayer > 20) {
                shootInterval = 3500; // Slower when far away (saving ammo)
            }

            // Shoot at player
            if (currentTime - this.aiState.lastShot > shootInterval) {
                this.aiShoot();
                this.aiState.lastShot = currentTime;
            }
        }

        // Make AI character always face the player
        const dirToPlayer = new THREE.Vector3(
            this.playerPosition.x - this.aiState.position.x,
            0,
            this.playerPosition.z - this.aiState.position.z
        );
        const angleToPlayer = Math.atan2(dirToPlayer.x, dirToPlayer.z);
        this.ai.rotation.y = angleToPlayer;
    }

    getRandomHidingSpot() {
        // Pick a random hiding spot that's far from player
        const farSpots = this.aiState.hidingSpots.filter(spot => {
            return spot.distanceTo(this.playerPosition) > 12;
        });

        if (farSpots.length > 0) {
            return farSpots[Math.floor(Math.random() * farSpots.length)];
        }

        // If no far spots, just pick any random one
        return this.aiState.hidingSpots[Math.floor(Math.random() * this.aiState.hidingSpots.length)];
    }

    aiShoot() {
        if (!this.aiState.hasSnowball) return;

        this.aiState.hasSnowball = false;

        const distanceToPlayer = this.aiState.position.distanceTo(this.playerPosition);

        // SMART FEATURE 1: Distance-based charging
        // Reduced charge levels - was overshooting player
        let chargeLevel = 0.3;
        if (distanceToPlayer > 25) {
            chargeLevel = 1.2; // Reduced from 2.0
        } else if (distanceToPlayer > 15) {
            chargeLevel = 0.9; // Reduced from 1.5
        } else if (distanceToPlayer > 8) {
            chargeLevel = 0.6; // Reduced from 1.0
        } else {
            chargeLevel = 0.3; // Reduced from 0.5
        }

        const powerMultiplier = 0.5 + (chargeLevel * 1.0);

        // SMART FEATURE 2: Lead targeting - predict where player will be
        const timeToHit = distanceToPlayer / (CONFIG.SNOWBALL_SPEED * powerMultiplier);
        const predictedPlayerPos = this.playerPosition.clone().add(
            this.aiState.playerVelocity.clone().multiplyScalar(timeToHit * 0.7) // Reduced prediction by 30%
        );

        // Aim at predicted position (at player center height)
        const targetHeight = new THREE.Vector3(0, CONFIG.PLAYER_HEIGHT / 2, 0);
        let direction = predictedPlayerPos.clone().add(targetHeight)
            .sub(this.aiState.position)
            .normalize();

        // SMART FEATURE 3: Reduced inaccuracy (only slight randomness now)
        // Only add small error for realism
        const accuracyError = 0.08; // Much lower than 0.3
        direction.x += (Math.random() - 0.5) * accuracyError;
        direction.z += (Math.random() - 0.5) * accuracyError;
        direction.normalize();

        const snowball = this.createSnowballObject(
            this.aiState.position.clone().add(new THREE.Vector3(0, 1.5, 0)),
            direction,
            powerMultiplier
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

            // Apply gravity for curved trajectory
            snowball.velocity.y -= 9.8 * delta;

            snowball.lifetime -= delta;

            // Check collision with obstacles
            if (this.checkSnowballObstacleCollision(snowball.mesh.position)) {
                this.createExplosion(snowball.mesh.position, 0.8);
                this.scene.remove(snowball.mesh);
                this.snowballs.splice(i, 1);
                continue;
            }

            // Check collision with tutorial target
            if (this.gameMode === 'tutorial' && this.tutorialTargets.length > 0) {
                const target = this.tutorialTargets[0];
                if (!target.hit) {
                    const distToTarget = snowball.mesh.position.distanceTo(target.position);
                    if (distToTarget < 1.2) {
                        target.hit = true;
                        this.tutorialHits++;
                        this.createExplosion(snowball.mesh.position, 1.5);
                        this.scene.remove(snowball.mesh);
                        this.snowballs.splice(i, 1);

                        // Update step (which moves player back) then reset target
                        this.updateTutorialStep();

                        // Reset target for next hit (unless tutorial complete)
                        if (this.tutorialHits < 3) {
                            setTimeout(() => {
                                target.hit = false;
                            }, 100);
                        }
                        continue;
                    }
                }
                if (i < 0 || i >= this.snowballs.length) continue;
            }

            // Check collision with opponent (AI or remote player) - skip in tutorial
            if (this.gameMode !== 'tutorial') {
                let opponentPosition;
                if (this.gameMode === 'multiplayer' && this.opponent) {
                    opponentPosition = new THREE.Vector3(
                        this.opponent.position.x,
                        1.2,  // Center of character body
                        this.opponent.position.z
                    );
                } else {
                    opponentPosition = new THREE.Vector3(
                        this.ai.position.x,
                        1.2,  // Center of AI character body
                        this.ai.position.z
                    );
                }
                const distToOpponent = snowball.mesh.position.distanceTo(opponentPosition);
                if (distToOpponent < 1.5) {  // Larger radius to account for full character
                this.state.addPlayerScore();
                this.createExplosion(snowball.mesh.position, 1.2);
                this.scene.remove(snowball.mesh);
                this.snowballs.splice(i, 1);
                this.updateUI();

                // Sync score in multiplayer
                if (this.gameMode === 'multiplayer' && this.multiplayer) {
                    this.multiplayer.updateScore(this.state.playerScore);
                }

                const winner = this.state.checkWin();
                if (winner) this.endGame(winner);
                continue;
                }
            }

            // Check ground collision
            if (snowball.mesh.position.y <= 0) {
                this.createExplosion(new THREE.Vector3(snowball.mesh.position.x, 0, snowball.mesh.position.z), 0.8);
                this.scene.remove(snowball.mesh);
                this.snowballs.splice(i, 1);
                continue;
            }

            // Remove if lifetime expired or out of bounds
            if (snowball.lifetime <= 0 || Math.abs(snowball.mesh.position.x) > 50 ||
                Math.abs(snowball.mesh.position.z) > 50) {
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

            // Apply gravity for curved trajectory
            snowball.velocity.y -= 9.8 * delta;

            snowball.lifetime -= delta;

            // Check collision with obstacles
            if (this.checkSnowballObstacleCollision(snowball.mesh.position)) {
                this.createExplosion(snowball.mesh.position, 0.8);
                this.scene.remove(snowball.mesh);
                this.aiSnowballs.splice(i, 1);
                continue;
            }

            // Check collision with player
            const distToPlayer = snowball.mesh.position.distanceTo(
                this.playerPosition.clone().add(new THREE.Vector3(0, CONFIG.PLAYER_HEIGHT / 2, 0))
            );
            if (distToPlayer < 1.2) { // Increased from 1.0 for easier hits
                this.state.addAIScore();
                this.createExplosion(snowball.mesh.position, 1.2);
                this.showHitFlash();
                this.scene.remove(snowball.mesh);
                this.aiSnowballs.splice(i, 1);
                this.updateUI();

                const winner = this.state.checkWin();
                if (winner) this.endGame(winner);
                continue;
            }

            // Check ground collision
            if (snowball.mesh.position.y <= 0) {
                this.createExplosion(new THREE.Vector3(snowball.mesh.position.x, 0, snowball.mesh.position.z), 0.8);
                this.scene.remove(snowball.mesh);
                this.aiSnowballs.splice(i, 1);
                continue;
            }

            // Remove if lifetime expired or out of bounds
            if (snowball.lifetime <= 0 || Math.abs(snowball.mesh.position.x) > 50 ||
                Math.abs(snowball.mesh.position.z) > 50) {
                this.scene.remove(snowball.mesh);
                this.aiSnowballs.splice(i, 1);
            }
        }
    }

    updateExplosions(delta) {
        for (let i = this.explosions.length - 1; i >= 0; i--) {
            const explosion = this.explosions[i];
            explosion.age += delta;

            // Update each particle
            for (const particle of explosion.particles) {
                // Move particle
                particle.position.add(
                    particle.userData.velocity.clone().multiplyScalar(delta)
                );

                // Apply gravity
                particle.userData.velocity.y -= 9.8 * delta;

                // Fade out
                const progress = explosion.age / explosion.lifetime;
                particle.material.opacity = 1 - progress;
                particle.scale.setScalar(1 - progress * 0.5);
            }

            // Remove explosion when done
            if (explosion.age >= explosion.lifetime) {
                for (const particle of explosion.particles) {
                    this.scene.remove(particle);
                    particle.geometry.dispose();
                    particle.material.dispose();
                }
                this.explosions.splice(i, 1);
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

    showHitFlash() {
        const flash = document.getElementById('hit-flash');
        flash.classList.add('show');
        setTimeout(() => {
            flash.classList.remove('show');
        }, 200);
    }

    createSnowflakes() {
        const container = document.getElementById('snowflakes');
        if (!container) return;

        // Clear existing snowflakes
        container.innerHTML = '';

        // Create 50 snowflakes
        for (let i = 0; i < 50; i++) {
            const snowflake = document.createElement('div');
            snowflake.className = 'snowflake';
            snowflake.textContent = '❄';

            // Random horizontal position
            snowflake.style.left = Math.random() * 100 + '%';

            // Random size
            const size = 0.5 + Math.random() * 1;
            snowflake.style.fontSize = size + 'em';

            // Random animation duration (10-20 seconds)
            const duration = 10 + Math.random() * 10;
            snowflake.style.animationDuration = duration + 's';

            // Random delay
            snowflake.style.animationDelay = Math.random() * 5 + 's';

            // Random opacity
            snowflake.style.opacity = 0.3 + Math.random() * 0.7;

            container.appendChild(snowflake);
        }
    }

    restart() {
        // Hide game over screen
        document.getElementById('game-over-screen').classList.add('hidden');

        // Reset state
        this.state.reset();
        this.state.gameStarted = true;

        // Update opponent label based on game mode
        const opponentLabel = document.getElementById('opponent-label');
        if (this.gameMode === 'multiplayer') {
            opponentLabel.textContent = 'OPPONENT';
        } else {
            opponentLabel.textContent = 'AI';
        }

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

        // Clear explosions
        for (const explosion of this.explosions) {
            for (const particle of explosion.particles) {
                this.scene.remove(particle);
                particle.geometry.dispose();
                particle.material.dispose();
            }
        }
        this.explosions = [];

        this.updateUI();
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        const delta = this.clock.getDelta();

        if (this.state.gameStarted && !this.state.gameOver) {
            this.updatePlayer(delta);
            // Only update AI in AI mode, not in multiplayer
            if (this.gameMode === 'ai') {
                this.updateAI(delta);
            } else if (this.gameMode === 'multiplayer') {
                this.updateOpponentPosition(delta);
            }
            this.updateSnowballs(delta);
        }

        // Always update explosions even if game is paused
        this.updateExplosions(delta);

        // Update charge visual feedback
        this.updateChargeVisual();

        this.renderer.render(this.scene, this.camera);
    }

    updateChargeVisual() {
        if (!this.isCharging) return;

        const chargeDuration = Date.now() - this.throwChargeStart;
        const chargeLevel = Math.min(chargeDuration / 1000, 2); // Max 2 seconds
        const chargePercent = chargeLevel / 2; // 0 to 1

        const throwBtn = document.getElementById('throw-btn');

        // Scale button from 1.0 to 1.2
        const scale = 1.0 + (chargePercent * 0.2);
        throwBtn.style.transform = `scale(${scale})`;

        // Color gradient from blue to red
        const red = Math.floor(79 + (chargePercent * 176)); // 79 to 255
        const green = Math.floor(195 - (chargePercent * 115)); // 195 to 80
        const blue = Math.floor(247 - (chargePercent * 167)); // 247 to 80

        throwBtn.style.background = `linear-gradient(135deg, rgb(${red}, ${green}, ${blue}) 0%, rgb(${red - 30}, ${green - 30}, ${blue - 30}) 100%)`;
    }
}

// ============================================================================
// START GAME
// ============================================================================

window.addEventListener('DOMContentLoaded', () => {
    new SnowballGame();
});
