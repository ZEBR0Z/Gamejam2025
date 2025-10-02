/**
 * WaitingPhase - Handles the waiting for players phase
 * Shows a simple waiting screen while everyone completes their songs
 * 
 * NEW: Doesn't call onComplete - Game.js handles state checking
 */
export class WaitingPhase {
  constructor(gameState, uiManager, audioEngine, multiplayerManager, getCurrentRound) {
    this.gameState = gameState;
    this.uiManager = uiManager;
    this.audioEngine = audioEngine;
    this.multiplayerManager = multiplayerManager;
    this.getCurrentRound = getCurrentRound;
    this.onPhaseComplete = null;
    this.backgroundMusic = null;
    this.isActive = false;
  }

  async start(onComplete) {
    this.onPhaseComplete = onComplete;
    this.isActive = true;

    this.uiManager.showScreen("waiting_for_players");

    const state = this.multiplayerManager.getLobbyState();
    if (state) {
      this.updateWaitingUI(state);
    }

    if (this.isActive) {
      await this.loadBackgroundMusic();
    }

    await this.fetchRandomFact();
  }

  updateWaitingUI(state) {
    // Transform state to include currentRound and maxRounds for UIManager
    const transformedState = {
      ...state,
      currentRound: this.getCurrentRound() - 1, // UIManager adds 1, so subtract 1 here
      maxRounds: state.rounds,
    };
    this.uiManager.updateWaitingScreen(transformedState);
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
      if (waitingMessage) {
        await this.typeText(
          waitingMessage,
          "Sometimes either the internet, API, or JavaScript, just want to... not work!",
        );
      }
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

      await new Promise((resolve, reject) => {
        this.backgroundMusic.addEventListener("canplaythrough", resolve, {
          once: true,
        });
        this.backgroundMusic.addEventListener("error", reject, { once: true });
        this.backgroundMusic.load();
      });

      if (this.isActive) {
        this.backgroundMusic.play();
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
  }
}
