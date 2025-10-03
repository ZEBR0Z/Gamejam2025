/**
 * Song - Represents a collaborative song composition
 * Contains events, backing track, and selected sounds
 * Handles conversion between client and server formats
 */

import { SoundEvent } from "./SoundEvent.js";

export class Song {
  constructor() {
    this.events = []; // Array of SoundEvent instances
    this.backingTrack = null; // {path, duration}
    this.selectedSounds = []; // [{audio, icon}]
    this.nextEventId = 0;
  }

  /**
   * Add a sound event to the song
   * @param {number} soundIndex - Index in selectedSounds (0-2)
   * @param {number} startTimeSec - Start time in seconds
   * @param {number} pitchSemitones - Pitch adjustment
   * @returns {SoundEvent} Created event
   */
  addEvent(soundIndex, startTimeSec, pitchSemitones = 0) {
    const event = new SoundEvent(
      this.nextEventId++,
      soundIndex,
      startTimeSec,
      pitchSemitones
    );
    this.events.push(event);
    return event;
  }

  /**
   * Remove an event by ID
   * @param {number} eventId
   * @returns {boolean} Success
   */
  removeEvent(eventId) {
    const index = this.events.findIndex((e) => e.id === eventId);
    if (index > -1) {
      this.events.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get all events
   * @returns {Array<SoundEvent>}
   */
  getEvents() {
    return this.events;
  }

  /**
   * Get events for a specific sound
   * @param {number} soundIndex
   * @returns {Array<SoundEvent>}
   */
  getEventsForSound(soundIndex) {
    return this.events.filter((e) => e.soundIndex === soundIndex);
  }

  /**
   * Clear all events
   */
  clearEvents() {
    this.events = [];
    this.nextEventId = 0;
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
  }

  /**
   * Get backing track
   * @returns {Object|null}
   */
  getBackingTrack() {
    return this.backingTrack;
  }

  /**
   * Get song duration (from backing track or default 8 seconds)
   * @returns {number}
   */
  getDuration() {
    return this.backingTrack?.duration || 8;
  }

  /**
   * Set selected sounds
   * @param {Array} sounds - Array of {audio, icon}
   */
  setSelectedSounds(sounds) {
    this.selectedSounds = sounds;
  }

  /**
   * Get selected sounds
   * @returns {Array}
   */
  getSelectedSounds() {
    return this.selectedSounds;
  }

  /**
   * Convert to server submission format
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
   * Create Song from server submission format
   * @param {Object} submission - {songData, backingTrack, selectedSounds}
   * @returns {Song}
   */
  static fromSubmission(submission) {
    const song = new Song();

    // Set backing track
    song.setBackingTrack(submission.backingTrack);

    // Set selected sounds
    song.setSelectedSounds(submission.selectedSounds);

    // Convert songData to events
    submission.songData.forEach((data) => {
      const soundIndex = song.selectedSounds.findIndex(
        (s) => s.audio === data.audio
      );
      if (soundIndex !== -1) {
        song.addEvent(soundIndex, data.time, data.pitch);
      }
    });

    return song;
  }

  /**
   * Create a deep copy of this song
   * @returns {Song}
   */
  clone() {
    const song = new Song();
    song.backingTrack = this.backingTrack
      ? { ...this.backingTrack }
      : null;
    song.selectedSounds = this.selectedSounds.map((s) => ({ ...s }));
    song.events = this.events.map((e) => e.clone());
    song.nextEventId = this.nextEventId;
    return song;
  }

  /**
   * Check if song is empty (no events)
   * @returns {boolean}
   */
  isEmpty() {
    return this.events.length === 0;
  }

  /**
   * Get total number of events
   * @returns {number}
   */
  getEventCount() {
    return this.events.length;
  }
}
