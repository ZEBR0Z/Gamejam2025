import { BasePhase } from "./BasePhase.js";
import { PhaseType, GameConfig } from "../Constants.js";

/**
 * EditingPhase - Edit pitch of recorded events
 * Players can drag notes vertically to change pitch
 */
export class EditingPhase extends BasePhase {
  constructor(services) {
    super(services);

    this.scheduleInterval = null;
    this.animationFrameId = null;
    this.timeRemaining = GameConfig.EDITING_TIME;
    this.countdownInterval = null;
    this.selectedSoundIndex = 0;
  }

  async enter(onComplete, onSecondary = null) {
    await super.enter(onComplete, onSecondary);

    // Show editing screen
    this.ui.showScreen("editing");

    // Load backing track (should already be in local state)
    const backingTrack = this.localState.getBackingTrack();
    if (backingTrack) {
      await this.audio.loadBackingTrack(backingTrack.audio);
    }

    // Set up sound selector buttons
    this.setupSoundSelector();

    // Set up transport controls
    this.input.setupTransportEvents({
      "editing-play-pause-btn": () => this.togglePlayback(),
      "editing-restart-btn": () => this.restart(),
      "editing-progress-bar": (value) => this.seekTo(value),
    });

    // Set up canvas for dragging
    const canvas = document.getElementById("editing-timeline-canvas");
    if (canvas) {
      this.input.setupCanvasEvents(canvas, "editing", null, {
        onMouseDown: (mouseX, mouseY) => this.handleMouseDown(mouseX, mouseY),
        onMouseMove: (note, startY, startPitch, mouseY) =>
          this.handleMouseMove(note, startY, startPitch, mouseY),
        onMouseUp: (note) => this.handleMouseUp(note),
      });
    }

    // Set up continue button
    this.input.setupButtonEvents({
      "editing-continue-btn": () => this.handleContinue(),
    });

    // Start playback loop
    this.startPlayback();

    // Start countdown
    this.startCountdown();
  }

  exit() {
    // Clean up intervals
    if (this.scheduleInterval) {
      clearInterval(this.scheduleInterval);
      this.scheduleInterval = null;
    }

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }

    // Clean up input handlers
    this.input.cleanupTransportEvents();
    this.input.cleanupButtonEvents();
    this.input.cleanupCanvasEvents(
      document.getElementById("editing-timeline-canvas")
    );

    // Stop audio
    this.audio.stopBackingTrack();

