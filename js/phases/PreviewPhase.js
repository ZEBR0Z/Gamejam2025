/**
 * PreviewPhase - Preview previous player's work before adding to it
 *
 * - Loads and displays only the most recent segment (from previous player)
 * - Plays back a single segment timeline with backing track
 * - Loads the original sound selection for the next performance phase
 * - Transitions to performance when player is ready
 */
export class PreviewPhase {
  constructor(
    gameState,
    uiManager,
    audioEngine,
    canvasRenderer,
    inputController,
    multiplayerManager,
  ) {
    this.gameState = gameState;
    this.uiManager = uiManager;
    this.audioEngine = audioEngine;
    this.canvasRenderer = canvasRenderer;
    this.inputController = inputController;
    this.multiplayerManager = multiplayerManager;

    this.onPhaseComplete = null;
    this.scheduleInterval = null;
    this.animationFrameId = null;
    this.phaseTimerInterval = null;
    this.previousSong = null;
    this.previewEvents = [];
    this.phaseStartTime = null;
  }

  async start(onComplete) {
    this.onPhaseComplete = onComplete;

    console.log("Starting song preview phase");
    this.uiManager.showScreen("preview");

    // Get the previous song data from server
    await this.loadPreviousSong();

    // Setup UI and playback
    this.setupUI();
    this.setupEventHandlers();
    this.startPreviewPlayback();

    // Start the phase timer
    this.startPhaseTimer();
  }

  async loadPreviousSong() {
    try {
      const response = await this.multiplayerManager.getPreviousSong();
      if (response.success) {
        this.previousSong = response.song;

        // Set backing track info and load it
        if (this.previousSong.backingTrack) {
          this.gameState.setBackingTrack(this.previousSong.backingTrack);
          await this.audioEngine.loadBackingTrack(
            this.previousSong.backingTrack.path,
          );
        }

        // Update UI with previous player info
        this.uiManager.updatePreviewScreen(
          response.gameState,
          response.previousPlayerName,
        );

        // Convert song segments to events for playback
        await this.convertSongToEvents();
      } else {
        console.error("Failed to load previous song:", response.error);
      }
    } catch (error) {
      console.error("Error loading previous song:", error);
    }
  }

  async convertSongToEvents() {
    if (
      !this.previousSong ||
      !this.previousSong.segments ||
      this.previousSong.segments.length === 0
    )
      return;

    this.previewEvents = [];
    let eventId = 0;

    // Only process the most recent segment (from the previous player)
    const mostRecentSegment =
      this.previousSong.segments[this.previousSong.segments.length - 1];

    // Convert each sound event in the most recent segment
    for (const soundEvent of mostRecentSegment.songData) {
      this.previewEvents.push({
        id: eventId++,
        soundIndex: 0, // We'll map this to the loaded sound
        startTimeSec: soundEvent.time, // No time offset needed since we're only showing one segment
        pitchSemitones: soundEvent.pitch || 0,
        scheduled: false,
        audio: soundEvent.audio, // Store the audio URL instead of buffer
        icon: soundEvent.icon,
      });
    }

    // Preview ready - converted most recent segment to playable events
  }

  setupUI() {
    // Calculate total preview time (single segment only)
    const totalTime = this.gameState.getSegmentLength();

    // Reset transport controls
    this.uiManager.updatePreviewTransportControls(false, 0, totalTime);

    // Draw initial preview
    this.draw();
  }

  setupEventHandlers() {
    // Transport controls
    const transportHandlers = {
      "preview-play-pause-btn": () => this.togglePlayback(),
      "preview-restart-btn": () => this.restart(),
      "preview-progress-bar": (value) => this.seekTo(value),
      "continue-to-performance-btn": () => this.continueToPerformance(),
    };

    this.inputController.setupTransportEvents(transportHandlers);
  }

  startPreviewPlayback() {
    const totalTime = this.gameState.getSegmentLength();

    this.gameState.setPlaybackState(true, 0, this.audioEngine.getCurrentTime());
    this.uiManager.updatePreviewTransportControls(true, 0, totalTime);

    // Start backing track
    this.audioEngine.startBackingTrack();

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
    if (!this.gameState.playback.isPlaying || !this.previewEvents.length)
      return;

    const currentTime = this.audioEngine.getCurrentTime();
    const playbackTime = currentTime - this.gameState.playback.startTime;
    const totalTime = this.gameState.getSegmentLength();

    // Restart if past the end
    if (playbackTime >= totalTime) {
      this.restart();
      return;
    }

    this.previewEvents.forEach((event) => {
      if (!event.scheduled) {
        const eventTime = event.startTimeSec;

        if (
          eventTime >= playbackTime &&
          eventTime <= playbackTime + this.audioEngine.lookaheadTime
        ) {
          const scheduleTime = currentTime + (eventTime - playbackTime);
          this.playEvent(event, scheduleTime);
          event.scheduled = true;
        }
      }
    });
  }

  async playEvent(event, scheduleTime) {
    if (event.audio) {
      await this.audioEngine.playSoundFromUrl(
        event.audio,
        event.pitchSemitones,
        scheduleTime,
      );
    }
  }

  startAnimation() {
    const animate = () => {
      if (
        this.gameState.getState() === "preview" &&
        this.gameState.playback.isPlaying
      ) {
        this.updateCurrentTime();
        this.draw();
        this.animationFrameId = requestAnimationFrame(animate);
      }
    };
    animate();
  }

