/**
 * SelectionPhase - Handles the sound selection phase
 * Players choose 3 sounds from 5 random options within 10 seconds
 */
export class SelectionPhase {
  constructor(gameState, uiManager, audioEngine) {
    this.gameState = gameState;
    this.uiManager = uiManager;
    this.audioEngine = audioEngine;
    this.onPhaseComplete = null;
    this.countdownInterval = null;
  }

  async start(onComplete) {
    this.onPhaseComplete = onComplete;

    this.uiManager.showScreen("selection");

    this.gameState.clearSelectedSounds();
    this.updateUI();

    this.gameState.selectRandomSounds(5);

    await this.populateSoundGrid();

    this.startCountdown();
    this.setupEventHandlers();
  }

  async populateSoundGrid() {
    this.uiManager.clearSoundGrid();

    for (let i = 0; i < this.gameState.availableSounds.length; i++) {
      const soundData = this.gameState.availableSounds[i];
      const soundOption = this.uiManager.createSoundOption(soundData, i);

      soundOption.addEventListener("mouseenter", () => this.previewSound(i));
      soundOption.addEventListener("mouseleave", () => this.stopPreview());
      soundOption.addEventListener("click", () => this.selectSound(i));

      const soundGrid = this.uiManager.getElement("soundGrid");
      if (soundGrid) {
        soundGrid.appendChild(soundOption);
      }
    }
  }

  async previewSound(index) {
    this.stopPreview();

    try {
      const soundData = this.gameState.availableSounds[index];
      await this.audioEngine.startPreviewFromUrl(soundData.audio);
    } catch (error) {
      console.error("Failed to preview sound:", error);
    }
  }

  stopPreview() {
    this.audioEngine.stopPreview();
  }

  async selectSound(index) {
    const soundOption = document.querySelector(`[data-index="${index}"]`);
    if (!soundOption) return;

    try {
      const soundData = this.gameState.availableSounds[index];

      // Check if sound is already selected
      if (soundOption.classList.contains("selected")) {
        // Unselect the sound
        const success = this.gameState.removeSelectedSound(index);
        if (success) {
          soundOption.classList.remove("selected");
          this.updateUI();

          // Re-enable all sounds since we're no longer at the limit
          this.uiManager.enableAllSounds();
        }
      } else {
        // Select the sound (if we haven't reached the limit)
        if (this.gameState.selectedSounds.length >= 3) return;

        const success = this.gameState.addSelectedSound(soundData, index);

        if (success) {
          // Update UI
          soundOption.classList.add("selected");
          this.updateUI();

          if (this.gameState.selectedSounds.length === 3) {
            this.uiManager.updateContinueButton(true);
            this.uiManager.disableNonSelectedSounds();
          }
        }
      }
    } catch (error) {
      console.error("Failed to select/unselect sound:", error);
    }
  }

  autoSelectRemaining() {
    const unselected = this.gameState.availableSounds
      .map((sound, index) => index)
      .filter(
        (index) =>
          !this.gameState.selectedSounds.some((s) => s.originalIndex === index),
      );

    const selectPromises = [];
    while (this.gameState.selectedSounds.length < 3 && unselected.length > 0) {
      const randomIndex = unselected.splice(
        Math.floor(Math.random() * unselected.length),
        1,
      )[0];
      selectPromises.push(this.selectSound(randomIndex));
    }

    return Promise.all(selectPromises);
  }

  startCountdown() {
    let timeLeft = this.gameState.config.selectionTime;
    const countdownElement = this.uiManager.elements.selectionCountdown;

    const updateCountdown = () => {
      if (countdownElement) {
        countdownElement.textContent = timeLeft;
      }

      timeLeft--;

      if (timeLeft < 0) {
        this.stopCountdown();
        if (this.gameState.selectedSounds.length === 3) {
          this.complete();
        } else {
          // Auto-select remaining sounds
          this.autoSelectRemaining();
          setTimeout(() => this.complete(), 500);
        }
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

  updateUI() {
    this.uiManager.updateSelectedCount(this.gameState.selectedSounds.length);
    this.uiManager.updateContinueButton(
      this.gameState.selectedSounds.length === 3,
    );
  }

  setupEventHandlers() {
    const continueBtn = this.uiManager.getElement("continueBtn");
    if (continueBtn) {
      this.continueHandler = () => this.complete();
      continueBtn.addEventListener("click", this.continueHandler);
    }
  }

  complete() {
    if (this.gameState.selectedSounds.length < 3) {
      this.autoSelectRemaining().then(() => {
        setTimeout(() => this.finishPhase(), 500);
      });
    } else {
      this.finishPhase();
    }
  }

  finishPhase() {
    this.stopPreview();
    this.stopCountdown();

    if (this.onPhaseComplete) {
      this.onPhaseComplete();
    }
  }

  cleanup() {
    const continueBtn = this.uiManager.getElement("continueBtn");
    if (continueBtn && this.continueHandler) {
      continueBtn.removeEventListener("click", this.continueHandler);
    }

    this.stopPreview();
    this.stopCountdown();
  }
}
