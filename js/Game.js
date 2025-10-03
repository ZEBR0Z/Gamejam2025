/**
 * Game - Main orchestrator for a Gartic Phone-style collaborative music game
 *
 * NEW ARCHITECTURE (Client-Driven):
 * - Server maintains lobby state (code, players, rounds, assignments)
 * - Server broadcasts state updates to all clients
 * - Clients independently decide phase transitions based on state
 * - Clients send minimal updates: ready status, phase changes, submissions
 *
 * GAME FLOW:
 * 1. Lobby creation/joining - Players connect and ready up
 * 2. When all ready (2+ players), server sets state to "in_progress" and generates assignments
 * 3. Clients detect ready state and move to selection phase
 * 4. Collaborative rounds - Songs rotate between players:
 *    Round 1: Each player creates their own initial 8-second segment
 *    Round 2+: Players add segments to assigned player's song
 *    Each round: Preview -> Sound Replacement -> Performance -> Editing -> Waiting
 * 5. Final showcase - All completed collaborative songs are presented
 *
 * KEY RESPONSIBILITIES:
 * - Initializing and wiring together all game subsystems
 * - Managing multiplayer lobby lifecycle (create, join, leave)
 * - Processing state updates and determining appropriate phase transitions
 * - Converting game state between client and server formats
 * - Handling UI validation and user interaction detection (for audio autoplay)
 */

import { AudioEngine } from "./core/AudioEngine.js";
import { GameState } from "./core/GameState.js";
import { UIManager } from "./core/UIManager.js";
import { CanvasRenderer } from "./core/CanvasRenderer.js";
import { InputController } from "./core/InputController.js";
import { MultiplayerManager } from "./core/MultiplayerManager.js";
import { PhaseManager } from "./core/PhaseManager.js";

import { SelectionPhase } from "./phases/SelectionPhase.js";
import { PerformancePhase } from "./phases/PerformancePhase.js";
import { EditingPhase } from "./phases/EditingPhase.js";
import { WaitingPhase } from "./phases/WaitingPhase.js";
import { PreviewPhase } from "./phases/PreviewPhase.js";
import { SoundReplacementPhase } from "./phases/SoundReplacementPhase.js";
import { ShowcasePhase } from "./phases/ShowcasePhase.js";

export class Game {
  constructor() {
    // Core systems - foundational components used throughout the game
    this.audioEngine = new AudioEngine();
    this.gameState = new GameState();
    this.uiManager = new UIManager();
    this.canvasRenderer = new CanvasRenderer();
    this.inputController = new InputController(
      this.gameState,
      this.uiManager,
      this.audioEngine,
    );
    this.multiplayerManager = new MultiplayerManager();
    this.phaseManager = new PhaseManager();

    // Phase instances - each handles specific gameplay mechanics
    this.selectionPhase = new SelectionPhase(
      this.gameState,
      this.uiManager,
      this.audioEngine,
    );
    this.performancePhase = new PerformancePhase(
      this.gameState,
      this.uiManager,
      this.audioEngine,
      this.canvasRenderer,
      this.inputController,
      this.multiplayerManager,
      () => this.currentRound,
    );
    this.editingPhase = new EditingPhase(
      this.gameState,
      this.uiManager,
      this.audioEngine,
      this.canvasRenderer,
      this.inputController,
      this.multiplayerManager,
    );
    this.waitingPhase = new WaitingPhase(
      this.gameState,
      this.uiManager,
      this.audioEngine,
      this.multiplayerManager,
      () => this.currentRound,
    );
    this.previewPhase = new PreviewPhase(
      this.gameState,
      this.uiManager,
      this.audioEngine,
      this.canvasRenderer,
      this.inputController,
      this.multiplayerManager,
      () => this.currentRound,
    );
    this.soundReplacementPhase = new SoundReplacementPhase(
      this.gameState,
      this.uiManager,
      this.audioEngine,
    );
    this.showcasePhase = new ShowcasePhase(
      this.gameState,
      this.uiManager,
      this.audioEngine,
      this.canvasRenderer,
      this.inputController,
      this.multiplayerManager,
    );

    this.isMultiplayer = true;
    this.serverUrl = "http://localhost:8000";

    // Track user interaction for audio autoplay policy compliance
    this.hasUserInteracted = false;

    // Client-side game tracking
    this.currentRound = 0;
    this.currentPhase = "lobby";

    // Wire up icon preloading
    this.gameState.onIconPreload = (iconUrl) => {
      this.canvasRenderer.loadIcon(iconUrl);
    };

    this.setupPhaseManager();
  }

