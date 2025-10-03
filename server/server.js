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
 * CLIENT-DRIVEN MUSIC GAME SERVER
 *
 * Game Flow:
 * - Server maintains lobby state (code, players, assignments)
 * - Clients control their own phase transitions
 * - Server broadcasts state updates, clients decide what to do
 * - Players submit song segments when entering waiting_for_players phase
 *
 * For N players: N songs, each with N segments (N × 8 seconds total)
 */

const lobbies = new Map();
const playerSockets = new Map();

function generateLobbyCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function generatePlayerId() {
  return Math.random().toString(36).substring(2, 15);
}

/**
 * Lobby - Manages a single game session
 *
 * Structure:
 * - code: Lobby identifier
 * - state: "lobby" or "in_progress"
 * - players: Map of playerId -> player object
 * - rounds: Total number of rounds (equals number of players)
 * - assignments: Map of playerId -> [list of playerIds for each round]
 */
class Lobby {
  constructor(code) {
    this.code = code;
    this.state = "lobby";
    this.players = new Map();
    this.rounds = 0;
    this.assignments = new Map();
  }

  addPlayer(socketId, playerName) {
    const playerId = generatePlayerId();
    const player = {
      id: playerId,
      socketId: socketId,
      name: playerName,
      ready: false,
      round: 0,
      phase: "lobby",
      submissions: [],
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
      this.players.size >= 2 &&
      Array.from(this.players.values()).every((p) => p.ready)
    );
  }

  /**
   * Generates circular assignments for song rotation.
   * For player at index i, they get songs from player at index (i-1) for each round.
   */
  generateAssignments() {
    const playerIds = Array.from(this.players.keys());
    const numPlayers = playerIds.length;
    this.rounds = numPlayers;

    playerIds.forEach((playerId, index) => {
      const assignmentList = [];

      // For each round (except round 1 where they work on their own song),
      // assign the previous player's ID
      for (let round = 2; round <= numPlayers; round++) {
        const prevIndex = (index - 1 + numPlayers) % numPlayers;
        assignmentList.push(playerIds[prevIndex]);
      }

      this.assignments.set(playerId, assignmentList);
    });
  }

  /**
   * Sets a player's ready state and checks if game should start
   */
  setPlayerReady(playerId, isReady) {
    const player = this.players.get(playerId);
    if (!player) return false;

    player.ready = isReady;

    // If all players are ready and we have 2+, start the game
    if (this.areAllPlayersReady() && this.state === "lobby") {
      this.state = "in_progress";
      this.generateAssignments();
    }

    return true;
  }

  /**
   * Updates a player's phase and round
   */
  updatePlayerPhase(playerId, phase, round, submission = null) {
    const player = this.players.get(playerId);
    if (!player) return false;

    player.phase = phase;
    player.round = round;

    // If moving to waiting_for_players and submission provided, add it
    if (phase === "waiting_for_players" && submission) {
      player.submissions.push(submission);
    }

    return true;
  }

  /**
   * Returns serializable lobby state for broadcasting
   */
  getState() {
    return {
      code: this.code,
      state: this.state,
      rounds: this.rounds,
      assignments: Object.fromEntries(this.assignments),
      players: Array.from(this.players.values()).map((p) => ({
        id: p.id,
        name: p.name,
        ready: p.ready,
        round: p.round,
        phase: p.phase,
        submissions: p.submissions,
      })),
    };
  }

  cleanup() {
    this.players.clear();
    this.assignments.clear();
  }
}

/**
 * SOCKET.IO EVENT HANDLERS
 *
 * All events result in a state broadcast to all players in the lobby.
 * Clients use the state to determine their next actions.
 */
io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on("createLobby", (data, callback) => {
    const { playerName } = data;
    const code = generateLobbyCode();
    const lobby = new Lobby(code);

    lobbies.set(code, lobby);
    const player = lobby.addPlayer(socket.id, playerName);

    socket.join(code);

    const state = lobby.getState();

    callback({
      success: true,
      lobbyCode: code,
      playerId: player.id,
      state: state,
    });

    // Broadcast to lobby
    io.to(code).emit("stateUpdate", { state });

    console.log(`Lobby created: ${code} by ${playerName}`);
  });

  socket.on("joinLobby", (data, callback) => {
    const { lobbyCode, playerName } = data;
    const lobby = lobbies.get(lobbyCode.toUpperCase());

    if (!lobby) {
      callback({ success: false, error: "Lobby not found." });
      return;
    }

    if (lobby.state !== "lobby") {
      callback({ success: false, error: "Game already in progress" });
      return;
    }

    const player = lobby.addPlayer(socket.id, playerName);
    socket.join(lobbyCode);

    const state = lobby.getState();

    callback({
      success: true,
      playerId: player.id,
      state: state,
    });

    // Broadcast to lobby
    io.to(lobbyCode).emit("stateUpdate", { state });

    console.log(`${playerName} joined lobby ${lobbyCode}`);
  });

  socket.on("setReady", (data) => {
    const { isReady } = data;
    const lobby = findLobbyBySocket(socket.id);
    if (!lobby) return;

    const player = lobby.getPlayer(socket.id);
    if (!player) return;

    lobby.setPlayerReady(player.id, isReady);

    const state = lobby.getState();
    io.to(lobby.code).emit("stateUpdate", { state });

    console.log(
      `${player.name} ready status: ${isReady} in lobby ${lobby.code}`,
    );
  });

  socket.on("updatePhase", (data) => {
    const { phase, round, submission } = data;
    const lobby = findLobbyBySocket(socket.id);
    if (!lobby) return;

    const player = lobby.getPlayer(socket.id);
    if (!player) return;

    lobby.updatePlayerPhase(player.id, phase, round, submission);

    const state = lobby.getState();
    io.to(lobby.code).emit("stateUpdate", { state });

    console.log(
      `${player.name} updated to phase: ${phase}, round: ${round} in lobby ${lobby.code}`,
    );
  });

  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);

    const lobby = findLobbyBySocket(socket.id);
    if (lobby) {
      const player = lobby.removePlayer(socket.id);

      if (lobby.players.size === 0) {
        lobby.cleanup();
        lobbies.delete(lobby.code);
        console.log(`Lobby ${lobby.code} cleaned up (empty)`);
      } else if (player) {
        const state = lobby.getState();
        io.to(lobby.code).emit("stateUpdate", { state });
        console.log(`${player.name} left lobby ${lobby.code}`);
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

// REST API endpoints for debugging
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

  res.json(lobby.getState());
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
