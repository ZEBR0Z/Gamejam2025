/**
 * Timer - Handles countdown timers and phase transitions
 * Manages timing for different game phases and countdown displays
 */
export class Timer {
  constructor(gameState, uiManager) {
    this.gameState = gameState;
    this.uiManager = uiManager;
    this.activeTimers = new Map();
  }

  // Start a countdown timer
  startCountdown(timerName, initialValue, callback, displayElement = null) {
    // Clear existing timer if it exists
    this.stopTimer(timerName);

    const updateCountdown = () => {
      const currentValue = this.gameState.timers[timerName];

      // Update display
      if (displayElement) {
        if (
          timerName.includes("performance") ||
          timerName.includes("editing")
        ) {
          // Format as MM:SS for longer timers
          this.uiManager.updateCountdown(
            displayElement,
            this.uiManager.formatTime(currentValue),
          );
        } else {
          // Show raw seconds for short timers
          this.uiManager.updateCountdown(displayElement, currentValue);
        }
      }

      // Check if timer finished
      if (currentValue <= 0) {
        this.stopTimer(timerName);
        if (callback) callback();
        return;
      }

      // Decrement and schedule next update
      this.gameState.decrementTimer(timerName);
      const timeoutId = setTimeout(updateCountdown, 1000);
      this.activeTimers.set(timerName, timeoutId);
    };

    // Start the countdown
    updateCountdown();
  }

  // Start a phase countdown (3, 2, 1...)
  startPhaseCountdown(countdownElement, callback) {
    this.gameState.timers.phaseCountdown =
      this.gameState.config.phaseCountdownTime;

    if (countdownElement === "phaseCountdown") {
      this.uiManager.showPhaseCountdown(this.gameState.timers.phaseCountdown);
    } else if (countdownElement === "editingPhaseCountdown") {
      this.uiManager.showEditingPhaseCountdown(
        this.gameState.timers.phaseCountdown,
      );
    }

    const updateCountdown = () => {
      this.gameState.decrementTimer("phaseCountdown");
      const currentValue = this.gameState.timers.phaseCountdown;

      if (currentValue <= 0) {
        // Hide countdown and call callback
        if (countdownElement === "phaseCountdown") {
          this.uiManager.hidePhaseCountdown();
        } else if (countdownElement === "editingPhaseCountdown") {
          this.uiManager.hideEditingPhaseCountdown();
        }

        if (callback) callback();
        return;
      }

      // Update display
      if (countdownElement === "phaseCountdown") {
        this.uiManager.showPhaseCountdown(currentValue);
      } else if (countdownElement === "editingPhaseCountdown") {
        this.uiManager.showEditingPhaseCountdown(currentValue);
      }

      setTimeout(updateCountdown, 1000);
    };

    setTimeout(updateCountdown, 1000);
  }

  // Selection timer with auto-completion
  startSelectionTimer(callback) {
    this.startCountdown(
      "selectionTimeLeft",
      this.gameState.config.selectionTime,
      () => {
        // Check if selection is complete
        if (this.gameState.selectedSounds.length === 3) {
          callback();
        } else {
          // Auto-select remaining sounds
          this.autoSelectRemaining();
          setTimeout(callback, 500);
        }
      },
      "selectionCountdown",
    );
  }

  // Performance timer
  startPerformanceTimer(callback) {
    this.startCountdown(
      "performanceTimeLeft",
      this.gameState.config.performanceTime,
      callback,
      "performanceCountdown",
    );
  }

  // Editing timer
  startEditingTimer(callback) {
    this.startCountdown(
      "editingTimeLeft",
      this.gameState.config.editingTime,
      callback,
      "editingCountdown",
    );
  }

  // Auto-select remaining sounds (helper for selection timer)
  autoSelectRemaining() {
    const unselected = this.gameState.availableSounds
      .map((sound, index) => index)
      .filter(
        (index) =>
          !this.gameState.selectedSounds.some((s) => s.originalIndex === index),
      );

    while (this.gameState.selectedSounds.length < 3 && unselected.length > 0) {
      const randomIndex = unselected.splice(
        Math.floor(Math.random() * unselected.length),
        1,
      )[0];

      // This would need to be handled by the selection phase
      // For now, we'll emit an event or call a callback
      console.log(`Auto-selecting sound at index ${randomIndex}`);
    }
  }

  // Stop a specific timer
  stopTimer(timerName) {
    const timeoutId = this.activeTimers.get(timerName);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.activeTimers.delete(timerName);
    }
  }

  // Stop all timers
  stopAllTimers() {
    this.activeTimers.forEach((timeoutId) => {
      clearTimeout(timeoutId);
    });
    this.activeTimers.clear();
  }

  // Get remaining time for a timer
  getRemainingTime(timerName) {
    return this.gameState.timers[timerName] || 0;
  }

  // Check if a timer is active
  isTimerActive(timerName) {
    return this.activeTimers.has(timerName);
  }

  // Reset all timers
  resetAllTimers() {
    this.stopAllTimers();
    this.gameState.resetTimers();
  }
}
