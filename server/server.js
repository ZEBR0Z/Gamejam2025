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

/**
 * GARTIC PHONE-STYLE MUSIC GAME SERVER
 *
 * Game Flow:
 * 1. Players create/join lobbies
 * 2. Each player selects 3 sounds from 5 random options
 * 3. Multiple rounds where players work on each other's songs:
 *    - Round 0: Each player creates their own song (8 seconds)
 *    - Round 1+: Songs rotate, players add to previous player's song
 * 4. Final showcase: Play all completed collaborative songs
 *
 * For N players: N songs, each with N segments (N × 8 seconds total)
 */

// Game state management
const lobbies = new Map(); // lobbyCode -> Lobby instance
const playerSockets = new Map(); // socketId -> playerId mapping

// Game configuration
const GAME_CONFIG = {
  segmentLength: 8        // Length of each song segment
};

// Utility functions
function generateLobbyCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function generatePlayerId() {
  return Math.random().toString(36).substring(2, 15);
}

/**
 * Lobby Class - Manages a single game session
 *
 * States: waiting -> selection -> performance -> editing -> waiting-for-players -> song-preview -> final-showcase
 *
 * Song Structure:
 * - Each song has multiple segments (one per round)
 * - Each segment contains sound events from one player
 * - Songs rotate between players each round (Gartic Phone style)
 */
class Lobby {
  constructor(code) {
    this.code = code;
    this.players = new Map(); // playerId -> player object
    this.state = 'waiting'; // waiting, selection, performance, editing, waiting-for-players, song-preview, final-showcase
    this.currentRound = 0;
    this.maxRounds = 0; // Will be set to number of players
    this.songs = new Map(); // songId -> song object with segments array
    this.currentSongAssignments = new Map(); // playerId -> songId they're working on
    this.roundSubmissions = new Map(); // playerId -> boolean (submitted this round)
    this.phaseStartTime = null;
    this.availableSounds = []; // 5 random sounds for this lobby
  }

  addPlayer(socketId, playerName) {
    const playerId = generatePlayerId();
    const player = {
      id: playerId,
      socketId: socketId,
      name: playerName,
      isReady: false
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

  /**
   * Start the game - initializes songs and begins selection phase
   * Each player gets their own song to start with
   */
  startGame() {
    if (this.players.size < 2) {
      return false; // Need at least 2 players
    }

    this.maxRounds = this.players.size; // Each song passes through all players
    this.currentRound = 0;

    // Initialize one song per player
    this.players.forEach(player => {
      const songId = `song_${player.id}`;
      this.songs.set(songId, {
        id: songId,
        originalCreator: player.id,
        segments: [], // Will contain one segment per round
        contributors: [player.id],
        selectedSounds: null // Set by first player in round 0
      });
    });

    this.selectRandomSounds(); // Pick 5 sounds for this lobby
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

  /**
   * Start selection phase - players choose 3 sounds from 5 options
   * Each player initially works on their own song
   */
  startSelectionPhase() {
    this.state = 'selection';
    this.phaseStartTime = Date.now();

    // Assign each player to their own song initially
    this.currentSongAssignments.clear();
    this.players.forEach(player => {
      const songId = `song_${player.id}`;
      this.currentSongAssignments.set(player.id, songId);
    });

    // Reset ready states
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

    // Reset player ready states
    this.players.forEach(player => {
      player.isReady = false;
    });
  }

  /**
   * Start waiting phase - players submit their completed segments
   */
  startWaitingForPlayers() {
    this.state = 'waiting-for-players';
    this.phaseStartTime = Date.now();
  }

  /**
   * Check if all players have submitted their songs for the current round
   * If so, either move to next round or end the game
   */
  checkAllPlayersSubmitted() {
    const allSubmitted = Array.from(this.players.keys()).every(playerId =>
      this.roundSubmissions.get(playerId) === true
    );

    if (allSubmitted) {
      this.currentRound++;

      if (this.currentRound < this.maxRounds) {
        // More rounds to go - rotate songs and continue
        this.roundSubmissions.clear(); // Reset for new round
        this.rotateSongAssignments();
        this.startSongPreview();
      } else {
        // All rounds complete - show final results
        this.startFinalShowcase();
      }
    }
  }

  /**
   * Start song preview phase - players listen to previous work before adding to it
   */
  startSongPreview() {
    this.state = 'song-preview';
    this.phaseStartTime = Date.now();

    // No server-side timer - clients handle their own timing
  }

  endSongPreviewPhase() {
    // All players continue to performance phase
    this.startPerformancePhase();
  }

  /**
   * Start final showcase - display all completed collaborative songs
   */
  startFinalShowcase() {
    this.state = 'final-showcase';
    this.phaseStartTime = Date.now();
  }

  /**
   * Rotate song assignments - Gartic Phone style
   * Each player gets the song from the previous player in the rotation
   */
  rotateSongAssignments() {
    const playerIds = Array.from(this.players.keys());
    const newAssignments = new Map();

    playerIds.forEach((playerId, index) => {
      // Get song from previous player (with wraparound)
      const prevIndex = (index - 1 + playerIds.length) % playerIds.length;
      const prevPlayerId = playerIds[prevIndex];
      const songId = this.currentSongAssignments.get(prevPlayerId);

      newAssignments.set(playerId, songId);

      // Track that this player will contribute to this song
      const song = this.songs.get(songId);
      if (song && !song.contributors.includes(playerId)) {
        song.contributors.push(playerId);
      }
    });

    this.currentSongAssignments = newAssignments;
  }

  startFinalPhase() {
    this.state = 'final';
    this.phaseStartTime = Date.now();
  }

  /**
   * Submit a song segment from a player
   * Adds the segment to the assigned song and checks if round is complete
   */
  submitSong(playerId, songData) {
    // Prevent duplicate submissions
    if (this.roundSubmissions.get(playerId) === true) {
      return false;
    }

    // Get assigned song
    const songId = this.currentSongAssignments.get(playerId);
    const song = this.songs.get(songId);

    if (!song) {
      console.error(`No song found for player ${playerId}`);
      return false;
    }

    // Prevent songs from getting too many segments
    if (song.segments.length >= this.maxRounds) {
      console.warn(`Song ${songId} already complete, ignoring submission`);
      return false;
    }

    // Add segment to song
    const segment = {
      roundNumber: this.currentRound,
      playerId: playerId,
      songData: songData.songData,
      submittedAt: Date.now()
    };

    song.segments.push(segment);

    // Store selected sounds from first round (for later rounds to use)
    if (this.currentRound === 0 && songData.selectedSounds) {
      song.selectedSounds = songData.selectedSounds;
    }

    // Mark player as submitted
    this.roundSubmissions.set(playerId, true);

    // Check if round is complete
    this.checkAllPlayersSubmitted();

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
        hasSubmitted: this.roundSubmissions.get(p.id) || false
      })),
      availableSounds: this.availableSounds,
      phaseTimeLeft: this.getPhaseTimeLeft(),
      currentSongAssignment: null // Will be set per player
    };
  }

  getPhaseTimeLeft() {
    // Server doesn't track phase timing - clients handle their own timers
    // Only return time for server-managed phases (none currently)
    return 0;
  }

  cleanup() {
    // Server cleanup - clients handle their own timers
  }
}

