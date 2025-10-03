import { PhaseType, StateEvent, NetworkEvent, GameConfig } from "./Constants.js";
import { ServerState } from "./state/ServerState.js";
import { LocalGameState } from "./state/LocalGameState.js";
import { StateObserver } from "./state/StateObserver.js";
import { AudioService } from "./services/AudioService.js";
import { NetworkService } from "./services/NetworkService.js";
import { UIService } from "./services/UIService.js";
import { CanvasService } from "./services/CanvasService.js";
import { InputService } from "./services/InputService.js";
import { LobbyPhase } from "./phases/LobbyPhase.js";
import { SelectionPhase } from "./phases/SelectionPhase.js";
import { PreviewPhase } from "./phases/PreviewPhase.js";
import { SoundReplacementPhase } from "./phases/SoundReplacementPhase.js";
import { PerformancePhase } from "./phases/PerformancePhase.js";
import { EditingPhase } from "./phases/EditingPhase.js";
import { WaitingPhase } from "./phases/WaitingPhase.js";
import { ShowcasePhase } from "./phases/ShowcasePhase.js";

/**
 * Game - Main orchestrator for collaborative music game
 * Manages phase transitions, state updates, and service coordination
 */
export class Game {
  constructor() {
    // State layer
    this.serverState = new ServerState();
    this.localState = new LocalGameState();

    // Service layer
    this.audio = new AudioService();
    this.network = new NetworkService(this.serverState);
    this.ui = new UIService();
    this.canvas = new CanvasService();
    this.input = new InputService();

    // Services object for phase injection
    this.services = {
      audio: this.audio,
      network: this.network,
      ui: this.ui,
      canvas: this.canvas,
      input: this.input,
      serverState: this.serverState,
      localState: this.localState,
    };

    // Phase instances
    this.phases = {
      [PhaseType.LOBBY]: new LobbyPhase(this.services),
      [PhaseType.SELECTION]: new SelectionPhase(this.services),
      [PhaseType.PREVIEW]: new PreviewPhase(this.services),
      [PhaseType.SOUND_REPLACEMENT]: new SoundReplacementPhase(this.services),
      [PhaseType.PERFORMANCE]: new PerformancePhase(this.services),
      [PhaseType.EDITING]: new EditingPhase(this.services),
      [PhaseType.WAITING]: new WaitingPhase(this.services),
      [PhaseType.SHOWCASE]: new ShowcasePhase(this.services),
    };

    // Current phase
    this.currentPhase = null;

    // State update handler
    this.stateUpdateHandler = null;
  }

  /**
   * Initialize the game
   */
  async initialize() {
    console.log("Initializing game...");

    // Initialize services
    await this.audio.initialize();
    this.ui.initialize();
    this.input.initialize();

    // Load assets
    await this.localState.loadSoundList();

    // Set up main menu buttons
    this.setupMainMenu();

    // Show main menu
    this.ui.showScreen("main_menu");

    console.log("Game initialized");
  }

  /**
   * Set up main menu button handlers
   */
  setupMainMenu() {
    this.input.setupPersistentButtonEvents({
      "create-lobby-btn": () => this.showCreateLobbyScreen(),
      "join-lobby-btn": () => this.showJoinLobbyScreen(),
      "tutorial-btn": () => this.ui.showScreen("tutorial"),
      "create-lobby-confirm-btn": () => this.handleCreateLobby(),
      "join-lobby-confirm-btn": () => this.handleJoinLobby(),
      "back-to-menu-btn": () => this.ui.showScreen("main_menu"),
      "back-to-menu-from-join-btn": () => this.ui.showScreen("main_menu"),
    });
  }

  /**
   * Show create lobby screen
   */
  showCreateLobbyScreen() {
    this.ui.showScreen("create_lobby");
  }

  /**
   * Show join lobby screen
   */
  showJoinLobbyScreen() {
    this.ui.showScreen("join_lobby");
  }

  /**
   * Handle create lobby button
   */
  async handleCreateLobby() {
    const nameInput = document.getElementById("player-name");
    const playerName = nameInput?.value.trim() || "Player";

    try {
      await this.network.connect(GameConfig.SERVER_URL);
      const response = await this.network.createLobby(playerName);

      if (!response.success) {
        this.ui.showError(response.error || "Failed to create lobby");
        return;
      }

      // Listen for state updates
      this.setupStateUpdateHandler();

      // Start lobby phase (state is already populated from createLobby response)
      this.startPhase(PhaseType.LOBBY);
    } catch (error) {
      console.error("Failed to create lobby:", error);
      this.ui.showError("Failed to create lobby. Please try again.");
    }
  }

  /**
   * Handle join lobby button
   */
  async handleJoinLobby() {
    const nameInput = document.getElementById("join-player-name");
    const codeInput = document.getElementById("lobby-code");

    const playerName = nameInput?.value.trim() || "Player";
    const lobbyCode = codeInput?.value.trim().toUpperCase();

    if (!lobbyCode) {
      this.ui.showError("Please enter a lobby code.");
      return;
    }

    try {
      await this.network.connect(GameConfig.SERVER_URL);
      const response = await this.network.joinLobby(lobbyCode, playerName);

      if (!response.success) {
        this.ui.showError(response.error || "Failed to join lobby");
        return;
      }

      // Listen for state updates
      this.setupStateUpdateHandler();

      // Start lobby phase (state is already populated from joinLobby response)
      this.startPhase(PhaseType.LOBBY);
    } catch (error) {
      console.error("Failed to join lobby:", error);
      this.ui.showError("Failed to join lobby. Please check the code and try again.");
    }
  }

