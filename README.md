# 🎮 Haunted Gallery Heist

A mobile-first stealth heist game built with Phaser 3. Steal valuable loot from a haunted art gallery while avoiding spotlights and ghosts!

## 🎯 Game Overview

You're a master thief breaking into a haunted gallery. You have exactly **60 seconds** to steal as much loot as possible and extract it to your van. But beware - the gallery is protected by rotating spotlights and patrolling ghosts!

### Features
- **Mobile-first touch controls** - Drag anywhere to move
- **Dynamic difficulty** - Threats intensify over time
- **Score multiplier system** - Chain extractions for massive bonuses
- **8 unique layouts** - Randomized each run
- **Persistent stats** - Track your best scores, perfect stealth runs, and extraction streaks
- **60-second rounds** - Fast, replayable sessions

## 🕹️ How to Play

### Controls
- **Drag** anywhere on screen to move your thief
- **Release** to stop moving
- Walk over loot to pick it up
- Bring loot to the green **VAN EXIT** zone (bottom-left) to score

### Loot Types
- 🖼️ **Painting** (50 pts) - Light, minimal speed penalty
- 🗿 **Statue** (120 pts) - Medium weight, -15% speed
- 💎 **Gem Case** (250 pts) - Heavy, -25% speed, HIGH RISK/REWARD

### Threats
- **Spotlights** 🔦 - Rotating and sweeping detection cones
  - Getting spotted: -0.5x multiplier, resets extraction streak
- **Ghosts** 👻 - Patrol the gallery on set paths
  - Collision: drops carried loot, "spooked" debuff, -0.5x multiplier

### Scoring
- Score only increases when you extract loot at the van
- **Extraction bonus**: +25% of loot value
- **Multiplier**: Starts at 1.0x
  - +0.15x per successful extraction (max 3.0x)
  - -0.5x when spotted or hit (min 1.0x)
- **Perfect Stealth**: Complete a run without getting spotted or hit

## 🚀 Running Locally

### Option 1: Direct File Open
Simply open `index.html` in a modern web browser (Chrome recommended).

### Option 2: Local Server (Recommended)
```bash
# Using Python 3
python3 -m http.server 8000

# Using Python 2
python -m SimpleHTTPServer 8000

# Using Node.js (if you have http-server installed)
npx http-server -p 8000
```

Then navigate to `http://localhost:8000`

## 📦 Deploying to Netlify

### Method 1: Drag & Drop
1. Go to [Netlify](https://www.netlify.com/)
2. Sign up or log in
3. Drag and drop the entire `haunted-gallery-heist` folder onto the Netlify dashboard
4. Your game will be live at a Netlify URL instantly!

### Method 2: Git Repository
1. Create a new repository on GitHub
2. Push this code to the repository:
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin YOUR_REPO_URL
git push -u origin main
```
3. In Netlify, click "New site from Git"
4. Connect your repository
5. Build settings:
   - **Build command**: Leave empty
   - **Publish directory**: Leave empty or use `.`
6. Deploy!

### Method 3: Netlify CLI
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
cd haunted-gallery-heist
netlify deploy --prod
```

## 📊 Stats Tracking

The game automatically tracks and persists:
- **Best Score** - Your highest score ever
- **Best Perfect Stealth Score** - Highest score without getting spotted/hit
- **Longest Extraction Streak** - Most consecutive extractions without penalties
- **Last 10 Scores** - Your recent performance history

Stats are stored in browser localStorage and persist across sessions.

## 🎨 Technical Details

### Tech Stack
- **Phaser 3.70.0** - Game framework
- **Vanilla JavaScript** - No TypeScript, no build step
- **HTML5 Canvas** - Rendering
- **LocalStorage** - Persistent data

### Architecture
- **Modular class structure** - Player, Spotlight, Ghost, Loot classes
- **Scene system** - Boot scene + Game scene
- **Arcade Physics** - Collision detection
- **Procedural graphics** - No external image assets required

### Performance
- Optimized for mobile devices
- FIT scaling with automatic centering
- Touch-optimized input handling
- Efficient rendering with Phaser Graphics

## 🎮 Game Design Notes

### Difficulty Progression
- **0-15s**: No ghosts, learn the layout
- **15-35s**: 1 ghost appears
- **35-60s**: 2 ghosts, increased speeds
- Spotlights rotate faster over time

### Strategy Tips
- Plan your route before grabbing high-value loot
- Learn spotlight patterns to time your movements
- Build multiplier with safe extractions before going for gems
- The van is always in the bottom-left - build muscle memory!
- Ghost paths are predictable - observe before committing

### Risk/Reward
- Paintings are safe but low value
- Statues offer decent points with manageable risk
- Gems can make or break a run - go big or go home!

## 🐛 Browser Compatibility

Tested and working on:
- ✅ Chrome (Desktop & Android)
- ✅ Firefox (Desktop)
- ✅ Safari (iOS & Desktop)
- ✅ Edge

For best performance, use Chrome on Android.

## 📝 File Structure

```
haunted-gallery-heist/
├── index.html          # Main HTML file
├── styles.css          # Styling and mobile optimizations
├── main.js             # Complete game code (~850 lines)
└── README.md           # This file
```

## 🎯 Future Enhancement Ideas

- Sound effects and background music
- Additional ghost behavior patterns
- Power-ups (speed boost, invisibility)
- More loot types with special mechanics
- Difficulty modes (Easy, Normal, Hard)
- Online leaderboards
- Multiple gallery themes

## 📄 License

Free to use and modify. Built as a demonstration of Phaser 3 mobile game development.

## 🙏 Credits

Built with Phaser 3 by the Phaser team.
Game design and code by [Your Name Here].

---

**Good luck, master thief! 💰👻**
