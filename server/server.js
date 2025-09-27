const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

// Game state management
const lobbies = new Map();
const playerSockets = new Map(); // socketId -> playerId mapping

// Game configuration
const GAME_CONFIG = {
  selectionTime: 10,
  performanceTime: 90,
  editingTime: 60,
  phaseCountdownTime: 3,
  segmentLength: 8
};

// Utility functions
function generateLobbyCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function generatePlayerId() {
  return Math.random().toString(36).substring(2, 15);
}

// Lobby management
class Lobby {
  constructor(code, hostSocketId) {
    this.code = code;
    this.hostSocketId = hostSocketId;
    this.players = new Map(); // playerId -> player object
    this.state = 'waiting'; // waiting, selection, performance, editing, final
    this.currentRound = 0;
    this.maxRounds = 0; // Will be set to number of players
    this.songs = new Map(); // songId -> song object
    this.currentSongAssignments = new Map(); // playerId -> songId they're working on
    this.timer = null;
    this.phaseStartTime = null;
    this.availableSounds = []; // 5 random sounds for this lobby
  }

  addPlayer(socketId, playerName) {
    const playerId = generatePlayerId();
    const player = {
      id: playerId,
      socketId: socketId,
      name: playerName,
      isReady: false,
      isHost: socketId === this.hostSocketId
    };

    this.players.set(playerId, player);
    playerSockets.set(socketId, playerId);
    return player;
  }

  removePlayer(socketId) {
    const playerId = playerSockets.get(socketId);
    if (playerId) {
      this.players.delete(playerId);
      playerSockets.delete(socketId);

      // If host left, assign new host
      if (socketId === this.hostSocketId && this.players.size > 0) {
        const newHost = this.players.values().next().value;
        this.hostSocketId = newHost.socketId;
        newHost.isHost = true;
      }
    }
    return playerId;
  }

  getPlayer(socketId) {
    const playerId = playerSockets.get(socketId);
    return playerId ? this.players.get(playerId) : null;
  }

  getAllPlayers() {
    return Array.from(this.players.values());
  }

  areAllPlayersReady() {
    return this.players.size > 0 && Array.from(this.players.values()).every(p => p.isReady);
  }

  startGame() {
    if (this.players.size < 2) {
      return false; // Need at least 2 players
    }

    this.maxRounds = this.players.size;
    this.currentRound = 0;

    // Initialize songs - one per player
    this.players.forEach(player => {
      const songId = `song_${player.id}`;
      this.songs.set(songId, {
        id: songId,
        originalCreator: player.id,
        events: [], // Array of sound events with filename references
        contributors: [player.id] // Track who has worked on this song
      });
    });

    // Select 5 random sounds for this lobby (from soundlist.json)
    this.selectRandomSounds();

    this.startSelectionPhase();
    return true;
  }

  selectRandomSounds() {
    try {
      // Load soundlist.json
      const soundListPath = path.join(__dirname, '..', 'soundlist.json');
      const soundList = JSON.parse(fs.readFileSync(soundListPath, 'utf8'));

      const selectedIndices = new Set();
      while (selectedIndices.size < 5) {
        selectedIndices.add(Math.floor(Math.random() * soundList.length));
      }

      this.availableSounds = Array.from(selectedIndices);
    } catch (error) {
      console.error('Failed to load soundlist.json:', error);
      // Fallback to simulated data
      const selectedIndices = new Set();
      while (selectedIndices.size < 5) {
        selectedIndices.add(Math.floor(Math.random() * 442));
      }
      this.availableSounds = Array.from(selectedIndices);
    }
  }

  startSelectionPhase() {
    this.state = 'selection';
    this.phaseStartTime = Date.now();

    // Reset player ready states
    this.players.forEach(player => {
      player.isReady = false;
    });
  }

  checkAllPlayersReady() {
    // Check if all players are ready to move on
    const allReady = Array.from(this.players.values()).every(player => player.isReady);

    if (allReady) {
      if (this.state === 'selection') {
        this.startPerformancePhase();
      }
    }
  }

  startPerformancePhase() {
    this.state = 'performance';
    this.phaseStartTime = Date.now();

    // Assign each player to work on their own song initially
    this.currentSongAssignments.clear();
    this.players.forEach(player => {
      const songId = `song_${player.id}`;
      this.currentSongAssignments.set(player.id, songId);
    });

    // Reset player ready states
    this.players.forEach(player => {
      player.isReady = false;
    });

    // Start performance timer
    this.timer = setTimeout(() => {
      this.endPerformancePhase();
    }, GAME_CONFIG.performanceTime * 1000);
  }

