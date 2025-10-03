/**
 * AudioService - Manages Web Audio API operations
 * Handles audio loading, playback, and pitch manipulation with lazy loading
 * Stateless service that operates on data passed to it
 */
export class AudioService {
  constructor() {
    this.context = null;
    this.audioBufferCache = new Map();
    this.loadingPromises = new Map();

    // Preview playback tracking
    this.currentPreview = null;
    this.currentEditPreview = null;

    // Backing track (HTML5 Audio for looping)
    this.backingTrackAudio = null;
    this.backingTrackStartTime = 0;
    this.isBackingTrackLoaded = false;

    // Menu music (HTML5 Audio for looping)
    this.menuMusicAudio = null;
    this.isMenuMusicLoaded = false;

    this.lookaheadTime = 0.2;
  }

  /**
   * Initialize Web Audio API context
   */
  async initialize() {
    try {
      this.context = new (window.AudioContext || window.webkitAudioContext)();
      console.log("AudioService initialized");
    } catch (error) {
      console.error("Failed to initialize AudioService:", error);
      throw error;
    }
  }

  /**
   * Resume audio context (required after user interaction)
   */
  async resume() {
    if (this.context && this.context.state === "suspended") {
      await this.context.resume();
    }
  }

  /**
   * Get current Web Audio API time
   * @returns {number}
   */
  getCurrentTime() {
    return this.context ? this.context.currentTime : 0;
  }

