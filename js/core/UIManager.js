/**
 * UIManager - Handles DOM interactions and screen management
 * Manages UI elements, screen transitions, and user interface updates
 */
export class UIManager {
  constructor() {
    this.screens = {};
    this.elements = {};
    this.initialized = false;

    // Transport control mapping for different phases
    this.transportControls = {
      performance: {
        playPauseBtn: "playPauseBtn",
        progressBar: "progressBar",
        timeDisplay: "timeDisplay",
      },
      editing: {
        playPauseBtn: "editPlayPauseBtn",
        progressBar: "editProgressBar",
        timeDisplay: "editTimeDisplay",
      },
      preview: {
        playPauseBtn: "previewPlayPauseBtn",
        progressBar: "previewProgressBar",
        timeDisplay: "previewTimeDisplay",
      },
      showcase: {
        playPauseBtn: "showcasePlayPauseBtn",
        progressBar: "showcaseProgressBar",
        timeDisplay: "showcaseTimeDisplay",
      },
      final: {
        playPauseBtn: "finalPlayPauseBtn",
        progressBar: "finalProgressBar",
        timeDisplay: "finalTimeDisplay",
      },
    };
  }

  initialize() {
    this.initializeScreens();
    this.initializeElements();
    this.initialized = true;
    console.log("UIManager initialized");
  }

  initializeScreens() {
    this.screens = {
      "main-menu": document.getElementById("main-menu"),
      "create-lobby": document.getElementById("create-lobby"),
      "join-lobby": document.getElementById("join-lobby"),
      "lobby-waiting": document.getElementById("lobby-waiting"),
      tutorial: document.getElementById("tutorial"),
      selection: document.getElementById("selection"),
      performance: document.getElementById("performance"),
      editing: document.getElementById("editing"),
      "waiting-for-players": document.getElementById("waiting-for-players"),
      preview: document.getElementById("preview"),
      "sound-replacement": document.getElementById("sound-replacement"),
      showcase: document.getElementById("showcase"),
      final: document.getElementById("final"),
    };
  }

