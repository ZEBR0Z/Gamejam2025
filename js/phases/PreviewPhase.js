import { BasePhase } from "./BasePhase.js";
import { PhaseType, GameConfig } from "../Constants.js";
import { SoundEvent } from "../models/SoundEvent.js";

/**
 * PreviewPhase - Preview assigned player's previous work
 * Shows the song segment that the player will build upon
 */
export class PreviewPhase extends BasePhase {
  constructor(services) {
    super(services);

    this.previewEvents = [];
    this.scheduleInterval = null;
    this.animationFrameId = null;
    this.timeRemaining = 20; // 20 seconds preview time
    this.countdownInterval = null;
  }

  async enter(onComplete, onSecondary = null) {
    await super.enter(onComplete, onSecondary);

    // Show preview screen
    this.ui.showScreen("preview");

    // Load previous player's work
    await this.loadPreviousWork();

    // Set up transport controls
    this.input.setupTransportEvents({
      "preview-play-pause-btn": () => this.togglePlayback(),
      "preview-restart-btn": () => this.restart(),
      "preview-progress-bar": (value) => this.seekTo(value),
    });

    // Set up continue button
    this.input.setupButtonEvents({
      "continue-to-performance-btn": () => this.handleContinue(),
    });

    // Start playback automatically
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

    // Stop audio
    this.audio.stopBackingTrack();

    super.exit();
  }

  /**
   * Load previous player's work
   */
  async loadPreviousWork() {
    const currentRound = this.serverState.getCurrentRound();
    const localPlayerId = this.serverState.getLocalPlayerId();

    // Round 1 has no previous work (shouldn't reach here)
    if (currentRound < 2) {
      console.warn("PreviewPhase called in round 1");
      return;
    }

    // Get assignment for current round
    const assignment = this.serverState.getAssignment(localPlayerId, currentRound);

    if (!assignment) {
      console.warn("No assignment found for round", currentRound);
      return;
    }

    // Get that player's previous submission
    const submission = this.serverState.getSubmission(
      assignment,
      currentRound - 1
    );

    if (!submission) {
      console.warn("No submission found for assigned player", assignment);
      return;
    }

    // Load backing track
    if (submission.backingTrack) {
      this.localState.setBackingTrack(submission.backingTrack);
      await this.audio.loadBackingTrack(submission.backingTrack.audio);
    }

    // Convert submission to events for preview
    this.previewEvents = [];
    if (submission.songData) {
      submission.songData.forEach((eventData) => {
        this.previewEvents.push(
          new SoundEvent(
            null,
            0, // soundIndex (not relevant for preview)
            eventData.time,
            eventData.pitch || 0
          )
        );
      });
    }

    // Update UI with player name
    const assignedPlayer = this.serverState
      .getPlayers()
      .find((p) => p.id === assignment);
    const playerName = assignedPlayer ? assignedPlayer.name : "Unknown";

    this.ui.updatePreviewInfo(playerName, currentRound);
  }

  /**
   * Start playback
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
      "preview-play-pause-btn",
      "preview-progress-bar",
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
    if (!this.localState.isPlaying() || this.previewEvents.length === 0) {
      return;
    }

    const currentTime = this.audio.getCurrentTime();
    const playbackTime = currentTime - this.localState.getStartTime();

    // Loop back if we reached the end
    if (playbackTime >= GameConfig.SEGMENT_LENGTH) {
      this.restart();
      return;
    }

    // Schedule unscheduled events
    this.previewEvents.forEach((event) => {
      if (!event.scheduled) {
        const eventTime = event.startTimeSec;

        if (
          eventTime >= playbackTime &&
          eventTime <= playbackTime + 0.1 // 100ms lookahead
        ) {
          const scheduleTime = currentTime + (eventTime - playbackTime);
          // Note: In preview, we don't have actual audio URLs for events
          // This would need to be handled differently in the actual implementation
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
      "preview-play-pause-btn",
      "preview-progress-bar",
      true,
      playbackTime,
      GameConfig.SEGMENT_LENGTH
    );

    // Draw canvas
    const canvas = document.getElementById("preview-canvas");
    if (canvas) {
      this.canvas.drawFinalView(
        canvas,
        this.previewEvents,
        playbackTime,
        GameConfig.SEGMENT_LENGTH
      );
    }
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
    this.previewEvents.forEach((e) => (e.scheduled = false));

    this.audio.resumeBackingTrack();
    this.startScheduling();
    this.startAnimation();

    this.ui.updateTransportControls(
      "preview-play-pause-btn",
      "preview-progress-bar",
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
      "preview-play-pause-btn",
      "preview-progress-bar",
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
    this.previewEvents.forEach((e) => (e.scheduled = false));

    if (this.localState.isPlaying()) {
      this.audio.startBackingTrack();
    }

    this.ui.updateTransportControls(
      "preview-play-pause-btn",
      "preview-progress-bar",
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
    this.previewEvents.forEach((e) => (e.scheduled = false));

    this.audio.seekBackingTrack(time);

    this.ui.updateTransportControls(
      "preview-play-pause-btn",
      "preview-progress-bar",
      this.localState.isPlaying(),
      time,
      GameConfig.SEGMENT_LENGTH
    );

    // Update canvas
    const canvas = document.getElementById("preview-canvas");
    if (canvas) {
      this.canvas.drawFinalView(
        canvas,
        this.previewEvents,
        time,
        GameConfig.SEGMENT_LENGTH
      );
    }
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
    const element = document.getElementById("preview-countdown");
    if (element) {
      element.textContent = `Time: ${this.timeRemaining}s`;
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

    // Update server - move to sound replacement phase
    this.network.updatePhase(PhaseType.SOUND_REPLACEMENT, currentRound);

    // Complete phase
    this.complete();
  }
}
