/**
 * MultiplayerManager - Handles multiplayer communication with the server
 * Manages WebSocket connections and state synchronization
 * 
 * New Flow:
 * - Server broadcasts state updates
 * - Client processes state and decides phase transitions
 * - Client sends minimal updates (ready, phase changes, submissions)
 */
export class MultiplayerManager {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.playerId = null;
    this.lobbyCode = null;
    this.lobbyState = null;

    // Callbacks
    this.onStateUpdate = null;
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
    // Single event handler for all state updates
    this.socket.on("stateUpdate", (data) => {
      console.log("State update received:", data.state);
      this.lobbyState = data.state;
      
      if (this.onStateUpdate) {
        this.onStateUpdate(data.state);
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
          this.lobbyState = response.state;
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
            this.lobbyState = response.state;
            console.log(`Joined lobby: ${this.lobbyCode}`);
          }
          resolve(response);
        },
      );
    });
  }

  /**
   * Sets player ready status
   * @param {boolean} isReady - Ready status
   */
  setReady(isReady = true) {
    if (!this.isConnected || !this.lobbyCode) return;

    this.socket.emit("setReady", { isReady });
  }

  /**
   * Updates player's current phase and round
   * @param {string} phase - Current phase name
   * @param {number} round - Current round number
   * @param {Object} submission - Optional song submission (for waiting_for_players phase)
   */
  updatePhase(phase, round, submission = null) {
    if (!this.isConnected || !this.lobbyCode) return;

    this.socket.emit("updatePhase", { phase, round, submission });
  }

  /**
   * Gets the assignment for this player for a specific round
   * @param {number} round - Round number (1-indexed)
   * @returns {string|null} Player ID whose song this player should work on
   */
  getAssignment(round) {
    if (!this.lobbyState || !this.lobbyState.assignments) return null;
    
    const assignments = this.lobbyState.assignments[this.playerId];
    if (!assignments || round < 2) return null;
    
    // Round 1 = work on own song (no assignment needed)
    // Round 2 = index 0, Round 3 = index 1, etc.
    return assignments[round - 2];
  }

  /**
   * Gets a specific player's submission for a specific round
   * @param {string} playerId - Player ID
   * @param {number} round - Round number (1-indexed)
   * @returns {Object|null} Song submission object
   */
  getPlayerSubmission(playerId, round) {
    if (!this.lobbyState || !this.lobbyState.players) return null;
    
    const player = this.lobbyState.players.find((p) => p.id === playerId);
    if (!player || !player.submissions) return null;
    
    // Round 1 = index 0, Round 2 = index 1, etc.
    return player.submissions[round - 1] || null;
  }

  /**
   * Gets this player's own data
   * @returns {Object|null} Player object
   */
  getMyPlayerData() {
    if (!this.lobbyState || !this.lobbyState.players) return null;
    
    return this.lobbyState.players.find((p) => p.id === this.playerId) || null;
  }

  /**
   * Checks if all players are at or past a specific phase/round
   * @param {number} round - Round to check
   * @param {string} phase - Phase to check
   * @returns {boolean}
   */
  areAllPlayersAtPhase(round, phase) {
    if (!this.lobbyState || !this.lobbyState.players) return false;
    
    return this.lobbyState.players.every((p) => {
      if (p.round > round) return true;
      if (p.round === round && this.isPhaseAtOrPast(p.phase, phase)) return true;
      return false;
    });
  }

  /**
   * Helper to determine if phase1 is at or past phase2
   */
  isPhaseAtOrPast(phase1, phase2) {
    const phaseOrder = [
      "lobby",
      "selection",
      "preview",
      "sound_replacement",
      "performance",
      "editing",
      "waiting_for_players",
    ];
    
    const index1 = phaseOrder.indexOf(phase1);
    const index2 = phaseOrder.indexOf(phase2);
    
    return index1 >= index2;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnected = false;
    this.playerId = null;
    this.lobbyCode = null;
    this.lobbyState = null;
  }

  getPlayerId() {
    return this.playerId;
  }

  getLobbyCode() {
    return this.lobbyCode;
  }

  getLobbyState() {
    return this.lobbyState;
  }

  isInLobby() {
    return this.isConnected && this.lobbyCode && this.playerId;
  }
}
