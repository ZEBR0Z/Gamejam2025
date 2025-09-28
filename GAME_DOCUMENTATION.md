# Gartic Phone-Style Music Game

A collaborative music creation game where players work together to create songs in a Gartic Phone-style rotation system.

## 🎵 Game Overview

Players take turns adding to each other's musical creations, similar to the drawing game Gartic Phone. Each player starts with their own song, and over multiple rounds, songs rotate between players who add their own 8-second segments.

### Game Flow

1. **Lobby Phase**: Players create or join lobbies (2+ players required)
2. **Selection Phase**: Each player selects 3 sounds from 5 random options (10 seconds)
3. **Multiple Rounds** of collaborative creation:
   - **Performance Phase**: Record 8-second music segments (90 seconds)
   - **Editing Phase**: Adjust pitch and timing of recorded notes (60 seconds)
   - **Waiting Phase**: Wait for all players to complete their segments
   - **Preview Phase**: Listen to previous player's work (rounds 2+) (this shows only the past 1 segment, not all previous segments)
4. **Final Showcase**: Play all completed collaborative songs

### Example with 3 Players

- **Round 1**: Player A creates Song A, Player B creates Song B, Player C creates Song C
- **Round 2**: Player A adds to Song C, Player B adds to Song A, Player C adds to Song B
- **Round 3**: Player A adds to Song B, Player B adds to Song C, Player C adds to Song A
- **Result**: 3 songs, each 24 seconds long (3 × 8 seconds), each created by all 3 players

## 🏗️ Architecture

### Server-Side (`server/server.js`)

**Core Classes:**
- `Lobby`: Manages game sessions, player assignments, and song rotation
- Socket.IO handlers for real-time multiplayer communication

**Key Features:**
- Gartic Phone-style song rotation logic
- Round management and phase transitions
- Song segment storage and retrieval
- Player synchronization

### Client-Side

**Core Systems:**
- `MultiplayerGame.js`: Main game orchestrator
- `MultiplayerManager.js`: Server communication
- `AudioEngine.js`: Audio playback and recording
- `GameState.js`: Client-side state management
- `UIManager.js`: DOM manipulation and screen management
- `CanvasRenderer.js`: Timeline and visual rendering

**Game Phases:**
- `SelectionPhase.js`: Sound selection interface
- `PerformancePhase.js`: Music recording with timeline
- `EditingPhase.js`: Pitch/timing adjustment tools
- `WaitingPhase.js`: Multiplayer synchronization screen
- `SongPreviewPhase.js`: Preview previous work before adding
- `FinalShowcasePhase.js`: Display completed collaborative songs

## 🎮 Controls

### Performance Phase
- **Keys 1, 2, 3**: Play selected sounds and record them
- **Right-click timeline**: Remove recorded notes
- **Transport controls**: Play/pause, restart, seek, finish early

### Editing Phase
- **Drag notes vertically**: Adjust pitch (-12 to +12 semitones)
- **Transport controls**: Play/pause, restart, seek
- **Done button**: Finish editing early

### Final Showcase
- **Navigation**: Previous/Next song buttons
- **Transport controls**: Play/pause, restart, seek
- **Exit options**: Play again or return to menu

## 🔧 Technical Details

### Song Data Structure

```javascript
// Server-side song storage
{
  id: "song_playerId",
  originalCreator: "playerId",
  segments: [
    {
      roundNumber: 0,
      playerId: "player1",
      songData: [
        {
          audio: "sounds/21.wav",
          icon: "sounds/21__icon.png",
          time: 2.5,
          pitch: 0
        }
      ],
      submittedAt: timestamp
    }
  ],
  contributors: ["player1", "player2", "player3"],
  selectedSounds: [...] // Original sound selection
}
```

### Phase Transitions

```
Lobby → Selection → Performance → Editing → Waiting
                        ↑                      ↓
                    Preview ←──────────────────┘
                        ↓
                   Final Showcase
```

### Round Management

- `maxRounds = numberOfPlayers`
- Each song passes through all players exactly once
- Songs rotate using `(index - 1 + length) % length` formula
- Round submissions tracked to prevent duplicates

## 🚀 Setup and Running

### Prerequisites
- Node.js (for server)
- Modern web browser with Web Audio API support

### Installation

1. **Install server dependencies:**
   ```bash
   cd server
   npm install
   ```

2. **Start the server:**
   ```bash
   cd server
   node server.js
   ```

3. **Open the game:**
   Navigate to `http://localhost:3000` in your browser

### File Structure

```
game_jam/
├── server/
│   ├── server.js          # Main server file
│   ├── package.json       # Server dependencies
│   └── README.md         # Server documentation
├── js/
│   ├── core/             # Core game systems
│   │   ├── AudioEngine.js
│   │   ├── GameState.js
│   │   ├── UIManager.js
│   │   ├── CanvasRenderer.js
│   │   ├── InputController.js
│   │   ├── Timer.js
│   │   └── MultiplayerManager.js
│   ├── phases/           # Game phase implementations
│   │   ├── SelectionPhase.js
│   │   ├── PerformancePhase.js
│   │   ├── EditingPhase.js
│   │   ├── WaitingPhase.js
│   │   ├── SongPreviewPhase.js
│   │   └── FinalShowcasePhase.js
│   ├── MultiplayerGame.js # Main game class
│   └── MusicGame.js      # Single-player version
├── sounds/               # Audio files and icons
├── index.html           # Main HTML file
├── style.css           # Game styling
├── soundlist.json      # Available sounds database
└── GAME_DOCUMENTATION.md # This file
```

## 🎨 Customization

### Adding New Sounds

1. Add audio files to `sounds/` directory
2. Add corresponding icon files (same name + `__icon.png`)
3. Update `soundlist.json` with new entries
4. Run `python create_soundlist.py` to regenerate the sound list

### Adjusting Game Timing

Edit `GAME_CONFIG` in `server/server.js`:

```javascript
const GAME_CONFIG = {
  selectionTime: 10,      // Sound selection time
  performanceTime: 90,    // Recording time
  editingTime: 60,        // Editing time
  phaseCountdownTime: 3,  // Phase transition countdown
  segmentLength: 8        // Length of each song segment
};
```

### UI Customization

- Modify `style.css` for visual styling
- Update `index.html` for layout changes
- Adjust `UIManager.js` for new UI elements

## 🐛 Troubleshooting

### Common Issues

1. **Audio not playing**: Check browser audio permissions and Web Audio API support
2. **Connection issues**: Ensure server is running on correct port (3000)
3. **Sync problems**: Check browser console for WebSocket connection errors
4. **Sound loading failures**: Verify sound files exist and are accessible

### Debug Features

- Server logs show detailed game state transitions
- Client console shows phase changes and audio loading
- Network tab shows WebSocket communication

## 📝 Development Notes

### Key Design Decisions

1. **Gartic Phone Rotation**: Songs rotate between players to ensure everyone contributes to every song
2. **Segment-Based Storage**: Each round creates a new segment, allowing for complex collaborative pieces
3. **Client-Side Audio**: Audio processing happens on client for low latency
4. **Real-Time Sync**: WebSocket communication keeps all players synchronized

### Performance Considerations

- Audio buffers cached on client-side
- Canvas rendering optimized for 60fps
- Server state kept minimal for scalability
- Event scheduling uses Web Audio API timing

### Future Enhancements

- Spectator mode for completed games
- Recording/export functionality
- More sound effect options
- Advanced editing tools (volume, effects)
- Tournament/bracket systems
