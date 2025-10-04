import { BasePhase } from "./BasePhase.js";
import { PhaseType, GameConfig } from "../Constants.js";

/**
 * SoundReplacementPhase - Replace one random sound with a new option
 * Adds evolution to the sound palette across rounds
 */
export class SoundReplacementPhase extends BasePhase {
  constructor(services) {
    super(services);

    this.replacementOptions = [];
    this.selectedIndex = -1;
    this.soundToReplaceIndex = -1;
    this.timeRemaining = GameConfig.REPLACEMENT_TIME;
    this.countdownInterval = null;
  }

  async enter(onComplete, onSecondary = null) {
    await super.enter(onComplete, onSecondary);

    // Show replacement screen
    this.ui.showScreen("sound_replacement");

    // Pick random sound to replace
    const currentSounds = this.localState.getSelectedSounds();
    this.soundToReplaceIndex = Math.floor(Math.random() * currentSounds.length);

    // Generate 3 replacement options (excluding current sounds)
    this.replacementOptions = this.localState.getRandomSounds(
      3,
      currentSounds.map((s) => s.audio)
    );

    // Display replacement UI
    this.displayReplacementOptions();

    // Set up continue button
    this.input.setupButtonEvents({
      "confirm-replacement-btn": () => this.handleConfirmReplacement(),
    });

    this.updateConfirmButton();

    // Start countdown
    this.startCountdown();
  }

  exit() {
    // Clean up countdown
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }

    // Clean up input handlers
    this.input.cleanupButtonEvents();

    super.exit();
  }

  /**
   * Display replacement options
   */
  displayReplacementOptions() {
    const container = document.getElementById("replacement-options-container");
    if (!container) return;

    container.innerHTML = "";

    // Show which sound is being replaced
    const soundToReplace =
      this.localState.getSelectedSounds()[this.soundToReplaceIndex];
    const infoElement = document.getElementById("replacement-info");
    if (infoElement) {
      infoElement.textContent = `Replacing Sound ${this.soundToReplaceIndex + 1}`;
    }

    // Show replacement options
    this.replacementOptions.forEach((sound, index) => {
      const soundOption = this.ui.createSoundOption(
        sound,
        index,
        this.selectedIndex === index
      );

      soundOption.addEventListener("click", () =>
        this.handleReplacementClick(index)
      );

      container.appendChild(soundOption);
    });
  }

  /**
   * Handle replacement option click
   */
  handleReplacementClick(index) {
    if (this.selectedIndex === index) {
      // Deselect
      this.selectedIndex = -1;
    } else {
      // Select
      this.selectedIndex = index;
    }

    // Update UI
    this.displayReplacementOptions();
    this.updateConfirmButton();
  }

  /**
   * Update confirm button state
   */
  updateConfirmButton() {
    const confirmBtn = document.getElementById("confirm-replacement-btn");
    if (!confirmBtn) return;

    if (this.selectedIndex !== -1) {
      confirmBtn.disabled = false;
      confirmBtn.textContent = "Confirm Replacement";
    } else {
      confirmBtn.disabled = true;
      confirmBtn.textContent = "Select a Replacement";
    }
  }

  /**
   * Start countdown
   */
  startCountdown() {
    this.updateCountdownDisplay();

    this.countdownInterval = setInterval(() => {
      this.timeRemaining--;

      if (this.timeRemaining <= 0) {
        this.handleTimeExpired();
      } else {
        this.updateCountdownDisplay();
      }
    }, 1000);
  }

  /**
   * Update countdown display
   */
  updateCountdownDisplay() {
    const element = document.getElementById("replacement-countdown");
    if (element) {
      element.textContent = `Time: ${this.timeRemaining}s`;
    }
  }

  /**
   * Handle time expired (auto-select random)
   */
  handleTimeExpired() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }

    // Auto-select if not selected
    if (this.selectedIndex === -1 && this.replacementOptions.length > 0) {
      this.selectedIndex = Math.floor(
        Math.random() * this.replacementOptions.length
      );
    }

    this.handleConfirmReplacement();
  }

  /**
   * Handle confirm replacement
   */
  handleConfirmReplacement() {
    if (this.selectedIndex === -1) {
      return;
    }

    // Replace the sound in local state
    const newSound = this.replacementOptions[this.selectedIndex];
    const currentSounds = this.localState.getSelectedSounds();
    currentSounds[this.soundToReplaceIndex] = newSound;
    this.localState.setSelectedSounds(currentSounds);

    // Update server
    const currentRound = this.localState.getCurrentRound();
    this.network.updatePhase(PhaseType.PERFORMANCE, currentRound);

    // Complete phase
    this.complete();
  }
}
