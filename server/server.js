const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..")));

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

const lobbies = new Map();
const playerSockets = new Map();
let soundList = null;

function loadSoundList() {
  try {
    const audioMapPath = path.join(__dirname, "..", "audiomap.json");
    const audioMap = JSON.parse(fs.readFileSync(audioMapPath, "utf8"));
    soundList = audioMap.sounds;
    console.log(`Loaded ${soundList.length} sounds`);
  } catch (error) {
    console.error("Failed to load audiomap.json:", error);
    soundList = [];
  }
}

loadSoundList();

function generateLobbyCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function generatePlayerId() {
  return Math.random().toString(36).substring(2, 15);
}

/**
 * Lobby - Manages a single game session
 *
 * States: waiting -> selection -> performance -> editing -> waiting_for_players -> preview -> showcase
 *
 * Song Structure:
 * - Each song has multiple segments (one per round)
 * - Each segment contains sound events from one player
 * - Songs rotate between players each round (Gartic Phone style)
 */
class Lobby {
  constructor(code) {
    this.code = code;
    this.players = new Map();
    this.state = "waiting";
    this.currentRound = 0;
    this.maxRounds = 0;
    this.songs = new Map();
    this.currentSongAssignments = new Map();
    this.roundSubmissions = new Map();
    this.availableSounds = [];
  }

  addPlayer(socketId, playerName) {
    const playerId = generatePlayerId();
    const player = {
      id: playerId,
      socketId: socketId,
      name: playerName,
      isReady: false,
    };

    this.players.set(playerId, player);
    playerSockets.set(socketId, playerId);
    return player;
  }

  removePlayer(socketId) {
    const playerId = playerSockets.get(socketId);
    if (playerId) {
      const player = this.players.get(playerId);
      this.players.delete(playerId);
      playerSockets.delete(socketId);
      return player;
    }
    return null;
  }

  getPlayer(socketId) {
    const playerId = playerSockets.get(socketId);
    return playerId ? this.players.get(playerId) : null;
  }

  getAllPlayers() {
    return Array.from(this.players.values());
  }

  areAllPlayersReady() {
    return (
      this.players.size > 0 &&
      Array.from(this.players.values()).every((p) => p.isReady)
    );
  }

  /**
   * Initializes N songs (one per player) and starts the selection phase.
   * Returns false if fewer than 2 players.
   */
  startGame() {
    if (this.players.size < 2) {
      return false;
    }

    this.maxRounds = this.players.size;
    this.currentRound = 0;

    this.players.forEach((player) => {
      const songId = `song_${player.id}`;
      this.songs.set(songId, {
        id: songId,
        originalCreator: player.id,
        segments: [],
        contributors: [player.id],
      });
    });

    this.selectRandomSounds();
    this.startSelectionPhase();
    return true;
  }

  /**
   * Selects 5 random sound indices from the available sound list for this lobby.
   */
  selectRandomSounds() {
    if (!soundList || soundList.length === 0) {
      console.error("No sounds available in audiomap.json");
      this.availableSounds = [];
      return;
    }

    const selectedIndices = new Set();
    const maxSounds = Math.min(5, soundList.length);
    while (selectedIndices.size < maxSounds) {
      selectedIndices.add(Math.floor(Math.random() * soundList.length));
    }

    this.availableSounds = Array.from(selectedIndices);
  }

  /**
   * Transitions to selection phase. Each player is assigned to their own song initially.
   */
  startSelectionPhase() {
    this.state = "selection";

    this.currentSongAssignments.clear();
    this.players.forEach((player) => {
      const songId = `song_${player.id}`;
      this.currentSongAssignments.set(player.id, songId);
    });

    this.players.forEach((player) => {
      player.isReady = false;
    });
  }

  /**
   * Checks if all players are ready. If so and in selection state, transitions to performance.
   */
  checkAllPlayersReady() {
    const allReady = Array.from(this.players.values()).every(
      (player) => player.isReady,
    );

    if (allReady && this.state === "selection") {
      this.startPerformancePhase();
    }
  }

  startPerformancePhase() {
    this.state = "performance";

    this.players.forEach((player) => {
      player.isReady = false;
    });
  }

  startWaitingForPlayers() {
    this.state = "waiting_for_players";
  }

  /**
   * Called after each player submits their segment.
   * If all submitted, either rotates songs for next round or moves to showcase.
   */
  checkAllPlayersSubmitted() {
    const allSubmitted = Array.from(this.players.keys()).every(
      (playerId) => this.roundSubmissions.get(playerId) === true,
    );

    if (allSubmitted) {
      this.currentRound++;

      if (this.currentRound < this.maxRounds) {
        this.roundSubmissions.clear();
        this.rotateSongAssignments();
        this.startSongPreview();
      } else {
        this.startFinalShowcase();
      }
    }
  }

  startSongPreview() {
    this.state = "preview";
  }

  endSongPreviewPhase() {
    this.startPerformancePhase();
  }

  startFinalShowcase() {
    this.state = "showcase";
  }

