/**
 * UIService - Handles DOM interactions and screen management
 * Manages UI elements, screen transitions, and user interface updates
 * Stateless service that operates on DOM elements
 */

export class UIService {
  constructor() {
    this.screens = {};
    this.elements = {};
    this.initialized = false;
  }

  /**
   * Initialize the UI service by caching DOM references
   */
  initialize() {
    this.cacheScreens();
    this.cacheElements();
    this.initialized = true;
    console.log("UIService initialized");
  }

  /**
   * Cache all screen elements
   */
  cacheScreens() {
    this.screens = {
      main_menu: document.getElementById("main-menu"),
      create_lobby: document.getElementById("create-lobby"),
      join_lobby: document.getElementById("join-lobby"),
      lobby_waiting: document.getElementById("lobby-waiting"),
      tutorial: document.getElementById("tutorial"),
      selection: document.getElementById("selection"),
      performance: document.getElementById("performance"),
      editing: document.getElementById("editing"),
      waiting_for_players: document.getElementById("waiting-for-players"),
      preview: document.getElementById("preview"),
      sound_replacement: document.getElementById("sound-replacement"),
      showcase: document.getElementById("showcase"),
      final: document.getElementById("final"),
    };
  }

  /**
   * Cache all UI element references
   */
  cacheElements() {
    // Countdown elements
    this.elements.selectionCountdown = document.getElementById("selection-countdown");
    this.elements.performanceCountdown = document.getElementById("performance-countdown");
    this.elements.editingCountdown = document.getElementById("editing-countdown");
    this.elements.replacementCountdown = document.getElementById("replacement-countdown");
    this.elements.previewPhaseTimer = document.getElementById("preview-phase-timer");

    // Selection screen
    this.elements.selectedCount = document.getElementById("selected-count");
    this.elements.soundGrid = document.getElementById("sound-grid");
    this.elements.continueBtn = document.getElementById("continue-btn");

    // Sound replacement screen
    this.elements.replacementGrid = document.getElementById("replacement-grid");
    this.elements.replacementContinueBtn = document.getElementById("replacement-continue-btn");
    this.elements.replacementTargetIcon = document.getElementById("replacement-target-icon");
    this.elements.replacementTargetNumber = document.getElementById("replacement-target-number");
    this.elements.replacementStatus = document.getElementById("replacement-status");

    // Performance screen
    this.elements.playPauseBtn = document.getElementById("play-pause-btn");
    this.elements.restartBtn = document.getElementById("restart-btn");
    this.elements.progressBar = document.getElementById("progress-bar");
    this.elements.timeDisplay = document.getElementById("time-display");
    this.elements.performanceContinueBtn = document.getElementById("performance-continue-btn");

    // Editing screen
    this.elements.editPlayPauseBtn = document.getElementById("edit-play-pause-btn");
    this.elements.editRestartBtn = document.getElementById("edit-restart-btn");
    this.elements.editProgressBar = document.getElementById("edit-progress-bar");
    this.elements.editTimeDisplay = document.getElementById("edit-time-display");

    // Preview screen
    this.elements.previousPlayerName = document.getElementById("previous-player-name");
    this.elements.previewCurrentRound = document.getElementById("preview-current-round");
    this.elements.previewTotalRounds = document.getElementById("preview-total-rounds");
    this.elements.previewCanvas = document.getElementById("preview-canvas");
    this.elements.previewPlayPauseBtn = document.getElementById("preview-play-pause-btn");
    this.elements.previewRestartBtn = document.getElementById("preview-restart-btn");
    this.elements.previewProgressBar = document.getElementById("preview-progress-bar");
    this.elements.previewTimeDisplay = document.getElementById("preview-time-display");
    this.elements.continueToPerformanceBtn = document.getElementById("continue-to-performance-btn");

    // Showcase screen
    this.elements.currentSongNumber = document.getElementById("current-song-number");
    this.elements.totalSongs = document.getElementById("total-songs");
    this.elements.songCreators = document.getElementById("song-creators");
    this.elements.showcaseCanvas = document.getElementById("showcase-canvas");
    this.elements.showcasePlayPauseBtn = document.getElementById("showcase-play-pause-btn");
    this.elements.showcaseRestartBtn = document.getElementById("showcase-restart-btn");
    this.elements.showcaseProgressBar = document.getElementById("showcase-progress-bar");
    this.elements.showcaseTimeDisplay = document.getElementById("showcase-time-display");
    this.elements.prevSongBtn = document.getElementById("prev-song-btn");
    this.elements.nextSongBtn = document.getElementById("next-song-btn");

    // Waiting screen
    this.elements.waitingMessage = document.getElementById("waiting-message");
    this.elements.currentRound = document.getElementById("current-round");
    this.elements.totalRounds = document.getElementById("total-rounds");

    // Sound icons
    this.elements.soundIcons = [
      document.getElementById("sound-1-icon"),
      document.getElementById("sound-2-icon"),
      document.getElementById("sound-3-icon"),
    ];

    this.elements.editingSoundIcons = [
      document.getElementById("editing-sound-1-icon"),
      document.getElementById("editing-sound-2-icon"),
      document.getElementById("editing-sound-3-icon"),
    ];

    // Canvases
    this.elements.timelineCanvas = document.getElementById("timeline-canvas");
    this.elements.editingTimelineCanvas = document.getElementById("editing-timeline-canvas");
    this.elements.editingCanvases = [
      document.getElementById("editing-canvas-1"),
      document.getElementById("editing-canvas-2"),
      document.getElementById("editing-canvas-3"),
    ];
    this.elements.finalCanvas = document.getElementById("final-canvas");

    // Lobby elements
    this.elements.playerName = document.getElementById("player-name");
    this.elements.joinPlayerName = document.getElementById("join-player-name");
    this.elements.lobbyCodeInput = document.getElementById("lobby-code");
    this.elements.lobbyCodeDisplay = document.getElementById("lobby-code-display");
    this.elements.shareableCode = document.getElementById("shareable-code");
    this.elements.playerCount = document.getElementById("player-count");
    this.elements.playersContainer = document.getElementById("players-container");
    this.elements.connectionIndicator = document.getElementById("connection-indicator");
    this.elements.gameStarting = document.getElementById("game-starting");
    this.elements.startCountdown = document.getElementById("start-countdown");
  }

