/**
 * PerformancePhase - Handles the performance recording phase
 * Players record sounds using keys 1, 2, 3 over a backing track loop
 */
export class PerformancePhase {
  constructor(
    gameState,
    uiManager,
    audioEngine,
    timer,
    canvasRenderer,
    inputController,
    multiplayerManager,
  ) {
    this.gameState = gameState;
    this.uiManager = uiManager;
    this.audioEngine = audioEngine;
    this.timer = timer;
    this.canvasRenderer = canvasRenderer;
    this.inputController = inputController;
    this.multiplayerManager = multiplayerManager;

    this.onPhaseComplete = null;
    this.scheduleInterval = null;
    this.animationFrameId = null;
  }

  async start(onComplete) {
    this.onPhaseComplete = onComplete;

    console.log("Starting performance phase");
    this.uiManager.showScreen("performance");

    // Reset performance state
    this.gameState.clearEvents();
    this.gameState.setPlaybackState(false, 0, 0);
    this.gameState.timers.performanceTimeLeft =
      this.gameState.config.performanceTime;

    // Load backing track for current song
    await this.loadCurrentSongBackingTrack();

    // Setup UI
    this.setupUI();

    // Setup event handlers
    this.setupEventHandlers();

    // Start loop
    this.startLoop();
  }

  async loadCurrentSongBackingTrack() {
    try {
      const response = await this.multiplayerManager.getCurrentSong();
      if (response.success && response.song && response.song.backingTrack) {
        const backingTrack = response.song.backingTrack;
        this.gameState.setBackingTrack(backingTrack);
        await this.audioEngine.loadBackingTrack(backingTrack.path);
        console.log(
          "Loaded backing track:",
          backingTrack.path,
          "duration:",
          backingTrack.duration,
        );
      }
    } catch (error) {
      console.error("Failed to load backing track:", error);
    }
  }

  setupUI() {
    // Update sound icons
    this.uiManager.updateSoundIcons(this.gameState.selectedSounds);

    // Clear timeline
    const canvas = this.uiManager.getCanvas("timelineCanvas");
    if (canvas) {
      this.canvasRenderer.drawTimeline(
        canvas,
        [],
        0,
        this.gameState.getSegmentLength(),
      );
    }

    // Reset transport controls
    this.uiManager.updateTransportControls(
      "performance",
      false,
      0,
      this.gameState.getSegmentLength(),
    );
  }

  setupEventHandlers() {
    // Register input handlers
    this.inputController.registerHandler(
      "keyPress",
      "performance",
      (soundIndex) => {
        this.handleKeyPress(soundIndex);
      },
    );

    this.inputController.registerHandler(
      "timelineRightClick",
      "performance",
      (mouseX, mouseY) => {
        this.handleTimelineRightClick(mouseX, mouseY);
      },
    );

    // Setup canvas events
    const timelineCanvas = this.uiManager.getCanvas("timelineCanvas");
    if (timelineCanvas) {
      this.inputController.setupCanvasEvents(timelineCanvas, "timeline");
    }

    // Transport controls
    const transportHandlers = {
      "play-pause-btn": () => this.togglePlayback(),
      "restart-btn": () => this.restart(),
      "progress-bar": (value) => this.seekTo(value),
      "performance-continue-btn": () => this.complete(),
    };

    this.inputController.setupTransportEvents(transportHandlers);
  }

  startLoop() {
    // Refresh UI in case selected sounds have changed (e.g., in subsequent rounds)
    this.refreshUI();

    this.gameState.setPlaybackState(true, 0, this.audioEngine.getCurrentTime());
    this.uiManager.updateTransportControls(
      "performance",
      true,
      0,
      this.gameState.getSegmentLength(),
    );

    // Start backing track
    this.audioEngine.startBackingTrack();

    // Start performance countdown
    this.timer.startPerformanceTimer(() => this.complete());

    // Start scheduling and animation
    this.startScheduling();
    this.startAnimation();
  }

  refreshUI() {
    // Update sound icons with current selected sounds
    this.uiManager.updateSoundIcons(this.gameState.selectedSounds);

    // Clear timeline
    const canvas = this.uiManager.getCanvas("timelineCanvas");
    if (canvas) {
      this.canvasRenderer.drawTimeline(
        canvas,
        [],
        0,
        this.gameState.getSegmentLength(),
      );
    }
  }

  startScheduling() {
    if (this.scheduleInterval) {
      clearInterval(this.scheduleInterval);
    }

    this.scheduleInterval = setInterval(() => {
      if (this.gameState.playback.isPlaying) {
        this.scheduleEvents();
      }
    }, 50); // Check every 50ms
  }

  scheduleEvents() {
    if (!this.gameState.playback.isPlaying) return;

    const currentTime = this.audioEngine.getCurrentTime();
    const playbackTime =
      (currentTime - this.gameState.playback.startTime) %
      this.gameState.getSegmentLength();

    // Schedule events that should play in the next lookahead window
    this.gameState.events.forEach((event) => {
      if (!event.scheduled) {
        const eventTime = event.startTimeSec;
        let nextEventTime = eventTime;

        // Handle looping
        if (eventTime < playbackTime) {
          nextEventTime = eventTime + this.gameState.getSegmentLength();
        }

        const scheduleTime = currentTime + (nextEventTime - playbackTime);

        if (scheduleTime <= currentTime + this.audioEngine.lookaheadTime) {
          this.playEvent(event, scheduleTime);
          event.scheduled = true;

          // Reset scheduled flag for next loop
          setTimeout(
            () => {
              event.scheduled = false;
            },
            (this.gameState.getSegmentLength() - eventTime + 0.1) * 1000,
          );
        }
      }
    });
  }