  endPerformancePhase() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    this.startEditingPhase();
  }

  startEditingPhase() {
    this.state = 'editing';
    this.phaseStartTime = Date.now();

    // Reset player ready states
    this.players.forEach(player => {
      player.isReady = false;
    });

    // Start editing timer
    this.timer = setTimeout(() => {
      this.endEditingPhase();
    }, GAME_CONFIG.editingTime * 1000);
  }

  endEditingPhase() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    this.currentRound++;

    if (this.currentRound < this.maxRounds) {
      // Move to next round - rotate song assignments
      this.rotateSongAssignments();
      this.startPerformancePhase();
    } else {
      // All rounds complete, go to final phase
      this.startFinalPhase();
    }
  }

  rotateSongAssignments() {
    // Implement Gartic Phone-style rotation
    const playerIds = Array.from(this.players.keys());
    const newAssignments = new Map();

    playerIds.forEach((playerId, index) => {
      // Each player gets the song from the previous player in the rotation
      const prevIndex = (index - 1 + playerIds.length) % playerIds.length;
      const prevPlayerId = playerIds[prevIndex];
      const songId = this.currentSongAssignments.get(prevPlayerId);

      newAssignments.set(playerId, songId);

      // Add this player as a contributor to the song
      const song = this.songs.get(songId);
      if (!song.contributors.includes(playerId)) {
        song.contributors.push(playerId);
      }
    });

    this.currentSongAssignments = newAssignments;
  }

  startFinalPhase() {
    this.state = 'final';
    this.phaseStartTime = Date.now();
  }

  submitSong(playerId, songData) {
    // For this simplified version, just store the song data directly
    // In a full multiplayer implementation, you'd handle song rotation here
    const songId = `song_${playerId}_${Date.now()}`;

    this.songs.set(songId, {
      id: songId,
      playerId: playerId,
      songData: songData.songData, // Array of {audio, icon, time, pitch} objects
      submittedAt: Date.now()
    });

    console.log(`Stored song ${songId} with ${songData.songData.length} sound events`);
    return true;
  }

  getGameState() {
    return {
      code: this.code,
      state: this.state,
      currentRound: this.currentRound,
      maxRounds: this.maxRounds,
      players: this.getAllPlayers().map(p => ({
        id: p.id,
        name: p.name,
        isReady: p.isReady,
        isHost: p.isHost
      })),
      availableSounds: this.availableSounds,
      phaseTimeLeft: this.getPhaseTimeLeft(),
      currentSongAssignment: null // Will be set per player
    };
  }

  getPhaseTimeLeft() {
    if (!this.phaseStartTime) return 0;

    const elapsed = (Date.now() - this.phaseStartTime) / 1000;
    let totalTime;

    switch (this.state) {
      case 'selection':
        totalTime = GAME_CONFIG.selectionTime;
        break;
      case 'performance':
        totalTime = GAME_CONFIG.performanceTime;
        break;
      case 'editing':
        totalTime = GAME_CONFIG.editingTime;
        break;
      default:
        return 0;
    }

    return Math.max(0, totalTime - elapsed);
  }

  cleanup() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

