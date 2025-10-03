/**
 * ShowcasePhase - Display all completed collaborative songs
 *
 * NEW: Builds songs from player submissions in lobby state
 * - For each player, combines all their submissions into one song
 * - Each submission becomes a segment in the final song
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

    this.uiManager.showScreen("showcase");

    await this.loadFinalSongs();

    this.setupUI();
    this.setupEventHandlers();

    if (this.finalSongs.length > 0) {
      this.showSong(0);
    }
  }

  async loadFinalSongs() {
    try {
      const state = this.multiplayerManager.getLobbyState();
      if (!state || !state.players) {
        console.error("No lobby state available");
        return;
      }

      // Build songs from player submissions
      this.finalSongs = state.players.map((player) => {
        // Get all contributors for this song
        const contributors = this.getContributorsForSong(state, player.id);

        return {
          id: `song_${player.id}`,
          originalCreator: player.name,
          segments: player.submissions || [],
          contributors: contributors,
          backingTrack: player.submissions[0]?.backingTrack || null,
        };
      });

      console.log("Final songs loaded:", this.finalSongs);
    } catch (error) {
      console.error("Error loading final songs:", error);
    }
  }

  /**
   * Get list of contributor names for a song
   * Uses assignments map to determine who contributed to which song
   */
  getContributorsForSong(state, originalCreatorId) {
    const contributors = [originalCreatorId];

    // For each round after the first, find who worked on this song
    for (let round = 2; round <= state.rounds; round++) {
      for (const [playerId, assignments] of Object.entries(state.assignments)) {
        const assignedId = assignments[round - 2]; // Round 2 = index 0
        if (
          assignedId === originalCreatorId ||
          (contributors.includes(assignedId) && round > 2)
        ) {
          if (!contributors.includes(playerId)) {
            contributors.push(playerId);
          }
        }
      }
    }

    // Convert player IDs to names
    return contributors.map((id) => {
      const player = state.players.find((p) => p.id === id);
      return player ? player.name : id;
    });
  }

  setupUI() {
    if (this.finalSongs.length > 0) {
      this.uiManager.updateShowcaseScreen(0, this.finalSongs.length, []);
    }
  }

  setupEventHandlers() {
    const transportHandlers = {
      "showcase-play-pause-btn": () =>
        !this.isSequentialMode && this.togglePlayback(),
      "showcase-restart-btn": () => !this.isSequentialMode && this.restart(),
      "showcase-progress-bar": (value) =>
        !this.isSequentialMode && this.seekTo(value),
    };

    this.inputController.setupTransportEvents(transportHandlers);

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

    await this.convertSongToEvents(song);

    const creators = song.contributors || [];
    this.uiManager.updateShowcaseScreen(
      songIndex,
      this.finalSongs.length,
      creators,
      this.isSequentialMode,
    );

    if (song.backingTrack) {
      this.gameState.setBackingTrack(song.backingTrack);
      await this.audioEngine.loadBackingTrack(song.backingTrack.audio);
    }
    const totalTime = song.segments.length * this.gameState.getSegmentLength();

    this.gameState.setPlaybackState(true, 0, this.audioEngine.getCurrentTime());
    this.uiManager.updateShowcaseTransportControls(
      true,
      0,
      totalTime,
      this.isSequentialMode,
    );

    this.audioEngine.startBackingTrack();
    this.startScheduling();
    this.startAnimation();
    this.draw();
  }

  async convertSongToEvents(song) {
    this.currentSongEvents = [];
    let eventId = 0;

    if (!song.segments) return;

    for (
      let segmentIndex = 0;
      segmentIndex < song.segments.length;
      segmentIndex++
    ) {
      const segment = song.segments[segmentIndex];
      const timeOffset = segmentIndex * this.gameState.getSegmentLength();

      for (const soundEvent of segment.songData) {
        this.currentSongEvents.push({
          id: eventId++,
          soundIndex: 0,
          startTimeSec: soundEvent.time + timeOffset,
          pitchSemitones: soundEvent.pitch || 0,
          scheduled: false,
          audio: soundEvent.audio,
          icon: soundEvent.icon,
        });
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
    if (!this.gameState.playback.isPlaying || !this.currentSongEvents.length)
      return;

    const currentTime = this.audioEngine.getCurrentTime();
    const playbackTime = currentTime - this.gameState.playback.startTime;
    const song = this.finalSongs[this.currentSongIndex];
    const totalTime = song
      ? song.segments.length * this.gameState.getSegmentLength()
      : this.gameState.getSegmentLength();

    const effectivePlaybackTime = this.isSequentialMode
      ? playbackTime
      : playbackTime % totalTime;

    this.currentSongEvents.forEach((event) => {
      if (!event.scheduled) {
        const eventTime = event.startTimeSec;
        let nextEventTime = eventTime;

        if (this.isSequentialMode) {
          if (eventTime >= effectivePlaybackTime) {
            nextEventTime = eventTime;
          } else {
            return;
          }
        } else {
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
      const actualCurrentTime = Math.min(elapsed, totalTime);
      this.gameState.playback.currentTime = actualCurrentTime;

      this.uiManager.updateShowcaseTransportControls(
        this.gameState.playback.isPlaying,
        actualCurrentTime,
        totalTime,
        this.isSequentialMode,
      );

      if (elapsed >= totalTime) {
        this.advanceToNextSong();
      }
    } else {
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
      this.stopCurrentSong();

      setTimeout(() => {
        this.showSong(this.currentSongIndex + 1);
      }, 500);
    } else {
      this.isSequentialMode = false;
      this.hasPlayedAllSongs = true;
      this.pause();

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

    this.currentSongEvents.forEach((event) => {
      event.scheduled = false;
    });

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
    this.gameState.setPlaybackState(false);

    if (this.scheduleInterval) {
      clearInterval(this.scheduleInterval);
      this.scheduleInterval = null;
    }

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

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

    this.audioEngine.seekBackingTrack(time);

    this.uiManager.updateShowcaseTransportControls(
      this.gameState.playback.isPlaying,
      time,
      totalTime,
      this.isSequentialMode,
    );

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

    if (this.onExit) {
      this.onExit();
    }
  }

  cleanup() {
    this.inputController.cleanupTransportEvents();
    this.inputController.cleanupButtonEvents();

    this.audioEngine.stopPreview();
    this.audioEngine.stopEditPreview();

    if (this.scheduleInterval) {
      clearInterval(this.scheduleInterval);
    }
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }

    this.audioEngine.stopBackingTrack();
    this.gameState.setPlaybackState(false, 0, 0);
    this.isSequentialMode = true;
    this.hasPlayedAllSongs = false;
    this.currentSongIndex = 0;
  }
}
