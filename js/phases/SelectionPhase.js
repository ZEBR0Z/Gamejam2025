/**
 * SelectionPhase - Handles the sound selection phase
 * Players choose 3 sounds from 5 random options within 10 seconds
 */
export class SelectionPhase {
    constructor(gameState, uiManager, audioEngine, timer) {
        this.gameState = gameState;
        this.uiManager = uiManager;
        this.audioEngine = audioEngine;
        this.timer = timer;
        this.onPhaseComplete = null;
    }

    async start(onComplete) {
        this.onPhaseComplete = onComplete;

        console.log('Starting selection phase');
        this.uiManager.showScreen('selection');

        // Reset selection state
        this.gameState.clearSelectedSounds();
        this.gameState.resetTimers();
        this.updateUI();

        // Pick 5 random sounds
        this.gameState.selectRandomSounds(5);

        // Populate sound grid
        await this.populateSoundGrid();

        // Start countdown timer
        this.timer.startSelectionTimer(() => this.complete());

        // Setup event handlers
        this.setupEventHandlers();
    }

    async populateSoundGrid() {
        this.uiManager.clearSoundGrid();

        for (let i = 0; i < this.gameState.availableSounds.length; i++) {
            const soundData = this.gameState.availableSounds[i];
            const soundOption = this.uiManager.createSoundOption(soundData, i);

            // Add event listeners
            soundOption.addEventListener('mouseenter', () => this.previewSound(i));
            soundOption.addEventListener('mouseleave', () => this.stopPreview());
            soundOption.addEventListener('click', () => this.selectSound(i));

            const soundGrid = this.uiManager.getElement('soundGrid');
            if (soundGrid) {
                soundGrid.appendChild(soundOption);
            }
        }
    }

    async previewSound(index) {
        this.stopPreview();

        try {
            const soundData = this.gameState.availableSounds[index];
            const audioBuffer = await this.audioEngine.loadAudioBuffer(soundData.audio);
            this.audioEngine.startPreview(audioBuffer);
        } catch (error) {
            console.error('Failed to preview sound:', error);
        }
    }

    stopPreview() {
        this.audioEngine.stopPreview();
    }

    async selectSound(index) {
        if (this.gameState.selectedSounds.length >= 3) return;

        const soundOption = document.querySelector(`[data-index="${index}"]`);
        if (!soundOption || soundOption.classList.contains('selected')) return;

        try {
            const soundData = this.gameState.availableSounds[index];

            // Load audio buffer
            const audioBuffer = await this.audioEngine.loadAudioBuffer(soundData.audio);

            // Add to selected sounds
            const success = this.gameState.addSelectedSound(soundData, audioBuffer, index);

            if (success) {
                // Update UI
                soundOption.classList.add('selected');
                this.updateUI();

                if (this.gameState.selectedSounds.length === 3) {
                    this.uiManager.updateContinueButton(true);
                    this.uiManager.disableNonSelectedSounds();
                }
            }
        } catch (error) {
            console.error('Failed to load sound:', error);
        }
    }

    autoSelectRemaining() {
        const unselected = this.gameState.availableSounds
            .map((sound, index) => index)
            .filter(index => !this.gameState.selectedSounds.some(s => s.originalIndex === index));

        const selectPromises = [];
        while (this.gameState.selectedSounds.length < 3 && unselected.length > 0) {
            const randomIndex = unselected.splice(Math.floor(Math.random() * unselected.length), 1)[0];
            selectPromises.push(this.selectSound(randomIndex));
        }

        return Promise.all(selectPromises);
    }

    updateUI() {
        this.uiManager.updateSelectedCount(this.gameState.selectedSounds.length);
        this.uiManager.updateContinueButton(this.gameState.selectedSounds.length === 3);
    }

    setupEventHandlers() {
        const continueBtn = this.uiManager.getElement('continueBtn');
        if (continueBtn) {
            continueBtn.addEventListener('click', () => this.complete());
        }
    }

    complete() {
        // Ensure we have 3 sounds selected
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
        this.timer.stopTimer('selectionTimeLeft');

        console.log('Selection phase complete');
        if (this.onPhaseComplete) {
            this.onPhaseComplete();
        }
    }

    cleanup() {
        this.stopPreview();
        this.timer.stopTimer('selectionTimeLeft');
    }
}
