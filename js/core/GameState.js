/**
 * GameState - Manages the game's state and data
 * Centralized state management for the music game
 */
export class GameState {
  constructor() {
    // Game flow state
    this.currentState = "menu"; // menu, tutorial, selection, performance, editing, final

    // Audio data
    this.soundList = [];
    this.selectedSounds = []; // 3 chosen sounds with audio buffers and icons
    this.availableSounds = []; // 5 random sounds for selection

    // Music data
    this.events = []; // Array of SoundEvent objects
    this.nextEventId = 0;

    // Timing configuration
    this.config = {
      bpm: 120,
      segmentLength: 8, // seconds
      selectionTime: 10,
      performanceTime: 90, // 1.5 minutes
      editingTime: 60,
      phaseCountdownTime: 3,
    };

    // Playback state
    this.playback = {
      currentTime: 0,
      isPlaying: false,
      startTime: 0,
    };

    // Phase timers
    this.timers = {
      selectionTimeLeft: this.config.selectionTime,
      performanceTimeLeft: this.config.performanceTime,
      editingTimeLeft: this.config.editingTime,
      phaseCountdown: 0,
    };
  }

  // State management
  setState(newState) {
    const previousState = this.currentState;
    this.currentState = newState;
    console.log(`State changed: ${previousState} -> ${newState}`);
  }

  getState() {
    return this.currentState;
  }

  // Sound management
  async loadSoundList() {
    try {
      const response = await fetch("./soundlist.json");
      this.soundList = await response.json();
      console.log(`Loaded ${this.soundList.length} sounds`);
    } catch (error) {
      console.error("Failed to load sound list:", error);
      throw error;
    }
  }

  selectRandomSounds(count = 5) {
    const shuffled = [...this.soundList].sort(() => Math.random() - 0.5);
    this.availableSounds = shuffled.slice(0, count);
  }

  addSelectedSound(soundData, audioBuffer, originalIndex) {
    if (this.selectedSounds.length >= 3) return false;

    this.selectedSounds.push({
      originalIndex,
      audioBuffer,
      icon: soundData.icon,
      audio: soundData.audio,
    });

    return true;
  }

  clearSelectedSounds() {
    this.selectedSounds = [];
  }

  // Event management
  addEvent(soundIndex, startTimeSec, pitchSemitones = 0) {
    const event = {
      id: this.nextEventId++,
      soundIndex,
      startTimeSec,
      pitchSemitones,
      scheduled: false,
    };

    this.events.push(event);
    return event;
  }

  removeEvent(eventId) {
    const index = this.events.findIndex((event) => event.id === eventId);
    if (index > -1) {
      this.events.splice(index, 1);
      return true;
    }
    return false;
  }

  clearEvents() {
    this.events = [];
    this.nextEventId = 0;
  }

  getEventsForSound(soundIndex) {
    return this.events.filter((event) => event.soundIndex === soundIndex);
  }

  // Playback state
  setPlaybackState(isPlaying, currentTime = null, startTime = null) {
    this.playback.isPlaying = isPlaying;
    if (currentTime !== null) this.playback.currentTime = currentTime;
    if (startTime !== null) this.playback.startTime = startTime;
  }

  updateCurrentTime(audioCurrentTime, totalTime = null) {
    if (this.playback.isPlaying) {
      const elapsed = audioCurrentTime - this.playback.startTime;
      const timeLimit = totalTime || this.config.segmentLength;
      this.playback.currentTime = elapsed % timeLimit;
    }
  }

  // Timer management
  resetTimers() {
    this.timers.selectionTimeLeft = this.config.selectionTime;
    this.timers.performanceTimeLeft = this.config.performanceTime;
    this.timers.editingTimeLeft = this.config.editingTime;
    this.timers.phaseCountdown = this.config.phaseCountdownTime;
  }

  decrementTimer(timerName) {
    if (this.timers[timerName] > 0) {
      this.timers[timerName]--;
      return this.timers[timerName];
    }
    return 0;
  }

  // Reset methods
  resetGameData() {
    this.clearEvents();
    this.clearSelectedSounds();
    this.availableSounds = [];
    this.setPlaybackState(false, 0, 0);
    this.resetTimers();
  }

  resetForNewGame() {
    this.resetGameData();
    this.setState("menu");
  }
}