  /**
   * Show a specific screen
   * @param {string} screenName - Name of the screen to show
   */
  showScreen(screenName) {
    if (!this.initialized) {
      console.error("UIService not initialized");
      return;
    }

    // Hide all screens
    Object.values(this.screens).forEach((screen) => {
      if (screen) screen.classList.remove("active");
    });

    // Show target screen
    if (this.screens[screenName]) {
      this.screens[screenName].classList.add("active");

      if (screenName === "main_menu") {
        this.resetMainMenuButtons();
      }
    } else {
      console.error(`Screen not found: ${screenName}`);
    }
  }

  /**
   * Reset main menu buttons to initial state
   */
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

  /**
   * Get a cached element by name
   * @param {string} elementName
   * @returns {HTMLElement|null}
   */
  getElement(elementName) {
    const element = this.elements[elementName];
    if (!element) {
      console.warn(`Element not found: ${elementName}`);
    }
    return element;
  }

  /**
   * Update countdown text
   * @param {string} countdownName - Element name or number value
   * @param {number} value - Countdown value (optional if first param is number)
   */
  updateCountdown(countdownName, value) {
    // Support both updateCountdown(elementName, value) and updateCountdown(value)
    if (typeof countdownName === "number") {
      const element = document.getElementById("countdown");
      if (element) {
        element.textContent = countdownName;
      }
      return;
    }

    const element = this.getElement(countdownName);
    if (element) {
      element.textContent = value;
    }
  }

  /**
   * Update lobby code display
   * @param {string} code - Lobby code
   */
  updateLobbyCode(code) {
    const displayElement = document.getElementById("lobby-code-display");
    if (displayElement) {
      displayElement.textContent = code;
    }
    const shareableElement = document.getElementById("shareable-code");
    if (shareableElement) {
      shareableElement.textContent = code;
    }
  }

  /**
   * Update lobby player list
   * @param {Array} players - Array of player objects
   * @param {string} localPlayerId - Local player's ID
   */
  updateLobbyPlayerList(players, localPlayerId) {
    const listElement = document.getElementById("players-container");
    if (!listElement) return;

    listElement.innerHTML = "";

    players.forEach((player) => {
      const playerDiv = document.createElement("div");
      playerDiv.className = "player-item";

      const nameSpan = document.createElement("span");
      nameSpan.textContent = player.name;
      if (player.id === localPlayerId) {
        nameSpan.textContent += " (You)";
      }

      const statusSpan = document.createElement("span");
      statusSpan.className = "player-status";
      statusSpan.textContent = player.ready ? "Ready" : "Not Ready";
      if (player.ready) {
        statusSpan.classList.add("ready");
      }

      playerDiv.appendChild(nameSpan);
      playerDiv.appendChild(statusSpan);
      listElement.appendChild(playerDiv);
    });

    // Update player count
    const countElement = document.getElementById("player-count");
    if (countElement) {
      countElement.textContent = players.length;
    }
  }