// Socket.IO event handlers
io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // Create lobby
  socket.on('createLobby', (data, callback) => {
    const { playerName } = data;
    const code = generateLobbyCode();
    const lobby = new Lobby(code, socket.id);

    lobbies.set(code, lobby);
    const player = lobby.addPlayer(socket.id, playerName);

    socket.join(code);

    callback({
      success: true,
      lobbyCode: code,
      playerId: player.id,
      gameState: lobby.getGameState()
    });

    console.log(`Lobby created: ${code} by ${playerName}`);
  });

  // Join lobby
  socket.on('joinLobby', (data, callback) => {
    const { lobbyCode, playerName } = data;
    const lobby = lobbies.get(lobbyCode);

    if (!lobby) {
      callback({ success: false, error: 'Lobby not found' });
      return;
    }

    if (lobby.state !== 'waiting') {
      callback({ success: false, error: 'Game already in progress' });
      return;
    }

    const player = lobby.addPlayer(socket.id, playerName);
    socket.join(lobbyCode);

    const gameState = lobby.getGameState();

    callback({
      success: true,
      playerId: player.id,
      gameState: gameState
    });

    // Notify all players in lobby
    socket.to(lobbyCode).emit('playerJoined', {
      player: {
        id: player.id,
        name: player.name,
        isReady: player.isReady,
        isHost: player.isHost
      },
      gameState: gameState
    });

    console.log(`${playerName} joined lobby ${lobbyCode}`);
  });

  // Player ready
  socket.on('playerReady', (data) => {
    const lobby = findLobbyBySocket(socket.id);
    if (!lobby) return;

    const player = lobby.getPlayer(socket.id);
    if (!player) return;

    player.isReady = true;

    // Notify all players
    io.to(lobby.code).emit('playerReady', {
      playerId: player.id,
      gameState: lobby.getGameState()
    });

    // Start game if all players are ready
    if (lobby.areAllPlayersReady() && lobby.state === 'waiting') {
      if (lobby.startGame()) {
        io.to(lobby.code).emit('gameStarted', {
          gameState: lobby.getGameState()
        });
      }
    }

    console.log(`${player.name} is ready in lobby ${lobby.code}`);
  });

  // Player completed selection phase (optional tracking)
  socket.on('completeSelection', () => {
    const lobby = findLobbyBySocket(socket.id);
    if (!lobby) return;

    const player = lobby.getPlayer(socket.id);
    if (!player) return;

    // Just log for tracking - no server action needed since clients handle their own phases
    console.log(`${player.name} completed sound selection`);
  });

  // Submit song (final song data with filenames)
  socket.on('submitSong', (data) => {
    const { songData } = data; // Array of {audio, icon, time, pitch} objects
    const lobby = findLobbyBySocket(socket.id);
    if (!lobby) return;

    const player = lobby.getPlayer(socket.id);
    if (!player) return;

    const success = lobby.submitSong(player.id, { songData });

    if (success) {
      // Notify all players (optional - for UI feedback)
      io.to(lobby.code).emit('songSubmitted', {
        playerId: player.id,
        playerName: player.name
      });

      console.log(`${player.name} submitted song with ${songData.length} sounds in lobby ${lobby.code}`);
    }
  });

  // Get current song assignment
  socket.on('getCurrentSong', (callback) => {
    const lobby = findLobbyBySocket(socket.id);
    if (!lobby) {
      callback({ success: false, error: 'Not in a lobby' });
      return;
    }

    const player = lobby.getPlayer(socket.id);
    if (!player) {
      callback({ success: false, error: 'Player not found' });
      return;
    }

    const songId = lobby.currentSongAssignments.get(player.id);
    const song = songId ? lobby.songs.get(songId) : null;

    callback({
      success: true,
      song: song ? {
        id: song.id,
        events: song.events,
        contributors: song.contributors
      } : null,
      gameState: {
        ...lobby.getGameState(),
        currentSongAssignment: songId
      }
    });
  });

  // Get all final songs
  socket.on('getFinalSongs', (callback) => {
    const lobby = findLobbyBySocket(socket.id);
    if (!lobby) {
      callback({ success: false, error: 'Not in a lobby' });
      return;
    }

    const songs = Array.from(lobby.songs.values()).map(song => ({
      id: song.id,
      playerId: song.playerId,
      songData: song.songData, // Array of {audio, icon, time, pitch} objects
      submittedAt: song.submittedAt
    }));

    callback({
      success: true,
      songs: songs
    });
  });

  // Disconnect handling
  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);

    const lobby = findLobbyBySocket(socket.id);
    if (lobby) {
      const playerId = lobby.removePlayer(socket.id);

      if (lobby.players.size === 0) {
        // Clean up empty lobby
        lobby.cleanup();
        lobbies.delete(lobby.code);
        console.log(`Lobby ${lobby.code} cleaned up`);
      } else {
        // Notify remaining players
        io.to(lobby.code).emit('playerLeft', {
          playerId: playerId,
          gameState: lobby.getGameState()
        });
      }
    }
  });
});

// Helper functions
function findLobbyBySocket(socketId) {
  for (const lobby of lobbies.values()) {
    if (lobby.players.has(playerSockets.get(socketId))) {
      return lobby;
    }
  }
  return null;
}

// API endpoints
app.get('/api/lobbies', (req, res) => {
  const lobbyList = Array.from(lobbies.values()).map(lobby => ({
    code: lobby.code,
    playerCount: lobby.players.size,
    state: lobby.state
  }));

  res.json(lobbyList);
});

app.get('/api/lobby/:code', (req, res) => {
  const lobby = lobbies.get(req.params.code.toUpperCase());
  if (!lobby) {
    res.status(404).json({ error: 'Lobby not found' });
    return;
  }

  res.json(lobby.getGameState());
});

// Serve the main game
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Game available at http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');

  // Clean up all lobbies
  lobbies.forEach(lobby => {
    lobby.cleanup();
  });

  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