  initializeElements() {
    // Countdown elements
    this.elements.selectionCountdown = document.getElementById(
      "selection-countdown",
    );
    this.elements.performanceCountdown = document.getElementById(
      "performance-countdown",
    );
    this.elements.editingCountdown =
      document.getElementById("editing-countdown");

    // Selection elements
    this.elements.selectedCount = document.getElementById("selected-count");
    this.elements.soundGrid = document.getElementById("sound-grid");
    this.elements.continueBtn = document.getElementById("continue-btn");

    // Replacement elements
    this.elements.replacementCountdown = document.getElementById(
      "replacement-countdown",
    );
    this.elements.replacementGrid = document.getElementById("replacement-grid");
    this.elements.replacementContinueBtn = document.getElementById(
      "replacement-continue-btn",
    );
    this.elements.replacementTargetIcon = document.getElementById(
      "replacement-target-icon",
    );
    this.elements.replacementTargetNumber = document.getElementById(
      "replacement-target-number",
    );
    this.elements.replacementStatus =
      document.getElementById("replacement-status");

    // Performance transport controls
    this.elements.playPauseBtn = document.getElementById("play-pause-btn");
    this.elements.restartBtn = document.getElementById("restart-btn");
    this.elements.progressBar = document.getElementById("progress-bar");
    this.elements.timeDisplay = document.getElementById("time-display");
    this.elements.performanceContinueBtn = document.getElementById(
      "performance-continue-btn",
    );

    // Editing transport controls
    this.elements.editPlayPauseBtn = document.getElementById(
      "edit-play-pause-btn",
    );
    this.elements.editRestartBtn = document.getElementById("edit-restart-btn");
    this.elements.editProgressBar =
      document.getElementById("edit-progress-bar");
    this.elements.editTimeDisplay =
      document.getElementById("edit-time-display");

    // Final transport controls
    this.elements.finalPlayPauseBtn = document.getElementById(
      "final-play-pause-btn",
    );
    this.elements.finalRestartBtn =
      document.getElementById("final-restart-btn");
    this.elements.finalProgressBar =
      document.getElementById("final-progress-bar");
    this.elements.finalTimeDisplay =
      document.getElementById("final-time-display");

    // Sound icons
    this.elements.soundIcons = [
      document.getElementById("sound-1-icon"),
      document.getElementById("sound-2-icon"),
      document.getElementById("sound-3-icon"),
    ];

    // Canvas elements
    this.elements.timelineCanvas = document.getElementById("timeline-canvas");
    this.elements.editingTimelineCanvas = document.getElementById(
      "editing-timeline-canvas",
    );
    this.elements.editingCanvases = [
      document.getElementById("editing-canvas-1"),
      document.getElementById("editing-canvas-2"),
      document.getElementById("editing-canvas-3"),
    ];
    this.elements.finalCanvas = document.getElementById("final-canvas");

    // Editing sound icons
    this.elements.editingSoundIcons = [
      document.getElementById("editing-sound-1-icon"),
      document.getElementById("editing-sound-2-icon"),
      document.getElementById("editing-sound-3-icon"),
    ];

    // Waiting for players elements
    this.elements.waitingMessage = document.getElementById("waiting-message");
    this.elements.currentRound = document.getElementById("current-round");
    this.elements.totalRounds = document.getElementById("total-rounds");

    // Song preview elements
    this.elements.previousPlayerName = document.getElementById(
      "previous-player-name",
    );
    this.elements.previewCurrentRound = document.getElementById(
      "preview-current-round",
    );
    this.elements.previewTotalRounds = document.getElementById(
      "preview-total-rounds",
    );
    this.elements.previewPhaseTimer = document.getElementById(
      "preview-phase-timer",
    );
    this.elements.previewCanvas = document.getElementById("preview-canvas");
    this.elements.previewPlayPauseBtn = document.getElementById(
      "preview-play-pause-btn",
    );
    this.elements.previewRestartBtn = document.getElementById(
      "preview-restart-btn",
    );
    this.elements.previewProgressBar = document.getElementById(
      "preview-progress-bar",
    );
    this.elements.previewTimeDisplay = document.getElementById(
      "preview-time-display",
    );
    this.elements.continueToPerformanceBtn = document.getElementById(
      "continue-to-performance-btn",
    );

    // Final showcase elements
    this.elements.currentSongNumber = document.getElementById(
      "current-song-number",
    );
    this.elements.totalSongs = document.getElementById("total-songs");
    this.elements.songCreators = document.getElementById("song-creators");
    this.elements.showcaseCanvas = document.getElementById("showcase-canvas");
    this.elements.showcasePlayPauseBtn = document.getElementById(
      "showcase-play-pause-btn",
    );
    this.elements.showcaseRestartBtn = document.getElementById(
      "showcase-restart-btn",
    );
    this.elements.showcaseProgressBar = document.getElementById(
      "showcase-progress-bar",
    );
    this.elements.showcaseTimeDisplay = document.getElementById(
      "showcase-time-display",
    );
    this.elements.prevSongBtn = document.getElementById("prev-song-btn");
    this.elements.nextSongBtn = document.getElementById("next-song-btn");
  }

  // Screen management
  showScreen(screenName) {
    if (!this.initialized) {
      console.error("UIManager not initialized");
      return;
    }

    Object.values(this.screens).forEach((screen) => {
      if (screen) screen.classList.remove("active");
    });

    if (this.screens[screenName]) {
      this.screens[screenName].classList.add("active");

      // Reset button states when returning to main menu
      if (screenName === "main-menu") {
        this.resetMainMenuButtons();
      }
    } else {
      console.error(`Screen not found: ${screenName}`);
    }
  }

  resetMainMenuButtons() {
    const createButton = document.getElementById("create-lobby-confirm-btn");
    if (createButton) {
      createButton.disabled = false;
      createButton.classList.remove("is-disabled");
      createButton.textContent = "Create Lobby";
    }

    const joinButton = document.getElementById("join-lobby-confirm-btn");
    if (joinButton) {
      joinButton.disabled = false;
      joinButton.classList.remove("is-disabled");
      joinButton.textContent = "Join Lobby";
    }
  }

  // Element getters with error checking
  getElement(elementName) {
    const element = this.elements[elementName];
    if (!element) {
      console.warn(`Element not found: ${elementName}`);
    }
    return element;
  }