  /**
   * Update transport controls (play/pause, progress, time)
   * @param {string} phase - Current phase name
   * @param {boolean} isPlaying - Is audio playing
   * @param {number} currentTime - Current time in seconds
   * @param {number} totalTime - Total time in seconds
   */
  updateTransportControls(phase, isPlaying, currentTime, totalTime) {
    let playPauseBtn, progressBar, timeDisplay;

    // Map phase to elements
    switch (phase) {
      case "performance":
        playPauseBtn = this.elements.playPauseBtn;
        progressBar = this.elements.progressBar;
        timeDisplay = this.elements.timeDisplay;
        break;
      case "editing":
        playPauseBtn = this.elements.editPlayPauseBtn;
        progressBar = this.elements.editProgressBar;
        timeDisplay = this.elements.editTimeDisplay;
        break;
      case "preview":
        playPauseBtn = this.elements.previewPlayPauseBtn;
        progressBar = this.elements.previewProgressBar;
        timeDisplay = this.elements.previewTimeDisplay;
        break;
      case "showcase":
        playPauseBtn = this.elements.showcasePlayPauseBtn;
        progressBar = this.elements.showcaseProgressBar;
        timeDisplay = this.elements.showcaseTimeDisplay;
        break;
      default:
        return;
    }

    // Update play/pause button
    if (playPauseBtn) {
      if (isPlaying) {
        playPauseBtn.classList.add("playing");
      } else {
        playPauseBtn.classList.remove("playing");
      }
    }

    // Update progress bar
    if (progressBar) {
      progressBar.max = totalTime;
      progressBar.value = currentTime;
    }

    // Update time display
    if (timeDisplay) {
      timeDisplay.textContent = `${currentTime.toFixed(1)} / ${totalTime.toFixed(1)}`;
    }
  }

  /**
   * Clear the sound grid
   */
  clearSoundGrid() {
    const soundGrid = this.getElement("soundGrid");
    if (soundGrid) {
      soundGrid.innerHTML = "";
    }
  }

  /**
   * Create a sound option element
   * @param {Object} soundData - {audio, icon}
   * @param {number} index - Index of the sound
   * @returns {HTMLElement}
   */
  createSoundOption(soundData, index) {
    const soundOption = document.createElement("div");
    soundOption.className = "sound-option";
    soundOption.dataset.index = index;

    const skeleton = document.createElement("div");
    skeleton.className = "sound-skeleton";
    soundOption.appendChild(skeleton);

    const img = document.createElement("img");
    img.onload = () => {
      skeleton.remove();
      soundOption.appendChild(img);
    };
    img.onerror = () => {
      skeleton.remove();
      soundOption.innerHTML = "🎵";
      soundOption.style.display = "flex";
      soundOption.style.alignItems = "center";
      soundOption.style.justifyContent = "center";
      soundOption.style.fontSize = "2rem";
    };
    img.src = soundData.icon;
    img.alt = `Sound ${index + 1}`;

    return soundOption;
  }

  /**
   * Update selected sound count
   * @param {number} count
   */
  updateSelectedCount(count) {
    const element = this.getElement("selectedCount");
    if (element) {
      element.textContent = count;
    }
  }

  /**
   * Update continue button state
   * @param {boolean} enabled
   */
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

  /**
   * Update sound icons in performance screen
   * @param {Array} selectedSounds - Array of {audio, icon}
   */
  updateSoundIcons(selectedSounds) {
    this.elements.soundIcons.forEach((icon, index) => {
      if (icon && selectedSounds[index]) {
        icon.src = selectedSounds[index].icon;
      }
    });
  }

  /**
   * Update sound icons in editing screen
   * @param {Array} selectedSounds - Array of {audio, icon}
   * @param {number} selectedSoundIndex - Currently selected sound
   */
  updateEditingSoundIcons(selectedSounds, selectedSoundIndex) {
    this.elements.editingSoundIcons.forEach((icon, index) => {
      if (icon && selectedSounds[index]) {
        icon.src = selectedSounds[index].icon;
      }
    });

    // Highlight selected sound
    const editingSounds = document.querySelectorAll(".phase-sound-selectable");
    editingSounds.forEach((soundEl, index) => {
      if (index === selectedSoundIndex) {
        soundEl.classList.add("selected");
      } else {
        soundEl.classList.remove("selected");
      }
    });
  }

