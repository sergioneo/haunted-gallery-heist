# ❄️ Snowball Showdown 3D

A first-person 3D snowball shooter game built with Three.js. Battle against an AI opponent in a snowy backyard - first to 10 hits wins!

## 🎮 Game Overview

Experience an epic snowball fight in full 3D! Navigate a backyard with a house, trees, and bushes. Find snow patches to roll snowballs, then take aim at your AI opponent. But watch out - they're shooting back!

### Features
- **Full 3D Graphics** - Built with Three.js for smooth 3D rendering
- **First-Person POV** - Immersive camera perspective
- **Mobile-Optimized Controls** - Virtual joystick + on-screen buttons
- **AI Opponent** - Intelligent enemy that collects snow and shoots at you
- **Interactive Environment** - House, trees, bushes, and snow patches
- **Score to Win** - First player to 10 hits wins the match
- **Instant Restart** - Jump right back into the action

## 🕹️ How to Play

### Controls
- **Left Joystick** - Move your character (forward, backward, left, right)
- **Drag Screen** - Look around (aim your shots)
- **ROLL SNOWBALL** - Collect snow when near white snow patches
- **THROW** - Launch your snowball at the AI opponent

### Gameplay
1. Move around the map using the virtual joystick
2. Find white circular **snow patches** on the ground
3. Get close to a snow patch and press **ROLL SNOWBALL**
4. Aim at the red AI opponent by dragging the screen
5. Press **THROW** to launch your snowball
6. Hit the AI to score points
7. **First to 10 hits wins!**

### Strategy Tips
- The AI will chase snow patches and shoot at you automatically
- Use the house and trees for cover
- Plan your route to snow patches carefully
- Lead your shots - the AI is moving!
- Watch for incoming AI snowballs

## 🎨 Environment

The 3D map includes:
- 🏠 **House** - Brown wooden house with red roof (provides cover)
- 🌳 **Trees** - Pine trees around the perimeter
- 🌿 **Bushes** - Green bushes scattered around
- ⚪ **Snow Patches** - White circles where you can roll snowballs (6 locations)
- 🟢 **Grass** - Green ground plane

## 🚀 Running Locally

### Option 1: Direct File Open
Open `index.html` directly in a modern web browser (Chrome recommended for best performance).

### Option 2: Local Server (Recommended)
```bash
# Using Python 3
python3 -m http.server 8000

# Using Python 2
python -m SimpleHTTPServer 8000

# Using Node.js
npx http-server -p 8000
```

Then navigate to `http://localhost:8000`

## 📦 Deploying to Netlify

### Method 1: Drag & Drop (Easiest)
1. Go to [netlify.com](https://www.netlify.com/)
2. Sign up or log in
3. Drag the entire project folder onto the Netlify dashboard
4. Your game goes live instantly!

### Method 2: Git Deploy
1. Push this code to a GitHub repository
2. In Netlify, click "New site from Git"
3. Connect your repository
4. Leave build settings empty (it's a static site)
5. Deploy!

### Method 3: Netlify CLI
```bash
npm install -g netlify-cli
cd snowball-showdown
netlify deploy --prod
```

## 🎯 Technical Details

### Tech Stack
- **Three.js r160** - 3D graphics engine
- **Vanilla JavaScript** - No frameworks, no build step
- **HTML5 Canvas** - WebGL rendering
- **CSS3** - UI styling and responsiveness

### Architecture
```
game.js
├── GameState - Manages scores and game flow
├── SnowballGame - Main game class
│   ├── initThree() - Three.js setup
│   ├── initScene() - Create 3D environment
│   ├── initControls() - Touch/mouse input
│   ├── updatePlayer() - Player movement
│   ├── updateAI() - AI behavior
│   └── updateSnowballs() - Projectile physics
```

### 3D Objects
- **Player**: First-person camera at 1.6m height
- **AI**: Red capsule geometry with simple AI
- **Snowballs**: White spheres with physics
- **House**: Composite of boxes and cone
- **Trees**: Cylinder trunk + cone foliage
- **Bushes**: Flattened sphere geometry

### Game Mechanics

**Player Movement**
- Virtual joystick for 8-directional movement
- Speed: 5 units/second
- Collision detection with house and boundaries

**Camera Control**
- First-person perspective
- Touch drag to look around
- Pitch clamped to prevent over-rotation

**Snowball System**
- Must be near snow patches (within 3 units)
- Snowballs travel at 15 units/second
- 5-second lifetime before despawning
- Hit detection radius: 1 unit

**AI Behavior**
- Pathfinds to nearest snow patch when empty
- Shoots at player every 3 seconds when armed
- Moves with 30% inaccuracy for fairness
- Speed: 3 units/second (slower than player)

**Win Condition**
- First to 10 hits wins
- Game over screen with final score
- Instant restart option

## 📱 Browser Compatibility

Tested and working on:
- ✅ Chrome (Desktop & Mobile)
- ✅ Firefox (Desktop)
- ✅ Safari (iOS & Desktop)
- ✅ Edge
- ✅ Android Chrome

Requires WebGL support. Works best on devices from 2018+.

## 📝 File Structure

```
snowball-showdown/
├── index.html          # Main HTML with UI
├── styles.css          # Styling and mobile controls
├── game.js             # Complete game code (~900 lines)
└── README.md           # This file
```

## 🎮 Performance

- **Target**: 60 FPS on modern devices
- **Optimized**: Shadow mapping, fog culling
- **Mobile**: Touch-optimized with virtual joystick
- **Lightweight**: ~900 lines of code, no external assets

## 🔧 Configuration

Edit `CONFIG` object in `game.js` to tweak gameplay:

```javascript
const CONFIG = {
    PLAYER_SPEED: 5,           // Player movement speed
    CAMERA_SENSITIVITY: 0.002, // Look sensitivity
    SNOWBALL_SPEED: 15,        // Projectile speed
    AI_SPEED: 3,               // AI movement speed
    AI_SHOOT_INTERVAL: 3000,   // AI shoot delay (ms)
    SNOW_PATCH_DISTANCE: 3,    // Pickup range
    WIN_SCORE: 10              // Points to win
};
```

## 🚀 Future Enhancement Ideas

- Multiple AI difficulty levels
- Power-ups (rapid fire, bigger snowballs)
- Multiple maps/environments
- Multiplayer support (local or online)
- Weather effects (snowfall animation)
- Sound effects and music
- Player customization
- Leaderboards

## 📄 License

Free to use and modify for personal and educational purposes.

## 🙏 Credits

Built with Three.js by the Three.js team.
Game design and code implementation by Claude.

---

**Ready for a snowball fight? Let's go! ❄️⛄**