  /**
   * Register all game phases with the phase manager
   */
  setupPhaseManager() {
    this.phaseManager.registerPhase("selection", this.selectionPhase);
    this.phaseManager.registerPhase("performance", this.performancePhase);
    this.phaseManager.registerPhase("editing", this.editingPhase);
    this.phaseManager.registerPhase("waiting_for_players", this.waitingPhase);
    this.phaseManager.registerPhase("preview", this.previewPhase);
    this.phaseManager.registerPhase(
      "sound_replacement",
      this.soundReplacementPhase,
    );
    this.phaseManager.registerPhase("showcase", this.showcasePhase);

    // Hook into phase transitions to sync state
    this.phaseManager.onTransition = (phaseName, phaseInstance) => {
      this.gameState.setState(phaseName);
      this.currentPhase = phaseName;

      // Stop menu music when entering gameplay phases
      if (this.audioEngine.isMenuMusicPlaying()) {
        this.audioEngine.stopMenuMusic();
      }
    };
  }

  /**
   * Initialize all game systems asynchronously
   */
  async initialize() {
    try {
      await this.audioEngine.initialize();
      await this.gameState.loadSoundList();
      this.uiManager.initialize();
      await this.audioEngine.loadMenuMusic();

      this.initializeMultiplayerScreens();
      this.setupMenuHandlers();
      this.setupMultiplayerHandlers();
      this.setupUserInteractionDetection();
    } catch (error) {
      console.error("Failed to initialize Game:", error);
      this.showError(
        "Failed to initialize the game. Please refresh and try again.",
      );
    }
  }

  /**
   * Cache DOM references for multiplayer UI elements
   */
  initializeMultiplayerScreens() {
    this.uiManager.screens.create_lobby =
      document.getElementById("create-lobby");
    this.uiManager.screens.join_lobby = document.getElementById("join-lobby");
    this.uiManager.screens.lobby_waiting =
      document.getElementById("lobby-waiting");

    this.uiManager.elements.playerName = document.getElementById("player-name");
    this.uiManager.elements.joinPlayerName =
      document.getElementById("join-player-name");
    this.uiManager.elements.lobbyCodeInput =
      document.getElementById("lobby-code");
    this.uiManager.elements.lobbyCodeDisplay =
      document.getElementById("lobby-code-display");
    this.uiManager.elements.shareableCode =
      document.getElementById("shareable-code");
    this.uiManager.elements.playerCount =
      document.getElementById("player-count");
    this.uiManager.elements.playersContainer =
      document.getElementById("players-container");
    this.uiManager.elements.connectionIndicator = document.getElementById(
      "connection-indicator",
    );
    this.uiManager.elements.gameStarting =
      document.getElementById("game-starting");
    this.uiManager.elements.startCountdown =
      document.getElementById("start-countdown");
  }

  setupMenuHandlers() {
    const menuHandlers = {
      "tutorial-btn": () => this.showTutorial(),
      "create-lobby-btn": () => this.showCreateLobby(),
      "join-lobby-btn": () => this.showJoinLobby(),
      "skip-tutorial-btn": () => this.uiManager.showScreen("main_menu"),
      "start-tutorial-btn": () => this.uiManager.showScreen("main_menu"),
    };

    this.inputController.setupPersistentButtonEvents(menuHandlers);
  }

  setupUserInteractionDetection() {
    const handleFirstInteraction = () => {
      if (!this.hasUserInteracted) {
        this.handleFirstUserInteraction();
      }
    };

    document.addEventListener("click", handleFirstInteraction, { once: true });
    document.addEventListener("keydown", handleFirstInteraction, {
      once: true,
    });
    document.addEventListener("touchstart", handleFirstInteraction, {
      once: true,
    });
  }

  handleFirstUserInteraction() {
    this.hasUserInteracted = true;

    if (!this.audioEngine.isMenuMusicPlaying()) {
      this.audioEngine.startMenuMusic();
    }
  }

