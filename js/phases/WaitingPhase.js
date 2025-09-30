/**
 * WaitingPhase - Handles the waiting for players phase
 * Shows a simple waiting screen while everyone completes their songs
 */
export class WaitingPhase {
  constructor(gameState, uiManager, audioEngine, multiplayerManager) {
    this.gameState = gameState;
    this.uiManager = uiManager;
    this.audioEngine = audioEngine;
    this.multiplayerManager = multiplayerManager;
    this.onPhaseComplete = null;

    // Audio management properties
    this.backgroundMusic = null;
    this.fadeInterval = null;
    this.currentVolume = 0;
    this.targetVolume = 0.2; // Target volume for the background music
    this.fadeSteps = 20; // Number of fade steps
    this.fadeStepDuration = 10; // Milliseconds per fade step
  }

  async start(onComplete) {
    this.onPhaseComplete = onComplete;

    console.log("Starting waiting phase");
    this.uiManager.showScreen("waiting-for-players");

    // Update the waiting screen with current game state
    const gameState = this.multiplayerManager.getGameState();
    if (gameState) {
      this.uiManager.updateWaitingScreen(gameState);
    }

    // Load and start background music
    await this.loadBackgroundMusic();
    if (this.backgroundMusic) {
      this.fadeIn();
    }

    // Set up multiplayer event handlers
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    // Listen for waiting updates from server
    this.multiplayerManager.onWaitingUpdate = (gameState) => {
      this.updateWaitingUI(gameState);
    };

    // Listen for phase changes (when all players have submitted)
    this.multiplayerManager.onPhaseChange = (gameState) => {
      if (gameState.state === "preview" || gameState.state === "showcase") {
        this.complete(gameState);
      }
    };
  }

  updateWaitingUI(gameState) {
    this.uiManager.updateWaitingScreen(gameState);
  }

  complete(gameState) {
    console.log("Waiting phase complete, transitioning to:", gameState.state);
    if (this.onPhaseComplete) {
      this.onPhaseComplete(gameState);
    }
  }

  fadeIn() {
    if (!this.backgroundMusic || this.fadeInterval) {
      return; // No music loaded or fade already in progress
    }

    this.currentVolume = 0;
    this.backgroundMusic.volume = 0;
    this.backgroundMusic.play();

    this.fadeInterval = setInterval(() => {
      const volumeStep = this.targetVolume / this.fadeSteps;
      this.currentVolume += volumeStep;

      if (this.currentVolume >= this.targetVolume) {
        this.currentVolume = this.targetVolume;
        this.backgroundMusic.volume = this.currentVolume;
        clearInterval(this.fadeInterval);
        this.fadeInterval = null;
      } else {
        this.backgroundMusic.volume = this.currentVolume;
      }
    }, this.fadeStepDuration);
  }

  fadeOut() {
    if (!this.backgroundMusic || this.fadeInterval) {
      return; // No music loaded or fade already in progress
    }

    this.fadeInterval = setInterval(() => {
      const volumeStep = this.targetVolume / this.fadeSteps;
      this.currentVolume -= volumeStep;

      if (this.currentVolume <= 0) {
        this.currentVolume = 0;
        this.backgroundMusic.volume = 0;
        this.backgroundMusic.pause();
        this.backgroundMusic.currentTime = 0;
        clearInterval(this.fadeInterval);
        this.fadeInterval = null;
      } else {
        this.backgroundMusic.volume = this.currentVolume;
      }
    }, this.fadeStepDuration);
  }

  async loadBackgroundMusic() {
    try {
      this.backgroundMusic = new Audio("assets/sfx/gameshow_presentation.mp3");
      this.backgroundMusic.loop = true;
      this.backgroundMusic.volume = 0;

      // Wait for the audio to be loadable
      await new Promise((resolve, reject) => {
        this.backgroundMusic.addEventListener("canplaythrough", resolve, {
          once: true,
        });
        this.backgroundMusic.addEventListener("error", reject, { once: true });
        this.backgroundMusic.load();
      });

      console.log("Waiting phase background music loaded");
    } catch (error) {
      console.error("Failed to load waiting phase background music:", error);
      this.backgroundMusic = null;
    }
  }

  cleanup() {
    // Fade out and stop background music
    if (this.backgroundMusic) {
      this.fadeOut();
      // Give fade out time to complete, then cleanup
      setTimeout(
        () => {
          if (this.backgroundMusic) {
            this.backgroundMusic.pause();
            this.backgroundMusic.currentTime = 0;
            this.backgroundMusic = null;
          }
          if (this.fadeInterval) {
            clearInterval(this.fadeInterval);
            this.fadeInterval = null;
          }
        },
        this.fadeSteps * this.fadeStepDuration + 100,
      );
    }

    // Clean up event handlers
    this.multiplayerManager.onWaitingUpdate = null;
    // Note: Don't clear onPhaseChange as it might be used by other phases
  }
}
