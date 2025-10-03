/**
 * NetworkService - Handles multiplayer communication with the server
 * Manages WebSocket connections via Socket.IO
 * Emits events when server state updates are received
 */

import { NetworkEvent } from "../Constants.js";
import { StateObserver } from "../state/StateObserver.js";

export class NetworkService {
  constructor(serverState) {
    this.socket = null;
    this.isConnected = false;
    this.playerId = null;
    this.lobbyCode = null;
    this.serverState = serverState;
    this.observer = new StateObserver();
  }

  /**
   * Connect to the multiplayer server
   * @param {string} serverUrl - Server URL to connect to
   * @returns {Promise<boolean>} True if connection successful
   */
  async connect(serverUrl) {
    try {
      // Load Socket.IO library if not already loaded
      if (!window.io) {
        console.log("Loading Socket.IO client script...");
        await this.loadSocketIO(serverUrl);
      }

      // Create socket connection
      this.socket = window.io(serverUrl);
      console.log("Socket.IO connection created");

      // Set up event handlers
      this.setupSocketHandlers();

      // Wait for connection
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          console.log("Connection timeout after 10 seconds");
          reject(new Error("Connection timeout"));
        }, 10000);

        this.socket.on("connect", () => {
          clearTimeout(timeout);
          console.log("Connected to server. Socket ID:", this.socket.id);
          this.isConnected = true;
          this.observer.emit(NetworkEvent.CONNECTED);
          resolve(true);
        });

        this.socket.on("connect_error", (error) => {
          console.log("Socket connection error:", error);
          clearTimeout(timeout);
          this.observer.emit(NetworkEvent.CONNECTION_ERROR, error);
          resolve(false);
        });
      });
    } catch (error) {
      console.error("Failed to connect to multiplayer server:", error);
      this.observer.emit(NetworkEvent.CONNECTION_ERROR, error);
      return false;
    }
  }

  /**
   * Load Socket.IO client library
   * @param {string} serverUrl
   * @returns {Promise<void>}
   */
  async loadSocketIO(serverUrl) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `${serverUrl}/socket.io/socket.io.js`;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  /**
   * Set up Socket.IO event handlers
   */
  setupSocketHandlers() {
    // Connection events
    this.socket.on("disconnect", () => {
      console.log("Disconnected from server");
      this.isConnected = false;
      this.observer.emit(NetworkEvent.DISCONNECTED);
    });

    // State update event (server broadcasts state)
    this.socket.on("stateUpdate", (data) => {
      console.log("State update received:", data.state);
      // Emit to observers (Game will update ServerState)
      this.observer.emit("stateUpdate", data.state);
    });
  }

  /**
   * Create a new lobby
   * @param {string} playerName - Name of the player creating the lobby
   * @returns {Promise<Object>} Response object with lobby details
   */
  async createLobby(playerName) {
    if (!this.isConnected) {
      console.log("Not connected to server");
      return { success: false, error: "Not connected to server" };
    }

    return new Promise((resolve) => {
      this.socket.emit("createLobby", { playerName }, (response) => {
        if (response.success) {
          this.playerId = response.playerId;
          this.lobbyCode = response.lobbyCode;
          this.serverState.setLocalPlayerId(response.playerId);

          // Immediately update server state with initial state from response
          if (response.state) {
            this.serverState.update(response.state);
          }

          console.log(`Lobby created: ${this.lobbyCode}, Player ID: ${this.playerId}`);
        }
        resolve(response);
      });
    });
  }

  /**
   * Join an existing lobby
   * @param {string} lobbyCode - Lobby code to join
   * @param {string} playerName - Name of the player joining
   * @returns {Promise<Object>} Response object with lobby details
   */
  async joinLobby(lobbyCode, playerName) {
    if (!this.isConnected) {
      return { success: false, error: "Not connected to server" };
    }

    return new Promise((resolve) => {
      this.socket.emit(
        "joinLobby",
        { lobbyCode: lobbyCode.toUpperCase(), playerName },
        (response) => {
          if (response.success) {
            this.playerId = response.playerId;
            this.lobbyCode = lobbyCode.toUpperCase();
            this.serverState.setLocalPlayerId(response.playerId);

            // Immediately update server state with initial state from response
            if (response.state) {
              this.serverState.update(response.state);
            }

            console.log(`Joined lobby: ${this.lobbyCode}, Player ID: ${this.playerId}`);
          }
          resolve(response);
        }
      );
    });
  }

  /**
   * Set player ready status
   * @param {boolean} isReady - Ready status
   */
  setReady(isReady = true) {
    if (!this.isConnected || !this.lobbyCode) {
      console.warn("Cannot set ready: not in a lobby");
      return;
    }

    this.socket.emit("setReady", { isReady });
    console.log(`Set ready: ${isReady}`);
  }

  /**
   * Update player's current phase and round
   * @param {string} phase - Current phase name
   * @param {number} round - Current round number
   * @param {Object} submission - Optional song submission
   */
  updatePhase(phase, round, submission = null) {
    if (!this.isConnected || !this.lobbyCode) {
      console.warn("Cannot update phase: not in a lobby");
      return;
    }

    this.socket.emit("updatePhase", { phase, round, submission });
    console.log(`Updated phase: ${phase}, round: ${round}`);
  }

  /**
   * Disconnect from the server
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.isConnected = false;
    this.playerId = null;
    this.lobbyCode = null;

    console.log("Disconnected from server");
  }

  /**
   * Subscribe to state updates
   * @param {Function} callback - Called with (newState)
   * @returns {Function} Unsubscribe function
   */
  onStateUpdate(callback) {
    return this.observer.on("stateUpdate", callback);
  }

  /**
   * Subscribe to connection events
   * @param {string} event - Event name (CONNECTED, DISCONNECTED, CONNECTION_ERROR)
   * @param {Function} callback
   * @returns {Function} Unsubscribe function
   */
  on(event, callback) {
    return this.observer.on(event, callback);
  }

  /**
   * Get player ID
   * @returns {string|null}
   */
  getPlayerId() {
    return this.playerId;
  }

  /**
   * Get lobby code
   * @returns {string|null}
   */
  getLobbyCode() {
    return this.lobbyCode;
  }

  /**
   * Check if connected and in a lobby
   * @returns {boolean}
   */
  isInLobby() {
    return this.isConnected && this.lobbyCode && this.playerId;
  }
}
