/**
 * EditingPhase - Handles the editing phase
 * Players can drag notes vertically to change their pitch
 */
export class EditingPhase {
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
    this.selectedSoundIndex = 0; // Currently selected sound for editing (0, 1, or 2)
  }

  async start(onComplete) {
    this.onPhaseComplete = onComplete;

    console.log("Starting editing phase");
    this.uiManager.showScreen("editing");

    // Reset editing state
    this.gameState.setPlaybackState(false, 0, 0);
    this.gameState.timers.editingTimeLeft = this.gameState.config.editingTime;

    // Load backing track for current song (backing track should already be set from preview/performance)
    // But load it again in case we're starting editing without going through those phases
    await this.loadCurrentSongBackingTrack();

    // Setup UI
    this.setupUI();

    // Setup event handlers
    this.setupEventHandlers();

    // Start timer for length of editing phase
    this.startEditingTimer();
  }

  setupUI() {
    // Update sound icons to show selected sounds
    this.uiManager.updateEditingSoundIcons(
      this.gameState.selectedSounds,
      this.selectedSoundIndex,
    );

    // Reset transport controls
    this.uiManager.updateTransportControls(
      "editing",
      false,
      0,
      this.gameState.getSegmentLength(),
    );

    // Draw initial editing view
    this.draw();
  }

  setupEventHandlers() {
    // Register input handlers for editing
    this.inputController.registerHandler(
      "editingMouseDown",
      "editing",
      (mouseX, mouseY) => {
        return this.handleMouseDown(mouseX, mouseY);
      },
    );

    // Register sound selection key handlers
    this.inputController.registerHandler(
      "keyPress",
      "editing",
      (soundIndex) => {
        this.selectSound(soundIndex);
      },
    );

    this.inputController.registerHandler(
      "editingMouseMove",
      "editing",
      (draggedNote, dragStartY, dragStartPitch, mouseY) => {
        this.handleMouseMove(draggedNote, dragStartY, dragStartPitch, mouseY);
      },
    );

    this.inputController.registerHandler(
      "editingMouseUp",
      "editing",
      (draggedNote) => {
        this.handleMouseUp(draggedNote);
      },
    );

    // Setup canvas events for unified editing timeline
    const editingCanvas = this.uiManager.getCanvas("editingTimelineCanvas");
    if (editingCanvas) {
      this.inputController.setupCanvasEvents(editingCanvas, "editing");
    }

    // Setup click handlers for sound selection buttons
    for (let i = 0; i < 3; i++) {
      const soundButton = document.getElementById(`editing-sound-${i}`);
      if (soundButton) {
        soundButton.addEventListener("click", () => {
          this.selectSound(i);
        });
      }
    }

    // Transport controls
    const transportHandlers = {
      "edit-play-pause-btn": () => this.togglePlayback(),
      "edit-restart-btn": () => this.restart(),
      "edit-progress-bar": (value) => this.seekTo(value),
      "editing-continue-btn": () => this.complete(),
    };

    this.inputController.setupTransportEvents(transportHandlers);
  }

  startEditingTimer() {
    // Draw the editing view immediately when starting
    this.draw();

    // Auto-start playback after countdown (like performance phase)
    this.gameState.setPlaybackState(true, 0, this.audioEngine.getCurrentTime());
    this.uiManager.updateTransportControls(
      "editing",
      true,
      0,
      this.gameState.getSegmentLength(),
    );

    // Start backing track
    this.audioEngine.startBackingTrack();

    // Start scheduling and animation
    this.startScheduling();
    this.startAnimation();

    // Start editing countdown
    this.timer.startEditingTimer(() => this.complete());
  }

  async loadCurrentSongBackingTrack() {
    // Backing track should already be loaded from previous phases, but ensure it's loaded
    if (this.gameState.backingTrack.path && !this.audioEngine.isBackingTrackLoaded) {
      try {
        await this.audioEngine.loadBackingTrack(this.gameState.backingTrack.path);
      } catch (error) {
        console.error("Failed to load backing track in editing phase:", error);
      }
    }
  }

  handleMouseDown(mouseX, mouseY) {
    const canvas = this.uiManager.getCanvas("editingTimelineCanvas");
    if (!canvas) return null;

    const clickedEvent = this.canvasRenderer.getEventAtPosition(
      this.gameState.events,
      mouseX,
      mouseY,
      canvas,
      this.gameState.getSegmentLength(),
      this.selectedSoundIndex, // Only events for currently selected sound
      this.gameState.playback.currentTime, // currentTime for viewport calculation
    );

    if (clickedEvent) {
      // Play the note immediately on mousedown
      const selectedSound =
        this.gameState.selectedSounds[clickedEvent.soundIndex];
      if (selectedSound) {
        this.audioEngine.startEditPreviewFromUrl(
          selectedSound.audio,
          clickedEvent.pitchSemitones,
        );
      }

      return { draggedNote: clickedEvent };
    }

    return null;
  }

  handleMouseMove(draggedNote, dragStartY, dragStartPitch, mouseY) {
    const deltaY = dragStartY - mouseY;
    const pitchChange = this.canvasRenderer.calculatePitchChange(deltaY);
    const newPitch = this.canvasRenderer.constrainPitch(
      dragStartPitch + pitchChange,
      -12,
      12,
    );

    if (newPitch !== draggedNote.pitchSemitones) {
      draggedNote.pitchSemitones = newPitch;

      // Play preview when pitch changes (responsive feedback)
      const selectedSound =
        this.gameState.selectedSounds[draggedNote.soundIndex];
      if (selectedSound) {
        this.audioEngine.startEditPreviewFromUrl(selectedSound.audio, newPitch);
      }
    }

    this.draw();
  }

  handleMouseUp(draggedNote) {
    // Stop any current edit preview when dragging ends
    this.audioEngine.stopEditPreview();
  }

  draw() {
    // Draw unified timeline with all events, but highlight selected sound
    const canvas = this.uiManager.getCanvas("editingTimelineCanvas");
    if (canvas) {
      this.canvasRenderer.drawEditingTimeline(
        canvas,
        this.gameState.events,
        this.gameState.playback.currentTime,
        this.gameState.getSegmentLength(),
        this.selectedSoundIndex,
        this.gameState.playback.isPlaying,
        this.gameState.selectedSounds,
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
    }, 50);
  }

  scheduleEvents() {
    if (!this.gameState.playback.isPlaying) return;

    const currentTime = this.audioEngine.getCurrentTime();
    const playbackTime =
      (currentTime - this.gameState.playback.startTime) %
      this.gameState.getSegmentLength();

    this.gameState.events.forEach((event) => {
      if (!event.scheduled) {
        const eventTime = event.startTimeSec;
        let nextEventTime = eventTime;

        if (eventTime < playbackTime) {
          nextEventTime = eventTime + this.gameState.getSegmentLength();
        }

        const scheduleTime = currentTime + (nextEventTime - playbackTime);

        if (scheduleTime <= currentTime + this.audioEngine.lookaheadTime) {
          this.playEvent(event, scheduleTime);
          event.scheduled = true;

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
        this.gameState.getState() === "editing" &&
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
      "editing",
      this.gameState.playback.isPlaying,
      this.gameState.playback.currentTime,
      this.gameState.getSegmentLength(),
    );
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
      "editing",
      true,
      this.gameState.playback.currentTime,
      this.gameState.getSegmentLength(),
    );

    // Resume backing track
    this.audioEngine.resumeBackingTrack();
  }

  pause() {
    this.gameState.setPlaybackState(false);
    if (this.scheduleInterval) {
      clearInterval(this.scheduleInterval);
    }

    this.uiManager.updateTransportControls(
      "editing",
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

    this.gameState.events.forEach((event) => {
      event.scheduled = false;
    });

    this.uiManager.updateTransportControls(
      "editing",
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

    this.gameState.events.forEach((event) => {
      event.scheduled = false;
    });

    this.uiManager.updateTransportControls(
      "editing",
      this.gameState.playback.isPlaying,
      time,
      this.gameState.getSegmentLength(),
    );

    // Sync backing track
    this.audioEngine.seekBackingTrack(time);

    // Redraw canvas to show new position
    this.draw();
  }

  selectSound(soundIndex) {
    if (soundIndex >= 0 && soundIndex < 3) {
      this.selectedSoundIndex = soundIndex;
      this.uiManager.updateEditingSoundIcons(
        this.gameState.selectedSounds,
        this.selectedSoundIndex,
      );
      this.draw(); // Redraw to update transparency
    }
  }

  complete() {
    this.pause();
    this.audioEngine.stopEditPreview();
    this.audioEngine.stopBackingTrack();
    this.timer.stopTimer("editingTimeLeft");

    console.log("Editing phase complete");
    if (this.onPhaseComplete) {
      this.onPhaseComplete();
    }
  }

  cleanup() {
    // Unregister handlers
    this.inputController.unregisterHandler("editingMouseDown", "editing");
    this.inputController.unregisterHandler("editingMouseMove", "editing");
    this.inputController.unregisterHandler("editingMouseUp", "editing");
    this.inputController.unregisterHandler("keyPress", "editing");

    // Clean up sound selection button listeners
    for (let i = 0; i < 3; i++) {
      const soundButton = document.getElementById(`editing-sound-${i}`);
      if (soundButton) {
        soundButton.replaceWith(soundButton.cloneNode(true)); // Remove all event listeners
      }
    }

    // Clean up transport event listeners
    this.inputController.cleanupTransportEvents();

    // Stop scheduling and animation
    if (this.scheduleInterval) {
      clearInterval(this.scheduleInterval);
    }
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }

    this.audioEngine.stopEditPreview();
    this.audioEngine.stopBackingTrack();
    this.timer.stopTimer("editingTimeLeft");
  }
}