/**
 * SOCKET.IO EVENT HANDLERS
 *
 * Main events:
 * - createLobby: Creates a new game lobby
 * - joinLobby: Player joins existing lobby
 * - playerReady: Player indicates ready to start
 * - submitSong: Player submits completed song segment
 * - getPreviousSong: Get song data for preview phase
 * - continueToPerformance: Ready to move from preview to performance
 * - getFinalSongs: Get all completed songs for showcase
 */
io.on('connection', (socket) => {
  // Create lobby
  socket.on('createLobby', (data, callback) => {
    const { playerName } = data;
    const code = generateLobbyCode();
    const lobby = new Lobby(code);

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

    // Check if all players are ready
    if (lobby.areAllPlayersReady() && lobby.state === 'waiting') {
      // First notify all players that everyone is ready (triggers countdown)
      io.to(lobby.code).emit('allPlayersReady', {
        gameState: lobby.getGameState()
      });

      // Then start the game after a delay (3 seconds)
      setTimeout(() => {
        if (lobby.startGame()) {
          io.to(lobby.code).emit('gameStarted', {
            gameState: lobby.getGameState()
          });
        }
      }, 3000);
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
    const { songData, selectedSounds } = data; // Array of {audio, icon, time, pitch} objects + selected sounds
    const lobby = findLobbyBySocket(socket.id);
    if (!lobby) return;

    const player = lobby.getPlayer(socket.id);
    if (!player) return;

    const success = lobby.submitSong(player.id, { songData, selectedSounds });

    if (success) {
      // Notify all players about the submission and updated game state
      io.to(lobby.code).emit('songSubmitted', {
        playerId: player.id,
        playerName: player.name,
        gameState: lobby.getGameState()
      });

      // Check if we should transition to next phase
      if (lobby.state === 'waiting-for-players') {
        // Notify about waiting state update
        io.to(lobby.code).emit('waitingUpdate', {
          gameState: lobby.getGameState()
        });
      } else if (lobby.state === 'song-preview') {
        // All players submitted, moving to song preview
        io.to(lobby.code).emit('phaseChanged', {
          gameState: lobby.getGameState()
        });
      } else if (lobby.state === 'final-showcase') {
        // All rounds complete, moving to final showcase
        io.to(lobby.code).emit('phaseChanged', {
          gameState: lobby.getGameState()
        });
      }

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

  // Get previous song for preview
  socket.on('getPreviousSong', (callback) => {
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
    const song = lobby.songs.get(songId);

    if (!song) {
      callback({ success: false, error: 'No song assignment found' });
      return;
    }

    // Get the previous player's name
    const previousSegment = song.segments[song.segments.length - 1];
    const previousPlayer = previousSegment ? lobby.players.get(previousSegment.playerId) : null;

    callback({
      success: true,
      song: {
        id: song.id,
        segments: song.segments,
        selectedSounds: song.selectedSounds,
        contributors: song.contributors
      },
      previousPlayerName: previousPlayer ? previousPlayer.name : 'Unknown',
      gameState: lobby.getGameState()
    });
  });

  // Continue to performance phase from preview
  socket.on('continueToPerformance', () => {
    const lobby = findLobbyBySocket(socket.id);
    if (!lobby) return;

    const player = lobby.getPlayer(socket.id);
    if (!player) return;

    // Mark player as ready to continue
    player.isReady = true;

    // Check if all players are ready to continue
    const allReady = Array.from(lobby.players.values()).every(p => p.isReady);

    if (allReady) {
      // Reset ready states and start performance phase
      lobby.players.forEach(p => { p.isReady = false; });
      lobby.startPerformancePhase();

      io.to(lobby.code).emit('phaseChanged', {
        gameState: lobby.getGameState()
      });
    }
  });

  // Get all final songs for showcase
  socket.on('getFinalSongs', (callback) => {
    const lobby = findLobbyBySocket(socket.id);
    if (!lobby) {
      callback({ success: false, error: 'Not in a lobby' });
      return;
    }

    const songs = Array.from(lobby.songs.values()).map(song => ({
      id: song.id,
      originalCreator: song.originalCreator,
      segments: song.segments,
      selectedSounds: song.selectedSounds,
      contributors: song.contributors
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
