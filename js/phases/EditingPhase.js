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
  ) {
    this.gameState = gameState;
    this.uiManager = uiManager;
    this.audioEngine = audioEngine;
    this.timer = timer;
    this.canvasRenderer = canvasRenderer;
    this.inputController = inputController;

    this.onPhaseComplete = null;
    this.scheduleInterval = null;
    this.animationFrameId = null;
  }

  start(onComplete) {
    this.onPhaseComplete = onComplete;

    console.log("Starting editing phase");
    this.uiManager.showScreen("editing");

    // Reset editing state
    this.gameState.setPlaybackState(false, 0, 0);
    this.gameState.timers.editingTimeLeft = this.gameState.config.editingTime;
    this.gameState.timers.phaseCountdown =
      this.gameState.config.phaseCountdownTime;

    // Setup UI
    this.setupUI();

    // Show phase countdown
    this.timer.startPhaseCountdown("editingPhaseCountdown", () => {
      this.startEditingTimer();
    });

    // Setup event handlers
    this.setupEventHandlers();
  }

  setupUI() {
    // Reset transport controls
    this.uiManager.updateTransportControls(
      "editing",
      false,
      0,
      this.gameState.config.segmentLength,
    );

    // Draw initial editing view
    this.draw();
  }

  setupEventHandlers() {
    // Register input handlers for editing
    this.inputController.registerHandler(
      "editingMouseDown",
      "editing",
      (mouseX, mouseY, canvasIndex) => {
        return this.handleMouseDown(mouseX, mouseY, canvasIndex);
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

    // Setup canvas events for all editing canvases
    this.uiManager.elements.editingCanvases.forEach((canvas, index) => {
      if (canvas) {
        this.inputController.setupCanvasEvents(canvas, "editing", index);
      }
    });

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
      this.gameState.config.segmentLength,
    );

    // Start scheduling and animation
    this.startScheduling();
    this.startAnimation();

    // Start editing countdown
    this.timer.startEditingTimer(() => this.complete());
  }

  handleMouseDown(mouseX, mouseY, canvasIndex) {
    const canvas = this.uiManager.getEditingCanvas(canvasIndex);
    if (!canvas) return null;

    const clickedEvent = this.canvasRenderer.getEventAtPosition(
      this.gameState.events,
      mouseX,
      mouseY,
      canvas,
      this.gameState.config.segmentLength,
      canvasIndex, // Only events for this sound
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
    // Draw each sound type on its own canvas
    for (let soundIndex = 0; soundIndex < 3; soundIndex++) {
      const canvas = this.uiManager.getEditingCanvas(soundIndex);
      if (canvas) {
        this.canvasRenderer.drawEditingTrack(
          canvas,
          this.gameState.events,
          this.gameState.playback.currentTime,
          this.gameState.config.segmentLength,
          soundIndex,
          this.gameState.playback.isPlaying,
          this.gameState.selectedSounds,
        );
      }
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
      this.gameState.config.segmentLength;

    this.gameState.events.forEach((event) => {
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

          setTimeout(
            () => {
              event.scheduled = false;
            },
            (this.gameState.config.segmentLength - eventTime + 0.1) * 1000,
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
      this.gameState.config.segmentLength,
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
      this.gameState.config.segmentLength,
    );
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
      this.gameState.config.segmentLength,
    );
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
      this.gameState.config.segmentLength,
    );
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
      this.gameState.config.segmentLength,
    );
  }

  complete() {
    this.pause();
    this.audioEngine.stopEditPreview();
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
    this.timer.stopTimer("editingTimeLeft");
  }
}
