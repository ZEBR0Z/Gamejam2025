import { BasePhase } from "./BasePhase.js";
import { PhaseType, GameConfig } from "../Constants.js";
import { SoundEvent } from "../models/SoundEvent.js";

/**
 * PerformancePhase - Record new segment using keys 1, 2, 3
 * Players add sounds to timeline during playback loop
 */
export class PerformancePhase extends BasePhase {
  constructor(services) {
    super(services);

    this.scheduleInterval = null;
    this.animationFrameId = null;
    this.timeRemaining = GameConfig.PERFORMANCE_TIME;
    this.countdownInterval = null;
    this.keyHandlers = {};
  }

  async enter(onComplete, onSecondary = null) {
    await super.enter(onComplete, onSecondary);

    // Show performance screen
    this.ui.showScreen("performance");

    // Load backing track
    await this.loadBackingTrack();

    // Clear events (fresh start)
    this.localState.clearEvents();

    // Update sound icons
    this.ui.updateSoundIcons(this.localState.getSelectedSounds());

    // Set up key handlers for sounds 1, 2, 3
    this.setupKeyHandlers();

    // Set up transport controls
    this.input.setupTransportEvents({
      "play-pause-btn": () => this.togglePlayback(),
      "restart-btn": () => this.restart(),
      "progress-bar": (value) => this.seekTo(value),
    });

    // Set up canvas for right-click deletion
    const canvas = document.getElementById("timeline-canvas");
    if (canvas) {
      this.input.setupCanvasEvents(canvas, "timeline", null, {
        onRightClick: (mouseX, mouseY) => this.handleTimelineRightClick(mouseX, mouseY),
      });
    }

    // Set up continue button
    this.input.setupButtonEvents({
      "performance-continue-btn": () => this.handleContinue(),
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

    // Clean up key handlers
    this.cleanupKeyHandlers();

    // Clean up input handlers
    this.input.cleanupTransportEvents();
    this.input.cleanupButtonEvents();
    this.input.cleanupCanvasEvents(
      document.getElementById("timeline-canvas")
    );

    // Stop audio
    this.audio.stopBackingTrack();

    super.exit();
  }

  /**
   * Load backing track
   */
  async loadBackingTrack() {
    const currentRound = this.localState.getCurrentRound();
    const localPlayerId = this.serverState.getLocalPlayerId();

    let backingTrack = null;

    if (currentRound === 1) {
      // Round 1: Random backing track
      const backingTracks = this.localState.getBackingTracks();
      if (backingTracks && backingTracks.length > 0) {
        const randomIndex = Math.floor(Math.random() * backingTracks.length);
        backingTrack = backingTracks[randomIndex];
      }
    } else {
      // Round 2+: Use backing track from assigned player's round 1
      const assignment = this.serverState.getAssignment(
        localPlayerId,
        currentRound
      );

      if (assignment) {
        const firstSubmission = this.serverState.getSubmission(assignment, 1);
        if (firstSubmission && firstSubmission.backingTrack) {
          backingTrack = firstSubmission.backingTrack;
        }
      }
    }

    if (backingTrack) {
      this.localState.setBackingTrack(backingTrack);
      await this.audio.loadBackingTrack(backingTrack.audio);
    }
  }

  /**
   * Set up key handlers for sounds
   */
  setupKeyHandlers() {
    const handleKeyDown = (e) => {
      if (e.key >= "1" && e.key <= "3") {
        const soundIndex = parseInt(e.key) - 1;
        e.preventDefault();
        this.ui.showKeyPress(soundIndex);
        this.handleKeyPress(soundIndex);
      }
    };

    const handleKeyUp = (e) => {
      if (e.key >= "1" && e.key <= "3") {
        const soundIndex = parseInt(e.key) - 1;
        this.ui.hideKeyPress(soundIndex);
      }
    };

    this.keyHandlers.keydown = handleKeyDown;
    this.keyHandlers.keyup = handleKeyUp;
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);
  }

  /**
   * Clean up key handlers
   */
  cleanupKeyHandlers() {
    if (this.keyHandlers.keydown) {
      document.removeEventListener("keydown", this.keyHandlers.keydown);
    }
    if (this.keyHandlers.keyup) {
      document.removeEventListener("keyup", this.keyHandlers.keyup);
    }
    this.keyHandlers = {};
  }

  /**
   * Handle key press to add sound
   */
  handleKeyPress(soundIndex) {
    if (!this.localState.isPlaying()) return;

    const currentTime = this.localState.getCurrentTime();
    const selectedSounds = this.localState.getSelectedSounds();

    if (soundIndex < 0 || soundIndex >= selectedSounds.length) return;

    // Add event at current time
    const event = this.localState.addEvent(soundIndex, currentTime, 0);

    // Play the sound immediately
    const sound = selectedSounds[soundIndex];
    this.audio.playSoundFromUrl(sound.audio, 0, this.audio.getCurrentTime());
  }

  /**
   * Handle timeline right-click to delete event
   */
  handleTimelineRightClick(mouseX, mouseY) {
    const events = this.localState.getEvents();
    const currentTime = this.localState.getCurrentTime();
    const canvas = document.getElementById("timeline-canvas");

    // Find event at click position
    const clickedEvent = this.canvas.getEventAtPosition(
      events,
      mouseX,
      mouseY,
      canvas,
      this.localState.getSegmentLength(),
      null,
      currentTime
    );

    if (clickedEvent) {
      this.localState.removeEvent(clickedEvent.id);
      // Immediately redraw to show deletion
      this.canvas.drawTimeline(
        canvas,
        this.localState.getEvents(),
        currentTime,
        this.localState.getSegmentLength(),
        this.localState.getSelectedSounds()
      );
    }
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
      "performance",
      true,
      0,
      this.localState.getSegmentLength()
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
    if (playbackTime >= this.localState.getSegmentLength()) {
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
      if (this.isActive) {
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
    let playbackTime;

    if (this.localState.isPlaying()) {
      const currentTime = this.audio.getCurrentTime();
      playbackTime = currentTime - this.localState.getStartTime();
      this.localState.setCurrentTime(playbackTime);
    } else {
      playbackTime = this.localState.getCurrentTime();
    }

    this.ui.updateTransportControls(
      "performance",
      this.localState.isPlaying(),
      playbackTime,
      this.localState.getSegmentLength()
    );

    // Draw canvas
    const canvas = document.getElementById("timeline-canvas");
    if (canvas) {
      this.canvas.drawTimeline(
        canvas,
        this.localState.getEvents(),
        playbackTime,
        this.localState.getSegmentLength(),
        this.localState.getSelectedSounds()
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
    this.localState.getEvents().forEach((e) => (e.scheduled = false));

    this.audio.resumeBackingTrack();
    this.startScheduling();
    this.startAnimation();

    this.ui.updateTransportControls(
      "performance",
      true,
      currentTime,
      this.localState.getSegmentLength()
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
      "performance",
      false,
      this.localState.getCurrentTime(),
      this.localState.getSegmentLength()
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
      "performance",
      this.localState.isPlaying(),
      0,
      this.localState.getSegmentLength()
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
      "performance",
      this.localState.isPlaying(),
      time,
      this.localState.getSegmentLength()
    );

    // Update canvas
    const canvas = document.getElementById("timeline-canvas");
    if (canvas) {
      this.canvas.drawTimeline(
        canvas,
        this.localState.getEvents(),
        time,
        this.localState.getSegmentLength(),
        this.localState.getSelectedSounds()
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
    const element = document.getElementById("performance-countdown");
    if (element) {
      const minutes = Math.floor(this.timeRemaining / 60);
      const seconds = this.timeRemaining % 60;
      element.textContent = `${minutes}:${seconds.toString().padStart(2, "0")}`;
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

    // Update server - move to editing phase
    this.network.updatePhase(PhaseType.EDITING, currentRound);

    // Complete phase
    this.complete();
  }
}
