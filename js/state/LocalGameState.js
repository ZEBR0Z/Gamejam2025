/**
 * LocalGameState - Client-only game state
 * Manages current editing session, selected sounds, events, playback
 * Not synced with server until submission
 */

import { StateObserver } from "./StateObserver.js";
import { StateEvent, GameConfig } from "../Constants.js";

export class LocalGameState {
  constructor() {
    this.observer = new StateObserver();

    // Sound management
    this.soundList = []; // All available sounds from audiomap.json
    this.backingTracks = []; // All available backing tracks
    this.availableSounds = []; // Random subset for selection (5 sounds)
    this.selectedSounds = []; // Player's chosen sounds (3 sounds)

    // Current song being worked on
    this.events = []; // {id, soundIndex, startTimeSec, pitchSemitones}
    this.nextEventId = 0;
    this.backingTrack = null; // {path, duration}

    // Playback state
    this.playback = {
      currentTime: 0,
      isPlaying: false,
      startTime: 0,
    };

    // Callback for icon preloading
    this.onIconPreload = null;
  }

  /**
   * Load sound list from audiomap.json
   */
  async loadSoundList() {
    try {
      const response = await fetch("assets/audiomap.json");
      const audioMap = await response.json();
      this.soundList = audioMap.sounds;
      this.backingTracks = audioMap.backing_tracks;
      console.log(
        `Loaded ${this.soundList.length} sounds and ${this.backingTracks.length} backing tracks`
      );
    } catch (error) {
      console.error("Failed to load audio map:", error);
      throw error;
    }
  }

  /**
   * Select random sounds for the selection phase
   * @param {number} count - Number of sounds to select
   */
  selectRandomSounds(count = GameConfig.SOUNDS_TO_CHOOSE_FROM) {
    const shuffled = [...this.soundList].sort(() => Math.random() - 0.5);
    this.availableSounds = shuffled.slice(0, count);
    this.emit(StateEvent.LOCAL_STATE_CHANGED);
  }