  /**
   * Rotates song assignments Gartic Phone style.
   * Each player receives the song from the previous player in the rotation order.
   */
  rotateSongAssignments() {
    const playerIds = Array.from(this.players.keys());
    const newAssignments = new Map();

    playerIds.forEach((playerId, index) => {
      const prevIndex = (index - 1 + playerIds.length) % playerIds.length;
      const prevPlayerId = playerIds[prevIndex];
      const songId = this.currentSongAssignments.get(prevPlayerId);

      newAssignments.set(playerId, songId);

      const song = this.songs.get(songId);
      if (song && !song.contributors.includes(playerId)) {
        song.contributors.push(playerId);
      }
    });

    this.currentSongAssignments = newAssignments;
  }

  /**
   * Adds a segment to the player's assigned song.
   * Stores backing track from first segment. Returns false if duplicate or invalid submission.
   */
  submitSong(playerId, songData) {
    if (this.roundSubmissions.get(playerId) === true) {
      return false;
    }

    const songId = this.currentSongAssignments.get(playerId);
    const song = this.songs.get(songId);

    if (!song) {
      console.error(`No song found for player ${playerId}`);
      return false;
    }

    if (song.segments.length >= this.maxRounds) {
      console.warn(`Song ${songId} already complete, ignoring submission`);
      return false;
    }

    const segment = {
      roundNumber: this.currentRound,
      playerId: playerId,
      songData: songData.songData,
      backingTrack: songData.backingTrack || null,
      submittedAt: Date.now(),
    };

    song.segments.push(segment);

    if (this.currentRound === 0 && songData.backingTrack) {
      song.backingTrack = songData.backingTrack;
    }

    this.roundSubmissions.set(playerId, true);
    this.checkAllPlayersSubmitted();

    return true;
  }

  getGameState() {
    return {
      code: this.code,
      state: this.state,
      currentRound: this.currentRound,
      maxRounds: this.maxRounds,
      players: this.getAllPlayers().map((p) => ({
        id: p.id,
        name: p.name,
        isReady: p.isReady,
        hasSubmitted: this.roundSubmissions.get(p.id) || false,
      })),
      availableSounds: this.availableSounds,
      currentSongAssignment: null,
    };
  }

  cleanup() {}
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
io.on("connection", (socket) => {
  socket.on("createLobby", (data, callback) => {
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
      gameState: lobby.getGameState(),
    });

    console.log(`Lobby created: ${code} by ${playerName}`);
  });

  socket.on("joinLobby", (data, callback) => {
    const { lobbyCode, playerName } = data;
    const lobby = lobbies.get(lobbyCode.toUpperCase());

    if (!lobby) {
      callback({ success: false, error: "Lobby not found." });
      return;
    }

    if (lobby.state !== "waiting") {
      callback({ success: false, error: "Game already in progress" });
      return;
    }

    const player = lobby.addPlayer(socket.id, playerName);
    socket.join(lobbyCode);

    const gameState = lobby.getGameState();

    callback({
      success: true,
      playerId: player.id,
      gameState: gameState,
    });

    socket.to(lobbyCode).emit("playerJoined", {
      player: {
        id: player.id,
        name: player.name,
        isReady: player.isReady,
      },
      gameState: gameState,
    });

    console.log(`${playerName} joined lobby ${lobbyCode}`);
  });

  socket.on("playerReady", (data) => {
    const lobby = findLobbyBySocket(socket.id);
    if (!lobby) return;

    const player = lobby.getPlayer(socket.id);
    if (!player) return;

    player.isReady = true;

    io.to(lobby.code).emit("playerReady", {
      playerId: player.id,
      gameState: lobby.getGameState(),
    });

    if (lobby.areAllPlayersReady() && lobby.state === "waiting") {
      io.to(lobby.code).emit("allPlayersReady", {
        gameState: lobby.getGameState(),
      });

      setTimeout(() => {
        if (lobby.startGame()) {
          io.to(lobby.code).emit("gameStarted", {
            gameState: lobby.getGameState(),
          });
        }
      }, 3000);
    }

    console.log(`${player.name} is ready in lobby ${lobby.code}`);
  });

  socket.on("completeSelection", () => {
    const lobby = findLobbyBySocket(socket.id);
    if (!lobby) return;

    const player = lobby.getPlayer(socket.id);
    if (!player) return;

    console.log(`${player.name} completed sound selection`);
  });

  socket.on("submitSong", (data) => {
    const { songData, backingTrack } = data;
    const lobby = findLobbyBySocket(socket.id);
    if (!lobby) return;

    const player = lobby.getPlayer(socket.id);
    if (!player) return;

    const success = lobby.submitSong(player.id, { songData, backingTrack });

    if (success) {
      io.to(lobby.code).emit("songSubmitted", {
        playerId: player.id,
        playerName: player.name,
        gameState: lobby.getGameState(),
      });

      if (lobby.state === "waiting_for_players") {
        io.to(lobby.code).emit("waitingUpdate", {
          gameState: lobby.getGameState(),
        });
      } else if (lobby.state === "preview") {
        io.to(lobby.code).emit("phaseChanged", {
          gameState: lobby.getGameState(),
        });
      } else if (lobby.state === "showcase") {
        io.to(lobby.code).emit("phaseChanged", {
          gameState: lobby.getGameState(),
        });
      }

      console.log(
        `${player.name} submitted song with ${songData.length} sounds in lobby ${lobby.code}`,
      );
    }
  });

