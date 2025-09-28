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
                playPauseBtn: 'playPauseBtn',
                progressBar: 'progressBar',
                timeDisplay: 'timeDisplay'
            },
            editing: {
                playPauseBtn: 'editPlayPauseBtn',
                progressBar: 'editProgressBar',
                timeDisplay: 'editTimeDisplay'
            },
            final: {
                playPauseBtn: 'finalPlayPauseBtn',
                progressBar: 'finalProgressBar',
                timeDisplay: 'finalTimeDisplay'
            }
        };
    }

    initialize() {
        this.initializeScreens();
        this.initializeElements();
        this.initialized = true;
        console.log('UIManager initialized');
    }

    initializeScreens() {
        this.screens = {
            'main-menu': document.getElementById('main-menu'),
            'create-lobby': document.getElementById('create-lobby'),
            'join-lobby': document.getElementById('join-lobby'),
            'lobby-waiting': document.getElementById('lobby-waiting'),
            tutorial: document.getElementById('tutorial'),
            selection: document.getElementById('selection'),
            performance: document.getElementById('performance'),
            editing: document.getElementById('editing'),
            'waiting-for-players': document.getElementById('waiting-for-players'),
            'song-preview': document.getElementById('song-preview'),
            'final-showcase': document.getElementById('final-showcase'),
            final: document.getElementById('final')
        };
    }

    initializeElements() {
        // Countdown elements
        this.elements.selectionCountdown = document.getElementById('selection-countdown');
        this.elements.performanceCountdown = document.getElementById('performance-countdown');
        this.elements.editingCountdown = document.getElementById('editing-countdown');
        this.elements.phaseCountdown = document.getElementById('phase-countdown');
        this.elements.editingPhaseCountdown = document.getElementById('editing-phase-countdown');

        // Selection elements
        this.elements.selectedCount = document.getElementById('selected-count');
        this.elements.soundGrid = document.getElementById('sound-grid');
        this.elements.continueBtn = document.getElementById('continue-btn');

        // Performance transport controls
        this.elements.playPauseBtn = document.getElementById('play-pause-btn');
        this.elements.restartBtn = document.getElementById('restart-btn');
        this.elements.progressBar = document.getElementById('progress-bar');
        this.elements.timeDisplay = document.getElementById('time-display');
        this.elements.performanceContinueBtn = document.getElementById('performance-continue-btn');

        // Editing transport controls
        this.elements.editPlayPauseBtn = document.getElementById('edit-play-pause-btn');
        this.elements.editRestartBtn = document.getElementById('edit-restart-btn');
        this.elements.editProgressBar = document.getElementById('edit-progress-bar');
        this.elements.editTimeDisplay = document.getElementById('edit-time-display');

        // Final transport controls
        this.elements.finalPlayPauseBtn = document.getElementById('final-play-pause-btn');
        this.elements.finalRestartBtn = document.getElementById('final-restart-btn');
        this.elements.finalProgressBar = document.getElementById('final-progress-bar');
        this.elements.finalTimeDisplay = document.getElementById('final-time-display');

        // Sound icons
        this.elements.soundIcons = [
            document.getElementById('sound-1-icon'),
            document.getElementById('sound-2-icon'),
            document.getElementById('sound-3-icon')
        ];

        // Canvas elements
        this.elements.timelineCanvas = document.getElementById('timeline-canvas');
        this.elements.editingCanvases = [
            document.getElementById('editing-canvas-1'),
            document.getElementById('editing-canvas-2'),
            document.getElementById('editing-canvas-3')
        ];
        this.elements.finalCanvas = document.getElementById('final-canvas');

        // Waiting for players elements
        this.elements.waitingMessage = document.getElementById('waiting-message');
        this.elements.currentRound = document.getElementById('current-round');
        this.elements.totalRounds = document.getElementById('total-rounds');
        this.elements.playersProgressContainer = document.getElementById('players-progress-container');

        // Song preview elements
        this.elements.previousPlayerName = document.getElementById('previous-player-name');
        this.elements.previewCurrentRound = document.getElementById('preview-current-round');
        this.elements.previewTotalRounds = document.getElementById('preview-total-rounds');
        this.elements.previewCanvas = document.getElementById('preview-canvas');
        this.elements.previewPlayPauseBtn = document.getElementById('preview-play-pause-btn');
        this.elements.previewRestartBtn = document.getElementById('preview-restart-btn');
        this.elements.previewProgressBar = document.getElementById('preview-progress-bar');
        this.elements.previewTimeDisplay = document.getElementById('preview-time-display');
        this.elements.continueToPerformanceBtn = document.getElementById('continue-to-performance-btn');

        // Final showcase elements
        this.elements.currentSongNumber = document.getElementById('current-song-number');
        this.elements.totalSongs = document.getElementById('total-songs');
        this.elements.songCreators = document.getElementById('song-creators');
        this.elements.showcaseCanvas = document.getElementById('showcase-canvas');
        this.elements.showcasePlayPauseBtn = document.getElementById('showcase-play-pause-btn');
        this.elements.showcaseRestartBtn = document.getElementById('showcase-restart-btn');
        this.elements.showcaseProgressBar = document.getElementById('showcase-progress-bar');
        this.elements.showcaseTimeDisplay = document.getElementById('showcase-time-display');
        this.elements.prevSongBtn = document.getElementById('prev-song-btn');
        this.elements.nextSongBtn = document.getElementById('next-song-btn');
    }

    // Screen management
    showScreen(screenName) {
        if (!this.initialized) {
            console.error('UIManager not initialized');
            return;
        }

        Object.values(this.screens).forEach(screen => {
            if (screen) screen.classList.remove('active');
        });

        if (this.screens[screenName]) {
            this.screens[screenName].classList.add('active');
        } else {
            console.error(`Screen not found: ${screenName}`);
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
        const element = this.getElement('phaseCountdown');
        if (element) {
            element.textContent = initialValue;
            element.style.display = 'block';
        }
    }

    hidePhaseCountdown() {
        const element = this.getElement('phaseCountdown');
        if (element) {
            element.style.display = 'none';
        }
    }

    showEditingPhaseCountdown(initialValue) {
        const element = this.getElement('editingPhaseCountdown');
        if (element) {
            element.textContent = initialValue;
            element.style.display = 'block';
        }
    }

    hideEditingPhaseCountdown() {
        const element = this.getElement('editingPhaseCountdown');
        if (element) {
            element.style.display = 'none';
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
            playPauseBtn.textContent = isPlaying ? '⏸️' : '▶️';
        }

        if (progressBar) {
            progressBar.value = currentTime;
        }

        if (timeDisplay) {
            timeDisplay.textContent = `${currentTime.toFixed(1)} / ${segmentLength.toFixed(1)}`;
        }
    }

    // Sound grid management
    clearSoundGrid() {
        const soundGrid = this.getElement('soundGrid');
        if (soundGrid) {
            soundGrid.innerHTML = '';
        }
    }

    createSoundOption(soundData, index) {
        const soundOption = document.createElement('div');
        soundOption.className = 'sound-option';
        soundOption.dataset.index = index;

        // Add skeleton loader
        const skeleton = document.createElement('div');
        skeleton.className = 'sound-skeleton';
        soundOption.appendChild(skeleton);

        // Load icon
        const img = document.createElement('img');
        img.onload = () => {
            skeleton.remove();
            soundOption.appendChild(img);
        };
        img.onerror = () => {
            skeleton.remove();
            soundOption.innerHTML = '🎵'; // Fallback
            soundOption.style.display = 'flex';
            soundOption.style.alignItems = 'center';
            soundOption.style.justifyContent = 'center';
            soundOption.style.fontSize = '2rem';
        };
        img.src = soundData.icon;
        img.alt = `Sound ${index + 1}`;

        return soundOption;
    }

    updateSelectedCount(count) {
        const element = this.getElement('selectedCount');
        if (element) {
            element.textContent = count;
        }
    }

    updateContinueButton(enabled) {
        const continueBtn = this.getElement('continueBtn');
        if (continueBtn) {
            continueBtn.disabled = !enabled;
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

    // Key press feedback
    showKeyPress(keyIndex) {
        const keyEl = document.querySelector(`.sound-key:nth-child(${keyIndex + 1}) .key`);
        if (keyEl) {
            keyEl.classList.add('pressed');
        }
    }

    hideKeyPress(keyIndex) {
        const keyEl = document.querySelector(`.sound-key:nth-child(${keyIndex + 1}) .key`);
        if (keyEl) {
            keyEl.classList.remove('pressed');
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
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    disableNonSelectedSounds() {
        document.querySelectorAll('.sound-option:not(.selected)').forEach(el => {
            el.classList.add('disabled');
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

        // Update players progress
        if (this.elements.playersProgressContainer) {
            this.elements.playersProgressContainer.innerHTML = '';

            gameState.players.forEach(player => {
                const playerItem = document.createElement('div');
                playerItem.className = 'player-progress-item';

                const playerName = document.createElement('span');
                playerName.className = 'player-name';
                playerName.textContent = player.name;

                const playerStatus = document.createElement('span');
                playerStatus.className = 'player-progress-status';

                if (player.hasSubmitted) {
                    playerStatus.textContent = 'Completed ✓';
                    playerStatus.classList.add('completed');
                } else {
                    playerStatus.textContent = 'Working...';
                    playerStatus.classList.add('working');
                }

                playerItem.appendChild(playerName);
                playerItem.appendChild(playerStatus);
                this.elements.playersProgressContainer.appendChild(playerItem);
            });
        }
    }

    // Song preview screen methods
    updatePreviewScreen(gameState, previousPlayerName) {
        if (this.elements.previousPlayerName) {
            this.elements.previousPlayerName.textContent = previousPlayerName;
        }
        if (this.elements.previewCurrentRound) {
            this.elements.previewCurrentRound.textContent = gameState.currentRound + 1;
        }
        if (this.elements.previewTotalRounds) {
            this.elements.previewTotalRounds.textContent = gameState.maxRounds;
        }
    }

    updatePreviewTransportControls(isPlaying, currentTime, totalTime) {
        if (this.elements.previewPlayPauseBtn) {
            this.elements.previewPlayPauseBtn.textContent = isPlaying ? '⏸️' : '▶️';
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
    updateShowcaseScreen(currentSongIndex, totalSongs, songCreators) {
        if (this.elements.currentSongNumber) {
            this.elements.currentSongNumber.textContent = currentSongIndex + 1;
        }
        if (this.elements.totalSongs) {
            this.elements.totalSongs.textContent = totalSongs;
        }
        if (this.elements.songCreators) {
            this.elements.songCreators.textContent = songCreators.join(', ');
        }

        // Update navigation buttons
        if (this.elements.prevSongBtn) {
            this.elements.prevSongBtn.disabled = currentSongIndex === 0;
        }
        if (this.elements.nextSongBtn) {
            this.elements.nextSongBtn.disabled = currentSongIndex === totalSongs - 1;
        }
    }

    updateShowcaseTransportControls(isPlaying, currentTime, totalTime) {
        if (this.elements.showcasePlayPauseBtn) {
            this.elements.showcasePlayPauseBtn.textContent = isPlaying ? '⏸️' : '▶️';
        }
        if (this.elements.showcaseProgressBar) {
            this.elements.showcaseProgressBar.value = currentTime;
            this.elements.showcaseProgressBar.max = totalTime;
        }
        if (this.elements.showcaseTimeDisplay) {
            this.elements.showcaseTimeDisplay.textContent = `${currentTime.toFixed(1)} / ${totalTime.toFixed(1)}`;
        }
    }
}
