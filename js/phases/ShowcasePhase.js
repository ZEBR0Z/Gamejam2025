/**
 * ShowcasePhase - Display all completed collaborative songs
 *
 * - Loads all final songs from server
 * - Allows navigation between different songs
 * - Plays full-length collaborative pieces with backing tracks
 * - Shows song contributors and creation timeline
 */
export class ShowcasePhase {
  constructor(
    gameState,
    uiManager,
    audioEngine,
    canvasRenderer,
    inputController,
    multiplayerManager,
  ) {
    this.gameState = gameState;
    this.uiManager = uiManager;
    this.audioEngine = audioEngine;
    this.canvasRenderer = canvasRenderer;
    this.inputController = inputController;
    this.multiplayerManager = multiplayerManager;

    this.onRestart = null;
    this.onExit = null;
    this.scheduleInterval = null;
    this.animationFrameId = null;

    this.finalSongs = [];
    this.currentSongIndex = 0;
    this.currentSongEvents = [];
    this.isSequentialMode = true;
    this.hasPlayedAllSongs = false;
  }

  async start(onRestart, onExit) {
    this.onRestart = onRestart;
    this.onExit = onExit;

    console.log("Starting final showcase phase");
    this.uiManager.showScreen("showcase");

    // Load all final songs from server
    await this.loadFinalSongs();

    // Setup UI and start showcasing
    this.setupUI();
    this.setupEventHandlers();

    if (this.finalSongs.length > 0) {
      this.showSong(0);
    }
  }

  async loadFinalSongs() {
    try {
      const response = await this.multiplayerManager.getFinalSongs();
      if (response.success) {
        this.finalSongs = response.songs;
      } else {
        console.error("Failed to load final songs:", response.error);
      }
    } catch (error) {
      console.error("Error loading final songs:", error);
    }
  }

  setupUI() {
    // Update showcase info
    if (this.finalSongs.length > 0) {
      this.uiManager.updateShowcaseScreen(0, this.finalSongs.length, []);
    }
  }

  setupEventHandlers() {
    // Transport controls - only enabled in navigation mode
    const transportHandlers = {
      "showcase-play-pause-btn": () =>
        !this.isSequentialMode && this.togglePlayback(),
      "showcase-restart-btn": () => !this.isSequentialMode && this.restart(),
      "showcase-progress-bar": (value) =>
        !this.isSequentialMode && this.seekTo(value),
    };

    this.inputController.setupTransportEvents(transportHandlers);

    // Navigation and exit buttons
    const buttonHandlers = {
      "prev-song-btn": () => !this.isSequentialMode && this.previousSong(),
      "next-song-btn": () => !this.isSequentialMode && this.nextSong(),
      "showcase-exit-btn": () => this.exitToMenu(),
    };

    this.inputController.setupButtonEvents(buttonHandlers);
  }

  async showSong(songIndex) {
    if (songIndex < 0 || songIndex >= this.finalSongs.length) return;

    this.currentSongIndex = songIndex;
    const song = this.finalSongs[songIndex];

    // Convert song segments to events for playback
    await this.convertSongToEvents(song);

    // Update UI
    const creators = song.contributors || [];
    this.uiManager.updateShowcaseScreen(
      songIndex,
      this.finalSongs.length,
      creators,
      this.isSequentialMode,
    );

    // Set backing track for this song and calculate total time
    if (song.backingTrack) {
      this.gameState.setBackingTrack(song.backingTrack);
      await this.audioEngine.loadBackingTrack(song.backingTrack.path);
    }
    const totalTime = song.segments.length * this.gameState.getSegmentLength();

    // Reset playback and start
    this.gameState.setPlaybackState(true, 0, this.audioEngine.getCurrentTime());
    this.uiManager.updateShowcaseTransportControls(
      true,
      0,
      totalTime,
      this.isSequentialMode,
    );

    // Start backing track and playback
    this.audioEngine.startBackingTrack();
    this.startScheduling();
    this.startAnimation();
    this.draw();
  }

