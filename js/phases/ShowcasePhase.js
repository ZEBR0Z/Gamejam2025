import { BasePhase } from "./BasePhase.js";
import { GameConfig } from "../Constants.js";

/**
 * ShowcasePhase - Display all completed collaborative songs
 * Shows final songs with all rounds combined
 */
export class ShowcasePhase extends BasePhase {
  constructor(services) {
    super(services);

    this.scheduleInterval = null;
    this.animationFrameId = null;
    this.finalSongs = [];
    this.currentSongIndex = 0;
    this.currentSongEvents = [];
    this.isForcedShowcase = true;
    this.hasPlayedAllSongs = false;
  }

  async enter(onComplete, onSecondary = null) {
    await super.enter(onComplete, onSecondary);

    // Show showcase screen
    this.ui.showScreen("showcase");

    // Load final songs from server state
    this.loadFinalSongs();

    // Set up transport controls (disabled in forced showcase mode)
    this.input.setupTransportEvents({
      "showcase-play-pause-btn": () =>
        !this.isForcedShowcase && this.togglePlayback(),
      "showcase-restart-btn": () => !this.isForcedShowcase && this.restart(),
      "showcase-progress-bar": (value) =>
        !this.isForcedShowcase && this.seekTo(value),
    });

    // Set up navigation buttons
    this.input.setupButtonEvents({
      "prev-song-btn": () => !this.isForcedShowcase && this.previousSong(),
      "next-song-btn": () => !this.isForcedShowcase && this.nextSong(),
      "showcase-exit-btn": () => this.handleExit(),
    });

    // Show first song
    if (this.finalSongs.length > 0) {
      this.showSong(0);
    }
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

    // Clean up input handlers
    this.input.cleanupTransportEvents();
    this.input.cleanupButtonEvents();

    // Stop audio
    this.audio.stopBackingTrack();

    super.exit();
  }

  /**
   * Load final songs from server state
   */
  loadFinalSongs() {
    const players = this.serverState.getPlayers();
    const maxRounds = this.serverState.getMaxRounds();

    this.finalSongs = players.map((originalPlayer) => {
      // Build the song by following who worked on it each round
      const submissions = [];
      const contributors = [originalPlayer.name];

      // Round 1: Original player's submission
      const round1Submission = this.serverState.getSubmission(originalPlayer.id, 1);
      if (round1Submission) {
        submissions.push(round1Submission);
      }

      // Round 2+: Find who was assigned to work on this song
      for (let round = 2; round <= maxRounds; round++) {
        let foundSubmission = false;

        for (const player of players) {
          const assignment = this.serverState.getAssignment(player.id, round);
          if (assignment === originalPlayer.id) {
            const submission = this.serverState.getSubmission(player.id, round);
            if (submission) {
              submissions.push(submission);
              if (!contributors.includes(player.name)) {
                contributors.push(player.name);
              }
              foundSubmission = true;
              break;
            }
          }
        }
      }

      return {
        id: `song_${originalPlayer.id}`,
        originalCreator: originalPlayer.name,
        segments: submissions,
        contributors: contributors,
        backingTrack: submissions[0]?.backingTrack || null,
      };
    });
  }

  /**
   * Show a specific song
   */
  async showSong(songIndex) {
    if (songIndex < 0 || songIndex >= this.finalSongs.length) return;

    this.currentSongIndex = songIndex;
    const song = this.finalSongs[songIndex];

    // Convert song to events
    await this.convertSongToEvents(song);

    // Update UI
    this.ui.updateShowcaseScreen(
      songIndex,
      this.finalSongs.length,
      song.contributors,
      this.isForcedShowcase
    );

    // Load backing track
    if (song.backingTrack) {
      await this.audio.loadBackingTrack(song.backingTrack.path);
    }

    // Start playback in forced showcase mode, or reset to beginning in manual mode
    if (this.isForcedShowcase) {
      this.startPlayback();
    } else {
      this.localState.setPlaybackState(false, 0, 0);
      this.resetScheduledFlags(0);
      this.ui.updateTransportControls("showcase", false, 0, this.getTotalTime());
    }
  }

  /**
   * Convert song segments to playable events
   */
  async convertSongToEvents(song) {
    this.currentSongEvents = [];

    if (!song.segments || song.segments.length === 0) return;

    const segmentLength = song.backingTrack.duration;

    song.segments.forEach((submission, segmentIndex) => {
      if (!submission.events) return;

      submission.events.forEach((eventData) => {
        // Get sound info from selectedSounds
        const sound = submission.selectedSounds[eventData.soundIndex];

        this.currentSongEvents.push({
          id: `${segmentIndex}_${eventData.startTimeSec}`,
          soundIndex: eventData.soundIndex,
          startTimeSec: segmentIndex * segmentLength + eventData.startTimeSec,
          pitchSemitones: eventData.pitchSemitones,
          scheduled: false,
          audio: sound.path,
          icon: sound.icon_path,
        });
      });
    });
  }