  socket.on("getCurrentSong", (callback) => {
    const lobby = findLobbyBySocket(socket.id);
    if (!lobby) {
      callback({ success: false, error: "Not in a lobby" });
      return;
    }

    const player = lobby.getPlayer(socket.id);
    if (!player) {
      callback({ success: false, error: "Player not found" });
      return;
    }

    const songId = lobby.currentSongAssignments.get(player.id);
    const song = songId ? lobby.songs.get(songId) : null;

    callback({
      success: true,
      song: song
        ? {
            id: song.id,
            events: song.events,
            contributors: song.contributors,
            backingTrack: song.backingTrack,
          }
        : null,
      gameState: {
        ...lobby.getGameState(),
        currentSongAssignment: songId,
      },
    });
  });

  socket.on("getPreviousSong", (callback) => {
    const lobby = findLobbyBySocket(socket.id);
    if (!lobby) {
      callback({ success: false, error: "Not in a lobby" });
      return;
    }

    const player = lobby.getPlayer(socket.id);
    if (!player) {
      callback({ success: false, error: "Player not found" });
      return;
    }

    const songId = lobby.currentSongAssignments.get(player.id);
    const song = lobby.songs.get(songId);

    if (!song) {
      callback({ success: false, error: "No song assignment found" });
      return;
    }

    const previousSegment = song.segments[song.segments.length - 1];
    const previousPlayer = previousSegment
      ? lobby.players.get(previousSegment.playerId)
      : null;

    callback({
      success: true,
      song: {
        id: song.id,
        segments: song.segments,
        contributors: song.contributors,
        backingTrack: song.backingTrack || null,
      },
      previousPlayerName: previousPlayer ? previousPlayer.name : "Unknown",
      gameState: lobby.getGameState(),
    });
  });

  socket.on("continueToPerformance", () => {
    const lobby = findLobbyBySocket(socket.id);
    if (!lobby) return;

    const player = lobby.getPlayer(socket.id);
    if (!player) return;

    player.isReady = true;

    const allReady = Array.from(lobby.players.values()).every((p) => p.isReady);

    if (allReady) {
      lobby.players.forEach((p) => {
        p.isReady = false;
      });
      lobby.startPerformancePhase();

      io.to(lobby.code).emit("phaseChanged", {
        gameState: lobby.getGameState(),
      });
    }
  });

  socket.on("getFinalSongs", (callback) => {
    const lobby = findLobbyBySocket(socket.id);
    if (!lobby) {
      callback({ success: false, error: "Not in a lobby" });
      return;
    }

    const songs = Array.from(lobby.songs.values()).map((song) => ({
      id: song.id,
      originalCreator: song.originalCreator,
      segments: song.segments,
      contributors: song.contributors.map((playerId) => {
        const player = lobby.players.get(playerId);
        return player ? player.name : playerId;
      }),
      backingTrack: song.backingTrack || null,
    }));

    callback({
      success: true,
      songs: songs,
    });
  });

  socket.on("disconnect", () => {
    console.log(`Player disconnected: ${socket.id}`);

    const lobby = findLobbyBySocket(socket.id);
    if (lobby) {
      const player = lobby.removePlayer(socket.id);

      if (lobby.players.size === 0) {
        lobby.cleanup();
        lobbies.delete(lobby.code);
        console.log(`Lobby ${lobby.code} cleaned up`);
      } else if (player) {
        io.to(lobby.code).emit("playerLeft", {
          playerId: player.id,
          playerName: player.name,
          gameState: lobby.getGameState(),
        });
      }
    }
  });
});

/**
 * Finds the lobby that contains the player with the given socket ID.
 */
function findLobbyBySocket(socketId) {
  for (const lobby of lobbies.values()) {
    if (lobby.players.has(playerSockets.get(socketId))) {
      return lobby;
    }
  }
  return null;
}

app.get("/api/lobbies", (req, res) => {
  const lobbyList = Array.from(lobbies.values()).map((lobby) => ({
    code: lobby.code,
    playerCount: lobby.players.size,
    state: lobby.state,
  }));

  res.json(lobbyList);
});

app.get("/api/lobby/:code", (req, res) => {
  const lobby = lobbies.get(req.params.code.toUpperCase());
  if (!lobby) {
    res.status(404).json({ error: "Lobby not found." });
    return;
  }

  res.json(lobby.getGameState());
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "index.html"));
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Game available at http://localhost:${PORT}`);
});

process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");

  lobbies.forEach((lobby) => {
    lobby.cleanup();
  });

  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});