  /**
   * Get random sounds (without storing them)
   * @param {number} count - Number of sounds to get
   * @param {Array} exclude - Audio paths to exclude
   * @returns {Array} Random sounds
   */
  getRandomSounds(count, exclude = []) {
    const available = this.soundList.filter(s => !exclude.includes(s.audio));
    const shuffled = [...available].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  /**
   * Select a random backing track
   * @returns {Object} Random backing track {audio, duration}
   */
  selectRandomBackingTrack() {
    const index = Math.floor(Math.random() * this.backingTracks.length);
    return this.backingTracks[index];
  }

  /**
   * Add a sound to selected sounds
   * @param {Object} soundData - {audio, icon}
   * @param {number} originalIndex - Index in availableSounds
   * @returns {boolean} Success
   */
  addSelectedSound(soundData, originalIndex) {
    if (this.selectedSounds.length >= GameConfig.SOUNDS_TO_SELECT) {
      return false;
    }

    this.selectedSounds.push({
      originalIndex,
      icon: soundData.icon,
      audio: soundData.audio,
    });

    // Notify for icon preloading
    if (this.onIconPreload && soundData.icon) {
      this.onIconPreload(soundData.icon);
    }

    this.emit(StateEvent.LOCAL_STATE_CHANGED);
    return true;
  }

  /**
   * Remove a sound from selected sounds
   * @param {number} originalIndex - Index in availableSounds
   * @returns {boolean} Success
   */
  removeSelectedSound(originalIndex) {
    const index = this.selectedSounds.findIndex(
      (sound) => sound.originalIndex === originalIndex
    );

    if (index !== -1) {
      this.selectedSounds.splice(index, 1);
      this.emit(StateEvent.LOCAL_STATE_CHANGED);
      return true;
    }

    return false;
  }

  /**
   * Clear selected sounds
   */
  clearSelectedSounds() {
    this.selectedSounds = [];
    this.emit(StateEvent.LOCAL_STATE_CHANGED);
  }

  /**
   * Set selected sounds (from server submission)
   * @param {Array} sounds - Array of {audio, icon}
   */
  setSelectedSounds(sounds) {
    this.selectedSounds = sounds;
    this.emit(StateEvent.LOCAL_STATE_CHANGED);
  }

  /**
   * Add a sound event
   * @param {number} soundIndex - Index in selectedSounds (0-2)
   * @param {number} startTimeSec - Start time in seconds
   * @param {number} pitchSemitones - Pitch adjustment
   * @returns {Object} Created event
   */
  addEvent(soundIndex, startTimeSec, pitchSemitones = 0) {
    const event = {
      id: this.nextEventId++,
      soundIndex,
      startTimeSec,
      pitchSemitones,
    };

    this.events.push(event);
    this.emit(StateEvent.LOCAL_STATE_CHANGED);
    return event;
  }

  /**
   * Remove a sound event
   * @param {number} eventId
   * @returns {boolean} Success
   */
  removeEvent(eventId) {
    const index = this.events.findIndex((event) => event.id === eventId);
    if (index > -1) {
      this.events.splice(index, 1);
      this.emit(StateEvent.LOCAL_STATE_CHANGED);
      return true;
    }
    return false;
  }

  /**
   * Clear all events
   */
  clearEvents() {
    this.events = [];
    this.nextEventId = 0;
    this.emit(StateEvent.LOCAL_STATE_CHANGED);
  }

  /**
   * Get events for a specific sound
   * @param {number} soundIndex
   * @returns {Array}
   */
  getEventsForSound(soundIndex) {
    return this.events.filter((event) => event.soundIndex === soundIndex);
  }

  /**
   * Set backing track
   * @param {Object} track - {path, duration} or {audio, duration}
   */
  setBackingTrack(track) {
    if (track) {
      this.backingTrack = {
        path: track.audio || track.path,
        duration: track.duration,
      };
    } else {
      this.backingTrack = null;
    }
    this.emit(StateEvent.LOCAL_STATE_CHANGED);
  }

  /**
   * Get segment length (backing track duration or default)
   * @returns {number} Segment length in seconds
   */
  getSegmentLength() {
    return this.backingTrack?.duration || GameConfig.SEGMENT_LENGTH;
  }

  /**
   * Set playback state
   * @param {boolean} isPlaying
   * @param {number|null} currentTime
   * @param {number|null} startTime
   */
  setPlaybackState(isPlaying, currentTime = null, startTime = null) {
    this.playback.isPlaying = isPlaying;
    if (currentTime !== null) this.playback.currentTime = currentTime;
    if (startTime !== null) this.playback.startTime = startTime;
    this.emit(StateEvent.LOCAL_STATE_CHANGED);
  }

  /**
   * Update current playback time
   * @param {number} audioCurrentTime
   * @param {number|null} totalTime
   */
  updateCurrentTime(audioCurrentTime, totalTime = null) {
    if (this.playback.isPlaying) {
      const elapsed = audioCurrentTime - this.playback.startTime;
      const timeLimit = totalTime || this.getSegmentLength();
      this.playback.currentTime = elapsed % timeLimit;
      this.emit(StateEvent.LOCAL_STATE_CHANGED);
    }
  }

  /**
   * Load song data from server submission
   * @param {Object} submission - {songData, backingTrack, selectedSounds}
   */
  loadFromSubmission(submission) {
    // Set backing track
    this.setBackingTrack(submission.backingTrack);

    // Set selected sounds
    this.setSelectedSounds(submission.selectedSounds);

    // Convert songData to events
    this.clearEvents();
    submission.songData.forEach((data) => {
      const soundIndex = this.selectedSounds.findIndex(
        (s) => s.audio === data.audio
      );
      if (soundIndex !== -1) {
        this.addEvent(soundIndex, data.time, data.pitch);
      }
    });
  }

  /**
   * Convert current state to server submission format
   * @returns {Object} {songData, backingTrack, selectedSounds}
   */
  toSubmission() {
    return {
      songData: this.events.map((event) => ({
        audio: this.selectedSounds[event.soundIndex].audio,
        icon: this.selectedSounds[event.soundIndex].icon,
        time: event.startTimeSec,
        pitch: event.pitchSemitones,
      })),
      backingTrack: this.backingTrack,
      selectedSounds: this.selectedSounds.map((s) => ({
        audio: s.audio,
        icon: s.icon,
      })),
    };
  }

  /**
   * Reset for new round (clear events, keep sounds)
   */
  resetForNewRound() {
    this.clearEvents();
    this.setPlaybackState(false, 0, 0);
  }

  /**
   * Reset everything for new game
   */
  resetForNewGame() {
    this.clearEvents();
    this.clearSelectedSounds();
    this.availableSounds = [];
    this.backingTrack = null;
    this.setPlaybackState(false, 0, 0);
  }

  /**
   * Get selected sounds
   * @returns {Array}
   */
  getSelectedSounds() {
    return this.selectedSounds;
  }

  /**
   * Get all events
   * @returns {Array}
   */
  getEvents() {
    return this.events;
  }

  /**
   * Get backing track
   * @returns {Object|null}
   */
  getBackingTrack() {
    return this.backingTrack;
  }

  /**
   * Get current playback time
   * @returns {number}
   */
  getCurrentTime() {
    return this.playback.currentTime;
  }

  /**
   * Check if playing
   * @returns {boolean}
   */
  isPlaying() {
    return this.playback.isPlaying;
  }

  /**
   * Subscribe to local state changes
   * @param {Function} callback
   * @returns {Function} Unsubscribe function
   */
  onChange(callback) {
    return this.observer.on(StateEvent.LOCAL_STATE_CHANGED, callback);
  }

  /**
   * Emit state change event
   */
  emit(event) {
    this.observer.emit(event);
  }
}
