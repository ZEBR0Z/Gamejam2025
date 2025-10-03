import { BasePhase } from "./BasePhase.js";
import { PhaseType, GameConfig } from "../Constants.js";

/**
 * SelectionPhase - Initial sound selection (pick 3 from 5)
 * First phase of each game where players choose their starting sounds
 */
export class SelectionPhase extends BasePhase {
  constructor(services) {
    super(services);

    this.availableSounds = [];
    this.selectedSounds = [];
    this.timeRemaining = GameConfig.SELECTION_TIME;
    this.countdownInterval = null;
  }

  async enter(onComplete, onSecondary = null) {
    await super.enter(onComplete, onSecondary);

    // Load sound list
    await this.localState.loadSoundList();

    // Generate 5 random sounds
    this.availableSounds = this.localState.getRandomSounds(
      GameConfig.SOUNDS_TO_CHOOSE_FROM
    );
    this.selectedSounds = [];

    // Show selection screen
    this.ui.showScreen("selection");

    // Display available sounds
    this.displayAvailableSounds();

    // Set up confirm button (initially disabled)
    this.input.setupButtonEvents({
      "confirm-selection-btn": () => this.handleConfirmSelection(),
    });

    this.updateConfirmButton();

    // Start countdown
    this.timeRemaining = GameConfig.SELECTION_TIME;
    this.updateCountdownDisplay();
    this.countdownInterval = setInterval(() => this.updateCountdown(), 1000);
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
   * Display available sounds as selectable options
   */
  displayAvailableSounds() {
    const container = document.getElementById("sound-options-container");
    if (!container) return;

    container.innerHTML = "";

    this.availableSounds.forEach((sound, index) => {
      const soundOption = this.ui.createSoundOption(
        sound,
        index,
        this.selectedSounds.includes(index)
      );

      soundOption.addEventListener("click", () => this.handleSoundClick(index));

      container.appendChild(soundOption);
    });
  }

  /**
   * Handle sound option click
   */
  handleSoundClick(index) {
    const selectedIndex = this.selectedSounds.indexOf(index);

    if (selectedIndex !== -1) {
      // Deselect
      this.selectedSounds.splice(selectedIndex, 1);
    } else if (this.selectedSounds.length < GameConfig.SOUNDS_TO_SELECT) {
      // Select
      this.selectedSounds.push(index);
    }

    // Update UI
    this.displayAvailableSounds();
    this.updateConfirmButton();
  }

  /**
   * Update confirm button state
   */
  updateConfirmButton() {
    const confirmBtn = document.getElementById("confirm-selection-btn");
    if (!confirmBtn) return;

    if (this.selectedSounds.length === GameConfig.SOUNDS_TO_SELECT) {
      confirmBtn.disabled = false;
      confirmBtn.textContent = `Confirm (${this.selectedSounds.length}/${GameConfig.SOUNDS_TO_SELECT})`;
    } else {
      confirmBtn.disabled = true;
      confirmBtn.textContent = `Select ${GameConfig.SOUNDS_TO_SELECT - this.selectedSounds.length} more`;
    }
  }

  /**
   * Update countdown timer
   */
  updateCountdown() {
    this.timeRemaining--;

    if (this.timeRemaining <= 0) {
      this.handleTimeExpired();
    } else {
      this.updateCountdownDisplay();
    }
  }

  /**
   * Update countdown display
   */
  updateCountdownDisplay() {
    const countdownElement = document.getElementById("selection-countdown");
    if (countdownElement) {
      countdownElement.textContent = this.timeRemaining;
    }
  }

  /**
   * Handle time expired (auto-select random sounds)
   */
  handleTimeExpired() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }

    // Auto-select random sounds if not enough selected
    while (this.selectedSounds.length < GameConfig.SOUNDS_TO_SELECT) {
      const availableIndices = this.availableSounds
        .map((_, i) => i)
        .filter((i) => !this.selectedSounds.includes(i));

      if (availableIndices.length === 0) break;

      const randomIndex =
        availableIndices[Math.floor(Math.random() * availableIndices.length)];
      this.selectedSounds.push(randomIndex);
    }

    this.handleConfirmSelection();
  }

  /**
   * Handle confirm selection
   */
  handleConfirmSelection() {
    if (this.selectedSounds.length !== GameConfig.SOUNDS_TO_SELECT) {
      return;
    }

    // Store selected sounds in local state
    const selectedSoundData = this.selectedSounds.map(
      (index) => this.availableSounds[index]
    );
    this.localState.setSelectedSounds(selectedSoundData);

    // Clear events (fresh start)
    this.localState.clearEvents();

    // Update server
    this.network.updatePhase(PhaseType.PREVIEW, 1);

    // Complete phase
    this.complete();
  }
}