  updateCurrentTime() {
    const totalTime = this.gameState.getSegmentLength();
    this.gameState.updateCurrentTime(this.audioEngine.getCurrentTime());
    this.uiManager.updatePreviewTransportControls(
      this.gameState.playback.isPlaying,
      this.gameState.playback.currentTime,
      totalTime,
    );
  }

  draw() {
    const canvas = this.uiManager.elements.previewCanvas;
    if (canvas && this.previewEvents.length > 0) {
      const totalTime = this.gameState.getSegmentLength();

      // Use the final view renderer to show the single segment preview timeline
      this.canvasRenderer.drawFinalView(
        canvas,
        this.previewEvents,
        this.gameState.playback.currentTime,
        totalTime,
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
    const totalTime = this.gameState.getSegmentLength();

    this.gameState.setPlaybackState(
      true,
      this.gameState.playback.currentTime,
      this.audioEngine.getCurrentTime() - this.gameState.playback.currentTime,
    );

    // Reset event scheduling
    this.previewEvents.forEach((event) => {
      event.scheduled = false;
    });

    // Resume backing track
    this.audioEngine.resumeBackingTrack();

    this.startScheduling();
    this.startAnimation();

    this.uiManager.updatePreviewTransportControls(
      true,
      this.gameState.playback.currentTime,
      totalTime,
    );
  }

  pause() {
    this.gameState.setPlaybackState(false);
    if (this.scheduleInterval) {
      clearInterval(this.scheduleInterval);
    }

    // Pause backing track
    this.audioEngine.pauseBackingTrack();

    const totalTime = this.gameState.getSegmentLength();
    this.uiManager.updatePreviewTransportControls(
      false,
      this.gameState.playback.currentTime,
      totalTime,
    );
  }

  restart() {
    const totalTime = this.gameState.getSegmentLength();

    this.gameState.setPlaybackState(
      this.gameState.playback.isPlaying,
      0,
      this.audioEngine.getCurrentTime(),
    );

    this.previewEvents.forEach((event) => {
      event.scheduled = false;
    });

    // Restart backing track
    if (this.gameState.playback.isPlaying) {
      this.audioEngine.startBackingTrack();
    }

    this.uiManager.updatePreviewTransportControls(
      this.gameState.playback.isPlaying,
      0,
      totalTime,
    );
  }

  seekTo(time) {
    const totalTime = this.gameState.getSegmentLength();

    this.gameState.setPlaybackState(
      this.gameState.playback.isPlaying,
      time,
      this.audioEngine.getCurrentTime() - time,
    );

    this.previewEvents.forEach((event) => {
      event.scheduled = false;
    });

    // Sync backing track
    this.audioEngine.seekBackingTrack(time);

    this.uiManager.updatePreviewTransportControls(
      this.gameState.playback.isPlaying,
      time,
      totalTime,
    );

    // Redraw canvas to show new position
    this.draw();
  }

  startPhaseTimer() {
    this.phaseStartTime = Date.now();
    const previewTime = 20; // 20 seconds

    // Update timer display immediately
    this.updatePhaseTimer(previewTime);

    // Update timer every second
    this.phaseTimerInterval = setInterval(() => {
      const elapsed = (Date.now() - this.phaseStartTime) / 1000;
      const timeLeft = Math.max(0, previewTime - elapsed);

      this.updatePhaseTimer(Math.ceil(timeLeft));

      // Auto-continue when time runs out
      if (timeLeft <= 0) {
        // Clear timer and call completion
        if (this.phaseTimerInterval) {
          clearInterval(this.phaseTimerInterval);
          this.phaseTimerInterval = null;
        }
        this.continueToPerformance();
      }
    }, 1000);
  }

  updatePhaseTimer(timeLeft) {
    if (this.uiManager.elements.previewPhaseTimer) {
      this.uiManager.elements.previewPhaseTimer.textContent = timeLeft;
    }
  }

  async continueToPerformance() {
    // Clear the timer if still running
    if (this.phaseTimerInterval) {
      clearInterval(this.phaseTimerInterval);
      this.phaseTimerInterval = null;
    }

    this.pause();
    this.audioEngine.stopBackingTrack();

    // Load the selected sounds from the previous song for the next round
    if (this.previousSong && this.previousSong.selectedSounds) {
      // Set the selected sounds in game state (no need to load audio buffers)
      this.gameState.selectedSounds = this.previousSong.selectedSounds.map(
        (sound, index) => ({
          audio: sound.audio,
          icon: sound.icon,
          originalIndex: index,
        }),
      );

      // Preload icons for next phase
      if (this.gameState.onIconPreload) {
        this.previousSong.selectedSounds.forEach((sound) => {
          if (sound.icon) {
            this.gameState.onIconPreload(sound.icon);
          }
        });
      }
    }

    // Notify server that this player is ready to continue
    this.multiplayerManager.continueToPerformance();

    if (this.onPhaseComplete) {
      this.onPhaseComplete();
    }
  }

  cleanup() {
    // Clean up transport event listeners
    this.inputController.cleanupTransportEvents();

    // Stop scheduling and animation
    if (this.scheduleInterval) {
      clearInterval(this.scheduleInterval);
    }
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.phaseTimerInterval) {
      clearInterval(this.phaseTimerInterval);
    }

    // Stop backing track
    this.audioEngine.stopBackingTrack();

    // Reset playback state
    this.gameState.setPlaybackState(false, 0, 0);
  }
}