    super.exit();
  }

  /**
   * Set up sound selector buttons
   */
  setupSoundSelector() {
    const selectedSounds = this.localState.getSelectedSounds();

    for (let i = 0; i < selectedSounds.length; i++) {
      const button = document.getElementById(`editing-sound-${i}`);
      if (button) {
        button.onclick = () => this.selectSound(i);
        this.updateSoundButton(i);
      }
    }

    this.selectSound(0);
  }

  /**
   * Update sound button appearance
   */
  updateSoundButton(index) {
    const button = document.getElementById(`editing-sound-${index}`);
    if (!button) return;

    if (index === this.selectedSoundIndex) {
      button.classList.add("selected");
    } else {
      button.classList.remove("selected");
    }
  }

  /**
   * Select a sound for editing
   */
  selectSound(index) {
    this.selectedSoundIndex = index;

    // Update button states
    const selectedSounds = this.localState.getSelectedSounds();
    for (let i = 0; i < selectedSounds.length; i++) {
      this.updateSoundButton(i);
    }

    // Redraw canvas
    this.drawCanvas();
  }

  /**
   * Handle mouse down on editing canvas
   */
  handleMouseDown(mouseX, mouseY) {
    const events = this.localState.getEvents();
    const currentTime = this.localState.getCurrentTime();

    // Filter events by selected sound
    const filteredEvents = events.filter(
      (e) => e.soundIndex === this.selectedSoundIndex
    );

    // Find event at click position
    const clickedEvent = this.canvas.findEventAtPosition(
      mouseX,
      mouseY,
      filteredEvents,
      currentTime,
      GameConfig.SEGMENT_LENGTH
    );

    if (clickedEvent) {
      return {
        draggedNote: clickedEvent,
      };
    }

    return null;
  }

  /**
   * Handle mouse move (dragging note)
   */
  handleMouseMove(note, startY, startPitch, mouseY) {
    if (!note) return;

    // Calculate pitch change (every 10 pixels = 1 semitone)
    const deltaY = startY - mouseY;
    const semitoneChange = Math.round(deltaY / 10);

    // Clamp pitch to reasonable range (-12 to +12 semitones)
    note.pitchSemitones = Math.max(
      -12,
      Math.min(12, startPitch + semitoneChange)
    );

    // Redraw canvas
    this.drawCanvas();
  }

  /**
   * Handle mouse up (finish dragging)
   */
  handleMouseUp(note) {
    // Nothing special needed, pitch is already updated
  }

  /**
   * Start playback loop
   */
  startPlayback() {
    this.localState.setPlaybackState(
      true,
      0,
      this.audio.getCurrentTime()
    );

    this.audio.startBackingTrack();
    this.startScheduling();
    this.startAnimation();

    this.ui.updateTransportControls(
      "editing-play-pause-btn",
      "editing-progress-bar",
      true,
      0,
      GameConfig.SEGMENT_LENGTH
    );
  }

  /**
   * Start scheduling events
   */
  startScheduling() {
    if (this.scheduleInterval) {
      clearInterval(this.scheduleInterval);
    }

    this.scheduleInterval = setInterval(() => {
      if (this.localState.isPlaying()) {
        this.scheduleEvents();
      }
    }, 50);
  }

  /**
   * Schedule events for playback
   */
  scheduleEvents() {
    if (!this.localState.isPlaying()) return;

    const currentTime = this.audio.getCurrentTime();
    const playbackTime = currentTime - this.localState.getStartTime();
    const events = this.localState.getEvents();
    const selectedSounds = this.localState.getSelectedSounds();

    // Loop back if we reached the end
    if (playbackTime >= GameConfig.SEGMENT_LENGTH) {
      this.restart();
      return;
    }

    // Schedule unscheduled events
    events.forEach((event) => {
      if (!event.scheduled) {
        const eventTime = event.startTimeSec;

        if (
          eventTime >= playbackTime &&
          eventTime <= playbackTime + 0.1 // 100ms lookahead
        ) {
          const scheduleTime = currentTime + (eventTime - playbackTime);
          const sound = selectedSounds[event.soundIndex];

          if (sound) {
            this.audio.playSoundFromUrl(
              sound.audio,
              event.pitchSemitones,
              scheduleTime
            );
          }

          event.scheduled = true;
        }
      }
    });
  }

  /**
   * Start animation loop
   */
  startAnimation() {
    const animate = () => {
      if (this.isActive && this.localState.isPlaying()) {
        this.updateDisplay();
        this.animationFrameId = requestAnimationFrame(animate);
      }
    };
    animate();
  }

  /**
   * Update display
   */
  updateDisplay() {
    const currentTime = this.audio.getCurrentTime();
    const playbackTime = currentTime - this.localState.getStartTime();

    this.localState.setCurrentTime(playbackTime);

    this.ui.updateTransportControls(
      "editing-play-pause-btn",
      "editing-progress-bar",
      true,
      playbackTime,
      GameConfig.SEGMENT_LENGTH
    );

    this.drawCanvas();
  }

  /**
   * Draw canvas
   */
  drawCanvas() {
    const canvas = document.getElementById("editing-timeline-canvas");
    if (!canvas) return;

    const events = this.localState.getEvents();
    const currentTime = this.localState.getCurrentTime();

    // Filter events by selected sound
    const filteredEvents = events.filter(
      (e) => e.soundIndex === this.selectedSoundIndex
    );

    this.canvas.drawEditingTrack(
      canvas,
      filteredEvents,
      currentTime,
      GameConfig.SEGMENT_LENGTH
    );
  }

  /**
   * Toggle playback
   */
  togglePlayback() {
    if (this.localState.isPlaying()) {
      this.pause();
    } else {
      this.play();
    }
  }

  /**
   * Play
   */
  play() {
    const currentTime = this.localState.getCurrentTime();

    this.localState.setPlaybackState(
      true,
      currentTime,
      this.audio.getCurrentTime() - currentTime
    );

    // Reset scheduled flags
    this.localState.getEvents().forEach((e) => (e.scheduled = false));

    this.audio.resumeBackingTrack();
    this.startScheduling();
    this.startAnimation();

    this.ui.updateTransportControls(
      "editing-play-pause-btn",
      "editing-progress-bar",
      true,
      currentTime,
      GameConfig.SEGMENT_LENGTH
    );
  }

  /**
   * Pause
   */
  pause() {
    this.localState.setPlaybackState(false);

    if (this.scheduleInterval) {
      clearInterval(this.scheduleInterval);
      this.scheduleInterval = null;
    }

    this.audio.pauseBackingTrack();

    this.ui.updateTransportControls(
      "editing-play-pause-btn",
      "editing-progress-bar",
      false,
      this.localState.getCurrentTime(),
      GameConfig.SEGMENT_LENGTH
    );
  }

  /**
   * Restart playback
   */
  restart() {
    this.localState.setPlaybackState(
      this.localState.isPlaying(),
      0,
      this.audio.getCurrentTime()
    );

    // Reset scheduled flags
    this.localState.getEvents().forEach((e) => (e.scheduled = false));

    if (this.localState.isPlaying()) {
      this.audio.startBackingTrack();
    }

    this.ui.updateTransportControls(
      "editing-play-pause-btn",
      "editing-progress-bar",
      this.localState.isPlaying(),
      0,
      GameConfig.SEGMENT_LENGTH
    );
  }

  /**
   * Seek to time
   */
  seekTo(time) {
    this.localState.setPlaybackState(
      this.localState.isPlaying(),
      time,
      this.audio.getCurrentTime() - time
    );

    // Reset scheduled flags
    this.localState.getEvents().forEach((e) => (e.scheduled = false));

    this.audio.seekBackingTrack(time);

    this.ui.updateTransportControls(
      "editing-play-pause-btn",
      "editing-progress-bar",
      this.localState.isPlaying(),
      time,
      GameConfig.SEGMENT_LENGTH
    );

    this.drawCanvas();
  }

  /**
   * Start countdown
   */
  startCountdown() {
    this.updateCountdownDisplay();

    this.countdownInterval = setInterval(() => {
      this.timeRemaining--;

      if (this.timeRemaining <= 0) {
        this.handleTimeExpired();
      } else {
        this.updateCountdownDisplay();
      }
    }, 1000);
  }

  /**
   * Update countdown display
   */
  updateCountdownDisplay() {
    const element = document.getElementById("editing-countdown");
    if (element) {
      const minutes = Math.floor(this.timeRemaining / 60);
      const seconds = this.timeRemaining % 60;
      element.textContent = `Time: ${minutes}:${seconds.toString().padStart(2, "0")}`;
    }
  }

  /**
   * Handle time expired
   */
  handleTimeExpired() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }

    this.handleContinue();
  }

  /**
   * Handle continue button
   */
  handleContinue() {
    const currentRound = this.serverState.getCurrentRound();

    // Stop playback
    this.pause();
    this.audio.stopBackingTrack();

    // Submit work to server
    const submission = this.localState.toSubmission();
    this.network.submitWork(submission, currentRound);

    // Update server - move to waiting phase
    this.network.updatePhase(PhaseType.WAITING, currentRound);

    // Complete phase
    this.complete();
  }
}