  async playEvent(event, scheduleTime) {
    const selectedSound = this.gameState.selectedSounds[event.soundIndex];
    if (selectedSound) {
      await this.audioEngine.playSoundFromUrl(
        selectedSound.audio,
        event.pitchSemitones,
        scheduleTime,
      );
    }
  }

  startAnimation() {
    const animate = () => {
      if (
        this.gameState.getState() === "performance" &&
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
    this.gameState.updateCurrentTime(this.audioEngine.getCurrentTime());
    this.uiManager.updateTransportControls(
      "performance",
      this.gameState.playback.isPlaying,
      this.gameState.playback.currentTime,
      this.gameState.getSegmentLength(),
    );
  }

  draw() {
    const canvas = this.uiManager.getCanvas("timelineCanvas");
    if (canvas) {
      this.canvasRenderer.drawTimeline(
        canvas,
        this.gameState.events,
        this.gameState.playback.currentTime,
        this.gameState.getSegmentLength(),
        this.gameState.selectedSounds,
      );
    }
  }

  async handleKeyPress(soundIndex) {
    // Play sound immediately
    const selectedSound = this.gameState.selectedSounds[soundIndex];
    if (selectedSound) {
      await this.audioEngine.playSoundFromUrl(selectedSound.audio, 0);
    }

    // Record event
    this.gameState.addEvent(soundIndex, this.gameState.playback.currentTime, 0);
  }

  handleTimelineRightClick(mouseX, mouseY) {
    const canvas = this.uiManager.getCanvas("timelineCanvas");
    if (!canvas) return;

    const clickedEvent = this.canvasRenderer.getEventAtPosition(
      this.gameState.events,
      mouseX,
      mouseY,
      canvas,
      this.gameState.getSegmentLength(),
      null, // soundIndex (null for main timeline)
      this.gameState.playback.currentTime, // currentTime for viewport calculation
    );

    if (clickedEvent) {
      this.gameState.removeEvent(clickedEvent.id);
      this.draw(); // Immediate redraw
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
      this.audioEngine.getCurrentTime() - this.gameState.playback.currentTime,
    );

    // Reset event scheduling
    this.gameState.events.forEach((event) => {
      event.scheduled = false;
    });

    this.startScheduling();
    this.startAnimation();

    this.uiManager.updateTransportControls(
      "performance",
      true,
      this.gameState.playback.currentTime,
      this.gameState.getSegmentLength(),
    );

    // Resume backing track if needed
    this.audioEngine.resumeBackingTrack();
  }

  pause() {
    this.gameState.setPlaybackState(false);
    if (this.scheduleInterval) {
      clearInterval(this.scheduleInterval);
    }

    this.uiManager.updateTransportControls(
      "performance",
      false,
      this.gameState.playback.currentTime,
      this.gameState.getSegmentLength(),
    );

    // Pause backing track
    this.audioEngine.pauseBackingTrack();
  }

  restart() {
    this.gameState.setPlaybackState(
      this.gameState.playback.isPlaying,
      0,
      this.audioEngine.getCurrentTime(),
    );

    // Reset event scheduling
    this.gameState.events.forEach((event) => {
      event.scheduled = false;
    });

    this.uiManager.updateTransportControls(
      "performance",
      this.gameState.playback.isPlaying,
      0,
      this.gameState.getSegmentLength(),
    );

    // Restart backing track
    if (this.gameState.playback.isPlaying) {
      this.audioEngine.startBackingTrack();
    }
  }

  seekTo(time) {
    this.gameState.setPlaybackState(
      this.gameState.playback.isPlaying,
      time,
      this.audioEngine.getCurrentTime() - time,
    );

    // Reset event scheduling
    this.gameState.events.forEach((event) => {
      event.scheduled = false;
    });

    this.uiManager.updateTransportControls(
      "performance",
      this.gameState.playback.isPlaying,
      time,
      this.gameState.getSegmentLength(),
    );

    // Sync backing track
    this.audioEngine.seekBackingTrack(time);

    // Redraw canvas to show new position
    this.draw();
  }

  complete() {
    this.pause();
    this.audioEngine.stopBackingTrack();
    this.timer.stopTimer("performanceTimeLeft");

    console.log("Performance phase complete");
    if (this.onPhaseComplete) {
      this.onPhaseComplete();
    }
  }

  cleanup() {
    // Unregister handlers
    this.inputController.unregisterHandler("keyPress", "performance");
    this.inputController.unregisterHandler("timelineRightClick", "performance");

    // Clean up transport event listeners
    this.inputController.cleanupTransportEvents();

    // Stop scheduling and animation
    if (this.scheduleInterval) {
      clearInterval(this.scheduleInterval);
    }
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }

    // Stop backing track
    this.audioEngine.stopBackingTrack();

    this.timer.stopTimer("performanceTimeLeft");
  }
}
