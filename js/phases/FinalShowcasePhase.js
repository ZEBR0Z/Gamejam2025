/**
 * FinalShowcasePhase - Display all completed collaborative songs
 *
 * - Loads all final songs from server
 * - Allows navigation between different songs
 * - Plays full-length collaborative pieces (N × 8 seconds each)
 * - Shows song contributors and creation timeline
 */
export class FinalShowcasePhase {
    constructor(gameState, uiManager, audioEngine, canvasRenderer, inputController, multiplayerManager) {
        this.gameState = gameState;
        this.uiManager = uiManager;
        this.audioEngine = audioEngine;
        this.canvasRenderer = canvasRenderer;
        this.inputController = inputController;
        this.multiplayerManager = multiplayerManager;

        this.onRestart = null;
        this.onExit = null;
        this.scheduleInterval = null;
        this.animationFrameId = null;

        this.finalSongs = [];
        this.currentSongIndex = 0;
        this.currentSongEvents = [];
    }

    async start(onRestart, onExit) {
        this.onRestart = onRestart;
        this.onExit = onExit;

        console.log('Starting final showcase phase');
        this.gameState.setState('final-showcase');
        this.uiManager.showScreen('final-showcase');

        // Load all final songs from server
        await this.loadFinalSongs();

        // Setup UI and start showcasing
        this.setupUI();
        this.setupEventHandlers();

        if (this.finalSongs.length > 0) {
            this.showSong(0);
        }
    }

    async loadFinalSongs() {
        try {
            const response = await this.multiplayerManager.getFinalSongs();
            if (response.success) {
                this.finalSongs = response.songs;
            } else {
                console.error('Failed to load final songs:', response.error);
            }
        } catch (error) {
            console.error('Error loading final songs:', error);
        }
    }

    setupUI() {
        // Update showcase info
        if (this.finalSongs.length > 0) {
            this.uiManager.updateShowcaseScreen(0, this.finalSongs.length, []);
        }
    }

    setupEventHandlers() {
        // Transport controls
        const transportHandlers = {
            'showcase-play-pause-btn': () => this.togglePlayback(),
            'showcase-restart-btn': () => this.restart(),
            'showcase-progress-bar': (value) => this.seekTo(value)
        };

        this.inputController.setupTransportEvents(transportHandlers);

        // Navigation and exit buttons
        const buttonHandlers = {
            'prev-song-btn': () => this.previousSong(),
            'next-song-btn': () => this.nextSong(),
            'showcase-restart-game-btn': () => this.restartGame(),
            'showcase-exit-btn': () => this.exitToMenu()
        };

        this.inputController.setupButtonEvents(buttonHandlers);
    }

    async showSong(songIndex) {
        if (songIndex < 0 || songIndex >= this.finalSongs.length) return;

        this.currentSongIndex = songIndex;
        const song = this.finalSongs[songIndex];

        // Convert song segments to events for playback
        await this.convertSongToEvents(song);

        // Update UI
        const creators = song.contributors || [];
        this.uiManager.updateShowcaseScreen(songIndex, this.finalSongs.length, creators);

        // Calculate total time for this song
        const totalTime = song.segments.length * this.gameState.config.segmentLength;

        // Reset playback and start
        this.gameState.setPlaybackState(true, 0, this.audioEngine.getCurrentTime());
        this.uiManager.updateShowcaseTransportControls(true, 0, totalTime);

        // Start playback
        this.startScheduling();
        this.startAnimation();
        this.draw();
    }