  /**
   * Start playback from beginning
   */
  startPlayback() {
    this.localState.setPlaybackState(true, 0, this.audio.getCurrentTime());
    this.audio.startBackingTrack();
    this.startScheduling();
    this.startAnimation();
    this.ui.updateTransportControls("showcase", true, 0, this.getTotalTime());
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

    // Check if song finished
    if (playbackTime >= this.getTotalTime()) {
      this.handleSongFinished();
      return;
    }

    // Schedule unscheduled events
    this.currentSongEvents.forEach((event) => {
      if (!event.scheduled) {
        const eventTime = event.startTimeSec;

        if (
          eventTime >= playbackTime &&
          eventTime <= playbackTime + 0.1 // 100ms lookahead
        ) {
          const scheduleTime = currentTime + (eventTime - playbackTime);

          if (event.audio) {
            this.audio.playSoundFromUrl(
              event.audio,
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
    const totalTime = this.getTotalTime();

    this.localState.setCurrentTime(playbackTime);
    this.ui.updateTransportControls("showcase", true, playbackTime, totalTime);

    const canvas = document.getElementById("showcase-canvas");
    if (canvas) {
      this.canvas.drawFinalView(canvas, this.currentSongEvents, playbackTime, totalTime);
    }
  }

  /**
   * Handle song finished
   */
  async handleSongFinished() {
    // Stop playback
    this.pause();
    this.audio.stopBackingTrack();

    if (this.isForcedShowcase) {
      // Move to next song
      if (this.currentSongIndex < this.finalSongs.length - 1) {
        this.showSong(this.currentSongIndex + 1);
      } else {
        // All songs played
        this.hasPlayedAllSongs = true;
        this.isForcedShowcase = false;
        this.showSong(0); // Show first song in manual mode
      }
    } else {
      // In manual mode, stop at end and reset to beginning
      const song = this.finalSongs[this.currentSongIndex];
      if (song.backingTrack) {
        await this.audio.loadBackingTrack(song.backingTrack.path);
      }
      this.localState.setPlaybackState(false, 0, 0);
      this.resetScheduledFlags(0);
      this.ui.updateTransportControls("showcase", false, 0, this.getTotalTime());
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
   * Get total time for current song
   */
  getTotalTime() {
    const song = this.finalSongs[this.currentSongIndex];
    return song.segments.length * song.backingTrack.duration;
  }

  /**
   * Reset event scheduled flags from a given time onwards
   */
  resetScheduledFlags(fromTime = 0) {
    this.currentSongEvents.forEach((e) => {
      if (e.startTimeSec >= fromTime) {
        e.scheduled = false;
      }
    });
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

    this.resetScheduledFlags(currentTime);

    if (currentTime === 0) {
      this.audio.startBackingTrack();
    } else {
      this.audio.resumeBackingTrack();
    }

    this.startScheduling();
    this.startAnimation();

    this.ui.updateTransportControls("showcase", true, currentTime, this.getTotalTime());
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
    this.ui.updateTransportControls("showcase", false, this.localState.getCurrentTime(), this.getTotalTime());
  }

  /**
   * Restart playback from beginning
   */
  restart() {
    const wasPlaying = this.localState.isPlaying();
    this.pause();
    this.localState.setCurrentTime(0);
    this.resetScheduledFlags(0);

    if (wasPlaying) {
      this.play();
    } else {
      this.ui.updateTransportControls("showcase", false, 0, this.getTotalTime());
      // Update canvas immediately
      const canvas = document.getElementById("showcase-canvas");
      if (canvas) {
        this.canvas.drawFinalView(canvas, this.currentSongEvents, 0, this.getTotalTime());
      }
    }
  }

  /**
   * Seek to time
   */
  seekTo(time) {
    const song = this.finalSongs[this.currentSongIndex];

    this.localState.setPlaybackState(
      this.localState.isPlaying(),
      time,
      this.audio.getCurrentTime() - time
    );

    this.resetScheduledFlags(time);
    this.audio.seekBackingTrack(time % song.backingTrack.duration);
    this.ui.updateTransportControls("showcase", this.localState.isPlaying(), time, this.getTotalTime());

    // Update canvas immediately
    const canvas = document.getElementById("showcase-canvas");
    if (canvas) {
      this.canvas.drawFinalView(canvas, this.currentSongEvents, time, this.getTotalTime());
    }
  }

  /**
   * Previous song
   */
  async previousSong() {
    if (this.currentSongIndex > 0) {
      this.pause();
      this.audio.stopBackingTrack();
      await this.showSong(this.currentSongIndex - 1);
      this.localState.setPlaybackState(false, 0, 0);
      this.startPlayback();
    }
  }

  /**
   * Next song
   */
  async nextSong() {
    if (this.currentSongIndex < this.finalSongs.length - 1) {
      this.pause();
      this.audio.stopBackingTrack();
      await this.showSong(this.currentSongIndex + 1);
      this.localState.setPlaybackState(false, 0, 0);
      this.startPlayback();
    }
  }

  /**
   * Handle exit button
   */
  handleExit() {
    this.pause();
    this.audio.stopBackingTrack();
    this.network.disconnect();
    this.triggerSecondary(); // Go back to main menu
  }

  /**
   * Handle restart button (new game)
   */
  handleRestart() {
    this.pause();
    this.audio.stopBackingTrack();
    this.network.disconnect();
    this.triggerSecondary(); // Go back to main menu
  }
}
