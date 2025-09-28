# Multiplayer Server

> Backend server for "Yo That's Heat" - A Gartic Phone-style collaborative music creation game

## Setup Instructions

### Prerequisites

- Node.js (version 14 or higher)
- npm (comes with Node.js)

### Installation

1. Navigate to the server directory:

   ```bash
   cd server
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the server:

   ```bash
   npm start
   ```

   Or for development with auto-restart:

   ```bash
   npm run dev
   ```

4. The server will start on port 3000 by default. You can access the game at:
   ```
   http://localhost:3000
   ```

## How Multiplayer Works

### Game Flow

1. **Lobby Creation**: Players can create a lobby with a 6-character code
2. **Joining**: Other players join using the lobby code
3. **Ready Up**: All players must ready up to start the game
4. **Selection Phase**: 10-second timer, players select 3 sounds from 5 options
5. **Performance Phase**: 90-second timer, players record their music
6. **Editing Phase**: 60-second timer, players edit pitch of notes
7. **Rotation**: Songs rotate between players (Gartic Phone style)
8. **Final Phase**: All completed songs are available for playback

### Technical Details

- **WebSocket Communication**: Real-time multiplayer using Socket.IO
- **Game State Synchronization**: Server manages all game state and timing
- **Sound Selection**: Server provides 5 random sounds per lobby
- **Song Rotation**: Each player works on every song once
- **Event System**: Sound events (timing, pitch) are stored server-side

### API Endpoints

- `GET /api/lobbies` - List all active lobbies
- `GET /api/lobby/:code` - Get specific lobby information
- `GET /` - Serve the game client

### Security Notes

This is designed for a game jam environment where security is not the primary concern. The client is trusted to send valid sound events and selections.