  // Countdown updates
  updateCountdown(countdownName, value) {
    const element = this.getElement(countdownName);
    if (element) {
      element.textContent = value;
    }
  }

  showPhaseCountdown(initialValue) {
    const element = this.getElement("phaseCountdown");
    if (element) {
      element.textContent = initialValue;
      element.style.display = "block";
    }
  }

  hidePhaseCountdown() {
    const element = this.getElement("phaseCountdown");
    if (element) {
      element.style.display = "none";
    }
  }

  showEditingPhaseCountdown(initialValue) {
    const element = this.getElement("editingPhaseCountdown");
    if (element) {
      element.textContent = initialValue;
      element.style.display = "block";
    }
  }

  hideEditingPhaseCountdown() {
    const element = this.getElement("editingPhaseCountdown");
    if (element) {
      element.style.display = "none";
    }
  }

  // Transport control updates
  updateTransportControls(phase, isPlaying, currentTime, segmentLength) {
    const controls = this.transportControls[phase];
    if (!controls) return; // Unknown phase

    const playPauseBtn = this.getElement(controls.playPauseBtn);
    const progressBar = this.getElement(controls.progressBar);
    const timeDisplay = this.getElement(controls.timeDisplay);

    if (playPauseBtn) {
      if (isPlaying) {
        playPauseBtn.classList.add("playing");
      } else {
        playPauseBtn.classList.remove("playing");
      }
    }

    if (progressBar) {
      progressBar.max = segmentLength;
      progressBar.value = currentTime;
    }

    if (timeDisplay) {
      timeDisplay.textContent = `${currentTime.toFixed(1)} / ${segmentLength.toFixed(1)}`;
    }
  }

  // Sound grid management
  clearSoundGrid() {
    const soundGrid = this.getElement("soundGrid");
    if (soundGrid) {
      soundGrid.innerHTML = "";
    }
  }

  createSoundOption(soundData, index) {
    const soundOption = document.createElement("div");
    soundOption.className = "sound-option";
    soundOption.dataset.index = index;

    // Add skeleton loader
    const skeleton = document.createElement("div");
    skeleton.className = "sound-skeleton";
    soundOption.appendChild(skeleton);

    // Load icon
    const img = document.createElement("img");
    img.onload = () => {
      skeleton.remove();
      soundOption.appendChild(img);
    };
    img.onerror = () => {
      skeleton.remove();
      soundOption.innerHTML = "🎵"; // Fallback
      soundOption.style.display = "flex";
      soundOption.style.alignItems = "center";
      soundOption.style.justifyContent = "center";
      soundOption.style.fontSize = "2rem";
    };
    img.src = soundData.icon;
    img.alt = `Sound ${index + 1}`;

    return soundOption;
  }

  updateSelectedCount(count) {
    const element = this.getElement("selectedCount");
    if (element) {
      element.textContent = count;
    }
  }

  updateContinueButton(enabled) {
    const continueBtn = this.getElement("continueBtn");
    if (continueBtn) {
      continueBtn.disabled = !enabled;
      if (enabled) {
        continueBtn.classList.remove("is-disabled");
      } else {
        continueBtn.classList.add("is-disabled");
      }
    }
  }

  // Sound icon updates
  updateSoundIcons(selectedSounds) {
    this.elements.soundIcons.forEach((icon, index) => {
      if (icon && selectedSounds[index]) {
        icon.src = selectedSounds[index].icon;
      }
    });
  }

  // Editing sound icon updates with selection highlighting
  updateEditingSoundIcons(selectedSounds, selectedSoundIndex) {
    // Refresh cached references to ensure we're updating current DOM elements
    this.elements.editingSoundIcons = [
      document.getElementById("editing-sound-1-icon"),
      document.getElementById("editing-sound-2-icon"),
      document.getElementById("editing-sound-3-icon"),
    ];

    this.elements.editingSoundIcons.forEach((icon, index) => {
      if (icon && selectedSounds[index]) {
        const newIconUrl = selectedSounds[index].icon;

        // Only update if the icon URL has actually changed
        if (icon.src !== newIconUrl) {
          // Force refresh by clearing src first, then setting new URL
          icon.src = "";
          // Use setTimeout to ensure the src clear takes effect
          setTimeout(() => {
            icon.src = newIconUrl;
          }, 0);
        }
      }
    });

    // Update selection highlighting on sound key elements
    const editingSounds = document.querySelectorAll(".editing-sound");
    editingSounds.forEach((soundEl, index) => {
      if (index === selectedSoundIndex) {
        soundEl.classList.add("selected");
      } else {
        soundEl.classList.remove("selected");
      }
    });
  }

