/**
 * PerformancePhase - Handles the performance recording phase
 * Players record sounds using keys 1, 2, 3 over a backing track loop
 */
export class PerformancePhase {
  constructor(
    gameState,
    uiManager,
    audioEngine,
    canvasRenderer,
    inputController,
    multiplayerManager,
    getCurrentRound,
  ) {
    this.gameState = gameState;
    this.uiManager = uiManager;
    this.audioEngine = audioEngine;
    this.canvasRenderer = canvasRenderer;
    this.inputController = inputController;
    this.multiplayerManager = multiplayerManager;
    this.getCurrentRound = getCurrentRound;

    this.onPhaseComplete = null;
    this.scheduleInterval = null;
    this.animationFrameId = null;
    this.countdownInterval = null;
  }

  async start(onComplete) {
    this.onPhaseComplete = onComplete;

    this.uiManager.showScreen("performance");

    this.gameState.clearEvents();
    this.gameState.setPlaybackState(false, 0, 0);
    await this.loadCurrentSongBackingTrack();

    this.setupUI();
    this.setupEventHandlers();
    this.startLoop();
  }

  async loadCurrentSongBackingTrack() {
    try {
      const state = this.multiplayerManager.getLobbyState();
      
      if (!state) {
        console.error("No lobby state");
        return;
      }

      let backingTrack = null;
      // Use Game's currentRound instead of server's player data
      const currentRound = this.getCurrentRound();

      // Round 1: Select a random backing track (working on own song)
      if (currentRound === 1) {
        const backingTracks = this.gameState.backingTracks;
        if (backingTracks && backingTracks.length > 0) {
          const randomIndex = Math.floor(Math.random() * backingTracks.length);
          backingTrack = backingTracks[randomIndex];
        }
      } 
      // Round 2+: Use backing track from the song we're working on
      else {
        const assignedPlayerId = this.multiplayerManager.getAssignment(currentRound);
        if (assignedPlayerId) {
          // Get the first submission (which has the backing track)
          const firstSubmission = this.multiplayerManager.getPlayerSubmission(assignedPlayerId, 1);
          if (firstSubmission && firstSubmission.backingTrack) {
            backingTrack = firstSubmission.backingTrack;
          }
        }
      }

      if (backingTrack) {
        this.currentBackingTrack = backingTrack;
        this.gameState.setBackingTrack(backingTrack);
        await this.audioEngine.loadBackingTrack(backingTrack.audio);
      }
    } catch (error) {
      console.error("Failed to load backing track:", error);
    }
  }

  setupUI() {
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

    const timelineCanvas = this.uiManager.getCanvas("timelineCanvas");
    if (timelineCanvas) {
      this.inputController.setupCanvasEvents(timelineCanvas, "timeline");
    }

    const transportHandlers = {
      "play-pause-btn": () => this.togglePlayback(),
      "restart-btn": () => this.restart(),
      "progress-bar": (value) => this.seekTo(value),
      "performance-continue-btn": () => this.complete(),
    };

    this.inputController.setupTransportEvents(transportHandlers);
  }

  startLoop() {
    this.refreshUI();

    this.gameState.setPlaybackState(true, 0, this.audioEngine.getCurrentTime());
    this.uiManager.updateTransportControls(
      "performance",
      true,
      0,
      this.gameState.getSegmentLength(),
    );

    this.audioEngine.startBackingTrack();
    this.startCountdown();
    this.startScheduling();
    this.startAnimation();
  }

  startCountdown() {
    let timeLeft = this.gameState.config.performanceTime;
    const countdownElement = this.uiManager.elements.performanceCountdown;

    const updateCountdown = () => {
      if (countdownElement) {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        countdownElement.textContent = `${minutes}:${seconds.toString().padStart(2, "0")}`;
      }

      timeLeft--;

      if (timeLeft < 0) {
        this.stopCountdown();
        this.complete();
      }
    };

    updateCountdown();
    this.countdownInterval = setInterval(updateCountdown, 1000);
  }

  stopCountdown() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }

  refreshUI() {
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

    this.audioEngine.pauseBackingTrack();
  }

  restart() {
    this.gameState.setPlaybackState(
      this.gameState.playback.isPlaying,
      0,
      this.audioEngine.getCurrentTime(),
    );

    this.gameState.events.forEach((event) => {
      event.scheduled = false;
    });

    this.uiManager.updateTransportControls(
      "performance",
      this.gameState.playback.isPlaying,
      0,
      this.gameState.getSegmentLength(),
    );

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

    this.gameState.events.forEach((event) => {
      event.scheduled = false;
    });

    this.uiManager.updateTransportControls(
      "performance",
      this.gameState.playback.isPlaying,
      time,
      this.gameState.getSegmentLength(),
    );

    this.audioEngine.seekBackingTrack(time);
    this.draw();
  }

  complete() {
    this.pause();
    this.audioEngine.stopBackingTrack();
    this.stopCountdown();

    if (this.onPhaseComplete) {
      this.onPhaseComplete();
    }
  }

  cleanup() {
    this.inputController.unregisterHandler("keyPress", "performance");
    this.inputController.unregisterHandler("timelineRightClick", "performance");

    this.inputController.cleanupTransportEvents();

    if (this.scheduleInterval) {
      clearInterval(this.scheduleInterval);
    }
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }

    this.audioEngine.stopBackingTrack();

    this.stopCountdown();
  }
}