  /**
   * Wire up all multiplayer-related event handlers
   */
  setupMultiplayerHandlers() {
    const lobbyHandlers = {
      "back-to-menu-btn": () => this.uiManager.showScreen("main_menu"),
      "back-to-menu-from-join-btn": () =>
        this.uiManager.showScreen("main_menu"),
      "create-lobby-confirm-btn": () => {
        this.createLobby();
      },
      "join-lobby-confirm-btn": () => this.joinLobby(),
      "leave-lobby-btn": () => this.leaveLobby(),
      "ready-btn": () => this.setReady(),
    };

    this.inputController.setupPersistentButtonEvents(lobbyHandlers);

    const lobbyCodeInput = this.uiManager.elements.lobbyCodeInput;
    if (lobbyCodeInput) {
      lobbyCodeInput.addEventListener("input", (e) => {
        e.target.value = e.target.value.toUpperCase();
      });
    }

    // NEW: Single state update handler
    this.multiplayerManager.onStateUpdate = (prevState, newState) => {
      this.handleStateUpdate(prevState, newState);
    };
  }

  /**
   * Handle state updates from server and determine what to do
   * This is the core of the client-driven architecture
   * @param {Object} prevState - Previous state (null on first update)
   * @param {Object} newState - New state from server
   */
  handleStateUpdate(prevState, newState) {
    console.log("State update:", newState);

    // Detect and notify about state changes
    this.detectStateChanges(prevState, newState);

    // Always update lobby UI if we're in lobby state (before game starts)
    if (newState.state === "lobby" || this.currentPhase === "lobby") {
      this.updateLobbyUI(newState);
    }

    // Check if game should start
    if (
      newState.state === "in_progress" &&
      this.currentPhase === "lobby" &&
      this.currentRound === 0
    ) {
      this.startGame(newState);
      return;
    }

    // If in waiting_for_players phase, check if we should move on
    if (this.currentPhase === "waiting_for_players") {
      this.checkWaitingPhaseComplete(newState);
    }
  }

  /**
   * Detect and notify about state changes between previous and new state
   * @param {Object} prevState - Previous state (null on first update)
   * @param {Object} newState - New state from server
   */
  detectStateChanges(prevState, newState) {
    if (!newState || !newState.players) return;

    // Skip notifications on initial state
    if (!prevState || !prevState.players) return;

    const prevPlayerIds = prevState.players.map((p) => p.id);
    const newPlayerIds = newState.players.map((p) => p.id);

    // Detect new players (joined)
    const joinedPlayers = newState.players.filter(
      (player) => !prevPlayerIds.includes(player.id),
    );

    // Detect removed players (left)
    const leftPlayers = prevState.players.filter(
      (player) => !newPlayerIds.includes(player.id),
    );

    // Show notifications for joins
    joinedPlayers.forEach((player) => {
      this.showNotification(`${player.name} joined the lobby`);
    });

    // Show notifications for leaves
    leftPlayers.forEach((player) => {
      this.showNotification(`${player.name} left the lobby`);
    });
  }

  /**
   * Start the game when all players are ready
   */
  async startGame(state) {
    console.log("Starting game with state:", state);

    this.hideGameStarting();

    try {
      await this.audioEngine.resume();
      this.gameState.resetGameData();

      // Generate 5 random sounds for selection
      this.gameState.selectRandomSounds(5);

      this.currentRound = 1;
      this.startSelectionPhase();
    } catch (error) {
      console.error("Failed to start game:", error);
      this.showError("Failed to start the game. Please try again.");
    }
  }

  /**
   * Check if waiting phase is complete and determine next phase
   */
  checkWaitingPhaseComplete(state) {
    const allAtWaiting = this.multiplayerManager.areAllPlayersAtPhase(
      this.currentRound,
      "waiting_for_players",
    );

    if (!allAtWaiting) return;

    const totalRounds = state.rounds;

    // If we're at the final round, move to showcase
    if (this.currentRound >= totalRounds) {
      this.moveToShowcase();
    } else {
      // Otherwise, move to next round's preview phase
      this.currentRound++;
      this.moveToPreview();
    }
  }

  /**
   * Move to preview phase for the next round
   */
  moveToPreview() {
    this.multiplayerManager.updatePhase("preview", this.currentRound);

    this.phaseManager.transitionTo("preview", () => {
      this.moveToSoundReplacement();
    });
  }

