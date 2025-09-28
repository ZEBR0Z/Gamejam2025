/**
 * SoundReplacementPhase - Handles the sound replacement phase
 * Players choose 1 sound from 3 random options to replace a random existing sound
 * This adds evolution to the sound palette across rounds
 */
export class SoundReplacementPhase {
  constructor(gameState, uiManager, audioEngine, timer) {
    this.gameState = gameState;
    this.uiManager = uiManager;
    this.audioEngine = audioEngine;
    this.timer = timer;
    this.onPhaseComplete = null;
    this.replacementOptions = []; // 3 random sounds to choose from
    this.selectedReplacementIndex = -1;
    this.replacementSoundIndex = -1; // Which existing sound will be replaced
    this.continueHandler = null;
  }

  async start(onComplete) {
    this.onPhaseComplete = onComplete;

    console.log("Starting sound replacement phase");
    this.uiManager.showScreen("sound-replacement");

    // Reset state
    this.selectedReplacementIndex = -1;
    this.replacementOptions = [];

    // Determine which existing sound will be replaced (randomly)
    this.replacementSoundIndex = Math.floor(Math.random() * 3);

    // Select 3 random replacement options (excluding current sounds)
    this.selectReplacementOptions();

    // Setup UI
    await this.populateReplacementGrid();
    this.updateUI();

    // Start countdown timer (10 seconds)
    this.timer.startReplacementTimer(() => this.complete());

    // Setup event handlers
    this.setupEventHandlers();
  }

  selectReplacementOptions() {
    if (!this.gameState.soundList || this.gameState.soundList.length === 0) {
      console.error("No sound list available for replacement");
      return;
    }

    // Get current sound URLs to exclude them
    const currentSoundUrls = this.gameState.selectedSounds.map(
      (sound) => sound.audio,
    );

    // Filter out current sounds
    const availableForReplacement = this.gameState.soundList.filter(
      (sound) => !currentSoundUrls.includes(sound.audio),
    );

    if (availableForReplacement.length < 3) {
      console.warn("Not enough sounds available for replacement");
      // Use whatever we have available
      this.replacementOptions = [...availableForReplacement];
      return;
    }

    // Randomly select 3 options
    const shuffled = [...availableForReplacement].sort(
      () => Math.random() - 0.5,
    );
    this.replacementOptions = shuffled.slice(0, 3);
  }

  async populateReplacementGrid() {
    this.uiManager.clearReplacementGrid();

    for (let i = 0; i < this.replacementOptions.length; i++) {
      const soundData = this.replacementOptions[i];
      const soundOption = this.uiManager.createReplacementSoundOption(
        soundData,
        i,
      );

      // Add event listeners
      soundOption.addEventListener("mouseenter", () => this.previewSound(i));
      soundOption.addEventListener("mouseleave", () => this.stopPreview());
      soundOption.addEventListener("click", () => this.selectReplacement(i));

      const replacementGrid = this.uiManager.getElement("replacementGrid");
      if (replacementGrid) {
        replacementGrid.appendChild(soundOption);
      }
    }
  }

  async previewSound(index) {
    this.stopPreview();

    try {
      const soundData = this.replacementOptions[index];
      await this.audioEngine.startPreviewFromUrl(soundData.audio);
    } catch (error) {
      console.error("Failed to preview replacement sound:", error);
    }
  }

  stopPreview() {
    this.audioEngine.stopPreview();
  }

  async selectReplacement(index) {
    if (this.selectedReplacementIndex !== -1) return; // Already selected

    const soundOption = document.querySelector(
      `[data-replacement-index="${index}"]`,
    );
    if (!soundOption) return;

    try {
      this.selectedReplacementIndex = index;

      // Update UI
      soundOption.classList.add("selected");
      this.updateUI();

      // Enable continue button
      this.uiManager.updateReplacementContinueButton(true);
      this.uiManager.disableNonSelectedReplacements();
    } catch (error) {
      console.error("Failed to select replacement sound:", error);
    }
  }

  autoSelectReplacement() {
    if (
      this.selectedReplacementIndex === -1 &&
      this.replacementOptions.length > 0
    ) {
      const randomIndex = Math.floor(
        Math.random() * this.replacementOptions.length,
      );
      this.selectReplacement(randomIndex);
    }
  }

  updateUI() {
    // Update which sound will be replaced
    const soundToReplace =
      this.gameState.selectedSounds[this.replacementSoundIndex];
    this.uiManager.updateReplacementInfo(
      soundToReplace,
      this.replacementSoundIndex,
    );

    // Update continue button state
    this.uiManager.updateReplacementContinueButton(
      this.selectedReplacementIndex !== -1,
    );
  }

  setupEventHandlers() {
    const continueBtn = this.uiManager.getElement("replacementContinueBtn");
    if (continueBtn) {
      this.continueHandler = () => this.complete();
      continueBtn.addEventListener("click", this.continueHandler);
    }
  }

  complete() {
    // Ensure we have a replacement selected
    if (this.selectedReplacementIndex === -1) {
      this.autoSelectReplacement();
    }

    setTimeout(() => this.finishPhase(), 500);
  }

  finishPhase() {
    this.stopPreview();
    this.timer.stopTimer("replacementTimeLeft");

    // Apply the sound replacement
    if (
      this.selectedReplacementIndex !== -1 &&
      this.replacementSoundIndex !== -1
    ) {
      const newSound = this.replacementOptions[this.selectedReplacementIndex];

      // Replace the sound in the selected sounds array
      this.gameState.selectedSounds[this.replacementSoundIndex] = {
        originalIndex: this.replacementSoundIndex, // Keep the same index position
        icon: newSound.icon,
        audio: newSound.audio,
      };

      // Preload the new icon if callback is set
      if (this.gameState.onIconPreload && newSound.icon) {
        this.gameState.onIconPreload(newSound.icon);
      }

      console.log(
        `Replaced sound ${this.replacementSoundIndex + 1} with ${newSound.audio}`,
      );
    }

    console.log("Sound replacement phase complete");
    if (this.onPhaseComplete) {
      this.onPhaseComplete();
    }
  }

  cleanup() {
    // Clean up event listeners
    const continueBtn = this.uiManager.getElement("replacementContinueBtn");
    if (continueBtn && this.continueHandler) {
      continueBtn.removeEventListener("click", this.continueHandler);
    }

    this.stopPreview();
    this.timer.stopTimer("replacementTimeLeft");
  }
}
