/**
 * AudioEngine - Manages Web Audio API operations
 * Handles audio loading, playback, and pitch manipulation with lazy loading
 */
export class AudioEngine {
  constructor() {
    this.context = null;
    this.currentPreview = null;
    this.currentEditPreview = null;
    this.lookaheadTime = 0.2;
    this.audioBufferCache = new Map();
    this.loadingPromises = new Map();

    this.backingTrackAudio = null;
    this.backingTrackStartTime = 0;
    this.isBackingTrackLoaded = false;

    this.menuMusicAudio = null;
    this.isMenuMusicLoaded = false;
  }

  async initialize() {
    try {
      this.context = new (window.AudioContext || window.webkitAudioContext)();
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
   *
   * @param {string} url - Audio file URL
   * @returns {Promise<AudioBuffer>} The decoded audio buffer
   */
  async getAudioBuffer(url) {
    if (this.audioBufferCache.has(url)) {
      return this.audioBufferCache.get(url);
    }

    if (this.loadingPromises.has(url)) {
      return await this.loadingPromises.get(url);
    }

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

  /**
   * @param {AudioBuffer} audioBuffer - Buffer to play
   * @param {number} pitchSemitones - Pitch adjustment in semitones
   * @param {number} scheduleTime - Web Audio API time to schedule playback
   * @returns {AudioBufferSourceNode|null} The audio source node
   */
  playSound(audioBuffer, pitchSemitones = 0, scheduleTime = null) {
    if (!audioBuffer || !this.context) return null;

    const source = this.context.createBufferSource();
    source.buffer = audioBuffer;
    source.detune.value = pitchSemitones * 100;
    source.connect(this.context.destination);
    source.start(scheduleTime || this.context.currentTime);

    return source;
  }

  /**
   * Play a sound from a URL, loading it if necessary
   *
   * @param {string} audioUrl - Audio file URL
   * @param {number} pitchSemitones - Pitch adjustment in semitones
   * @param {number} scheduleTime - Web Audio API time to schedule playback
   * @returns {Promise<AudioBufferSourceNode|null>} The audio source node
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
      } catch (e) {}
      this.currentPreview = null;
    }
  }

  startEditPreview(audioBuffer, pitchSemitones = 0) {
    this.stopEditPreview();
    this.currentEditPreview = this.playSound(audioBuffer, pitchSemitones);

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
      } catch (e) {}
      this.currentEditPreview = null;
    }
  }

  getCurrentTime() {
    return this.context ? this.context.currentTime : 0;
  }

  async loadBackingTrack(trackPath) {
    try {
      this.stopBackingTrack();

      this.backingTrackAudio = new Audio(trackPath);
      this.backingTrackAudio.loop = true;
      this.backingTrackAudio.volume = 0.8;

      await new Promise((resolve, reject) => {
        this.backingTrackAudio.addEventListener("canplaythrough", resolve, {
          once: true,
        });
        this.backingTrackAudio.addEventListener("error", reject, {
          once: true,
        });
        this.backingTrackAudio.load();
      });

      this.isBackingTrackLoaded = true;
    } catch (error) {
      console.error("Failed to load backing track:", error);
      this.isBackingTrackLoaded = false;
    }
  }

  startBackingTrack() {
    if (this.backingTrackAudio && this.isBackingTrackLoaded) {
      this.backingTrackAudio.currentTime = 0;
      this.backingTrackStartTime = this.getCurrentTime();
      return this.backingTrackAudio.play();
    }
    return Promise.resolve();
  }

  pauseBackingTrack() {
    if (this.backingTrackAudio) {
      this.backingTrackAudio.pause();
    }
  }

  resumeBackingTrack() {
    if (this.backingTrackAudio && this.isBackingTrackLoaded) {
      return this.backingTrackAudio.play();
    }
    return Promise.resolve();
  }

  stopBackingTrack() {
    if (this.backingTrackAudio) {
      this.backingTrackAudio.pause();
      this.backingTrackAudio.currentTime = 0;
      this.backingTrackAudio = null;
    }
    this.isBackingTrackLoaded = false;
  }

  seekBackingTrack(time) {
    if (this.backingTrackAudio) {
      this.backingTrackAudio.currentTime = time;
    }
  }

  getBackingTrackCurrentTime() {
    return this.backingTrackAudio ? this.backingTrackAudio.currentTime : 0;
  }

  isBackingTrackPlaying() {
    return this.backingTrackAudio && !this.backingTrackAudio.paused;
  }

  async loadMenuMusic() {
    try {
      this.stopMenuMusic();

      this.menuMusicAudio = new Audio("assets/audio/menu_music.mp3");
      this.menuMusicAudio.loop = true;
      this.menuMusicAudio.volume = 0.3;

      await new Promise((resolve, reject) => {
        this.menuMusicAudio.addEventListener("canplaythrough", resolve, {
          once: true,
        });
        this.menuMusicAudio.addEventListener("error", reject, { once: true });
        this.menuMusicAudio.load();
      });

      this.isMenuMusicLoaded = true;
    } catch (error) {
      console.error("Failed to load menu music:", error);
      this.isMenuMusicLoaded = false;
    }
  }

  startMenuMusic() {
    if (this.menuMusicAudio && this.isMenuMusicLoaded) {
      this.menuMusicAudio.currentTime = 0;
      return this.menuMusicAudio.play();
    }
    return Promise.resolve();
  }

  pauseMenuMusic() {
    if (this.menuMusicAudio) {
      this.menuMusicAudio.pause();
    }
  }

  resumeMenuMusic() {
    if (this.menuMusicAudio && this.isMenuMusicLoaded) {
      return this.menuMusicAudio.play();
    }
    return Promise.resolve();
  }

  stopMenuMusic() {
    if (this.menuMusicAudio) {
      this.menuMusicAudio.pause();
      this.menuMusicAudio.currentTime = 0;
      this.menuMusicAudio = null;
    }
    this.isMenuMusicLoaded = false;
  }

  isMenuMusicPlaying() {
    return this.menuMusicAudio && !this.menuMusicAudio.paused;
  }
}
