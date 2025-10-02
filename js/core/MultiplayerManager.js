/**
 * MultiplayerManager - Handles multiplayer communication with the server
 * Manages WebSocket connections and game state synchronization
 */
export class MultiplayerManager {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.playerId = null;
    this.lobbyCode = null;
    this.gameState = null;
    this.currentSong = null;

    this.onGameStateUpdate = null;
    this.onPhaseChange = null;
    this.onPlayerJoined = null;
    this.onPlayerLeft = null;
    this.onSongSubmitted = null;
    this.onGameStarted = null;
    this.onAllPlayersReady = null;
    this.onWaitingUpdate = null;
  }

  /**
   * Connects to the multiplayer server via Socket.IO
   * @param {string} serverUrl - Server URL to connect to
   * @returns {Promise<boolean>} True if connection successful, false otherwise
   */
  async connect(serverUrl) {
    try {
      if (!window.io) {
        console.log("Loading Socket.IO client script...");
        await this.loadSocketIO(serverUrl);
      } else {
        console.log("Socket.IO client already loaded");
      }

      this.socket = window.io(serverUrl);
      console.log("Socket.IO connection object created:", this.socket);

      this.socket.on("connect", () => {
        console.log("Socket ID:", this.socket.id);
        this.isConnected = true;
      });

      this.socket.on("disconnect", () => {
        console.log("Disconnected from multiplayer server");
        this.isConnected = false;
      });

      this.setupEventHandlers();

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          console.log("Connection timeout after 10 seconds");
          reject(new Error("Connection timeout"));
        }, 10000);

        this.socket.on("connect", () => {
          clearTimeout(timeout);
          resolve(true);
        });

        this.socket.on("connect_error", (error) => {
          console.log("Socket connection error:", error);
          clearTimeout(timeout);
          resolve(false);
        });
      });
    } catch (error) {
      console.error("Failed to connect to multiplayer server:", error);
      return false;
    }
  }

  async loadSocketIO(serverUrl) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `${serverUrl}/socket.io/socket.io.js`;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  setupEventHandlers() {
    this.socket.on("playerJoined", (data) => {
      this.gameState = data.gameState;
      if (this.onPlayerJoined) {
        this.onPlayerJoined(data.player, data.gameState);
      }
    });

    this.socket.on("playerLeft", (data) => {
      console.log("Player left:", data.playerName);
      this.gameState = data.gameState;
      if (this.onPlayerLeft) {
        this.onPlayerLeft(data.playerId, data.playerName, data.gameState);
      }
    });

    this.socket.on("playerReady", (data) => {
      this.gameState = data.gameState;
      if (this.onGameStateUpdate) {
        this.onGameStateUpdate(data.gameState);
      }
    });

    this.socket.on("allPlayersReady", (data) => {
      console.log("All players ready.");
      this.gameState = data.gameState;
      if (this.onAllPlayersReady) {
        this.onAllPlayersReady(data.gameState);
      }
    });

    this.socket.on("gameStarted", (data) => {
      this.gameState = data.gameState;
      if (this.onGameStarted) {
        this.onGameStarted(data.gameState);
      }
    });

    this.socket.on("phaseChanged", (data) => {
      console.log("Phase changed to:", data.gameState.state);
      this.gameState = data.gameState;
      if (this.onPhaseChange) {
        this.onPhaseChange(data.gameState);
      }
    });

    this.socket.on("songSubmitted", (data) => {
      console.log("Song submitted by:", data.playerId);
      this.gameState = data.gameState;
      if (this.onSongSubmitted) {
        this.onSongSubmitted(data.playerId, data.gameState);
      }
    });

    this.socket.on("waitingUpdate", (data) => {
      this.gameState = data.gameState;
      if (this.onWaitingUpdate) {
        this.onWaitingUpdate(data.gameState);
      }
    });
  }

  /**
   * Creates a new game lobby
   * @param {string} playerName - Name of the player creating the lobby
   * @returns {Promise<Object>} Response object with lobby details
   */
  async createLobby(playerName) {
    if (!this.isConnected) {
      console.log("Not connected to server");
      return null;
    }

    return new Promise((resolve) => {
      this.socket.emit("createLobby", { playerName }, (response) => {
        if (response.success) {
          this.playerId = response.playerId;
          this.lobbyCode = response.lobbyCode;
          this.gameState = response.gameState;
        }
        resolve(response);
      });
    });
  }

  /**
   * Joins an existing game lobby
   * @param {string} lobbyCode - Lobby code to join
   * @param {string} playerName - Name of the player joining
   * @returns {Promise<Object>} Response object with lobby details
   */
  async joinLobby(lobbyCode, playerName) {
    if (!this.isConnected) return null;

    return new Promise((resolve) => {
      this.socket.emit(
        "joinLobby",
        { lobbyCode: lobbyCode.toUpperCase(), playerName },
        (response) => {
          if (response.success) {
            this.playerId = response.playerId;
            this.lobbyCode = lobbyCode.toUpperCase();
            this.gameState = response.gameState;
            console.log(`Joined lobby: ${this.lobbyCode}`);
          }
          resolve(response);
        },
      );
    });
  }

  setReady() {
    if (!this.isConnected || !this.lobbyCode) return;

    this.socket.emit("playerReady", {});
  }

  completeSelection() {
    if (!this.isConnected || !this.lobbyCode) return;

    this.socket.emit("completeSelection");
  }

  submitSong(songData, backingTrack = null) {
    if (!this.isConnected || !this.lobbyCode) return;

    this.socket.emit("submitSong", { songData, backingTrack });
  }

  /**
   * Gets the current song data for this player's turn
   * @returns {Promise<Object>} Response object with song data
   */
  async getCurrentSong() {
    if (!this.isConnected || !this.lobbyCode) return null;

    return new Promise((resolve) => {
      this.socket.emit("getCurrentSong", (response) => {
        if (response.success) {
          this.currentSong = response.song;
          this.gameState = response.gameState;
        }
        resolve(response);
      });
    });
  }

  /**
   * Gets the previous player's song data for preview
   * @returns {Promise<Object>} Response object with previous song data
   */
  async getPreviousSong() {
    if (!this.isConnected || !this.lobbyCode) return null;

    return new Promise((resolve) => {
      this.socket.emit("getPreviousSong", (response) => {
        resolve(response);
      });
    });
  }

  continueToPerformance() {
    if (!this.isConnected || !this.lobbyCode) return;

    this.socket.emit("continueToPerformance");
  }

  /**
   * Gets all final completed songs for showcase phase
   * @returns {Promise<Object>} Response object with all final songs
   */
  async getFinalSongs() {
    if (!this.isConnected || !this.lobbyCode) return null;

    return new Promise((resolve) => {
      this.socket.emit("getFinalSongs", (response) => {
        resolve(response);
      });
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnected = false;
    this.playerId = null;
    this.lobbyCode = null;
    this.gameState = null;
    this.currentSong = null;
  }

  getPlayerId() {
    return this.playerId;
  }

  getLobbyCode() {
    return this.lobbyCode;
  }

  getGameState() {
    return this.gameState;
  }

  getCurrentSongData() {
    return this.currentSong;
  }

  isInLobby() {
    return this.isConnected && this.lobbyCode && this.playerId;
  }
}