  /**
   * Move to sound replacement phase
   */
  moveToSoundReplacement() {
    this.multiplayerManager.updatePhase("sound_replacement", this.currentRound);

    this.phaseManager.transitionTo("sound_replacement", () => {
      this.moveToPerformance();
    });
  }

  /**
   * Move to performance phase
   */
  moveToPerformance() {
    this.multiplayerManager.updatePhase("performance", this.currentRound);

    this.phaseManager.transitionTo("performance", () => {
      this.moveToEditing();
    });
  }

  /**
   * Move to editing phase
   */
  moveToEditing() {
    this.multiplayerManager.updatePhase("editing", this.currentRound);

    this.phaseManager.transitionTo("editing", () => {
      this.submitAndWait();
    });
  }

  /**
   * Submit song and move to waiting phase
   */
  submitAndWait() {
    // Convert events to server format
    const songData = this.gameState.events.map((event) => {
      const selectedSound = this.gameState.selectedSounds[event.soundIndex];
      return {
        audio: selectedSound.audio,
        icon: selectedSound.icon,
        time: event.startTimeSec,
        pitch: event.pitchSemitones || 0,
      };
    });

    const backingTrack = this.gameState.backingTrack
      ? {
          audio: this.gameState.backingTrack.path,
          duration: this.gameState.backingTrack.duration,
        }
      : null;

    const selectedSounds = this.gameState.selectedSounds.map((sound) => ({
      audio: sound.audio,
      icon: sound.icon,
    }));

    const submission = {
      songData,
      backingTrack,
      selectedSounds,
    };

    // Update phase with submission
    this.multiplayerManager.updatePhase(
      "waiting_for_players",
      this.currentRound,
      submission,
    );

    // Transition to waiting phase
    this.phaseManager.transitionTo("waiting_for_players", () => {
      // This callback won't be called - waiting phase loops
    });
  }

  /**
   * Move to final showcase phase
   */
  moveToShowcase() {
    this.multiplayerManager.updatePhase("showcase", this.currentRound);

    this.phaseManager.transitionTo(
      "showcase",
      () => this.restartGame(),
      () => this.exitToMenu(),
    );
  }

  /**
   * Start the initial selection phase
   */
  startSelectionPhase() {
    this.multiplayerManager.updatePhase("selection", this.currentRound);

    this.phaseManager.transitionTo("selection", () => {
      this.moveToPerformance();
    });
  }

  showTutorial() {
    this.gameState.setState("tutorial");
    this.uiManager.showScreen("tutorial");
  }

  showCreateLobby() {
    this.uiManager.showScreen("create_lobby");
    const playerNameInput = this.uiManager.elements.playerName;
    const createButton = document.getElementById("create-lobby-confirm-btn");

    if (createButton) {
      createButton.disabled = true;
      createButton.classList.add("is-disabled");
    }

    if (playerNameInput) {
      playerNameInput.focus();

      const validateInput = () => {
        const hasName = playerNameInput.value.trim().length > 0;
        if (createButton) {
          createButton.disabled = !hasName;
          if (hasName) {
            createButton.classList.remove("is-disabled");
          } else {
            createButton.classList.add("is-disabled");
          }
        }
      };

      playerNameInput.addEventListener("input", validateInput);
      validateInput();
    }
  }

  showJoinLobby() {
    this.uiManager.showScreen("join_lobby");
    const playerNameInput = this.uiManager.elements.joinPlayerName;
    const lobbyCodeInput = this.uiManager.elements.lobbyCodeInput;
    const joinButton = document.getElementById("join-lobby-confirm-btn");

    if (joinButton) {
      joinButton.disabled = true;
      joinButton.classList.add("is-disabled");
    }

    const validateInput = () => {
      const hasName = playerNameInput?.value.trim().length > 0;
      const hasValidCode = lobbyCodeInput?.value.trim().length === 6;
      const isValid = hasName && hasValidCode;

      if (joinButton) {
        joinButton.disabled = !isValid;
        if (isValid) {
          joinButton.classList.remove("is-disabled");
        } else {
          joinButton.classList.add("is-disabled");
        }
      }
    };

    if (playerNameInput) {
      playerNameInput.focus();
      playerNameInput.addEventListener("input", validateInput);
    }

    if (lobbyCodeInput) {
      lobbyCodeInput.addEventListener("input", validateInput);
    }

    validateInput();
  }

