/**
 * FinalPhase - Handles the final playback phase
 * Continuous playback of the created music with option to restart or exit
 */
export class FinalPhase {
    constructor(gameState, uiManager, audioEngine, canvasRenderer, inputController) {
        this.gameState = gameState;
        this.uiManager = uiManager;
        this.audioEngine = audioEngine;
        this.canvasRenderer = canvasRenderer;
        this.inputController = inputController;

        this.onRestart = null;
        this.onExit = null;
        this.scheduleInterval = null;
        this.animationFrameId = null;
    }

    start(onRestart, onExit) {
        this.onRestart = onRestart;
        this.onExit = onExit;

        console.log('Starting final phase');
        this.gameState.setState('final');
        this.uiManager.showScreen('final');

        // Setup final playback
        this.setupFinalPlayback();
        this.setupEventHandlers();
    }

    setupFinalPlayback() {
        this.gameState.setPlaybackState(true, 0, this.audioEngine.getCurrentTime());

        // Update transport controls
        this.uiManager.updateTransportControls('final', true, 0, this.gameState.config.segmentLength);

        // Reset event scheduling
        this.gameState.events.forEach(event => {
            event.scheduled = false;
        });

        // Start playback immediately
        this.startScheduling();
        this.startAnimation();
    }

    setupEventHandlers() {
        // Transport controls
        const transportHandlers = {
            'final-play-pause-btn': () => this.togglePlayback(),
            'final-restart-btn': () => this.restart(),
            'final-progress-bar': (value) => this.seekTo(value)
        };

        this.inputController.setupTransportEvents(transportHandlers);

        // Final buttons
        const buttonHandlers = {
            'restart-game-btn': () => this.restartGame(),
            'exit-btn': () => this.exitToMenu()
        };

        this.inputController.setupButtonEvents(buttonHandlers);
    }

    startScheduling() {
        if (this.scheduleInterval) {
            clearInterval(this.scheduleInterval);
        }

        this.scheduleInterval = setInterval(() => {
            if (this.gameState.playback.isPlaying) {
                this.scheduleEvents();
            }
        }, 50);
    }

    scheduleEvents() {
        if (!this.gameState.playback.isPlaying) return;

        const currentTime = this.audioEngine.getCurrentTime();
        const playbackTime = (currentTime - this.gameState.playback.startTime) % this.gameState.config.segmentLength;

        this.gameState.events.forEach(event => {
            if (!event.scheduled) {
                const eventTime = event.startTimeSec;
                let nextEventTime = eventTime;

                if (eventTime < playbackTime) {
                    nextEventTime = eventTime + this.gameState.config.segmentLength;
                }

                const scheduleTime = currentTime + (nextEventTime - playbackTime);

                if (scheduleTime <= currentTime + this.audioEngine.lookaheadTime) {
                    this.playEvent(event, scheduleTime);
                    event.scheduled = true;

                    setTimeout(() => {
                        event.scheduled = false;
                    }, (this.gameState.config.segmentLength - eventTime + 0.1) * 1000);
                }
            }
        });
    }

    playEvent(event, scheduleTime) {
        const selectedSound = this.gameState.selectedSounds[event.soundIndex];
        if (selectedSound) {
            this.audioEngine.playSound(selectedSound.audioBuffer, event.pitchSemitones, scheduleTime);
        }
    }

    startAnimation() {
        const animate = () => {
            if (this.gameState.getState() === 'final' && this.gameState.playback.isPlaying) {
                this.updateCurrentTime();
                this.draw();
                this.animationFrameId = requestAnimationFrame(animate);
            }
        };
        animate();
    }

    updateCurrentTime() {
        this.gameState.updateCurrentTime(this.audioEngine.getCurrentTime());
        this.uiManager.updateTransportControls(
            'final',
            this.gameState.playback.isPlaying,
            this.gameState.playback.currentTime,
            this.gameState.config.segmentLength
        );
    }

    draw() {
        const canvas = this.uiManager.getCanvas('finalCanvas');
        if (canvas) {
            this.canvasRenderer.drawFinalView(
                canvas,
                this.gameState.events,
                this.gameState.playback.currentTime,
                this.gameState.config.segmentLength
            );
        }
    }

    togglePlayback() {
        if (this.gameState.playback.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    play() {
        this.gameState.setPlaybackState(
            true,
            this.gameState.playback.currentTime,
            this.audioEngine.getCurrentTime() - this.gameState.playback.currentTime
        );

        // Reset event scheduling
        this.gameState.events.forEach(event => {
            event.scheduled = false;
        });

        this.startScheduling();
        this.startAnimation();

        this.uiManager.updateTransportControls('final', true, this.gameState.playback.currentTime, this.gameState.config.segmentLength);
    }

    pause() {
        this.gameState.setPlaybackState(false);
        if (this.scheduleInterval) {
            clearInterval(this.scheduleInterval);
        }

        this.uiManager.updateTransportControls('final', false, this.gameState.playback.currentTime, this.gameState.config.segmentLength);
    }

    restart() {
        this.gameState.setPlaybackState(
            this.gameState.playback.isPlaying,
            0,
            this.audioEngine.getCurrentTime()
        );

        this.gameState.events.forEach(event => {
            event.scheduled = false;
        });

        this.uiManager.updateTransportControls('final', this.gameState.playback.isPlaying, 0, this.gameState.config.segmentLength);
    }

    seekTo(time) {
        this.gameState.setPlaybackState(
            this.gameState.playback.isPlaying,
            time,
            this.audioEngine.getCurrentTime() - time
        );

        this.gameState.events.forEach(event => {
            event.scheduled = false;
        });

        this.uiManager.updateTransportControls('final', this.gameState.playback.isPlaying, time, this.gameState.config.segmentLength);
    }

    restartGame() {
        this.cleanup();

        console.log('Restarting game');
        if (this.onRestart) {
            this.onRestart();
        }
    }

    exitToMenu() {
        this.cleanup();

        console.log('Exiting to menu');
        if (this.onExit) {
            this.onExit();
        }
    }

    cleanup() {
        // Stop all audio previews
        this.audioEngine.stopPreview();
        this.audioEngine.stopEditPreview();

        // Stop scheduling and animation
        if (this.scheduleInterval) {
            clearInterval(this.scheduleInterval);
        }
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }

        // Reset playback state
        this.gameState.setPlaybackState(false, 0, 0);
    }
}
