/**
 * SoundReplacementPhase - Handles the sound replacement phase
 * Players choose 1 sound from 3 random options to replace a random existing sound
 * This adds evolution to the sound palette across rounds
 */
export class SoundReplacementPhase {
  constructor(gameState, uiManager, audioEngine) {
    this.gameState = gameState;
    this.uiManager = uiManager;
    this.audioEngine = audioEngine;
    this.onPhaseComplete = null;
    this.replacementOptions = [];
    this.selectedReplacementIndex = -1;
    this.replacementSoundIndex = -1;
    this.continueHandler = null;
    this.countdownInterval = null;
  }

  async start(onComplete) {
    this.onPhaseComplete = onComplete;

    console.log("Starting sound replacement phase");
    this.uiManager.showScreen("sound_replacement");

    this.selectedReplacementIndex = -1;
    this.replacementOptions = [];

    this.replacementSoundIndex = Math.floor(Math.random() * 3);

    this.selectReplacementOptions();

    await this.populateReplacementGrid();
    this.updateUI();
    this.startCountdown();
    this.setupEventHandlers();
  }

  startCountdown() {
    let timeLeft = this.gameState.config.replacementTime;
    const countdownElement = this.uiManager.elements.replacementCountdown;

    const updateCountdown = () => {
      if (countdownElement) {
        countdownElement.textContent = timeLeft;
      }

      timeLeft--;

      if (timeLeft < 0) {
        this.stopCountdown();
        this.complete();
      }
    };

    updateCountdown();
    this.countdownInterval = setInterval(updateCountdown, 1000);
  }

  stopCountdown() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
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
    const soundOption = document.querySelector(
      `[data-replacement-index="${index}"]`,
    );
    if (!soundOption) return;

    try {
      // Check if this replacement is already selected
      if (this.selectedReplacementIndex === index) {
        this.selectedReplacementIndex = -1;
        soundOption.classList.remove("selected");
        this.updateUI();

        this.uiManager.updateReplacementContinueButton(false);
        this.uiManager.enableAllReplacements();
      } else {
        if (this.selectedReplacementIndex !== -1) {
          const previousOption = document.querySelector(
            `[data-replacement-index="${this.selectedReplacementIndex}"]`,
          );
          if (previousOption) {
            previousOption.classList.remove("selected");
          }
        }

        this.selectedReplacementIndex = index;
        soundOption.classList.add("selected");
        this.updateUI();

        this.uiManager.updateReplacementContinueButton(true);
        this.uiManager.disableNonSelectedReplacements();
      }
    } catch (error) {
      console.error("Failed to select/unselect replacement sound:", error);
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
    const soundToReplace =
      this.gameState.selectedSounds[this.replacementSoundIndex];
    this.uiManager.updateReplacementInfo(
      soundToReplace,
      this.replacementSoundIndex,
    );

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
    if (this.selectedReplacementIndex === -1) {
      this.autoSelectReplacement();
    }

    setTimeout(() => this.finishPhase(), 500);
  }

  finishPhase() {
    this.stopPreview();
    this.stopCountdown();

    if (
      this.selectedReplacementIndex !== -1 &&
      this.replacementSoundIndex !== -1
    ) {
      const newSound = this.replacementOptions[this.selectedReplacementIndex];

      this.gameState.selectedSounds[this.replacementSoundIndex] = {
        originalIndex: this.replacementSoundIndex,
        icon: newSound.icon,
        audio: newSound.audio,
      };

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
    const continueBtn = this.uiManager.getElement("replacementContinueBtn");
    if (continueBtn && this.continueHandler) {
      continueBtn.removeEventListener("click", this.continueHandler);
    }

    this.stopPreview();
    this.stopCountdown();
  }
}