  async createLobby() {
    const createButton = document.getElementById("create-lobby-confirm-btn");
    if (createButton) {
      createButton.disabled = true;
      createButton.classList.add("is-disabled");
      createButton.textContent = "Creating...";
    }

    const playerName = this.uiManager.elements.playerName?.value.trim();

    try {
      const connected = await this.multiplayerManager.connect(this.serverUrl);

      if (!connected) {
        this.showError("Failed to connect to server. Please try again.");
        if (createButton) {
          createButton.disabled = false;
          createButton.textContent = "Create Lobby";
          createButton.classList.remove("is-disabled");
        }
        return;
      }

      const response = await this.multiplayerManager.createLobby(playerName);

      if (response.success) {
        this.showLobbyWaiting(response.state);
      } else {
        this.showError(response.error || "Failed to create lobby");
        if (createButton) {
          createButton.disabled = false;
          createButton.textContent = "Create Lobby";
          createButton.classList.remove("is-disabled");
        }
      }
    } catch (error) {
      console.error("Error creating lobby:", error);
      this.showError("Failed to create lobby. Please try again.");
      if (createButton) {
        createButton.disabled = false;
        createButton.classList.remove("is-disabled");
        createButton.textContent = "Create Lobby";
      }
    }
  }

  async joinLobby() {
    const joinButton = document.getElementById("join-lobby-confirm-btn");
    if (joinButton) {
      joinButton.disabled = true;
      joinButton.classList.add("is-disabled");
      joinButton.textContent = "Joining...";
    }

    const playerName = this.uiManager.elements.joinPlayerName?.value.trim();
    const lobbyCode = this.uiManager.elements.lobbyCodeInput?.value.trim();

    try {
      const connected = await this.multiplayerManager.connect(this.serverUrl);
      if (!connected) {
        this.showError("Failed to connect to server. Please try again.");
        if (joinButton) {
          joinButton.disabled = false;
          joinButton.textContent = "Join Lobby";
          joinButton.classList.remove("is-disabled");
        }
        return;
      }

      const response = await this.multiplayerManager.joinLobby(
        lobbyCode,
        playerName,
      );
      if (response.success) {
        this.showLobbyWaiting(response.state);
      } else {
        this.showError(response.error || "Failed to join lobby");
        if (joinButton) {
          joinButton.disabled = false;
          joinButton.textContent = "Join Lobby";
          joinButton.classList.remove("is-disabled");
        }
      }
    } catch (error) {
      console.error("Error joining lobby:", error);
      this.showError("Failed to join lobby. Please try again.");
      if (joinButton) {
        joinButton.disabled = false;
        joinButton.textContent = "Join Lobby";
        joinButton.classList.remove("is-disabled");
      }
    }
  }

  showLobbyWaiting(state) {
    this.uiManager.showScreen("lobby_waiting");
    this.updateLobbyUI(state);

    const lobbyCode = this.multiplayerManager.getLobbyCode();
    if (this.uiManager.elements.lobbyCodeDisplay) {
      this.uiManager.elements.lobbyCodeDisplay.textContent = lobbyCode;
    }
    if (this.uiManager.elements.shareableCode) {
      this.uiManager.elements.shareableCode.textContent = lobbyCode;
    }
  }

