/**
 * SongPreviewPhase - Preview previous player's work before adding to it
 *
 * - Loads and displays the song segments created so far
 * - Plays back the full timeline (all previous segments)
 * - Loads the original sound selection for the next performance phase
 * - Transitions to performance when player is ready
 */
export class SongPreviewPhase {
    constructor(gameState, uiManager, audioEngine, canvasRenderer, inputController, multiplayerManager) {
        this.gameState = gameState;
        this.uiManager = uiManager;
        this.audioEngine = audioEngine;
        this.canvasRenderer = canvasRenderer;
        this.inputController = inputController;
        this.multiplayerManager = multiplayerManager;

        this.onPhaseComplete = null;
        this.scheduleInterval = null;
        this.animationFrameId = null;
        this.previousSong = null;
        this.previewEvents = [];
    }

    async start(onComplete) {
        this.onPhaseComplete = onComplete;

        console.log('Starting song preview phase');
        this.gameState.setState('song-preview');
        this.uiManager.showScreen('song-preview');

        // Get the previous song data from server
        await this.loadPreviousSong();

        // Setup UI and playback
        this.setupUI();
        this.setupEventHandlers();
        this.startPreviewPlayback();
    }

    async loadPreviousSong() {
        try {
            const response = await this.multiplayerManager.getPreviousSong();
            if (response.success) {
                this.previousSong = response.song;

                // Update UI with previous player info
                this.uiManager.updatePreviewScreen(response.gameState, response.previousPlayerName);

                // Convert song segments to events for playback
                await this.convertSongToEvents();
            } else {
                console.error('Failed to load previous song:', response.error);
            }
        } catch (error) {
            console.error('Error loading previous song:', error);
        }
    }

    async convertSongToEvents() {
        if (!this.previousSong || !this.previousSong.segments) return;

        this.previewEvents = [];
        let eventId = 0;

        // Process all segments in sequence
        for (let segmentIndex = 0; segmentIndex < this.previousSong.segments.length; segmentIndex++) {
            const segment = this.previousSong.segments[segmentIndex];
            const timeOffset = segmentIndex * this.gameState.config.segmentLength;

            // Convert each sound event in the segment
            for (const soundEvent of segment.songData) {
                // Load the audio buffer for this sound
                try {
                    const audioBuffer = await this.audioEngine.loadAudioBuffer(soundEvent.audio);

                    this.previewEvents.push({
                        id: eventId++,
                        soundIndex: 0, // We'll map this to the loaded sound
                        startTimeSec: soundEvent.time + timeOffset,
                        pitchSemitones: soundEvent.pitch || 0,
                        scheduled: false,
                        audioBuffer: audioBuffer,
                        icon: soundEvent.icon
                    });
                } catch (error) {
                    console.error('Failed to load sound for preview:', soundEvent.audio, error);
                }
            }
        }

        // Preview ready - converted segments to playable events
    }

    setupUI() {
        // Calculate total preview time (all segments)
        const totalTime = this.previousSong ? this.previousSong.segments.length * this.gameState.config.segmentLength : this.gameState.config.segmentLength;

        // Reset transport controls
        this.uiManager.updatePreviewTransportControls(false, 0, totalTime);

        // Draw initial preview
        this.draw();
    }

    setupEventHandlers() {
        // Transport controls
        const transportHandlers = {
            'preview-play-pause-btn': () => this.togglePlayback(),
            'preview-restart-btn': () => this.restart(),
            'preview-progress-bar': (value) => this.seekTo(value),
            'continue-to-performance-btn': () => this.continueToPerformance()
        };

        this.inputController.setupTransportEvents(transportHandlers);
    }

    startPreviewPlayback() {
        const totalTime = this.previousSong ? this.previousSong.segments.length * this.gameState.config.segmentLength : this.gameState.config.segmentLength;

        this.gameState.setPlaybackState(true, 0, this.audioEngine.getCurrentTime());
        this.uiManager.updatePreviewTransportControls(true, 0, totalTime);

        // Start scheduling and animation
        this.startScheduling();
        this.startAnimation();
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
        if (!this.gameState.playback.isPlaying || !this.previewEvents.length) return;

        const currentTime = this.audioEngine.getCurrentTime();
        const playbackTime = currentTime - this.gameState.playback.startTime;
        const totalTime = this.previousSong ? this.previousSong.segments.length * this.gameState.config.segmentLength : this.gameState.config.segmentLength;

        this.previewEvents.forEach(event => {
            if (!event.scheduled) {
                const eventTime = event.startTimeSec;

                if (eventTime >= playbackTime && eventTime <= playbackTime + this.audioEngine.lookaheadTime) {
                    const scheduleTime = currentTime + (eventTime - playbackTime);
                    this.playEvent(event, scheduleTime);
                    event.scheduled = true;

                    // Reset scheduled flag when playback loops or restarts
                    setTimeout(() => {
                        event.scheduled = false;
                    }, (totalTime - eventTime + 0.1) * 1000);
                }
            }
        });
    }