  /**
   * Set up state update handler (just updates ServerState, doesn't force transitions)
   */
  setupStateUpdateHandler() {
    if (this.stateUpdateHandler) {
      this.network.observer.off("stateUpdate", this.stateUpdateHandler);
    }

    this.stateUpdateHandler = (newState) => {
      const previousState = this.serverState.get();
      this.serverState.update(newState);

      // Show join/leave notifications
      this.handlePlayerChanges(previousState, newState);

      // Phases observe ServerState themselves and decide when to complete
    };

    this.network.observer.on("stateUpdate", this.stateUpdateHandler);
  }

  /**
   * Handle player join/leave notifications
   */
  handlePlayerChanges(previousState, newState) {
    if (!previousState || !newState) return;

    const previousPlayers = previousState.players || [];
    const currentPlayers = newState.players || [];

    // Check for new players
    currentPlayers.forEach((player) => {
      const wasPresent = previousPlayers.some((p) => p.id === player.id);
      if (!wasPresent) {
        this.ui.showNotification(`${player.name} joined the lobby`);
      }
    });

    // Check for players who left
    previousPlayers.forEach((player) => {
      const isStillPresent = currentPlayers.some((p) => p.id === player.id);
      if (!isStillPresent) {
        this.ui.showNotification(`${player.name} left the lobby`);
      }
    });
  }

  /**
   * Get next phase based on current phase completing
   */
  getNextPhase(currentPhaseName) {
    const currentRound = this.serverState.getCurrentRound();
    const maxRounds = this.serverState.getMaxRounds();

    switch (currentPhaseName) {
      case "LobbyPhase":
        return PhaseType.SELECTION;
      case "SelectionPhase":
        return PhaseType.PERFORMANCE;
      case "PerformancePhase":
        return PhaseType.EDITING;
      case "EditingPhase":
        return PhaseType.WAITING;
      case "WaitingPhase":
        // Check if game is over
        if (currentRound >= maxRounds) {
          return PhaseType.SHOWCASE;
        }
        // Next round starts with preview (for round 2+)
        return PhaseType.PREVIEW;
      case "PreviewPhase":
        return PhaseType.SOUND_REPLACEMENT;
      case "SoundReplacementPhase":
        return PhaseType.PERFORMANCE;
      case "ShowcasePhase":
        return null; // Stay in showcase or return to menu
      default:
        return null;
    }
  }

  /**
   * Transition to a new phase
   */
  transitionToPhase(phaseType) {
    console.log(`Transitioning to phase: ${phaseType}`);

    // Exit current phase
    if (this.currentPhase) {
      this.currentPhase.exit();
    }

    // Start new phase
    this.startPhase(phaseType);
  }

  /**
   * Start a specific phase
   */
  async startPhase(phaseType) {
    const phase = this.phases[phaseType];

    if (!phase) {
      console.error(`Phase not found: ${phaseType}`);
      return;
    }

    this.currentPhase = phase;

    // Enter phase with callbacks
    await phase.enter(
      () => this.handlePhaseComplete(),
      () => this.handlePhaseSecondary()
    );
  }

  /**
   * Handle phase completion
   */
  handlePhaseComplete() {
    console.log("Phase completed:", this.currentPhase?.constructor.name);

    // Get next phase based on what just completed
    const currentPhaseName = this.currentPhase?.constructor.name;
    const nextPhaseType = this.getNextPhase(currentPhaseName);

    if (nextPhaseType) {
      this.transitionToPhase(nextPhaseType);
    } else {
      console.log("No next phase, staying in current phase");
    }
  }

  /**
   * Handle phase secondary action (e.g., exit to menu)
   */
  handlePhaseSecondary() {
    // Exit current phase
    if (this.currentPhase) {
      this.currentPhase.exit();
      this.currentPhase = null;
    }

    // Disconnect from server
    this.network.disconnect();

    // Clean up state update handler
    if (this.stateUpdateHandler) {
      this.network.observer.off("stateUpdate", this.stateUpdateHandler);
      this.stateUpdateHandler = null;
    }

    // Reset states
    this.serverState = new ServerState();
    this.localState = new LocalGameState();

    // Update services with new states
    this.services.serverState = this.serverState;
    this.services.localState = this.localState;

    // Update network service with new server state
    this.network.serverState = this.serverState;

    // Update all phase instances with new state references
    Object.values(this.phases).forEach((phase) => {
      phase.serverState = this.serverState;
      phase.localState = this.localState;
    });

    // Show main menu
    this.ui.showScreen("main_menu");

    console.log("Returned to main menu");
  }

  /**
   * Cleanup on shutdown
   */
  cleanup() {
    if (this.currentPhase) {
      this.currentPhase.exit();
    }

    this.network.disconnect();
    this.input.cleanup();
    this.audio.cleanup();
  }
}
