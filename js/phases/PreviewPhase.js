/**
 * PreviewPhase - Preview previous player's work before adding to it
 *
 * - Loads and displays only the most recent segment (from previous player)
 * - Plays back a single segment timeline with backing track
 * - Loads the original sound selection for the next performance phase
 * - Transitions to performance when player is ready
 */
export class PreviewPhase {
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

    this.onPhaseComplete = null;
    this.scheduleInterval = null;
    this.animationFrameId = null;
    this.phaseTimerInterval = null;
    this.previousSong = null;
    this.previewEvents = [];
    this.phaseStartTime = null;
  }

  async start(onComplete) {
    this.onPhaseComplete = onComplete;

    this.uiManager.showScreen("preview");

    await this.loadPreviousSong();

    this.setupUI();
    this.setupEventHandlers();
    this.startPreviewPlayback();
    this.startPhaseTimer();
  }

  async loadPreviousSong() {
    try {
      const response = await this.multiplayerManager.getPreviousSong();
      if (response.success) {
        this.previousSong = response.song;

        if (this.previousSong.backingTrack) {
          this.gameState.setBackingTrack(this.previousSong.backingTrack);
          await this.audioEngine.loadBackingTrack(
            this.previousSong.backingTrack.audio,
          );
        }

        this.uiManager.updatePreviewScreen(
          response.gameState,
          response.previousPlayerName,
        );

        await this.convertSongToEvents();
      } else {
        console.error("Failed to load previous song:", response.error);
      }
    } catch (error) {
      console.error("Error loading previous song:", error);
    }
  }

  async convertSongToEvents() {
    if (
      !this.previousSong ||
      !this.previousSong.segments ||
      this.previousSong.segments.length === 0
    )
      return;

    this.previewEvents = [];
    let eventId = 0;

    // Derive selected sounds from the first 3 unique sounds in all segments
    const uniqueSounds = new Map();
    for (const segment of this.previousSong.segments) {
      for (const soundEvent of segment.songData) {
        if (!uniqueSounds.has(soundEvent.audio)) {
          uniqueSounds.set(soundEvent.audio, {
            audio: soundEvent.audio,
            icon: soundEvent.icon,
            originalIndex: uniqueSounds.size,
          });
        }
        if (uniqueSounds.size >= 3) break;
      }
      if (uniqueSounds.size >= 3) break;
    }

    // If we found fewer than 3 sounds, fill remaining slots with random sounds
    // This is helpful gameplay-wise, because if a player finds certain sounds
    // too difficult to use for their song and end up not using them, the following player isn't
    // also stuck with those sounds.
    if (uniqueSounds.size < 3 && this.gameState.soundList.length > 0) {
      const usedAudioPaths = new Set(Array.from(uniqueSounds.keys()));
      const randomIndices = [];

      while (
        uniqueSounds.size < 3 &&
        randomIndices.length < this.gameState.soundList.length
      ) {
        const randomIndex = Math.floor(
          Math.random() * this.gameState.soundList.length,
        );
        const sound = this.gameState.soundList[randomIndex];

        // Ensure we don't duplicate sounds that were already used
        if (
          !randomIndices.includes(randomIndex) &&
          !usedAudioPaths.has(sound.audio)
        ) {
          randomIndices.push(randomIndex);
          uniqueSounds.set(sound.audio, {
            audio: sound.audio,
            icon: sound.icon,
            originalIndex: uniqueSounds.size,
          });
        }
      }
    }

    // Set selected sounds in game state for next phases
    this.gameState.clearSelectedSounds();
    Array.from(uniqueSounds.values()).forEach((sound) => {
      this.gameState.addSelectedSound(sound, sound.originalIndex);
    });

    // Only process the most recent segment (from the previous player)
    const mostRecentSegment =
      this.previousSong.segments[this.previousSong.segments.length - 1];

    for (const soundEvent of mostRecentSegment.songData) {
      this.previewEvents.push({
        id: eventId++,
        soundIndex: 0, // We'll map this to the loaded sound
        startTimeSec: soundEvent.time, // No time offset needed since we're only showing one segment
        pitchSemitones: soundEvent.pitch || 0,
        scheduled: false,
        audio: soundEvent.audio,
        icon: soundEvent.icon,
      });
    }
  }

  setupUI() {
    const totalTime = this.gameState.getSegmentLength();
    this.uiManager.updatePreviewTransportControls(false, 0, totalTime);
    this.draw();
  }

  setupEventHandlers() {
    // Transport controls
    const transportHandlers = {
      "preview-play-pause-btn": () => this.togglePlayback(),
      "preview-restart-btn": () => this.restart(),
      "preview-progress-bar": (value) => this.seekTo(value),
      "continue-to-performance-btn": () => this.continueToPerformance(),
    };

    this.inputController.setupTransportEvents(transportHandlers);
  }

  startPreviewPlayback() {
    const totalTime = this.gameState.getSegmentLength();

    this.gameState.setPlaybackState(true, 0, this.audioEngine.getCurrentTime());
    this.uiManager.updatePreviewTransportControls(true, 0, totalTime);

    this.audioEngine.startBackingTrack();

    this.startScheduling();
    this.startAnimation();
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
    if (!this.gameState.playback.isPlaying || !this.previewEvents.length)
      return;

    const currentTime = this.audioEngine.getCurrentTime();
    const playbackTime = currentTime - this.gameState.playback.startTime;
    const totalTime = this.gameState.getSegmentLength();

    if (playbackTime >= totalTime) {
      this.restart();
      return;
    }

    this.previewEvents.forEach((event) => {
      if (!event.scheduled) {
        const eventTime = event.startTimeSec;

        if (
          eventTime >= playbackTime &&
          eventTime <= playbackTime + this.audioEngine.lookaheadTime
        ) {
          const scheduleTime = currentTime + (eventTime - playbackTime);
          this.playEvent(event, scheduleTime);
          event.scheduled = true;
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
        this.gameState.getState() === "preview" &&
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
    const totalTime = this.gameState.getSegmentLength();
    this.gameState.updateCurrentTime(this.audioEngine.getCurrentTime());
    this.uiManager.updatePreviewTransportControls(
      this.gameState.playback.isPlaying,
      this.gameState.playback.currentTime,
      totalTime,
    );
  }

  draw() {
    const canvas = this.uiManager.elements.previewCanvas;
    if (canvas && this.previewEvents.length > 0) {
      const totalTime = this.gameState.getSegmentLength();

      // Use the final view renderer to show the single segment preview timeline
      this.canvasRenderer.drawFinalView(
        canvas,
        this.previewEvents,
        this.gameState.playback.currentTime,
        totalTime,
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
    const totalTime = this.gameState.getSegmentLength();

    this.gameState.setPlaybackState(
      true,
      this.gameState.playback.currentTime,
      this.audioEngine.getCurrentTime() - this.gameState.playback.currentTime,
    );

    this.previewEvents.forEach((event) => {
      event.scheduled = false;
    });

    this.audioEngine.resumeBackingTrack();

    this.startScheduling();
    this.startAnimation();

    this.uiManager.updatePreviewTransportControls(
      true,
      this.gameState.playback.currentTime,
      totalTime,
    );
  }

  pause() {
    this.gameState.setPlaybackState(false);
    if (this.scheduleInterval) {
      clearInterval(this.scheduleInterval);
    }

    this.audioEngine.pauseBackingTrack();

    const totalTime = this.gameState.getSegmentLength();
    this.uiManager.updatePreviewTransportControls(
      false,
      this.gameState.playback.currentTime,
      totalTime,
    );
  }

  restart() {
    const totalTime = this.gameState.getSegmentLength();

    this.gameState.setPlaybackState(
      this.gameState.playback.isPlaying,
      0,
      this.audioEngine.getCurrentTime(),
    );

    this.previewEvents.forEach((event) => {
      event.scheduled = false;
    });

    if (this.gameState.playback.isPlaying) {
      this.audioEngine.startBackingTrack();
    }

    this.uiManager.updatePreviewTransportControls(
      this.gameState.playback.isPlaying,
      0,
      totalTime,
    );
  }

  seekTo(time) {
    const totalTime = this.gameState.getSegmentLength();

    this.gameState.setPlaybackState(
      this.gameState.playback.isPlaying,
      time,
      this.audioEngine.getCurrentTime() - time,
    );

    this.previewEvents.forEach((event) => {
      event.scheduled = false;
    });

    this.audioEngine.seekBackingTrack(time);

    this.uiManager.updatePreviewTransportControls(
      this.gameState.playback.isPlaying,
      time,
      totalTime,
    );

    this.draw();
  }

  startPhaseTimer() {
    this.phaseStartTime = Date.now();
    const previewTime = 20; // 20 seconds

    this.updatePhaseTimer(previewTime);

    // Update timer every second
    this.phaseTimerInterval = setInterval(() => {
      const elapsed = (Date.now() - this.phaseStartTime) / 1000;
      const timeLeft = Math.max(0, previewTime - elapsed);

      this.updatePhaseTimer(Math.ceil(timeLeft));

      // Auto-continue when time runs out
      if (timeLeft <= 0) {
        if (this.phaseTimerInterval) {
          clearInterval(this.phaseTimerInterval);
          this.phaseTimerInterval = null;
        }
        this.continueToPerformance();
      }
    }, 1000);
  }

  updatePhaseTimer(timeLeft) {
    if (this.uiManager.elements.previewPhaseTimer) {
      this.uiManager.elements.previewPhaseTimer.textContent = timeLeft;
    }
  }

  async continueToPerformance() {
    if (this.phaseTimerInterval) {
      clearInterval(this.phaseTimerInterval);
      this.phaseTimerInterval = null;
    }

    this.pause();
    this.audioEngine.stopBackingTrack();

    // Load the selected sounds from the previous song for the next round
    if (this.previousSong && this.previousSong.selectedSounds) {
      this.gameState.selectedSounds = this.previousSong.selectedSounds.map(
        (sound, index) => ({
          audio: sound.audio,
          icon: sound.icon,
          originalIndex: index,
        }),
      );

      // Preload icons for next phase
      if (this.gameState.onIconPreload) {
        this.previousSong.selectedSounds.forEach((sound) => {
          if (sound.icon) {
            this.gameState.onIconPreload(sound.icon);
          }
        });
      }
    }

    this.multiplayerManager.continueToPerformance();

    if (this.onPhaseComplete) {
      this.onPhaseComplete();
    }
  }

  cleanup() {
    this.inputController.cleanupTransportEvents();

    if (this.scheduleInterval) {
      clearInterval(this.scheduleInterval);
    }
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.phaseTimerInterval) {
      clearInterval(this.phaseTimerInterval);
    }

    this.audioEngine.stopBackingTrack();
    this.gameState.setPlaybackState(false, 0, 0);
  }
}
