/**
 * SoundEvent - Represents a single sound event in the timeline
 * A sound played at a specific time with optional pitch adjustment
 */
export class SoundEvent {
  constructor(id, soundIndex, startTimeSec, pitchSemitones = 0) {
    this.id = id;
    this.soundIndex = soundIndex; // Index in selectedSounds array (0-2)
    this.startTimeSec = startTimeSec;
    this.pitchSemitones = pitchSemitones;
  }

  /**
   * Get the start time in seconds
   * @returns {number}
   */
  getStartTime() {
    return this.startTimeSec;
  }

  /**
   * Get the sound index
   * @returns {number}
   */
  getSoundIndex() {
    return this.soundIndex;
  }

  /**
   * Get the pitch adjustment in semitones
   * @returns {number}
   */
  getPitch() {
    return this.pitchSemitones;
  }

  /**
   * Set the pitch adjustment
   * @param {number} semitones
   */
  setPitch(semitones) {
    this.pitchSemitones = semitones;
  }

  /**
   * Create a copy of this event
   * @returns {SoundEvent}
   */
  clone() {
    return new SoundEvent(
      this.id,
      this.soundIndex,
      this.startTimeSec,
      this.pitchSemitones
    );
  }

  /**
   * Convert to plain object for serialization
   * @returns {Object}
   */
  toJSON() {
    return {
      id: this.id,
      soundIndex: this.soundIndex,
      startTimeSec: this.startTimeSec,
      pitchSemitones: this.pitchSemitones,
    };
  }

  /**
   * Create SoundEvent from plain object
   * @param {Object} data
   * @returns {SoundEvent}
   */
  static fromJSON(data) {
    return new SoundEvent(
      data.id,
      data.soundIndex,
      data.startTimeSec,
      data.pitchSemitones
    );
  }
}
