import { BasePhase } from "./BasePhase.js";
import { PhaseType, GameConfig } from "../Constants.js";

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
    this.timeRemaining = 20;
    this.countdownInterval = null;
    this.segmentLength = GameConfig.DEFAULT_SEGMENT_LENGTH;
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
    const currentRound = this.localState.getCurrentRound();
    const localPlayerId = this.serverState.getLocalPlayerId();

    // Round 1 has no previous work (shouldn't reach here)
    if (currentRound < 2) {
      return;
    }

    // Get assignment for current round
    const assignment = this.serverState.getAssignment(
      localPlayerId,
      currentRound,
    );
    if (!assignment) {
      return;
    }

    // Get that player's previous submission
    const submission = this.serverState.getSubmission(
      assignment,
      currentRound - 1,
    );
    if (!submission) {
      return;
    }

    // Load backing track
    if (submission.backingTrack) {
      this.localState.setBackingTrack(submission.backingTrack);
      await this.audio.loadBackingTrack(submission.backingTrack.path);
      this.segmentLength = submission.backingTrack.duration;
    }

    // Convert submission to preview events
    this.previewEvents = [];
    if (submission.events && submission.selectedSounds) {
      submission.events.forEach((event) => {
        const sound = submission.selectedSounds[event.soundIndex];
        this.previewEvents.push({
          path: sound.path,
          icon_path: sound.icon_path,
          soundIndex: event.soundIndex,
          startTimeSec: event.startTimeSec,
          pitchSemitones: event.pitchSemitones,
          scheduled: false,
        });
      });
    }

    // Update UI with player name
    const assignedPlayer = this.serverState
      .getPlayers()
      .find((p) => p.id === assignment);
    const playerName = assignedPlayer ? assignedPlayer.name : "Unknown";

    const playerNameEl = document.getElementById("previous-player-name");
    if (playerNameEl) {
      playerNameEl.textContent = playerName;
    }

    const currentRoundEl = document.getElementById("preview-current-round");
    if (currentRoundEl) {
      currentRoundEl.textContent = currentRound;
    }

    const totalRoundsEl = document.getElementById("preview-total-rounds");
    if (totalRoundsEl) {
      totalRoundsEl.textContent = this.serverState.getTotalRounds();
    }
  }

  /**
   * Start playback
   */
  startPlayback() {
    const currentTime = this.audio.getCurrentTime();

    this.localState.setPlaybackState(true, 0, currentTime);

    this.audio.startBackingTrack();
    this.startScheduling();
    this.startAnimation();

    this.ui.updateTransportControls("preview", true, 0, this.segmentLength);
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
    if (playbackTime >= this.segmentLength) {
      this.restart();
      return;
    }

    // Schedule unscheduled events
    this.previewEvents.forEach((event) => {
      if (!event.scheduled) {
        const eventTime = event.startTimeSec;

        if (eventTime >= playbackTime && eventTime <= playbackTime + 0.1) {
          const scheduleTime = currentTime + (eventTime - playbackTime);
          this.audio.playSoundFromUrl(
            event.path,
            event.pitchSemitones,
            scheduleTime,
          );
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
      "preview",
      true,
      playbackTime,
      this.segmentLength,
    );

    // Draw canvas
    const canvas = document.getElementById("preview-canvas");
    if (canvas) {
      this.canvas.drawFinalView(
        canvas,
        this.previewEvents,
        playbackTime,
        this.segmentLength,
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
      this.audio.getCurrentTime() - currentTime,
    );

    // Reset scheduled flags
    this.previewEvents.forEach((e) => (e.scheduled = false));

    this.audio.resumeBackingTrack();
    this.startScheduling();
    this.startAnimation();

    this.ui.updateTransportControls(
      "preview",
      true,
      currentTime,
      this.segmentLength,
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
      "preview",
      false,
      this.localState.getCurrentTime(),
      this.segmentLength,
    );
  }

  /**
   * Restart playback
   */
  restart() {
    this.localState.setPlaybackState(
      this.localState.isPlaying(),
      0,
      this.audio.getCurrentTime(),
    );

    // Reset scheduled flags
    this.previewEvents.forEach((e) => (e.scheduled = false));

    if (this.localState.isPlaying()) {
      this.audio.startBackingTrack();
    }

    this.ui.updateTransportControls(
      "preview",
      this.localState.isPlaying(),
      0,
      this.segmentLength,
    );

    // Update canvas immediately
    const canvas = document.getElementById("preview-canvas");
    if (canvas) {
      this.canvas.drawFinalView(
        canvas,
        this.previewEvents,
        0,
        this.segmentLength,
      );
    }
  }

  /**
   * Seek to time
   */
  seekTo(time) {
    this.localState.setPlaybackState(
      this.localState.isPlaying(),
      time,
      this.audio.getCurrentTime() - time,
    );

    // Reset scheduled flags
    this.previewEvents.forEach((e) => (e.scheduled = false));

    this.audio.seekBackingTrack(time);

    this.ui.updateTransportControls(
      "preview",
      this.localState.isPlaying(),
      time,
      this.segmentLength,
    );

    // Update canvas
    const canvas = document.getElementById("preview-canvas");
    if (canvas) {
      this.canvas.drawFinalView(
        canvas,
        this.previewEvents,
        time,
        this.segmentLength,
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
    const element = document.getElementById("preview-phase-timer");
    if (element) {
      element.textContent = this.timeRemaining;
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
    const currentRound = this.localState.getCurrentRound();

    // Stop playback
    this.pause();
    this.audio.stopBackingTrack();

    // Update server - move to sound replacement phase
    this.network.updatePhase(PhaseType.SOUND_REPLACEMENT, currentRound);

    // Complete phase
    this.complete();
  }
}
