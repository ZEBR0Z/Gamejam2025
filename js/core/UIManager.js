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
            menu: document.getElementById('main-menu'),
            tutorial: document.getElementById('tutorial'),
            selection: document.getElementById('selection'),
            performance: document.getElementById('performance'),
            editing: document.getElementById('editing'),
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
}
