/**
 * Game - Gartic Phone-style collaborative music game
 *
 * Game Flow:
 * 1. Lobby creation/joining
 * 2. Sound selection (each player picks 3 from 5 sounds)
 * 3. Multiple rounds of music creation:
 *    - Performance: Record 8-second segments
 *    - Editing: Adjust pitch and timing
 *    - Waiting: Wait for all players to finish
 *    - Preview: Listen to previous player's work (rounds 2+)
 * 4. Final showcase: Play all completed collaborative songs
 *
 * Each song passes through all players, creating N-segment collaborative pieces
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
    this.serverUrl = "https://ruelalarcon.dev/ythserver";
    this.hasUserInteracted = false;

    this.gameState.onIconPreload = (iconUrl) => {
      this.canvasRenderer.loadIcon(iconUrl);
    };

    this.setupPhaseManager();
  }

  setupPhaseManager() {
    this.phaseManager.registerPhase("selection", this.selectionPhase);
    this.phaseManager.registerPhase("performance", this.performancePhase);
    this.phaseManager.registerPhase("editing", this.editingPhase);
    this.phaseManager.registerPhase("waiting-for-players", this.waitingPhase);
    this.phaseManager.registerPhase("preview", this.previewPhase);
    this.phaseManager.registerPhase(
      "sound-replacement",
      this.soundReplacementPhase,
    );
    this.phaseManager.registerPhase("showcase", this.showcasePhase);

    this.phaseManager.onTransition = (phaseName, phaseInstance) => {
      console.log(`Transitioned to phase: ${phaseName}`);
      this.gameState.setState(phaseName);

      if (this.audioEngine.isMenuMusicPlaying()) {
        this.audioEngine.stopMenuMusic();
      }
    };
  }

  async initialize() {
    try {
      console.log("Initializing Game...");

      await this.audioEngine.initialize();
      await this.gameState.loadSoundList();
      this.uiManager.initialize();
      await this.audioEngine.loadMenuMusic();

      this.initializeMultiplayerScreens();
      this.setupMenuHandlers();
      this.setupMultiplayerHandlers();
      this.setupUserInteractionDetection();

      console.log("Game initialized successfully");
    } catch (error) {
      console.error("Failed to initialize Game:", error);
      this.showError(
        "Failed to initialize the game. Please refresh and try again.",
      );
    }
  }

  initializeMultiplayerScreens() {
    this.uiManager.screens.createLobby =
      document.getElementById("create-lobby");
    this.uiManager.screens.joinLobby = document.getElementById("join-lobby");
    this.uiManager.screens.lobbyWaiting =
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
      "skip-tutorial-btn": () => this.uiManager.showScreen("main-menu"),
      "start-tutorial-btn": () => this.uiManager.showScreen("main-menu"),
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
    console.log("First user interaction detected, starting menu music");

    if (!this.audioEngine.isMenuMusicPlaying()) {
      this.audioEngine.startMenuMusic();
    }
  }

  setupMultiplayerHandlers() {
    console.log("Setting up multiplayer handlers");
    const lobbyHandlers = {
      "back-to-menu-btn": () => this.uiManager.showScreen("main-menu"),
      "back-to-menu-from-join-btn": () =>
        this.uiManager.showScreen("main-menu"),
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

    const lobbyCodeInput = this.uiManager.elements.lobbyCodeInput;
    if (lobbyCodeInput) {
      lobbyCodeInput.addEventListener("input", (e) => {
        e.target.value = e.target.value.toUpperCase();
      });
    }

    this.multiplayerManager.onGameStateUpdate = (gameState) => {
      this.updateLobbyUI(gameState);
    };

    this.multiplayerManager.onPlayerJoined = (player, gameState) => {
      this.updateLobbyUI(gameState);
      this.showNotification(`${player.name} joined the lobby`);
    };

    this.multiplayerManager.onPlayerLeft = (playerId, gameState) => {
      this.updateLobbyUI(gameState);
      this.showNotification("A player left the lobby");
    };

    this.multiplayerManager.onGameStarted = (gameState) => {
      this.hideGameStarting();
      this.startMultiplayerGame(gameState);
    };

    this.multiplayerManager.onAllPlayersReady = (gameState) => {
      this.showGameStarting();
    };

    this.multiplayerManager.onPhaseChange = (gameState) => {
      this.handlePhaseChange(gameState);
    };

    this.multiplayerManager.onWaitingUpdate = (gameState) => {
      if (this.currentPhase === this.waitingPhase) {
        this.currentPhase.updateWaitingUI(gameState);
      }
    };
  }

  showTutorial() {
    this.gameState.setState("tutorial");
    this.uiManager.showScreen("tutorial");
  }

  showCreateLobby() {
    this.uiManager.showScreen("create-lobby");
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
    this.uiManager.showScreen("join-lobby");
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
    this.uiManager.showScreen("lobby-waiting");
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

    // Update ready button
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
    this.uiManager.showScreen("main-menu");

    if (this.hasUserInteracted && !this.audioEngine.isMenuMusicPlaying()) {
      this.audioEngine.startMenuMusic();
    }
  }

  async startMultiplayerGame(gameState) {
    try {
      await this.audioEngine.resume();
      this.gameState.resetGameData();

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
   * @param {Object} gameState - Current game state from server
   */
  handlePhaseChange(gameState) {
    switch (gameState.state) {
      case "performance":
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
        this.phaseManager.transitionTo("editing", () => {
          console.log(
            "Editing phase complete, submitting song and moving to waiting phase",
          );
          this.submitSongToServer();
        });
        break;
      case "waiting-for-players":
        this.phaseManager.transitionTo("waiting-for-players", (gameState) => {
          this.handlePhaseChange(gameState);
        });
        break;
      case "preview":
        this.phaseManager.transitionTo("preview", () => {
          console.log(
            "Song preview complete, moving to sound replacement phase",
          );
          this.phaseManager.transitionTo("sound-replacement", () => {
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
        this.phaseManager.transitionTo(
          "showcase",
          () => this.restartGame(), // onRestart
          () => this.exitToMenu(), // onExit
        );
        break;
    }
  }

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
   * @description Converts events to server format with sound file references and timing/pitch data
   */
  submitSongToServer() {
    const songData = this.gameState.events.map((event) => {
      const selectedSound = this.gameState.selectedSounds[event.soundIndex];
      return {
        audio: selectedSound.audio,
        icon: selectedSound.icon,
        time: event.startTimeSec,
        pitch: event.pitchSemitones || 0,
      };
    });

    const selectedSounds = this.gameState.selectedSounds.map((sound) => ({
      audio: sound.audio,
      icon: sound.icon,
    }));

    this.multiplayerManager.submitSong(songData, selectedSounds);

    this.phaseManager.transitionTo("waiting-for-players", (gameState) => {
      this.handlePhaseChange(gameState);
    });
  }

  restartGame() {
    this.leaveLobby();
  }

  exitToMenu() {
    this.cleanupCurrentPhase();
    this.multiplayerManager.disconnect();
    this.gameState.resetForNewGame();
    this.uiManager.showScreen("main-menu");

    if (this.hasUserInteracted && !this.audioEngine.isMenuMusicPlaying()) {
      this.audioEngine.startMenuMusic();
    }
  }

  cleanupCurrentPhase() {
    this.phaseManager.cleanup();
  }

  showNotification(message) {
    console.log("Notification:", message);
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

document.addEventListener("DOMContentLoaded", async () => {
  const game = new Game();
  await game.initialize();
  window.multiplayerGame = game;
});