  /**
   * Update lobby waiting screen UI based on current state
   */
  updateLobbyUI(state) {
    if (!state) return;

    console.log("Updating lobby UI");

    // Update player count
    if (this.uiManager.elements.playerCount) {
      this.uiManager.elements.playerCount.textContent = state.players.length;
    }

    // Update players list
    if (this.uiManager.elements.playersContainer) {
      this.uiManager.elements.playersContainer.innerHTML = "";

      state.players.forEach((player) => {
        const playerItem = document.createElement("div");
        playerItem.className = "player-item";

        const playerName = document.createElement("span");
        playerName.className = "player-name";
        playerName.textContent = player.name;

        const playerStatus = document.createElement("span");
        playerStatus.className = "player-status";

        if (player.ready) {
          playerStatus.textContent = "Ready";
          playerStatus.classList.add("ready");
        } else {
          playerStatus.textContent = "Not Ready";
        }

        playerItem.appendChild(playerName);
        playerItem.appendChild(playerStatus);
        this.uiManager.elements.playersContainer.appendChild(playerItem);
      });
    }

    // Update ready button state
    const readyBtn = document.getElementById("ready-btn");
    const currentPlayer = state.players.find(
      (p) => p.id === this.multiplayerManager.getPlayerId(),
    );
    if (readyBtn && currentPlayer) {
      const hasEnoughPlayers = state.players.length >= 2;

      // Disable if player is already ready (lock them in)
      if (currentPlayer.ready) {
        readyBtn.textContent = "Ready";
        readyBtn.disabled = true;
        readyBtn.classList.add("is-disabled");
      }
      // Enable if 2+ players and not ready yet
      else if (hasEnoughPlayers) {
        readyBtn.textContent = "Ready";
        readyBtn.disabled = false;
        readyBtn.classList.remove("is-disabled");
      }
      // Disable if less than 2 players
      else {
        readyBtn.textContent = "Ready";
        readyBtn.disabled = true;
        readyBtn.classList.add("is-disabled");
      }
    }

    // Check if all players ready and show countdown
    const allReady =
      state.players.length >= 2 && state.players.every((p) => p.ready);
    if (allReady && state.state === "lobby") {
      this.showGameStarting();
    }
  }

  setReady() {
    const state = this.multiplayerManager.getLobbyState();
    if (!state || state.players.length < 2) {
      return;
    }

    this.multiplayerManager.setReady(true);
  }

  showGameStarting() {
    const gameStarting = this.uiManager.elements.gameStarting;
    if (gameStarting && gameStarting.style.display !== "block") {
      gameStarting.style.display = "block";

      let countdown = 3;
      const countdownElement = this.uiManager.elements.startCountdown;

      const updateCountdown = () => {
        if (countdownElement) {
          countdownElement.textContent = countdown;
        }

        countdown--;
        if (countdown >= 0) {
          setTimeout(updateCountdown, 1000);
        }
      };

      updateCountdown();
    }
  }

  hideGameStarting() {
    const gameStarting = this.uiManager.elements.gameStarting;
    if (gameStarting) {
      gameStarting.style.display = "none";
    }
  }

  leaveLobby() {
    this.multiplayerManager.disconnect();
    this.uiManager.showScreen("main_menu");

    if (this.hasUserInteracted && !this.audioEngine.isMenuMusicPlaying()) {
      this.audioEngine.startMenuMusic();
    }
  }

  restartGame() {
    this.leaveLobby();
  }

  exitToMenu() {
    this.cleanupCurrentPhase();
    this.multiplayerManager.disconnect();
    this.gameState.resetForNewGame();
    this.currentRound = 0;
    this.currentPhase = "lobby";
    this.uiManager.showScreen("main_menu");

    if (this.hasUserInteracted && !this.audioEngine.isMenuMusicPlaying()) {
      this.audioEngine.startMenuMusic();
    }
  }

  cleanupCurrentPhase() {
    this.phaseManager.cleanup();
  }

  showNotification(message) {
    const messageDiv = document.createElement("section");
    messageDiv.className = "message -right";

    const balloon = document.createElement("div");
    balloon.className = "nes-balloon from-right";
    balloon.textContent = message;

    messageDiv.appendChild(balloon);

    const toast = Toastify({
      node: messageDiv,
      duration: 3000,
      gravity: "bottom",
      position: "right",
      stopOnFocus: true,
      offset: {
        x: 20,
        y: 20,
      },
      onClick: function () {
        toast.hideToast();
      },
    });

    toast.showToast();
  }

  showError(message) {
    const dialog = document.getElementById("error-dialog");
    const messageElement = document.getElementById("error-message");
    if (dialog && messageElement) {
      messageElement.textContent = message;
      dialog.showModal();
    } else {
      alert(message);
    }
  }

  cleanup() {
    this.cleanupCurrentPhase();
    this.audioEngine.stopPreview();
    this.audioEngine.stopEditPreview();
    this.audioEngine.stopMenuMusic();
    this.inputController.cleanup();
    this.multiplayerManager.disconnect();
  }
}

/**
 * Bootstrap the game on page load
 */
document.addEventListener("DOMContentLoaded", async () => {
  const game = new Game();
  await game.initialize();

  window.multiplayerGame = game;
});
