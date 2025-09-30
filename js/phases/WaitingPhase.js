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
    this.backgroundMusic = null;
    this.isActive = false;
  }

  async start(onComplete) {
    this.onPhaseComplete = onComplete;
    this.isActive = true;

    console.log("Starting waiting phase");
    this.uiManager.showScreen("waiting-for-players");

    const gameState = this.multiplayerManager.getGameState();
    if (gameState) {
      this.uiManager.updateWaitingScreen(gameState);
    }

    if (this.isActive) {
      await this.loadBackgroundMusic();
    }

    await this.fetchRandomFact();
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

  async fetchRandomFact() {
    try {
      const response = await fetch(
        "https://uselessfacts.jsph.pl/api/v2/facts/random",
      );
      if (!this.isActive) return;

      const data = await response.json();
      if (!this.isActive) return;

      const waitingMessage = document.getElementById("waiting-message");
      if (waitingMessage && data.text) {
        await this.typeText(waitingMessage, data.text);
      }
    } catch (error) {
      console.error("Failed to fetch random fact:", error);
      const waitingMessage = document.getElementById("waiting-message");
      await this.typeText(
        waitingMessage,
        "Sometimes either the internet, API, or JavaScript, just want to... not work!",
      );
    }
  }

  async typeText(element, text, speed = 30) {
    element.textContent = "";
    for (let i = 0; i < text.length; i++) {
      if (!this.isActive) return;
      element.textContent += text[i];
      await new Promise((resolve) => setTimeout(resolve, speed));
    }
  }

  async loadBackgroundMusic() {
    try {
      this.backgroundMusic = new Audio("assets/sfx/gameshow_presentation.mp3");
      this.backgroundMusic.loop = true;
      this.backgroundMusic.volume = 0.2;

      // Wait for the audio to be loadable
      await new Promise((resolve, reject) => {
        this.backgroundMusic.addEventListener("canplaythrough", resolve, {
          once: true,
        });
        this.backgroundMusic.addEventListener("error", reject, { once: true });
        this.backgroundMusic.load();
      });

      if (this.isActive) {
        this.backgroundMusic.play();
        console.log("Waiting phase background music loaded and playing");
      }
    } catch (error) {
      console.error("Failed to load waiting phase background music:", error);
      this.backgroundMusic = null;
    }
  }

  cleanup() {
    this.isActive = false;

    if (this.backgroundMusic) {
      this.backgroundMusic.pause();
      this.backgroundMusic.currentTime = 0;
      this.backgroundMusic = null;
    }

    this.multiplayerManager.onWaitingUpdate = null;
    // Note: We don't clear onPhaseChange as it might be used by other phases
  }
}