  async convertSongToEvents(song) {
    this.currentSongEvents = [];
    let eventId = 0;

    if (!song.segments) return;

    // Process all segments in sequence
    for (
      let segmentIndex = 0;
      segmentIndex < song.segments.length;
      segmentIndex++
    ) {
      const segment = song.segments[segmentIndex];
      const timeOffset = segmentIndex * this.gameState.getSegmentLength();

      // Convert each sound event in the segment
      for (const soundEvent of segment.songData) {
        this.currentSongEvents.push({
          id: eventId++,
          soundIndex: 0,
          startTimeSec: soundEvent.time + timeOffset,
          pitchSemitones: soundEvent.pitch || 0,
          scheduled: false,
          audio: soundEvent.audio, // Store audio URL instead of buffer
          icon: soundEvent.icon,
        });
      }
    }

    // Song converted to playable events
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
    if (!this.gameState.playback.isPlaying || !this.currentSongEvents.length)
      return;

    const currentTime = this.audioEngine.getCurrentTime();
    const playbackTime = currentTime - this.gameState.playback.startTime;
    const song = this.finalSongs[this.currentSongIndex];
    const totalTime = song
      ? song.segments.length * this.gameState.getSegmentLength()
      : this.gameState.getSegmentLength();

    // In sequential mode, don't loop - just play once
    const effectivePlaybackTime = this.isSequentialMode
      ? playbackTime
      : playbackTime % totalTime;

    this.currentSongEvents.forEach((event) => {
      if (!event.scheduled) {
        const eventTime = event.startTimeSec;
        let nextEventTime = eventTime;

        if (this.isSequentialMode) {
          // In sequential mode, only schedule events that haven't passed yet
          if (eventTime >= effectivePlaybackTime) {
            nextEventTime = eventTime;
          } else {
            return; // Skip events that have already passed
          }
        } else {
          // In navigation mode, handle looping
          if (eventTime < effectivePlaybackTime) {
            nextEventTime = eventTime + totalTime;
          }
        }

        const scheduleTime =
          currentTime + (nextEventTime - effectivePlaybackTime);

        if (scheduleTime <= currentTime + this.audioEngine.lookaheadTime) {
          this.playEvent(event, scheduleTime);
          event.scheduled = true;

          const resetDelay = this.isSequentialMode
            ? (nextEventTime - effectivePlaybackTime + 0.1) * 1000
            : (totalTime - eventTime + 0.1) * 1000;

          setTimeout(() => {
            event.scheduled = false;
          }, resetDelay);
        }
      }
    });
  }

  async playEvent(event, scheduleTime) {
    if (event.audio) {
      await this.audioEngine.playSoundFromUrl(
        event.audio,
        event.pitchSemitones,
        scheduleTime,
      );
    }
  }