    playEvent(event, scheduleTime) {
        if (event.audioBuffer) {
            this.audioEngine.playSound(event.audioBuffer, event.pitchSemitones, scheduleTime);
        }
    }

    startAnimation() {
        const animate = () => {
            if (this.gameState.getState() === 'song-preview' && this.gameState.playback.isPlaying) {
                this.updateCurrentTime();
                this.draw();
                this.animationFrameId = requestAnimationFrame(animate);
            }
        };
        animate();
    }

    updateCurrentTime() {
        const totalTime = this.previousSong ? this.previousSong.segments.length * this.gameState.config.segmentLength : this.gameState.config.segmentLength;
        this.gameState.updateCurrentTime(this.audioEngine.getCurrentTime());
        this.uiManager.updatePreviewTransportControls(
            this.gameState.playback.isPlaying,
            this.gameState.playback.currentTime,
            totalTime
        );
    }

    draw() {
        const canvas = this.uiManager.elements.previewCanvas;
        if (canvas && this.previewEvents.length > 0) {
            const totalTime = this.previousSong ? this.previousSong.segments.length * this.gameState.config.segmentLength : this.gameState.config.segmentLength;

            // Use the final view renderer to show the full preview timeline
            this.canvasRenderer.drawFinalView(
                canvas,
                this.previewEvents,
                this.gameState.playback.currentTime,
                totalTime
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
        const totalTime = this.previousSong ? this.previousSong.segments.length * this.gameState.config.segmentLength : this.gameState.config.segmentLength;

        this.gameState.setPlaybackState(
            true,
            this.gameState.playback.currentTime,
            this.audioEngine.getCurrentTime() - this.gameState.playback.currentTime
        );

        // Reset event scheduling
        this.previewEvents.forEach(event => {
            event.scheduled = false;
        });

        this.startScheduling();
        this.startAnimation();

        this.uiManager.updatePreviewTransportControls(true, this.gameState.playback.currentTime, totalTime);
    }

    pause() {
        this.gameState.setPlaybackState(false);
        if (this.scheduleInterval) {
            clearInterval(this.scheduleInterval);
        }

        const totalTime = this.previousSong ? this.previousSong.segments.length * this.gameState.config.segmentLength : this.gameState.config.segmentLength;
        this.uiManager.updatePreviewTransportControls(false, this.gameState.playback.currentTime, totalTime);
    }

    restart() {
        const totalTime = this.previousSong ? this.previousSong.segments.length * this.gameState.config.segmentLength : this.gameState.config.segmentLength;

        this.gameState.setPlaybackState(
            this.gameState.playback.isPlaying,
            0,
            this.audioEngine.getCurrentTime()
        );

        this.previewEvents.forEach(event => {
            event.scheduled = false;
        });

        this.uiManager.updatePreviewTransportControls(this.gameState.playback.isPlaying, 0, totalTime);
    }

    seekTo(time) {
        const totalTime = this.previousSong ? this.previousSong.segments.length * this.gameState.config.segmentLength : this.gameState.config.segmentLength;

        this.gameState.setPlaybackState(
            this.gameState.playback.isPlaying,
            time,
            this.audioEngine.getCurrentTime() - time
        );

        this.previewEvents.forEach(event => {
            event.scheduled = false;
        });

        this.uiManager.updatePreviewTransportControls(this.gameState.playback.isPlaying, time, totalTime);
    }

    async continueToPerformance() {
        this.pause();

        // Load the selected sounds from the previous song for the next performance
        if (this.previousSong && this.previousSong.selectedSounds) {
            try {
                // Load audio buffers for the selected sounds
                const loadedSounds = await Promise.all(
                    this.previousSong.selectedSounds.map(async (sound, index) => {
                        const audioBuffer = await this.audioEngine.loadAudioBuffer(sound.audio);
                        return {
                            audio: sound.audio,
                            icon: sound.icon,
                            audioBuffer: audioBuffer,
                            originalIndex: index
                        };
                    })
                );

                // Set the properly loaded sounds in game state
                this.gameState.selectedSounds = loadedSounds;
            } catch (error) {
                console.error('Failed to load selected sounds:', error);
                // Fallback to the sounds without buffers
                this.gameState.selectedSounds = this.previousSong.selectedSounds;
            }
        }

        // Notify server that this player is ready to continue
        this.multiplayerManager.continueToPerformance();

        if (this.onPhaseComplete) {
            this.onPhaseComplete();
        }
    }

    cleanup() {
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
