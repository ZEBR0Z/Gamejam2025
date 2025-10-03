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
    this.isSequentialMode = true;
    this.hasPlayedAllSongs = false;
  }

  async enter(onComplete, onSecondary = null) {
    await super.enter(onComplete, onSecondary);

    // Show showcase screen
    this.ui.showScreen("showcase");

    // Load final songs from server state
    this.loadFinalSongs();

    // Set up transport controls (disabled in sequential mode)
    this.input.setupTransportEvents({
      "showcase-play-pause-btn": () =>
        !this.isSequentialMode && this.togglePlayback(),
      "showcase-restart-btn": () => !this.isSequentialMode && this.restart(),
      "showcase-progress-bar": (value) =>
        !this.isSequentialMode && this.seekTo(value),
    });

    // Set up navigation buttons
    this.input.setupButtonEvents({
      "prev-song-btn": () => !this.isSequentialMode && this.previousSong(),
      "next-song-btn": () => !this.isSequentialMode && this.nextSong(),
      "showcase-exit-btn": () => this.handleExit(),
      "showcase-restart-btn": () => this.handleRestart(),
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

    this.finalSongs = players.map((player) => {
      // Get all submissions for this player
      const submissions = [];
      for (let round = 1; round <= maxRounds; round++) {
        const submission = this.serverState.getSubmission(player.id, round);
        if (submission) {
          submissions.push(submission);
        }
      }

      // Get contributors for this song (who worked on it)
      const contributors = this.getContributors(player.id, maxRounds);

      return {
        id: `song_${player.id}`,
        originalCreator: player.name,
        segments: submissions,
        contributors: contributors,
        backingTrack: submissions[0]?.backingTrack || null,
      };
    });
  }

  /**
   * Get list of contributors for a song
   */
  getContributors(originalCreatorId, maxRounds) {
    const contributors = [originalCreatorId];

    // For each round, find who worked on this song
    for (let round = 2; round <= maxRounds; round++) {
      const players = this.serverState.getPlayers();

      for (const player of players) {
        const assignment = this.serverState.getAssignment(player.id, round);

        // Check if this player was assigned to work on the original creator's song
        if (assignment === originalCreatorId && !contributors.includes(player.id)) {
          contributors.push(player.id);
        }
      }
    }

    // Convert IDs to names
    return contributors.map((id) => {
      const player = this.serverState.getPlayers().find((p) => p.id === id);
      return player ? player.name : "Unknown";
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
      this.isSequentialMode
    );

    // Load backing track
    if (song.backingTrack) {
      await this.audio.loadBackingTrack(song.backingTrack.audio);
    }

    // Start playback in sequential mode
    if (this.isSequentialMode) {
      this.startPlayback();
    }
  }

  /**
   * Convert song segments to playable events
   */
  async convertSongToEvents(song) {
    this.currentSongEvents = [];

    if (!song.segments || song.segments.length === 0) return;

    const segmentLength = GameConfig.SEGMENT_LENGTH;

    song.segments.forEach((submission, segmentIndex) => {
      if (!submission.songData) return;

      submission.songData.forEach((eventData) => {
        this.currentSongEvents.push({
          id: `${segmentIndex}_${eventData.time}`,
          soundIndex: 0,
          startTimeSec: segmentIndex * segmentLength + eventData.time,
          pitchSemitones: eventData.pitch || 0,
          scheduled: false,
          audio: eventData.audio,
          icon: eventData.icon,
        });
      });
    });
  }

  /**
   * Start playback
   */
  startPlayback() {
    const song = this.finalSongs[this.currentSongIndex];
    const totalTime = song.segments.length * GameConfig.SEGMENT_LENGTH;

    this.localState.setPlaybackState(
      true,
      0,
      this.audio.getCurrentTime()
    );

    this.audio.startBackingTrack();
    this.startScheduling();
    this.startAnimation();

    this.ui.updateTransportControls(
      "showcase-play-pause-btn",
      "showcase-progress-bar",
      true,
      0,
      totalTime
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
    const song = this.finalSongs[this.currentSongIndex];
    const totalTime = song.segments.length * GameConfig.SEGMENT_LENGTH;

    // Check if song finished
    if (playbackTime >= totalTime) {
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
    const song = this.finalSongs[this.currentSongIndex];
    const totalTime = song.segments.length * GameConfig.SEGMENT_LENGTH;

    this.localState.setCurrentTime(playbackTime);

    this.ui.updateTransportControls(
      "showcase-play-pause-btn",
      "showcase-progress-bar",
      true,
      playbackTime,
      totalTime
    );

    // Draw canvas
    const canvas = document.getElementById("showcase-canvas");
    if (canvas) {
      this.canvas.drawFinalView(
        canvas,
        this.currentSongEvents,
        playbackTime,
        totalTime
      );
    }
  }

  /**
   * Handle song finished
   */
  handleSongFinished() {
    // Stop playback
    this.pause();
    this.audio.stopBackingTrack();

    if (this.isSequentialMode) {
      // Move to next song
      if (this.currentSongIndex < this.finalSongs.length - 1) {
        this.showSong(this.currentSongIndex + 1);
      } else {
        // All songs played
        this.hasPlayedAllSongs = true;
        this.isSequentialMode = false;
        this.showSong(0); // Show first song in manual mode
      }
    } else {
      // In manual mode, just stop
      this.restart();
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
    const song = this.finalSongs[this.currentSongIndex];
    const totalTime = song.segments.length * GameConfig.SEGMENT_LENGTH;

    this.localState.setPlaybackState(
      true,
      currentTime,
      this.audio.getCurrentTime() - currentTime
    );

    // Reset scheduled flags
    this.currentSongEvents.forEach((e) => (e.scheduled = false));

    this.audio.resumeBackingTrack();
    this.startScheduling();
    this.startAnimation();

    this.ui.updateTransportControls(
      "showcase-play-pause-btn",
      "showcase-progress-bar",
      true,
      currentTime,
      totalTime
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

    const song = this.finalSongs[this.currentSongIndex];
    const totalTime = song.segments.length * GameConfig.SEGMENT_LENGTH;

    this.ui.updateTransportControls(
      "showcase-play-pause-btn",
      "showcase-progress-bar",
      false,
      this.localState.getCurrentTime(),
      totalTime
    );
  }

  /**
   * Restart playback
   */
  restart() {
    const song = this.finalSongs[this.currentSongIndex];
    const totalTime = song.segments.length * GameConfig.SEGMENT_LENGTH;

    this.localState.setPlaybackState(
      this.localState.isPlaying(),
      0,
      this.audio.getCurrentTime()
    );

    // Reset scheduled flags
    this.currentSongEvents.forEach((e) => (e.scheduled = false));

    if (this.localState.isPlaying()) {
      this.audio.startBackingTrack();
    }

    this.ui.updateTransportControls(
      "showcase-play-pause-btn",
      "showcase-progress-bar",
      this.localState.isPlaying(),
      0,
      totalTime
    );
  }

  /**
   * Seek to time
   */
  seekTo(time) {
    const song = this.finalSongs[this.currentSongIndex];
    const totalTime = song.segments.length * GameConfig.SEGMENT_LENGTH;

    this.localState.setPlaybackState(
      this.localState.isPlaying(),
      time,
      this.audio.getCurrentTime() - time
    );

    // Reset scheduled flags
    this.currentSongEvents.forEach((e) => (e.scheduled = false));

    this.audio.seekBackingTrack(time % GameConfig.SEGMENT_LENGTH);

    this.ui.updateTransportControls(
      "showcase-play-pause-btn",
      "showcase-progress-bar",
      this.localState.isPlaying(),
      time,
      totalTime
    );

    // Update canvas
    const canvas = document.getElementById("showcase-canvas");
    if (canvas) {
      this.canvas.drawFinalView(
        canvas,
        this.currentSongEvents,
        time,
        totalTime
      );
    }
  }

  /**
   * Previous song
   */
  previousSong() {
    if (this.currentSongIndex > 0) {
      this.pause();
      this.audio.stopBackingTrack();
      this.showSong(this.currentSongIndex - 1);
    }
  }

  /**
   * Next song
   */
  nextSong() {
    if (this.currentSongIndex < this.finalSongs.length - 1) {
      this.pause();
      this.audio.stopBackingTrack();
      this.showSong(this.currentSongIndex + 1);
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