  /**
   * Show key press visual feedback
   * @param {number} keyIndex - Index of the key (0-2)
   */
  showKeyPress(keyIndex) {
    const keyEl = document.querySelector(`.sound-key:nth-child(${keyIndex + 1}) .key`);
    if (keyEl) {
      keyEl.classList.add("pressed");
    }
  }

  /**
   * Hide key press visual feedback
   * @param {number} keyIndex - Index of the key (0-2)
   */
  hideKeyPress(keyIndex) {
    const keyEl = document.querySelector(`.sound-key:nth-child(${keyIndex + 1}) .key`);
    if (keyEl) {
      keyEl.classList.remove("pressed");
    }
  }

  /**
   * Disable non-selected sounds
   */
  disableNonSelectedSounds() {
    document.querySelectorAll(".sound-option:not(.selected)").forEach((el) => {
      el.classList.add("disabled");
    });
  }

  /**
   * Enable all sounds
   */
  enableAllSounds() {
    document.querySelectorAll(".sound-option").forEach((el) => {
      el.classList.remove("disabled");
    });
  }

  /**
   * Clear replacement grid
   */
  clearReplacementGrid() {
    const replacementGrid = this.getElement("replacementGrid");
    if (replacementGrid) {
      replacementGrid.innerHTML = "";
    }
  }

  /**
   * Create a replacement sound option element
   * @param {Object} soundData - {audio, icon}
   * @param {number} index
   * @returns {HTMLElement}
   */
  createReplacementSoundOption(soundData, index) {
    const soundOption = document.createElement("div");
    soundOption.className = "sound-option replacement-option";
    soundOption.dataset.replacementIndex = index;

    const skeleton = document.createElement("div");
    skeleton.className = "sound-skeleton";
    soundOption.appendChild(skeleton);

    const img = document.createElement("img");
    img.onload = () => {
      skeleton.remove();
      soundOption.appendChild(img);
    };
    img.onerror = () => {
      skeleton.remove();
      soundOption.innerHTML = "🎵";
      soundOption.style.display = "flex";
      soundOption.style.alignItems = "center";
      soundOption.style.justifyContent = "center";
      soundOption.style.fontSize = "2rem";
    };
    img.src = soundData.icon;
    img.alt = `Replacement Option ${index + 1}`;

    return soundOption;
  }

  /**
   * Update replacement info display
   * @param {Object} soundToReplace - {audio, icon}
   * @param {number} soundIndex
   */
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

  /**
   * Update replacement continue button state
   * @param {boolean} enabled
   */
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

  /**
   * Disable non-selected replacement options
   */
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

  /**
   * Enable all replacement options
   */
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

  /**
   * Update showcase screen info
   * @param {number} currentSongIndex
   * @param {number} totalSongs
   * @param {Array<string>} songCreators - Player names
   */
  updateShowcaseScreen(currentSongIndex, totalSongs, songCreators) {
    if (this.elements.currentSongNumber) {
      this.elements.currentSongNumber.textContent = currentSongIndex + 1;
    }
    if (this.elements.totalSongs) {
      this.elements.totalSongs.textContent = totalSongs;
    }
    if (this.elements.songCreators) {
      this.elements.songCreators.textContent = songCreators.join(", then ");
    }
  }

  /**
   * Format seconds as MM:SS
   * @param {number} seconds
   * @returns {string}
   */
  formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  }

  /**
   * Show error dialog
   * @param {string} message - Error message to display
   */
  showError(message) {
    const errorDialog = document.getElementById("error-dialog");
    const errorMessage = document.getElementById("error-message");

    if (errorDialog && errorMessage) {
      errorMessage.textContent = message;
      errorDialog.showModal();
    } else {
      // Fallback to alert if dialog not found
      alert(message);
    }
  }

  /**
   * Show notification toast
   * @param {string} message - Notification message
   */
  showNotification(message) {
    const messageDiv = document.createElement("section");
    messageDiv.className = "message -right";

    const balloon = document.createElement("div");
    balloon.className = "nes-balloon from-right";
    balloon.textContent = message;

    messageDiv.appendChild(balloon);

    const toast = Toastify({
      node: messageDiv,
      duration: 3000,
      gravity: "bottom",
      position: "right",
      stopOnFocus: true,
      offset: {
        x: 20,
        y: 20,
      },
      onClick: function () {
        toast.hideToast();
      },
    });

    toast.showToast();
  }
}
