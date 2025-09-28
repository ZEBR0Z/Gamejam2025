/**
 * AudioEngine - Manages Web Audio API operations
 * Handles audio loading, playback, and pitch manipulation with lazy loading
 */
export class AudioEngine {
  constructor() {
    this.context = null;
    this.currentPreview = null;
    this.currentEditPreview = null;
    this.lookaheadTime = 0.2; // seconds
    this.audioBufferCache = new Map(); // Cache for loaded audio buffers
    this.loadingPromises = new Map(); // Track ongoing loads to prevent duplicates
  }

  async initialize() {
    try {
      this.context = new (window.AudioContext || window.webkitAudioContext)();
      console.log("AudioEngine initialized");
    } catch (error) {
      console.error("Failed to initialize AudioEngine:", error);
      throw error;
    }
  }

  async resume() {
    if (this.context && this.context.state === "suspended") {
      await this.context.resume();
    }
  }

  async loadAudioBuffer(url) {
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      return await this.context.decodeAudioData(arrayBuffer);
    } catch (error) {
      console.error("Failed to load audio buffer:", error);
      throw error;
    }
  }

  /**
   * Get an audio buffer for the given URL, loading it if necessary
   * Uses caching to avoid loading the same file multiple times
   */
  async getAudioBuffer(url) {
    // Check if already cached
    if (this.audioBufferCache.has(url)) {
      return this.audioBufferCache.get(url);
    }

    // Check if already loading
    if (this.loadingPromises.has(url)) {
      return await this.loadingPromises.get(url);
    }

    // Start loading
    const loadPromise = this.loadAudioBuffer(url);
    this.loadingPromises.set(url, loadPromise);

    try {
      const audioBuffer = await loadPromise;
      this.audioBufferCache.set(url, audioBuffer);
      this.loadingPromises.delete(url);
      return audioBuffer;
    } catch (error) {
      this.loadingPromises.delete(url);
      throw error;
    }
  }

  playSound(audioBuffer, pitchSemitones = 0, scheduleTime = null) {
    if (!audioBuffer || !this.context) return null;

    const source = this.context.createBufferSource();
    source.buffer = audioBuffer;

    // Apply pitch adjustment (100 cents per semitone)
    source.detune.value = pitchSemitones * 100;

    source.connect(this.context.destination);
    source.start(scheduleTime || this.context.currentTime);

    return source;
  }

  /**
   * Play a sound from a URL, loading it if necessary
   * Returns a promise that resolves to the audio source node
   */
  async playSoundFromUrl(audioUrl, pitchSemitones = 0, scheduleTime = null) {
    try {
      const audioBuffer = await this.getAudioBuffer(audioUrl);
      return this.playSound(audioBuffer, pitchSemitones, scheduleTime);
    } catch (error) {
      console.error("Failed to play sound from URL:", audioUrl, error);
      return null;
    }
  }

  startPreview(audioBuffer) {
    this.stopPreview();
    this.currentPreview = this.playSound(audioBuffer);
  }

  async startPreviewFromUrl(audioUrl) {
    this.stopPreview();
    try {
      const audioBuffer = await this.getAudioBuffer(audioUrl);
      this.currentPreview = this.playSound(audioBuffer);
    } catch (error) {
      console.error("Failed to start preview from URL:", audioUrl, error);
    }
  }

  stopPreview() {
    if (this.currentPreview) {
      try {
        this.currentPreview.stop();
      } catch (e) {
        // Ignore if already stopped
      }
      this.currentPreview = null;
    }
  }

  startEditPreview(audioBuffer, pitchSemitones = 0) {
    this.stopEditPreview();
    this.currentEditPreview = this.playSound(audioBuffer, pitchSemitones);

    // Clear reference when sound ends naturally
    if (this.currentEditPreview) {
      this.currentEditPreview.onended = () => {
        this.currentEditPreview = null;
      };
    }
  }

  async startEditPreviewFromUrl(audioUrl, pitchSemitones = 0) {
    this.stopEditPreview();
    try {
      const audioBuffer = await this.getAudioBuffer(audioUrl);
      this.currentEditPreview = this.playSound(audioBuffer, pitchSemitones);

      // Clear reference when sound ends naturally
      if (this.currentEditPreview) {
        this.currentEditPreview.onended = () => {
          this.currentEditPreview = null;
        };
      }
    } catch (error) {
      console.error("Failed to start edit preview from URL:", audioUrl, error);
    }
  }

  stopEditPreview() {
    if (this.currentEditPreview) {
      try {
        this.currentEditPreview.stop();
      } catch (e) {
        // Ignore if already stopped
      }
      this.currentEditPreview = null;
    }
  }

  getCurrentTime() {
    return this.context ? this.context.currentTime : 0;
  }
}
