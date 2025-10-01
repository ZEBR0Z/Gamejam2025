/**
 * Game - Main orchestrator for a Gartic Phone-style collaborative music game
 *
 * ARCHITECTURE:
 * This class coordinates all major game systems and acts as the primary integration point:
 * - Core systems (audio, state, UI, rendering, input, networking)
 * - Phase management (orchestrating the game's state machine)
 * - Multiplayer synchronization (handling server events and state updates)
 *
 * GAME FLOW:
 * 1. Lobby creation/joining - Players connect and ready up
 * 2. Sound selection - Each player picks 3 sounds from 5 server-provided options
 * 3. Collaborative rounds - Songs rotate between players (like Gartic Phone):
 *    Round 0: Each player creates their own initial 8-second segment
 *    Round 1+: Players add segments to the previous player's song
 *    Each round: Preview -> Performance -> Editing -> Waiting
 * 4. Final showcase - All completed collaborative songs are presented
 *
 * KEY RESPONSIBILITIES:
 * - Initializing and wiring together all game subsystems
 * - Managing multiplayer lobby lifecycle (create, join, leave)
 * - Routing phase transitions from server to appropriate phase handlers
 * - Converting game state between client and server formats
 * - Handling UI validation and user interaction detection (for audio autoplay)
 *
 * MULTIPLAYER MODEL:
 * - Hybrid authority: Server manages lobby/round state, clients manage phase timing
 * - Server tracks: player ready states, song submissions, round completion, song rotation
 * - Client manages: phase timing, phase transitions within rounds, audio playback/recording
 * - Server signals: round boundaries (preview, showcase), not individual phase changes
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
    // Dependencies are injected to maintain separation of concerns
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
    );
    this.previewPhase = new PreviewPhase(
      this.gameState,
      this.uiManager,
      this.audioEngine,
      this.canvasRenderer,
      this.inputController,
      this.multiplayerManager,
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
    // Modern browsers require user gesture before playing audio
    this.hasUserInteracted = false;

    // State synchronization - track server state version for heartbeat reconciliation
    this.lastKnownStateVersion = 0;
    this.heartbeatInterval = null;
    this.heartbeatIntervalMs = 2500;

    // Wire up icon preloading when game state loads sounds
    // This ensures icons are ready for rendering before they're needed
    this.gameState.onIconPreload = (iconUrl) => {
      this.canvasRenderer.loadIcon(iconUrl);
    };

    this.setupPhaseManager();
  }

  /**
   * Register all game phases with the phase manager
   * Creates the phase registry that enables phase transitions via string keys
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

    // Hook into phase transitions to sync state and stop menu music
    this.phaseManager.onTransition = (phaseName, phaseInstance) => {
      console.log(`Transitioned to phase: ${phaseName}`);
      this.gameState.setState(phaseName);

      // Stop menu music when entering gameplay phases
      if (this.audioEngine.isMenuMusicPlaying()) {
        this.audioEngine.stopMenuMusic();
      }
    };
  }

  /**
   * Initialize all game systems asynchronously
   * This is the main entry point called once on page load
   * Sets up audio, loads sound manifests, wires UI, and prepares for multiplayer
   */
  async initialize() {
    try {
      console.log("Initializing Game...");

      // Initialize audio context and load assets
      await this.audioEngine.initialize();
      await this.gameState.loadSoundList();
      this.uiManager.initialize();
      await this.audioEngine.loadMenuMusic();

      // Set up multiplayer UI and event handlers
      this.initializeMultiplayerScreens();
      this.setupMenuHandlers();
      this.setupMultiplayerHandlers();

      // Listen for first user interaction to enable audio playback
      this.setupUserInteractionDetection();

      console.log("Game initialized successfully");
    } catch (error) {
      console.error("Failed to initialize Game:", error);
      this.showError(
        "Failed to initialize the game. Please refresh and try again.",
      );
    }
  }

  /**
   * Cache DOM references for multiplayer UI elements
   * Done once during initialization to avoid repeated querySelector calls
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

  /**
   * Set up listeners for first user interaction
   * Required to comply with browser autoplay policies - audio must be triggered by user gesture
   * Listens for click, keyboard, or touch events to enable audio playback
   */
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

  /**
   * Called on first user interaction - enables audio playback and starts menu music
   * Flag prevents re-triggering on subsequent interactions
   */
  handleFirstUserInteraction() {
    this.hasUserInteracted = true;
    console.log("First user interaction detected, starting menu music");

    if (!this.audioEngine.isMenuMusicPlaying()) {
      this.audioEngine.startMenuMusic();
    }
  }

  /**
   * Wire up all multiplayer-related event handlers
   * Connects UI button clicks to lobby actions and server events to UI updates
   * This creates the bidirectional data flow between client UI and server state
   */
  setupMultiplayerHandlers() {
    console.log("Setting up multiplayer handlers");

    // Button handlers for lobby actions
    const lobbyHandlers = {
      "back-to-menu-btn": () => this.uiManager.showScreen("main_menu"),
      "back-to-menu-from-join-btn": () =>
        this.uiManager.showScreen("main_menu"),
      "create-lobby-confirm-btn": () => {
        console.log("Create lobby button clicked!");
        this.createLobby();
      },
      "join-lobby-confirm-btn": () => this.joinLobby(),
      "leave-lobby-btn": () => this.leaveLobby(),
      "ready-btn": () => this.setReady(),
    };

    console.log(
      "Setting up persistent button events with handlers:",
      Object.keys(lobbyHandlers),
    );
    this.inputController.setupPersistentButtonEvents(lobbyHandlers);

    // Auto-uppercase lobby codes for consistency
    const lobbyCodeInput = this.uiManager.elements.lobbyCodeInput;
    if (lobbyCodeInput) {
      lobbyCodeInput.addEventListener("input", (e) => {
        e.target.value = e.target.value.toUpperCase();
      });
    }

    // Server event callbacks - these are triggered by socket messages
    this.multiplayerManager.onGameStateUpdate = (gameState) => {
      this.updateStateVersion(gameState);
      this.updateLobbyUI(gameState);
    };

    this.multiplayerManager.onPlayerJoined = (player, gameState) => {
      this.updateStateVersion(gameState);
      this.updateLobbyUI(gameState);
      this.showNotification(`${player.name} joined the lobby`);
    };

    this.multiplayerManager.onPlayerLeft = (playerId, gameState) => {
      this.updateStateVersion(gameState);
      this.updateLobbyUI(gameState);
      this.showNotification("A player left the lobby");
    };

    this.multiplayerManager.onGameStarted = (gameState) => {
      this.updateStateVersion(gameState);
      this.hideGameStarting();
      this.startMultiplayerGame(gameState);
    };

    this.multiplayerManager.onAllPlayersReady = (gameState) => {
      this.updateStateVersion(gameState);
      this.showGameStarting();
    };

    // Core game flow - server dictates phase transitions
    this.multiplayerManager.onPhaseChange = (gameState) => {
      this.updateStateVersion(gameState);
      this.handlePhaseChange(gameState);
    };

    this.multiplayerManager.onWaitingUpdate = (gameState) => {
      this.updateStateVersion(gameState);
      if (this.currentPhase === this.waitingPhase) {
        this.currentPhase.updateWaitingUI(gameState);
      }
    };
  }

  showTutorial() {
    this.gameState.setState("tutorial");
    this.uiManager.showScreen("tutorial");
  }

  /**
   * Show create lobby screen with input validation
   * Button is disabled until player name is entered
   */
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

  /**
   * Show join lobby screen with input validation
   * Button is disabled until both player name and 6-character lobby code are entered
   */
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
    console.log("createLobby method called");

    const createButton = document.getElementById("create-lobby-confirm-btn");
    if (createButton) {
      createButton.disabled = true;
      createButton.classList.add("is-disabled");
      createButton.textContent = "Creating...";
    }

    const playerName = this.uiManager.elements.playerName?.value.trim();

    try {
      console.log("Attempting to connect to server:", this.serverUrl);
      const connected = await this.multiplayerManager.connect(this.serverUrl);
      console.log("Connection result:", connected);
      if (!connected) {
        console.log("Failed to connect to server");
        this.showError("Failed to connect to server. Please try again.");
        if (createButton) {
          createButton.disabled = false;
          createButton.textContent = "Create Lobby";
          createButton.classList.remove("is-disabled");
        }
        return;
      }
      console.log("Successfully connected to server");

      const response = await this.multiplayerManager.createLobby(playerName);
      console.log("CreateLobby response in Game.js:", response);
      if (response.success) {
        console.log("Lobby created successfully, showing lobby waiting screen");
        this.showLobbyWaiting(response.gameState);
      } else {
        console.log("Failed to create lobby:", response.error);
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
        createButton.classList.remove("is-disabled");
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
        this.showLobbyWaiting(response.gameState);
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

  showLobbyWaiting(gameState) {
    console.log("showLobbyWaiting called with gameState:", gameState);
    this.uiManager.showScreen("lobby_waiting");
    this.updateLobbyUI(gameState);

    // Set lobby code displays
    const lobbyCode = this.multiplayerManager.getLobbyCode();
    if (this.uiManager.elements.lobbyCodeDisplay) {
      this.uiManager.elements.lobbyCodeDisplay.textContent = lobbyCode;
    }
    if (this.uiManager.elements.shareableCode) {
      this.uiManager.elements.shareableCode.textContent = lobbyCode;
    }
  }

  /**
   * Update lobby waiting screen UI based on current game state
   * Refreshes player list, ready status, and ready button availability
   * Called whenever server sends game state updates
   */
  updateLobbyUI(gameState) {
    if (!gameState) return;

    // Update player count
    if (this.uiManager.elements.playerCount) {
      this.uiManager.elements.playerCount.textContent =
        gameState.players.length;
    }

    // Update players list
    if (this.uiManager.elements.playersContainer) {
      this.uiManager.elements.playersContainer.innerHTML = "";

      gameState.players.forEach((player) => {
        const playerItem = document.createElement("div");
        playerItem.className = "player-item";

        const playerName = document.createElement("span");
        playerName.className = "player-name";
        playerName.textContent = player.name;

        const playerStatus = document.createElement("span");
        playerStatus.className = "player-status";

        if (player.isReady) {
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

    // Update ready button state - disabled if already ready or not enough players
    const readyBtn = document.getElementById("ready-btn");
    const currentPlayer = gameState.players.find(
      (p) => p.id === this.multiplayerManager.getPlayerId(),
    );
    if (readyBtn && currentPlayer) {
      const hasEnoughPlayers = gameState.players.length >= 2;

      if (currentPlayer.isReady) {
        readyBtn.textContent = "Ready";
        readyBtn.disabled = true;
        readyBtn.classList.add("is-disabled");
      } else if (!hasEnoughPlayers) {
        readyBtn.textContent = "Ready";
        readyBtn.disabled = true;
        readyBtn.classList.add("is-disabled");
      } else {
        readyBtn.textContent = "Ready";
        readyBtn.disabled = false;
        readyBtn.classList.remove("is-disabled");
      }
    }
  }

  /**
   * Mark current player as ready
   * Requires at least 2 players in the lobby
   */
  setReady() {
    const gameState = this.multiplayerManager.getGameState();
    if (!gameState || gameState.players.length < 2) {
      console.log("Cannot ready up: not enough players");
      return;
    }

    this.multiplayerManager.setReady();
  }

  showGameStarting() {
    const gameStarting = this.uiManager.elements.gameStarting;
    if (gameStarting) {
      gameStarting.style.display = "block";

      // Start countdown
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

  /**
   * Transition from lobby to actual gameplay
   * Called when server sends game start signal after all players ready up
   * Prepares audio context and converts server's sound indices to full sound objects
   */
  async startMultiplayerGame(gameState) {
    try {
      // Resume audio context (may be suspended by browser autoplay policy)
      await this.audioEngine.resume();
      this.gameState.resetGameData();

      // Convert server's sound indices to full sound objects from soundlist
      this.gameState.availableSounds = gameState.availableSounds.map(
        (index) => this.gameState.soundList[index],
      );

      this.startSelectionPhase();
    } catch (error) {
      console.error("Failed to start multiplayer game:", error);
      this.showError("Failed to start the game. Please try again.");
    }
  }

  /**
   * Handle phase changes from server and route to appropriate phase
   *
   * CRITICAL: Server only signals at ROUND BOUNDARIES, not every phase
   * - Server signals: "preview" (new round), "showcase" (game over)
   * - Client manages: selection -> performance -> editing -> waiting (within round)
   *
   * Server's role:
   * - Tracks song submissions and determines when round is complete
   * - Rotates song assignments between players (Gartic Phone style)
   * - Signals "preview" when all players submit (start next round)
   * - Signals "showcase" when all rounds complete
   *
   * Client's role:
   * - Manages timing for performance (8 sec), editing, etc.
   * - Chains phases within a round automatically
   * - Submits completed work to server, then waits
   *
   * @param {Object} gameState - Current game state from server
   */
  handlePhaseChange(gameState) {
    switch (gameState.state) {
      case "performance":
        // Rare: Server shouldn't send this, but handle it for robustness
        // Chain: performance -> editing -> submit -> waiting
        this.phaseManager.transitionTo("performance", () => {
          console.log("Performance phase complete, moving to editing phase");
          this.phaseManager.transitionTo("editing", () => {
            console.log(
              "Editing phase complete, submitting song and moving to waiting phase",
            );
            this.submitSongToServer();
          });
        });
        break;

      case "editing":
        // Rare: Direct to editing (shouldn't happen in normal flow)
        this.phaseManager.transitionTo("editing", () => {
          console.log(
            "Editing phase complete, submitting song and moving to waiting phase",
          );
          this.submitSongToServer();
        });
        break;

      case "waiting_for_players":
        // Already waiting, just update UI. Server will send next phase when ready
        this.phaseManager.transitionTo("waiting_for_players", (gameState) => {
          this.handlePhaseChange(gameState);
        });
        break;

      case "preview":
        // SERVER SIGNAL: New round starting, all players submitted previous round
        // Songs have been rotated, now preview the song before adding to it
        // Chain: preview -> sound_replacement -> performance -> editing -> submit -> waiting
        this.stopHeartbeat();
        this.phaseManager.transitionTo("preview", () => {
          console.log(
            "Song preview complete, moving to sound replacement phase",
          );
          this.phaseManager.transitionTo("sound_replacement", () => {
            console.log(
              "Sound replacement complete, moving to performance phase",
            );
            this.phaseManager.transitionTo("performance", () => {
              console.log(
                "Performance phase complete, moving to editing phase",
              );
              this.phaseManager.transitionTo("editing", () => {
                console.log(
                  "Editing phase complete, submitting song and moving to waiting phase",
                );
                this.submitSongToServer();
              });
            });
          });
        });
        break;

      case "showcase":
        // SERVER SIGNAL: All rounds complete, show final collaborative songs
        this.stopHeartbeat();
        this.phaseManager.transitionTo(
          "showcase",
          () => this.restartGame(), // onRestart callback
          () => this.exitToMenu(), // onExit callback
        );
        break;
    }
  }

  /**
   * Start the initial selection phase (first phase of the game)
   * Chains into performance -> editing -> submit
   */
  startSelectionPhase() {
    this.phaseManager.transitionTo("selection", () => {
      console.log("Selection phase complete, moving to performance phase");
      this.phaseManager.transitionTo("performance", () => {
        console.log("Performance phase complete, moving to editing phase");
        this.phaseManager.transitionTo("editing", () => {
          console.log(
            "Editing phase complete, submitting song and moving to waiting phase",
          );
          this.submitSongToServer();
        });
      });
    });
  }

  /**
   * Submit completed song segment to server
   *
   * Converts client's rich event objects into server format:
   * - Events contain soundIndex (local array position) -> convert to audio file paths
   * - Includes timing (startTimeSec) and pitch adjustments (pitchSemitones)
   * - Next player will derive selected sounds from the song segments
   *
   * Then transitions to waiting phase until all players submit their segments
   */
  submitSongToServer() {
    // Convert events to server format with sound file references
    const songData = this.gameState.events.map((event) => {
      const selectedSound = this.gameState.selectedSounds[event.soundIndex];
      return {
        audio: selectedSound.audio,
        icon: selectedSound.icon,
        time: event.startTimeSec,
        pitch: event.pitchSemitones || 0,
      };
    });

    // Include backing track info so it persists with the song
    const backingTrack = {
      audio: this.gameState.backingTrack.path,
      duration: this.gameState.backingTrack.duration,
    };

    this.multiplayerManager.submitSong(songData, backingTrack);
    this.startHeartbeat();

    // Enter waiting phase, which will recursively handle next phase change
    this.phaseManager.transitionTo("waiting_for_players", (gameState) => {
      this.stopHeartbeat();
      this.handlePhaseChange(gameState);
    });
  }

  /**
   * Restart game - currently just leaves lobby and returns to menu
   * Called from showcase phase "Play Again" button
   */
  restartGame() {
    this.leaveLobby();
  }

  /**
   * Exit to main menu from showcase phase
   * Cleans up all game state and reconnects menu music
   */
  exitToMenu() {
    this.cleanupCurrentPhase();
    this.multiplayerManager.disconnect();
    this.gameState.resetForNewGame();
    this.uiManager.showScreen("main_menu");

    if (this.hasUserInteracted && !this.audioEngine.isMenuMusicPlaying()) {
      this.audioEngine.startMenuMusic();
    }
  }

  /**
   * Delegate to phase manager to cleanup current phase
   * Called when transitioning phases or exiting game
   */
  cleanupCurrentPhase() {
    this.phaseManager.cleanup();
  }

  /**
   * Display notification to user
   */
  showNotification(message) {
    console.log("Notification:", message);

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

  /**
   * Show error dialog to user
   * Falls back to alert if dialog element not found
   */
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

  /**
   * Start heartbeat polling to detect state changes
   * Used during waiting/preview phases to ensure clients stay synchronized
   */
  startHeartbeat() {
    if (this.heartbeatInterval) {
      console.log("Heartbeat already running");
      return;
    }

    console.log("Starting heartbeat polling");
    this.heartbeatInterval = setInterval(async () => {
      try {
        const response = await this.multiplayerManager.sendHeartbeat(
          this.lastKnownStateVersion,
        );

        if (!response || !response.success) {
          console.warn("Heartbeat failed:", response);
          return;
        }

        if (response.stateChanged && response.gameState) {
          console.log(
            `Heartbeat detected state change: ${this.lastKnownStateVersion} -> ${response.gameState.stateVersion}`,
          );
          this.lastKnownStateVersion = response.gameState.stateVersion;

          // Trigger phase change handler to reconcile state
          this.handlePhaseChange(response.gameState);
        }
      } catch (error) {
        console.error("Heartbeat error:", error);
      }
    }, this.heartbeatIntervalMs);
  }

  /**
   * Stop heartbeat polling
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      console.log("Stopping heartbeat polling");
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Update last known state version from game state
   * Called whenever we receive a fresh state from the server
   */
  updateStateVersion(gameState) {
    if (gameState && gameState.stateVersion !== undefined) {
      this.lastKnownStateVersion = gameState.stateVersion;
    }
  }

  /**
   * Full cleanup of all game systems
   * Called on page unload or when reinitializing game
   */
  cleanup() {
    this.stopHeartbeat();
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
 * Creates and initializes the game instance, and exposes it globally for debugging
 */
document.addEventListener("DOMContentLoaded", async () => {
  const game = new Game();
  await game.initialize();

  // Expose game instance globally for debugging and console access
  window.multiplayerGame = game;
});