    async convertSongToEvents(song) {
        this.currentSongEvents = [];
        let eventId = 0;

        if (!song.segments) return;

        // Process all segments in sequence
        for (let segmentIndex = 0; segmentIndex < song.segments.length; segmentIndex++) {
            const segment = song.segments[segmentIndex];
            const timeOffset = segmentIndex * this.gameState.config.segmentLength;

            // Convert each sound event in the segment
            for (const soundEvent of segment.songData) {
                try {
                    const audioBuffer = await this.audioEngine.loadAudioBuffer(soundEvent.audio);

                    this.currentSongEvents.push({
                        id: eventId++,
                        soundIndex: 0,
                        startTimeSec: soundEvent.time + timeOffset,
                        pitchSemitones: soundEvent.pitch || 0,
                        scheduled: false,
                        audioBuffer: audioBuffer,
                        icon: soundEvent.icon
                    });
                } catch (error) {
                    console.error('Failed to load sound for showcase:', soundEvent.audio, error);
                }
            }
        }

        // Song converted to playable events
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
        if (!this.gameState.playback.isPlaying || !this.currentSongEvents.length) return;

        const currentTime = this.audioEngine.getCurrentTime();
        const playbackTime = (currentTime - this.gameState.playback.startTime);
        const song = this.finalSongs[this.currentSongIndex];
        const totalTime = song ? song.segments.length * this.gameState.config.segmentLength : this.gameState.config.segmentLength;

        // Handle looping
        const loopedPlaybackTime = playbackTime % totalTime;

        this.currentSongEvents.forEach(event => {
            if (!event.scheduled) {
                const eventTime = event.startTimeSec;
                let nextEventTime = eventTime;

                if (eventTime < loopedPlaybackTime) {
                    nextEventTime = eventTime + totalTime;
                }

                const scheduleTime = currentTime + (nextEventTime - loopedPlaybackTime);

                if (scheduleTime <= currentTime + this.audioEngine.lookaheadTime) {
                    this.playEvent(event, scheduleTime);
                    event.scheduled = true;

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
            if (this.gameState.getState() === 'final-showcase' && this.gameState.playback.isPlaying) {
                this.updateCurrentTime();
                this.draw();
                this.animationFrameId = requestAnimationFrame(animate);
            }
        };
        animate();
    }

    updateCurrentTime() {
        const song = this.finalSongs[this.currentSongIndex];
        const totalTime = song ? song.segments.length * this.gameState.config.segmentLength : this.gameState.config.segmentLength;

        this.gameState.updateCurrentTime(this.audioEngine.getCurrentTime(), totalTime);
        this.uiManager.updateShowcaseTransportControls(
            this.gameState.playback.isPlaying,
            this.gameState.playback.currentTime,
            totalTime
        );
    }

    draw() {
        const canvas = this.uiManager.elements.showcaseCanvas;
        if (canvas && this.currentSongEvents.length > 0) {
            const song = this.finalSongs[this.currentSongIndex];
            const totalTime = song ? song.segments.length * this.gameState.config.segmentLength : this.gameState.config.segmentLength;

            // Draw the full song timeline
            this.canvasRenderer.drawFinalView(
                canvas,
                this.currentSongEvents,
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
        const song = this.finalSongs[this.currentSongIndex];
        const totalTime = song ? song.segments.length * this.gameState.config.segmentLength : this.gameState.config.segmentLength;

        this.gameState.setPlaybackState(
            true,
            this.gameState.playback.currentTime,
            this.audioEngine.getCurrentTime() - this.gameState.playback.currentTime
        );

        // Reset event scheduling
        this.currentSongEvents.forEach(event => {
            event.scheduled = false;
        });

        this.startScheduling();
        this.startAnimation();

        this.uiManager.updateShowcaseTransportControls(true, this.gameState.playback.currentTime, totalTime);
    }

    pause() {
        this.gameState.setPlaybackState(false);
        if (this.scheduleInterval) {
            clearInterval(this.scheduleInterval);
        }

        const song = this.finalSongs[this.currentSongIndex];
        const totalTime = song ? song.segments.length * this.gameState.config.segmentLength : this.gameState.config.segmentLength;
        this.uiManager.updateShowcaseTransportControls(false, this.gameState.playback.currentTime, totalTime);
    }

    restart() {
        const song = this.finalSongs[this.currentSongIndex];
        const totalTime = song ? song.segments.length * this.gameState.config.segmentLength : this.gameState.config.segmentLength;

        this.gameState.setPlaybackState(
            this.gameState.playback.isPlaying,
            0,
            this.audioEngine.getCurrentTime()
        );

        this.currentSongEvents.forEach(event => {
            event.scheduled = false;
        });

        this.uiManager.updateShowcaseTransportControls(this.gameState.playback.isPlaying, 0, totalTime);
    }

    seekTo(time) {
        const song = this.finalSongs[this.currentSongIndex];
        const totalTime = song ? song.segments.length * this.gameState.config.segmentLength : this.gameState.config.segmentLength;

        this.gameState.setPlaybackState(
            this.gameState.playback.isPlaying,
            time,
            this.audioEngine.getCurrentTime() - time
        );

        this.currentSongEvents.forEach(event => {
            event.scheduled = false;
        });

        this.uiManager.updateShowcaseTransportControls(this.gameState.playback.isPlaying, time, totalTime);
    }

    previousSong() {
        if (this.currentSongIndex > 0) {
            this.pause();
            this.showSong(this.currentSongIndex - 1);
        }
    }

    nextSong() {
        if (this.currentSongIndex < this.finalSongs.length - 1) {
            this.pause();
            this.showSong(this.currentSongIndex + 1);
        }
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
