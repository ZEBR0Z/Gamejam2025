/**
 * PreviewPhase - Preview previous player's work before adding to it
 *
 * NEW: Uses assignments map and player submissions to find previous song
 * - Gets assignment from multiplayerManager.getAssignment(currentRound)
 * - Fetches that player's previous submission
 * - Displays the segment timeline with backing track
 */
export class PreviewPhase {
  constructor(
    gameState,
    uiManager,
    audioEngine,
    canvasRenderer,
    inputController,
    multiplayerManager,
    getCurrentRound,
  ) {
    this.gameState = gameState;
    this.uiManager = uiManager;
    this.audioEngine = audioEngine;
    this.canvasRenderer = canvasRenderer;
    this.inputController = inputController;
    this.multiplayerManager = multiplayerManager;
    this.getCurrentRound = getCurrentRound;

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
      const state = this.multiplayerManager.getLobbyState();

      if (!state) {
        console.error("No lobby state available");
        return;
      }

      // Use Game's currentRound instead of server's player data
      const currentRound = this.getCurrentRound();

      // Preview phase only happens in round 2+
      // Round 1 goes straight to performance
      if (currentRound < 2) {
        console.error("Preview phase should not run in round 1");
        return;
      }

      // Get assignment for this round
      const assignedPlayerId = this.multiplayerManager.getAssignment(currentRound);

      if (!assignedPlayerId) {
        console.warn("No assignment found for round:", currentRound);
        return;
      }

      // Get that player's previous submission (currentRound - 1)
      const submission = this.multiplayerManager.getPlayerSubmission(
        assignedPlayerId,
        currentRound - 1,
      );

      // Find the player's name for display
      const assignedPlayer = state.players.find((p) => p.id === assignedPlayerId);
      const playerName = assignedPlayer ? assignedPlayer.name : "Unknown";

      // Handle missing submission (player left or no data)
      if (!submission) {
        console.warn("No submission found for player:", assignedPlayerId, "round:", currentRound - 1, "- showing empty timeline");
        this.previousSong = null;
        this.previewEvents = [];
        // Transform state to include currentRound and maxRounds for UIManager
        const transformedState = {
          ...state,
          currentRound: this.getCurrentRound() - 1, // UIManager adds 1, so subtract 1 here
          maxRounds: state.rounds,
        };
        this.uiManager.updatePreviewScreen(transformedState, playerName);
        return;
      }

      this.previousSong = submission;

      // Load backing track
      if (submission.backingTrack) {
        this.gameState.setBackingTrack(submission.backingTrack);
        await this.audioEngine.loadBackingTrack(submission.backingTrack.audio);
      }

      // Transform state to include currentRound and maxRounds for UIManager
      const transformedState = {
        ...state,
        currentRound: this.getCurrentRound() - 1, // UIManager adds 1, so subtract 1 here
        maxRounds: state.rounds,
      };
      this.uiManager.updatePreviewScreen(transformedState, playerName);

      await this.convertSongToEvents();
    } catch (error) {
      console.error("Error loading previous song:", error);
    }
  }

  async convertSongToEvents() {
    if (!this.previousSong || !this.previousSong.songData) {
      // No song data - set empty events array
      this.previewEvents = [];
      return;
    }

    this.previewEvents = [];
    let eventId = 0;

    // Load selected sounds from previous submission
    if (this.previousSong.selectedSounds) {
      this.gameState.clearSelectedSounds();
      this.previousSong.selectedSounds.forEach((sound, index) => {
        this.gameState.addSelectedSound(sound, index);
      });
    }

    // Convert song data to preview events
    // Handle case where songData exists but is empty (no notes placed)
    if (Array.isArray(this.previousSong.songData)) {
      for (const soundEvent of this.previousSong.songData) {
        this.previewEvents.push({
          id: eventId++,
          soundIndex: 0,
          startTimeSec: soundEvent.time,
          pitchSemitones: soundEvent.pitch || 0,
          scheduled: false,
          audio: soundEvent.audio,
          icon: soundEvent.icon,
        });
      }
    }
  }

  setupUI() {
    const totalTime = this.gameState.getSegmentLength();
    this.uiManager.updatePreviewTransportControls(false, 0, totalTime);
    this.draw();
  }

  setupEventHandlers() {
    const transportHandlers = {
      "preview-play-pause-btn": () => this.togglePlayback(),
      "preview-restart-btn": () => this.restart(),
      "preview-progress-bar": (value) => this.seekTo(value),
      "continue-to-performance-btn": () => this.continueToNextPhase(),
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
    if (canvas) {
      const totalTime = this.gameState.getSegmentLength();

      // Draw even if previewEvents is empty (shows empty timeline)
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
    const previewTime = 20;

    this.updatePhaseTimer(previewTime);

    this.phaseTimerInterval = setInterval(() => {
      const elapsed = (Date.now() - this.phaseStartTime) / 1000;
      const timeLeft = Math.max(0, previewTime - elapsed);

      this.updatePhaseTimer(Math.ceil(timeLeft));

      if (timeLeft <= 0) {
        if (this.phaseTimerInterval) {
          clearInterval(this.phaseTimerInterval);
          this.phaseTimerInterval = null;
        }
        this.continueToNextPhase();
      }
    }, 1000);
  }

  updatePhaseTimer(timeLeft) {
    if (this.uiManager.elements.previewPhaseTimer) {
      this.uiManager.elements.previewPhaseTimer.textContent = timeLeft;
    }
  }

  async continueToNextPhase() {
    if (this.phaseTimerInterval) {
      clearInterval(this.phaseTimerInterval);
      this.phaseTimerInterval = null;
    }

    this.pause();
    this.audioEngine.stopBackingTrack();

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
