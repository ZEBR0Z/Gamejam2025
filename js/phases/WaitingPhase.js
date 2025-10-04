import { BasePhase } from "./BasePhase.js";
import { PhaseType } from "../Constants.js";

/**
 * WaitingPhase - Wait for other players to finish
 * Shows progress of all players and transitions when everyone is ready
 */
export class WaitingPhase extends BasePhase {
  constructor(services) {
    super(services);

    this.stateUpdateHandler = null;
    this.unsubscribeStateUpdate = null;
    this.updateInterval = null;
    this.backgroundMusic = null;
  }

  async enter(onComplete, onSecondary = null) {
    await super.enter(onComplete, onSecondary);

    // Show waiting screen
    this.ui.showScreen("waiting_for_players");

    // Listen for server state updates
    this.stateUpdateHandler = () => this.handleStateUpdate();
    this.unsubscribeStateUpdate = this.serverState.onChange(this.stateUpdateHandler);

    // Initial UI update
    this.updateWaitingUI();

    // Start update loop
    this.updateInterval = setInterval(() => this.update(), 500);

    // Load background music
    await this.loadBackgroundMusic();

    // Fetch and display random fact
    await this.fetchRandomFact();
  }

  update() {
    if (!this.isActive) return;

    // Update UI periodically
    this.updateWaitingUI();
  }

  exit() {
    // Clean up event listeners
    if (this.unsubscribeStateUpdate) {
      this.unsubscribeStateUpdate();
      this.unsubscribeStateUpdate = null;
      this.stateUpdateHandler = null;
    }

    // Clean up interval
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    // Clean up background music
    if (this.backgroundMusic) {
      this.backgroundMusic.pause();
      this.backgroundMusic.currentTime = 0;
      this.backgroundMusic = null;
    }

    super.exit();
  }

  /**
   * Handle state updates from server
   */
  handleStateUpdate() {
    this.updateWaitingUI();

    const currentRound = this.localState.getCurrentRound();
    const maxRounds = this.serverState.getMaxRounds();

    // Check if all players are at or past waiting phase for current round
    const allPlayersWaiting = this.serverState.areAllPlayersAtPhase(
      currentRound,
      PhaseType.WAITING
    );

    if (allPlayersWaiting) {
      // Check if we're done with all rounds
      if (currentRound >= maxRounds) {
        // Move to showcase phase
        this.complete();
      } else {
        // Move to next round (preview or performance)
        this.complete();
      }
    }
  }

  /**
   * Update waiting UI (show player progress)
   */
  updateWaitingUI() {
    const currentRound = this.localState.getCurrentRound();
    const maxRounds = this.serverState.getMaxRounds();

    // Update round info
    const currentRoundEl = document.getElementById("current-round");
    const totalRoundsEl = document.getElementById("total-rounds");

    if (currentRoundEl) {
      currentRoundEl.textContent = currentRound;
    }
    if (totalRoundsEl) {
      totalRoundsEl.textContent = maxRounds;
    }
  }

  /**
   * Load background music for waiting phase
   */
  async loadBackgroundMusic() {
    try {
      this.backgroundMusic = new Audio("assets/audio/waiting_music.mp3");
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

  /**
   * Fetch and display a random fact
   */
  async fetchRandomFact() {
    try {
      const response = await fetch(
        "https://uselessfacts.jsph.pl/api/v2/facts/random"
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
          "Sometimes either the internet, API, or JavaScript, just want to... not work!"
        );
      }
    }
  }

  /**
   * Type text with animation
   */
  async typeText(element, text, speed = 30) {
    element.textContent = "";
    for (let i = 0; i < text.length; i++) {
      if (!this.isActive) return;
      element.textContent += text[i];
      await new Promise((resolve) => setTimeout(resolve, speed));
    }
  }
}
