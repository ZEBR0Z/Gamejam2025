/**
 * GameState - Centralized state management for the music game
 */
export class GameState {
  constructor() {
    this.currentState = "menu";
    this.soundList = [];
    this.selectedSounds = [];
    this.availableSounds = [];
    this.events = [];
    this.nextEventId = 0;

    this.config = {
      segmentLength: 8,
      selectionTime: 30,
      performanceTime: 90,
      editingTime: 60,
      replacementTime: 30,
    };

    this.backingTrack = {
      path: null,
      duration: 8,
    };

    this.playback = {
      currentTime: 0,
      isPlaying: false,
      startTime: 0,
    };

    this.onIconPreload = null;
  }

  setState(newState) {
    const previousState = this.currentState;
    this.currentState = newState;
    console.log(`State changed: ${previousState} -> ${newState}`);
  }

  getState() {
    return this.currentState;
  }

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

  /**
   * @param {Object} soundData - Sound data including icon and audio URL
   * @param {number} originalIndex - Index in available sounds array
   * @returns {boolean} Success status
   */
  addSelectedSound(soundData, originalIndex) {
    if (this.selectedSounds.length >= 3) return false;

    this.selectedSounds.push({
      originalIndex,
      icon: soundData.icon,
      audio: soundData.audio,
    });

    if (this.onIconPreload && soundData.icon) {
      this.onIconPreload(soundData.icon);
    }

    return true;
  }

  removeSelectedSound(originalIndex) {
    const index = this.selectedSounds.findIndex(
      (sound) => sound.originalIndex === originalIndex,
    );
    if (index !== -1) {
      this.selectedSounds.splice(index, 1);
      return true;
    }
    return false;
  }

  clearSelectedSounds() {
    this.selectedSounds = [];
  }

  /**
   * @param {number} soundIndex - Index of selected sound (0-2)
   * @param {number} startTimeSec - Start time in seconds
   * @param {number} pitchSemitones - Pitch adjustment in semitones
   * @returns {Object} Created event object
   */
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

  setPlaybackState(isPlaying, currentTime = null, startTime = null) {
    this.playback.isPlaying = isPlaying;
    if (currentTime !== null) this.playback.currentTime = currentTime;
    if (startTime !== null) this.playback.startTime = startTime;
  }

  updateCurrentTime(audioCurrentTime, totalTime = null) {
    if (this.playback.isPlaying) {
      const elapsed = audioCurrentTime - this.playback.startTime;
      const timeLimit = totalTime || this.getSegmentLength();
      this.playback.currentTime = elapsed % timeLimit;
    }
  }

  /**
   * @param {Object} backingTrackInfo - Backing track info with path and duration
   * @description Sets backing track and overrides segment length with track duration
   */
  setBackingTrack(backingTrackInfo) {
    if (backingTrackInfo) {
      this.backingTrack.path = backingTrackInfo.path;
      this.backingTrack.duration = backingTrackInfo.duration;
      this.config.segmentLength = backingTrackInfo.duration;
    }
  }

  getSegmentLength() {
    return this.backingTrack.duration || this.config.segmentLength;
  }

  resetGameData() {
    this.clearEvents();
    this.clearSelectedSounds();
    this.availableSounds = [];
    this.setPlaybackState(false, 0, 0);
  }

  resetForNewGame() {
    this.resetGameData();
    this.setState("menu");
  }
}