  startAnimation() {
    const animate = () => {
      if (
        this.gameState.getState() === "showcase" &&
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
    const song = this.finalSongs[this.currentSongIndex];
    const totalTime = song
      ? song.segments.length * this.gameState.getSegmentLength()
      : this.gameState.getSegmentLength();

    const currentTime = this.audioEngine.getCurrentTime();
    const elapsed = currentTime - this.gameState.playback.startTime;

    if (this.isSequentialMode) {
      // In sequential mode, use raw elapsed time for advancement detection
      const actualCurrentTime = Math.min(elapsed, totalTime);
      this.gameState.playback.currentTime = actualCurrentTime;

      this.uiManager.updateShowcaseTransportControls(
        this.gameState.playback.isPlaying,
        actualCurrentTime,
        totalTime,
        this.isSequentialMode,
      );

      // Check if current song finished
      if (elapsed >= totalTime) {
        this.advanceToNextSong();
      }
    } else {
      // In navigation mode, use normal looping behavior
      this.gameState.updateCurrentTime(currentTime, totalTime);
      this.uiManager.updateShowcaseTransportControls(
        this.gameState.playback.isPlaying,
        this.gameState.playback.currentTime,
        totalTime,
        this.isSequentialMode,
      );
    }
  }

  draw() {
    const canvas = this.uiManager.elements.showcaseCanvas;
    if (canvas && this.currentSongEvents.length > 0) {
      const song = this.finalSongs[this.currentSongIndex];
      const totalTime = song
        ? song.segments.length * this.gameState.config.segmentLength
        : this.gameState.config.segmentLength;

      // Draw the full song timeline
      this.canvasRenderer.drawFinalView(
        canvas,
        this.currentSongEvents,
        this.gameState.playback.currentTime,
        totalTime,
      );
    }
  }

  advanceToNextSong() {
    if (this.currentSongIndex < this.finalSongs.length - 1) {
      // Move to next song
      this.stopCurrentSong();
      setTimeout(() => {
        this.showSong(this.currentSongIndex + 1);
      }, 500); // Brief pause between songs
    } else {
      // Finished all songs - enable navigation mode
      this.isSequentialMode = false;
      this.hasPlayedAllSongs = true;
      this.pause();

      // Update UI to show navigation controls
      const song = this.finalSongs[this.currentSongIndex];
      const creators = song.contributors || [];
      this.uiManager.updateShowcaseScreen(
        this.currentSongIndex,
        this.finalSongs.length,
        creators,
        this.isSequentialMode,
      );

      const totalTime =
        song.segments.length * this.gameState.getSegmentLength();
      this.uiManager.updateShowcaseTransportControls(
        false,
        this.gameState.playback.currentTime,
        totalTime,
        this.isSequentialMode,
      );
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
    const song = this.finalSongs[this.currentSongIndex];
    const totalTime = song
      ? song.segments.length * this.gameState.getSegmentLength()
      : this.gameState.getSegmentLength();

    this.gameState.setPlaybackState(
      true,
      this.gameState.playback.currentTime,
      this.audioEngine.getCurrentTime() - this.gameState.playback.currentTime,
    );

    // Reset event scheduling
    this.currentSongEvents.forEach((event) => {
      event.scheduled = false;
    });

    // Resume backing track
    this.audioEngine.resumeBackingTrack();

    this.startScheduling();
    this.startAnimation();

    this.uiManager.updateShowcaseTransportControls(
      true,
      this.gameState.playback.currentTime,
      totalTime,
      this.isSequentialMode,
    );
  }

  pause() {
    this.gameState.setPlaybackState(false);
    if (this.scheduleInterval) {
      clearInterval(this.scheduleInterval);
    }

    // Pause backing track
    this.audioEngine.pauseBackingTrack();

    const song = this.finalSongs[this.currentSongIndex];
    const totalTime = song
      ? song.segments.length * this.gameState.getSegmentLength()
      : this.gameState.getSegmentLength();
    this.uiManager.updateShowcaseTransportControls(
      false,
      this.gameState.playback.currentTime,
      totalTime,
      this.isSequentialMode,
    );
  }

  stopCurrentSong() {
    // Stop playback completely
    this.gameState.setPlaybackState(false);

    // Clear scheduling
    if (this.scheduleInterval) {
      clearInterval(this.scheduleInterval);
      this.scheduleInterval = null;
    }

    // Cancel animation
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Stop backing track
    this.audioEngine.stopBackingTrack();
  }

  restart() {
    const song = this.finalSongs[this.currentSongIndex];
    const totalTime = song
      ? song.segments.length * this.gameState.getSegmentLength()
      : this.gameState.getSegmentLength();

    this.gameState.setPlaybackState(
      this.gameState.playback.isPlaying,
      0,
      this.audioEngine.getCurrentTime(),
    );

    this.currentSongEvents.forEach((event) => {
      event.scheduled = false;
    });

    // Restart backing track
    if (this.gameState.playback.isPlaying) {
      this.audioEngine.startBackingTrack();
    }

    this.uiManager.updateShowcaseTransportControls(
      this.gameState.playback.isPlaying,
      0,
      totalTime,
      this.isSequentialMode,
    );
  }

  seekTo(time) {
    const song = this.finalSongs[this.currentSongIndex];
    const totalTime = song
      ? song.segments.length * this.gameState.getSegmentLength()
      : this.gameState.getSegmentLength();

    this.gameState.setPlaybackState(
      this.gameState.playback.isPlaying,
      time,
      this.audioEngine.getCurrentTime() - time,
    );

    this.currentSongEvents.forEach((event) => {
      event.scheduled = false;
    });

    // Sync backing track
    this.audioEngine.seekBackingTrack(time);

    this.uiManager.updateShowcaseTransportControls(
      this.gameState.playback.isPlaying,
      time,
      totalTime,
      this.isSequentialMode,
    );

    // Redraw canvas to show new position
    this.draw();
  }

  previousSong() {
    if (this.currentSongIndex > 0 && !this.isSequentialMode) {
      this.pause();
      this.showSong(this.currentSongIndex - 1);
    }
  }

  nextSong() {
    if (
      this.currentSongIndex < this.finalSongs.length - 1 &&
      !this.isSequentialMode
    ) {
      this.pause();
      this.showSong(this.currentSongIndex + 1);
    }
  }

  exitToMenu() {
    this.cleanup();

    console.log("Exiting to menu");
    if (this.onExit) {
      this.onExit();
    }
  }

  cleanup() {
    // Clean up transport and button event listeners
    this.inputController.cleanupTransportEvents();
    this.inputController.cleanupButtonEvents();

    // Stop all audio previews
    this.audioEngine.stopPreview();
    this.audioEngine.stopEditPreview();

    // Stop scheduling and animation
    if (this.scheduleInterval) {
      clearInterval(this.scheduleInterval);
    }
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }

    // Stop backing track
    this.audioEngine.stopBackingTrack();

    // Reset playback state and sequential mode
    this.gameState.setPlaybackState(false, 0, 0);
    this.isSequentialMode = true;
    this.hasPlayedAllSongs = false;
    this.currentSongIndex = 0;
  }
}
