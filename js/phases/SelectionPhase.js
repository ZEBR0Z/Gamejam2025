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
      "continue-btn": () => this.handleConfirmSelection(),
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
    const container = document.getElementById("sound-grid");
    if (!container) return;

    container.innerHTML = "";

    this.availableSounds.forEach((sound, index) => {
      const soundOption = this.ui.createSoundOption(sound, index);

      // Add selected class if this sound is selected
      if (this.selectedSounds.includes(index)) {
        soundOption.classList.add("selected");
      }

      // Hover to preview sound
      soundOption.addEventListener("mouseenter", () => this.handleSoundHover(index));
      soundOption.addEventListener("mouseleave", () => this.handleSoundLeave());

      // Click to select/deselect
      soundOption.addEventListener("click", () => this.handleSoundClick(index));

      container.appendChild(soundOption);
    });

    // Update selected count display
    this.ui.updateSelectedCount(this.selectedSounds.length);
  }

  /**
   * Handle sound hover (preview)
   */
  async handleSoundHover(index) {
    const soundData = this.availableSounds[index];
    if (soundData && soundData.audio) {
      try {
        await this.audio.startPreviewFromUrl(soundData.audio);
      } catch (error) {
        console.error("Failed to preview sound:", error);
      }
    }
  }

  /**
   * Handle sound leave (stop preview)
   */
  handleSoundLeave() {
    this.audio.stopPreview();
  }

  /**
   * Handle sound option click
   */
  handleSoundClick(index) {
    const selectedIndex = this.selectedSounds.indexOf(index);
    const soundOption = document.querySelector(`[data-index="${index}"]`);
    if (!soundOption) return;

    if (selectedIndex !== -1) {
      // Deselect
      this.selectedSounds.splice(selectedIndex, 1);
      soundOption.classList.remove("selected");
    } else if (this.selectedSounds.length < GameConfig.SOUNDS_TO_SELECT) {
      // Select
      this.selectedSounds.push(index);
      soundOption.classList.add("selected");
    }

    // Update UI elements
    this.ui.updateSelectedCount(this.selectedSounds.length);
    this.updateConfirmButton();
  }

  /**
   * Update confirm button state
   */
  updateConfirmButton() {
    const confirmBtn = document.getElementById("continue-btn");
    if (!confirmBtn) return;

    if (this.selectedSounds.length === GameConfig.SOUNDS_TO_SELECT) {
      confirmBtn.disabled = false;
      confirmBtn.classList.remove("is-disabled");
      confirmBtn.textContent = "Continue";
    } else {
      confirmBtn.disabled = true;
      confirmBtn.classList.add("is-disabled");
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