  // Key press feedback
  showKeyPress(keyIndex) {
    const keyEl = document.querySelector(
      `.sound-key:nth-child(${keyIndex + 1}) .key`,
    );
    if (keyEl) {
      keyEl.classList.add("pressed");
    }
  }

  hideKeyPress(keyIndex) {
    const keyEl = document.querySelector(
      `.sound-key:nth-child(${keyIndex + 1}) .key`,
    );
    if (keyEl) {
      keyEl.classList.remove("pressed");
    }
  }

  // Canvas elements
  getCanvas(canvasName) {
    return this.getElement(canvasName);
  }

  getEditingCanvas(index) {
    return this.elements.editingCanvases[index];
  }

  // Utility methods
  formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  }

  disableNonSelectedSounds() {
    document.querySelectorAll(".sound-option:not(.selected)").forEach((el) => {
      el.classList.add("disabled");
    });
  }

  enableAllSounds() {
    document.querySelectorAll(".sound-option").forEach((el) => {
      el.classList.remove("disabled");
    });
  }

  // Waiting for players screen methods
  updateWaitingScreen(gameState) {
    if (this.elements.currentRound) {
      this.elements.currentRound.textContent = gameState.currentRound + 1;
    }
    if (this.elements.totalRounds) {
      this.elements.totalRounds.textContent = gameState.maxRounds;
    }
    // Simple waiting screen - no individual player progress shown
  }

  // Song preview screen methods
  updatePreviewScreen(gameState, previousPlayerName) {
    if (this.elements.previousPlayerName) {
      this.elements.previousPlayerName.textContent = previousPlayerName;
    }
    if (this.elements.previewCurrentRound) {
      this.elements.previewCurrentRound.textContent =
        gameState.currentRound + 1;
    }
    if (this.elements.previewTotalRounds) {
      this.elements.previewTotalRounds.textContent = gameState.maxRounds;
    }
    if (this.elements.previewPhaseTimer) {
      this.elements.previewPhaseTimer.textContent = Math.ceil(
        gameState.phaseTimeLeft || 20,
      );
    }
  }

  updatePreviewTransportControls(isPlaying, currentTime, totalTime) {
    if (this.elements.previewPlayPauseBtn) {
      if (isPlaying) {
        this.elements.previewPlayPauseBtn.classList.add("playing");
      } else {
        this.elements.previewPlayPauseBtn.classList.remove("playing");
      }
    }
    if (this.elements.previewProgressBar) {
      this.elements.previewProgressBar.value = currentTime;
      this.elements.previewProgressBar.max = totalTime;
    }
    if (this.elements.previewTimeDisplay) {
      this.elements.previewTimeDisplay.textContent = `${currentTime.toFixed(1)} / ${totalTime.toFixed(1)}`;
    }
  }

  // Final showcase screen methods
  updateShowcaseScreen(
    currentSongIndex,
    totalSongs,
    songCreators,
    isSequentialMode = false,
  ) {
    if (this.elements.currentSongNumber) {
      this.elements.currentSongNumber.textContent = currentSongIndex + 1;
    }
    if (this.elements.totalSongs) {
      this.elements.totalSongs.textContent = totalSongs;
    }
    if (this.elements.songCreators) {
      this.elements.songCreators.textContent = songCreators.join(", then ");
    }

    // Update navigation buttons - disable in sequential mode
    if (this.elements.prevSongBtn) {
      this.elements.prevSongBtn.disabled =
        isSequentialMode || currentSongIndex === 0;
      this.elements.prevSongBtn.style.opacity = isSequentialMode ? "0.3" : "1";
    }
    if (this.elements.nextSongBtn) {
      this.elements.nextSongBtn.disabled =
        isSequentialMode || currentSongIndex === totalSongs - 1;
      this.elements.nextSongBtn.style.opacity = isSequentialMode ? "0.3" : "1";
    }
  }

  updateShowcaseTransportControls(
    isPlaying,
    currentTime,
    totalTime,
    isSequentialMode = false,
  ) {
    if (this.elements.showcasePlayPauseBtn) {
      if (isPlaying) {
        this.elements.showcasePlayPauseBtn.classList.add("playing");
      } else {
        this.elements.showcasePlayPauseBtn.classList.remove("playing");
      }
      this.elements.showcasePlayPauseBtn.disabled = isSequentialMode;
      this.elements.showcasePlayPauseBtn.style.opacity = isSequentialMode
        ? "0.3"
        : "1";
    }
    if (this.elements.showcaseProgressBar) {
      this.elements.showcaseProgressBar.value = currentTime;
      this.elements.showcaseProgressBar.max = totalTime;
      this.elements.showcaseProgressBar.disabled = isSequentialMode;
      this.elements.showcaseProgressBar.style.opacity = isSequentialMode
        ? "0.3"
        : "1";
    }
    if (this.elements.showcaseRestartBtn) {
      this.elements.showcaseRestartBtn.disabled = isSequentialMode;
      this.elements.showcaseRestartBtn.style.opacity = isSequentialMode
        ? "0.3"
        : "1";
    }
    if (this.elements.showcaseTimeDisplay) {
      this.elements.showcaseTimeDisplay.textContent = `${currentTime.toFixed(1)} / ${totalTime.toFixed(1)}`;
    }
  }

  // Sound replacement methods
  clearReplacementGrid() {
    const replacementGrid = this.getElement("replacementGrid");
    if (replacementGrid) {
      replacementGrid.innerHTML = "";
    }
  }

  createReplacementSoundOption(soundData, index) {
    const soundOption = document.createElement("div");
    soundOption.className = "sound-option replacement-option";
    soundOption.dataset.replacementIndex = index;

    // Add skeleton loader
    const skeleton = document.createElement("div");
    skeleton.className = "sound-skeleton";
    soundOption.appendChild(skeleton);

    // Load icon
    const img = document.createElement("img");
    img.onload = () => {
      skeleton.remove();
      soundOption.appendChild(img);
    };
    img.onerror = () => {
      skeleton.remove();
      soundOption.innerHTML = "🎵"; // Fallback
      soundOption.style.display = "flex";
      soundOption.style.alignItems = "center";
      soundOption.style.justifyContent = "center";
      soundOption.style.fontSize = "2rem";
    };
    img.src = soundData.icon;
    img.alt = `Replacement Option ${index + 1}`;

    return soundOption;
  }

  updateReplacementInfo(soundToReplace, soundIndex) {
    const targetIcon = this.getElement("replacementTargetIcon");
    const targetNumber = this.getElement("replacementTargetNumber");

    if (targetIcon && soundToReplace) {
      targetIcon.src = soundToReplace.icon;
      targetIcon.alt = `Sound ${soundIndex + 1}`;
    }

    if (targetNumber) {
      targetNumber.textContent = soundIndex + 1;
    }
  }

  updateReplacementContinueButton(enabled) {
    const continueBtn = this.getElement("replacementContinueBtn");
    if (continueBtn) {
      continueBtn.disabled = !enabled;
      if (enabled) {
        continueBtn.classList.remove("is-disabled");
      } else {
        continueBtn.classList.add("is-disabled");
      }
    }
  }

  disableNonSelectedReplacements() {
    const options = document.querySelectorAll(".replacement-option");
    options.forEach((option) => {
      if (!option.classList.contains("selected")) {
        option.style.opacity = "0.5";
        option.style.pointerEvents = "none";
      }
    });

    const status = this.getElement("replacementStatus");
    if (status) {
      status.textContent = "Replacement selected!";
    }
  }

  enableAllReplacements() {
    const options = document.querySelectorAll(".replacement-option");
    options.forEach((option) => {
      option.style.opacity = "";
      option.style.pointerEvents = "";
    });

    const status = this.getElement("replacementStatus");
    if (status) {
      status.textContent = "Choose a replacement sound:";
    }
  }
}