  /**
   * Load an audio buffer from URL
   * @param {string} url - Audio file URL
   * @returns {Promise<AudioBuffer>}
   */
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
   * @param {string} url - Audio file URL
   * @returns {Promise<AudioBuffer>}
   */
  async getAudioBuffer(url) {
    // Return cached buffer if available
    if (this.audioBufferCache.has(url)) {
      return this.audioBufferCache.get(url);
    }

    // Return ongoing load promise if already loading
    if (this.loadingPromises.has(url)) {
      return await this.loadingPromises.get(url);
    }

    // Start new load
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
   * Play an audio buffer
   * @param {AudioBuffer} audioBuffer - Buffer to play
   * @param {number} pitchSemitones - Pitch adjustment in semitones
   * @param {number} scheduleTime - Web Audio API time to schedule playback
   * @returns {AudioBufferSourceNode|null}
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
   * @param {string} audioUrl - Audio file URL
   * @param {number} pitchSemitones - Pitch adjustment in semitones
   * @param {number} scheduleTime - Web Audio API time to schedule playback
   * @returns {Promise<AudioBufferSourceNode|null>}
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

  // ===== PREVIEW PLAYBACK =====

  /**
   * Start preview playback from audio buffer
   * @param {AudioBuffer} audioBuffer
   */
  startPreview(audioBuffer) {
    this.stopPreview();
    this.currentPreview = this.playSound(audioBuffer);
  }

  /**
   * Start preview playback from URL
   * @param {string} audioUrl
   */
  async startPreviewFromUrl(audioUrl) {
    this.stopPreview();
    try {
      const audioBuffer = await this.getAudioBuffer(audioUrl);
      this.currentPreview = this.playSound(audioBuffer);
    } catch (error) {
      console.error("Failed to start preview from URL:", audioUrl, error);
    }
  }

  /**
   * Stop preview playback
   */
  stopPreview() {
    if (this.currentPreview) {
      try {
        this.currentPreview.stop();
      } catch (e) {
        // Ignore errors (already stopped)
      }
      this.currentPreview = null;
    }
  }

  // ===== EDIT PREVIEW PLAYBACK =====

  /**
   * Start edit preview playback from audio buffer
   * @param {AudioBuffer} audioBuffer
   * @param {number} pitchSemitones
   */
  startEditPreview(audioBuffer, pitchSemitones = 0) {
    this.stopEditPreview();
    this.currentEditPreview = this.playSound(audioBuffer, pitchSemitones);

    if (this.currentEditPreview) {
      this.currentEditPreview.onended = () => {
        this.currentEditPreview = null;
      };
    }
  }

  /**
   * Start edit preview playback from URL
   * @param {string} audioUrl
   * @param {number} pitchSemitones
   */
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

  /**
   * Stop edit preview playback
   */
  stopEditPreview() {
    if (this.currentEditPreview) {
      try {
        this.currentEditPreview.stop();
      } catch (e) {
        // Ignore errors (already stopped)
      }
      this.currentEditPreview = null;
    }
  }

  // ===== BACKING TRACK (HTML5 Audio) =====

  /**
   * Load backing track
   * @param {string} trackPath
   */
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
      throw error;
    }
  }

  /**
   * Start backing track playback
   */
  async startBackingTrack() {
    if (this.backingTrackAudio && this.isBackingTrackLoaded) {
      this.backingTrackAudio.currentTime = 0;
      this.backingTrackStartTime = this.getCurrentTime();
      return this.backingTrackAudio.play();
    }
    return Promise.resolve();
  }

  /**
   * Pause backing track
   */
  pauseBackingTrack() {
    if (this.backingTrackAudio) {
      this.backingTrackAudio.pause();
    }
  }

  /**
   * Resume backing track
   */
  async resumeBackingTrack() {
    if (this.backingTrackAudio && this.isBackingTrackLoaded) {
      return this.backingTrackAudio.play();
    }
    return Promise.resolve();
  }

  /**
   * Stop backing track
   */
  stopBackingTrack() {
    if (this.backingTrackAudio) {
      this.backingTrackAudio.pause();
      this.backingTrackAudio.currentTime = 0;
      this.backingTrackAudio = null;
    }
    this.isBackingTrackLoaded = false;
  }

  /**
   * Seek backing track to specific time
   * @param {number} time - Time in seconds
   */
  seekBackingTrack(time) {
    if (this.backingTrackAudio) {
      this.backingTrackAudio.currentTime = time;
    }
  }

  /**
   * Get backing track current time
   * @returns {number}
   */
  getBackingTrackCurrentTime() {
    return this.backingTrackAudio ? this.backingTrackAudio.currentTime : 0;
  }

  /**
   * Check if backing track is playing
   * @returns {boolean}
   */
  isBackingTrackPlaying() {
    return this.backingTrackAudio && !this.backingTrackAudio.paused;
  }

  // ===== MENU MUSIC (HTML5 Audio) =====

  /**
   * Load menu music
   */
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

  /**
   * Start menu music
   */
  async startMenuMusic() {
    if (this.menuMusicAudio && this.isMenuMusicLoaded) {
      this.menuMusicAudio.currentTime = 0;
      return this.menuMusicAudio.play();
    }
    return Promise.resolve();
  }

  /**
   * Pause menu music
   */
  pauseMenuMusic() {
    if (this.menuMusicAudio) {
      this.menuMusicAudio.pause();
    }
  }

  /**
   * Resume menu music
   */
  async resumeMenuMusic() {
    if (this.menuMusicAudio && this.isMenuMusicLoaded) {
      return this.menuMusicAudio.play();
    }
    return Promise.resolve();
  }

  /**
   * Stop menu music
   */
  stopMenuMusic() {
    if (this.menuMusicAudio) {
      this.menuMusicAudio.pause();
      this.menuMusicAudio.currentTime = 0;
      this.menuMusicAudio = null;
    }
    this.isMenuMusicLoaded = false;
  }

  /**
   * Check if menu music is playing
   * @returns {boolean}
   */
  isMenuMusicPlaying() {
    return this.menuMusicAudio && !this.menuMusicAudio.paused;
  }

  /**
   * Cleanup all audio resources
   */
  cleanup() {
    this.stopPreview();
    this.stopEditPreview();
    this.stopBackingTrack();
    this.stopMenuMusic();
    this.audioBufferCache.clear();
    this.loadingPromises.clear();
  }
}
