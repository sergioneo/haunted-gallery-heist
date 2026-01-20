# Firebase Setup Instructions

## Step 1: Create Firebase Project

1. Go to https://firebase.google.com/
2. Click **"Get Started"** and sign in with your Google account
3. Click **"Add project"**
4. Name it **"snowball-showdown"** (or any name you prefer)
5. **Disable Google Analytics** (not needed for this game)
6. Click **"Create project"**

## Step 2: Set Up Realtime Database

1. In the left sidebar, click **"Realtime Database"**
2. Click **"Create Database"**
3. Choose location closest to you
4. Start in **"Test mode"** for now (we'll secure it later)
5. Click **"Enable"**

## Step 3: Get Your Firebase Config

1. Click the **gear icon** (⚙️) next to "Project Overview"
2. Select **"Project settings"**
3. Scroll down to **"Your apps"** section
4. Click the **web icon** (`</>`)
5. Register app with nickname: **"snowball-game"**
6. **Copy the `firebaseConfig` object** - you'll need this!

It will look like this:
```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  databaseURL: "https://your-project-default-rtdb.firebaseio.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

## Step 4: Add Config to game.js

1. Open `game.js`
2. Find the Firebase configuration section (around line 15)
3. **Replace the placeholder config** with your actual Firebase config
4. Save the file

## Step 5: Test It!

1. Open `index.html` in your browser
2. Choose **"ONLINE"** mode
3. Click **"CREATE ROOM"**
4. If you see a 6-character room code, Firebase is working! 🎉

## Security Rules (Optional but Recommended)

Once you've tested it works, update your Firebase Realtime Database rules:

1. Go to Firebase Console → Realtime Database → Rules
2. Replace with:

```json
{
  "rules": {
    "rooms": {
      "$roomId": {
        ".read": true,
        ".write": true,
        ".indexOn": ["createdAt"]
      }
    }
  }
}
```

3. Click **"Publish"**

## How to Play Online

**To HOST a game:**
1. Click **"ONLINE"** → **"CREATE ROOM"**
2. Share the 6-character code with your opponent
3. Wait for them to join
4. Click **"START GAME"** when both ready!

**To JOIN a game:**
1. Click **"ONLINE"**
2. Enter the 6-character room code
3. Click **"JOIN ROOM"**
4. Wait for host to start!

## Troubleshooting

**"Firebase not configured" error:**
- Make sure you replaced the placeholder config in game.js
- Check that all fields (apiKey, databaseURL, etc.) are correct

**"Room not found" error:**
- Double-check the room code
- Room codes expire after some time of inactivity

**Can't connect:**
- Check your internet connection
- Make sure Firebase Realtime Database is enabled
- Verify the databaseURL in your config is correct

## Cost

Firebase Realtime Database is **FREE** for your use case:
- Free tier: 1GB storage, 10GB/month download
- Your game uses < 1KB per game session
- You can play 10,000+ games per month for free!

Enjoy the game! ❄️⚔️❄️
