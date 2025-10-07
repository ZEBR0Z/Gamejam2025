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

    // Load selected sounds from previous submission
    this.loadSelectedSounds();

    // Pick random sound to replace
    const currentSounds = this.localState.getSelectedSounds();
    this.soundToReplaceIndex = Math.floor(Math.random() * currentSounds.length);

    // Generate 3 replacement options (excluding current sounds)
    this.replacementOptions = this.localState.getRandomSounds(
      3,
      currentSounds.map((s) => s.path),
    );

    // Display replacement UI
    this.displayReplacementOptions();

    // Set up continue button
    this.input.setupButtonEvents({
      "replacement-continue-btn": () => this.handleConfirmReplacement(),
    });

    this.updateConfirmButton();

    // Reset and start countdown
    this.timeRemaining = GameConfig.REPLACEMENT_TIME;
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
   * Load selected sounds from previous submission
   */
  loadSelectedSounds() {
    const currentRound = this.localState.getCurrentRound();
    const localPlayerId = this.serverState.getLocalPlayerId();

    // Get assignment for current round
    const assignment = this.serverState.getAssignment(
      localPlayerId,
      currentRound,
    );
    if (!assignment) {
      return;
    }

    // Get that player's previous submission
    const submission = this.serverState.getSubmission(
      assignment,
      currentRound - 1,
    );
    if (!submission || !submission.selectedSounds) {
      return;
    }

    // Set selected sounds in local state
    this.localState.setSelectedSounds(submission.selectedSounds);
  }

  /**
   * Display replacement options
   */
  displayReplacementOptions() {
    const container = document.getElementById("replacement-grid");
    if (!container) return;

    container.innerHTML = "";

    // Show which sound is being replaced
    const soundToReplace =
      this.localState.getSelectedSounds()[this.soundToReplaceIndex];
    this.ui.updateReplacementInfo(soundToReplace, this.soundToReplaceIndex);

    // Add hover preview to the sound being replaced
    const targetIcon = document.getElementById("replacement-target-icon");
    if (targetIcon && soundToReplace) {
      targetIcon.parentElement.addEventListener("mouseenter", () =>
        this.handleTargetSoundHover(soundToReplace),
      );
      targetIcon.parentElement.addEventListener("mouseleave", () =>
        this.handleSoundLeave(),
      );
    }

    // Show replacement options
    this.replacementOptions.forEach((sound, index) => {
      const soundOption = this.ui.createSoundOption(sound, index);

      // Add selected class if this sound is selected
      if (this.selectedIndex === index) {
        soundOption.classList.add("selected");
      }

      // Hover to preview sound
      soundOption.addEventListener("mouseenter", () =>
        this.handleSoundHover(index),
      );
      soundOption.addEventListener("mouseleave", () => this.handleSoundLeave());

      // Click to select/deselect
      soundOption.addEventListener("click", () =>
        this.handleReplacementClick(index),
      );

      container.appendChild(soundOption);
    });
  }

  /**
   * Handle sound hover (preview)
   */
  async handleSoundHover(index) {
    const soundData = this.replacementOptions[index];
    if (soundData && soundData.path) {
      try {
        await this.audio.playPreviewSound(soundData.path);
      } catch (error) {
        console.error("Failed to preview sound:", error);
      }
    }
  }

  /**
   * Handle target sound hover (preview the sound being replaced)
   */
  async handleTargetSoundHover(soundData) {
    if (soundData && soundData.path) {
      try {
        await this.audio.playPreviewSound(soundData.path);
      } catch (error) {
        console.error("Failed to preview target sound:", error);
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
   * Handle replacement option click
   */
  handleReplacementClick(index) {
    const container = document.getElementById("replacement-grid");
    const soundOption = container?.querySelector(`[data-index="${index}"]`);
    if (!soundOption) return;

    if (this.selectedIndex === index) {
      // Deselect
      this.selectedIndex = -1;
      soundOption.classList.remove("selected");
    } else {
      // Deselect previous selection
      if (this.selectedIndex !== -1) {
        const prevOption = container?.querySelector(
          `[data-index="${this.selectedIndex}"]`,
        );
        if (prevOption) {
          prevOption.classList.remove("selected");
        }
      }
      // Select new
      this.selectedIndex = index;
      soundOption.classList.add("selected");
    }

    // Update button
    this.updateConfirmButton();
  }

  /**
   * Update confirm button state
   */
  updateConfirmButton() {
    const confirmBtn = document.getElementById("replacement-continue-btn");
    if (!confirmBtn) return;

    if (this.selectedIndex !== -1) {
      confirmBtn.disabled = false;
      confirmBtn.classList.remove("is-disabled");
      confirmBtn.textContent = "Continue";
    } else {
      confirmBtn.disabled = true;
      confirmBtn.classList.add("is-disabled");
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
      this.updateCountdownDisplay();

      if (this.timeRemaining <= 0) {
        this.handleTimeExpired();
      }
    }, 1000);
  }

  /**
   * Update countdown display
   */
  updateCountdownDisplay() {
    const element = document.getElementById("replacement-countdown");
    if (element) {
      element.textContent = this.timeRemaining;
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
        Math.random() * this.replacementOptions.length,
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
    const currentSounds = [...this.localState.getSelectedSounds()];
    currentSounds[this.soundToReplaceIndex] = newSound;
    this.localState.setSelectedSounds(currentSounds);

    // Update server
    const currentRound = this.localState.getCurrentRound();
    this.network.updatePhase(PhaseType.PERFORMANCE, currentRound);

    // Complete phase
    this.complete();
  }
}
