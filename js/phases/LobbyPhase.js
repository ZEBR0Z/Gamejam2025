import { BasePhase } from "./BasePhase.js";
import { GameConfig, StateEvent } from "../Constants.js";

/**
 * LobbyPhase - Waiting room before game starts
 * Handles player joining, ready system, and game start countdown
 */
export class LobbyPhase extends BasePhase {
  constructor(services) {
    super(services);

    this.stateUpdateHandler = null;
    this.updateInterval = null;
    this.countdownValue = null;
    this.countdownStartTime = null;
  }

  async enter(onComplete, onSecondary = null) {
    await super.enter(onComplete, onSecondary);

    // Show lobby screen
    this.ui.showScreen("lobby_waiting");

    // Display lobby code (get from network service since server state may not be populated yet)
    const lobbyCode = this.network.getLobbyCode() || this.serverState.getLobbyCode();
    if (lobbyCode) {
      this.ui.updateLobbyCode(lobbyCode);
    }

    // Set up ready button
    this.input.setupButtonEvents({
      "ready-btn": () => this.handleReadyToggle(),
      "leave-lobby-btn": () => this.handleLeaveLobby(),
    });

    // Listen for server state updates
    this.stateUpdateHandler = () => this.handleStateUpdate();
    this.serverState.observer.on(StateEvent.SERVER_STATE_CHANGED, this.stateUpdateHandler);

    // Initial UI update
    this.updateLobbyUI();

    // Start update loop for countdown animation
    this.updateInterval = setInterval(() => this.update(), 100);
  }

  update() {
    if (!this.isActive) return;

    // Update countdown if counting down
    if (this.countdownStartTime !== null) {
      const elapsed = (Date.now() - this.countdownStartTime) / 1000;
      const remaining = Math.max(0, Math.ceil(GameConfig.LOBBY_START_COUNTDOWN - elapsed));

      const countdownElement = document.getElementById("start-countdown");
      if (countdownElement) {
        countdownElement.textContent = remaining;
      }
    }
  }

  exit() {
    // Clean up event listeners
    if (this.stateUpdateHandler) {
      this.serverState.observer.off(StateEvent.SERVER_STATE_CHANGED, this.stateUpdateHandler);
      this.stateUpdateHandler = null;
    }

    // Clean up interval
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    // Clean up input handlers
    this.input.cleanupButtonEvents();

    super.exit();
  }

  /**
   * Handle state updates from server
   */
  handleStateUpdate() {
    this.updateLobbyUI();

    const players = this.serverState.getPlayers();
    const allReady = this.serverState.areAllPlayersReady();

    // When all players ready (2+ players, all ready), start countdown
    // Client-driven: we don't check lobby state, just player readiness
    if (allReady && this.countdownStartTime === null) {
      this.countdownStartTime = Date.now();
      const gameStartingElement = document.getElementById("game-starting");
      if (gameStartingElement) {
        gameStartingElement.style.display = "block";
      }

      // Auto-complete after countdown
      setTimeout(() => {
        if (this.isActive) {
          this.complete();
        }
      }, GameConfig.LOBBY_START_COUNTDOWN * 1000);
    }
  }

  /**
   * Update lobby UI (player list, ready status, etc.)
   */
  updateLobbyUI() {
    const players = this.serverState.getPlayers();
    const localPlayerId = this.serverState.getLocalPlayerId();

    // Update lobby code
    const lobbyCode = this.serverState.getLobbyCode();
    if (lobbyCode) {
      this.ui.updateLobbyCode(lobbyCode);
    }

    // Update player list
    this.ui.updateLobbyPlayerList(players, localPlayerId);

    // Update ready button state
    const localPlayer = players.find((p) => p.id === localPlayerId);
    if (localPlayer) {
      const readyBtn = document.getElementById("ready-btn");
      if (readyBtn) {
        // Disable ready button if less than 2 players
        if (players.length < 2) {
          readyBtn.disabled = true;
          readyBtn.classList.add("is-disabled");
          readyBtn.textContent = "Waiting for players...";
        } else if (localPlayer.ready) {
          // Once ready, disable the button (can't un-ready)
          readyBtn.disabled = true;
          readyBtn.classList.add("is-disabled");
          readyBtn.textContent = "Ready";
        } else {
          // Not ready yet, allow readying up
          readyBtn.disabled = false;
          readyBtn.classList.remove("is-disabled");
          readyBtn.classList.remove("is-success");
          readyBtn.textContent = "Ready";
        }
      }
    }

  }

  /**
   * Handle ready button (only allows setting ready to true, not un-readying)
   */
  handleReadyToggle() {
    const localPlayerId = this.serverState.getLocalPlayerId();
    const players = this.serverState.getPlayers();
    const localPlayer = players.find((p) => p.id === localPlayerId);

    if (localPlayer && !localPlayer.ready) {
      this.network.setReady(true);
    }
  }

  /**
   * Handle leaving lobby
   */
  handleLeaveLobby() {
    this.network.disconnect();
    this.triggerSecondary(); // Go back to main menu
  }
}
