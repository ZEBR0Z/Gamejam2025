/**
 * AudioEngine - Manages Web Audio API operations
 * Handles audio loading, playback, and pitch manipulation
 */
export class AudioEngine {
    constructor() {
        this.context = null;
        this.currentPreview = null;
        this.currentEditPreview = null;
        this.lookaheadTime = 0.2; // seconds
    }

    async initialize() {
        try {
            this.context = new (window.AudioContext || window.webkitAudioContext)();
            console.log('AudioEngine initialized');
        } catch (error) {
            console.error('Failed to initialize AudioEngine:', error);
            throw error;
        }
    }

    async resume() {
        if (this.context && this.context.state === 'suspended') {
            await this.context.resume();
        }
    }

    async loadAudioBuffer(url) {
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            return await this.context.decodeAudioData(arrayBuffer);
        } catch (error) {
            console.error('Failed to load audio buffer:', error);
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

    startPreview(audioBuffer) {
        this.stopPreview();
        this.currentPreview = this.playSound(audioBuffer);
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
