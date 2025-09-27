/**
 * Music Mini-Game - Vanilla JavaScript Implementation
 *
 * Game Flow:
 * 1. Main Menu (Tutorial or Play)
 * 2. Sound Selection (10s) - Pick 3 from 5 random sounds
 * 3. Performance Phase (2min) - Record with keys 1,2,3 on 8s loop
 * 4. Editing Phase (1min) - Drag notes vertically to change pitch
 * 5. Final Playback - Loop the creation indefinitely
 *
 * Controls:
 * - Keys 1,2,3: Trigger selected sounds (Performance phase only)
 * - Mouse: Select sounds, drag notes, operate transport controls
 * - Right-click: Delete notes on timeline (Performance phase)
 *
 * Audio: Web Audio API with 120 BPM, 8-second segments
 * Pitch: ±12 semitones using detune (100 cents per semitone)
 */

class MusicGame {
    constructor() {
        this.state = 'menu'; // menu, tutorial, selection, performance, editing, final
        this.audioContext = null;
        this.soundList = [];
        this.selectedSounds = []; // 3 chosen sounds with audio buffers and icons
        this.availableSounds = []; // 5 random sounds for selection
        this.events = []; // Array of SoundEvent objects
        this.nextEventId = 0;

        // Timing
        this.bpm = 120;
        this.segmentLength = 8; // seconds
        this.currentTime = 0;
        this.isPlaying = false;
        this.startTime = 0;
        this.lookaheadTime = 0.2; // seconds
        this.scheduleInterval = null;

        // Phase timers
        this.selectionTimeLeft = 10;
        this.performanceTimeLeft = 90; // 1.5 minutes (90 seconds)
        this.editingTimeLeft = 60;
        this.phaseCountdown = 0;

        // Editing state
        this.draggedNote = null;
        this.draggedCanvasIndex = undefined;
        this.dragStartY = 0;
        this.dragStartPitch = 0;
        this.isDragging = false;
        this.noteHeight = 20;
        this.semitoneHeight = 25;
        this.currentEditPreview = null; // Track current preview for editing

        // Initialize after DOM is ready
        this.initializeElements();
        this.setupCanvases();
        this.setupEventListeners();
        this.init();
    }

    initializeElements() {
        // Screen elements
        this.screens = {
            menu: document.getElementById('main-menu'),
            tutorial: document.getElementById('tutorial'),
            selection: document.getElementById('selection'),
            performance: document.getElementById('performance'),
            editing: document.getElementById('editing'),
            final: document.getElementById('final')
        };

        // UI elements
        this.selectionCountdown = document.getElementById('selection-countdown');
        this.performanceCountdown = document.getElementById('performance-countdown');
        this.editingCountdown = document.getElementById('editing-countdown');
        this.phaseCountdownEl = document.getElementById('phase-countdown');
        this.editingPhaseCountdownEl = document.getElementById('editing-phase-countdown');
        this.selectedCount = document.getElementById('selected-count');
        this.soundGrid = document.getElementById('sound-grid');
        this.continueBtn = document.getElementById('continue-btn');

        // Transport controls
        this.playPauseBtn = document.getElementById('play-pause-btn');
        this.restartBtn = document.getElementById('restart-btn');
        this.progressBar = document.getElementById('progress-bar');
        this.timeDisplay = document.getElementById('time-display');

        this.editPlayPauseBtn = document.getElementById('edit-play-pause-btn');
        this.editRestartBtn = document.getElementById('edit-restart-btn');
        this.editProgressBar = document.getElementById('edit-progress-bar');
        this.editTimeDisplay = document.getElementById('edit-time-display');

        this.finalPlayPauseBtn = document.getElementById('final-play-pause-btn');
        this.finalRestartBtn = document.getElementById('final-restart-btn');
        this.finalProgressBar = document.getElementById('final-progress-bar');
        this.finalTimeDisplay = document.getElementById('final-time-display');

        // Performance continue button
        this.performanceContinueBtn = document.getElementById('performance-continue-btn');
    }

    setupCanvases() {
        // Canvas contexts
        this.timelineCanvas = document.getElementById('timeline-canvas');
        this.finalCanvas = document.getElementById('final-canvas');

        // Editing canvases (3 separate ones)
        this.editingCanvases = [
            document.getElementById('editing-canvas-1'),
            document.getElementById('editing-canvas-2'),
            document.getElementById('editing-canvas-3')
        ];

        console.log('Canvas elements found:', {
            timeline: !!this.timelineCanvas,
            editing1: !!this.editingCanvases[0],
            editing2: !!this.editingCanvases[1],
            editing3: !!this.editingCanvases[2],
            final: !!this.finalCanvas
        });

        this.timelineCtx = this.timelineCanvas ? this.timelineCanvas.getContext('2d') : null;
        this.editingCtxs = this.editingCanvases.map(canvas => canvas ? canvas.getContext('2d') : null);
        this.finalCtx = this.finalCanvas ? this.finalCanvas.getContext('2d') : null;
    }

    setupEventListeners() {
        // Menu buttons
        document.getElementById('tutorial-btn').addEventListener('click', () => this.showTutorial());
        document.getElementById('play-btn').addEventListener('click', () => this.startGame());

        // Tutorial buttons
        document.getElementById('skip-tutorial-btn').addEventListener('click', () => this.startGame());
        document.getElementById('start-tutorial-btn').addEventListener('click', () => this.startGame());

        // Continue button
        this.continueBtn.addEventListener('click', () => this.startPerformance());

        // Performance continue button
        if (this.performanceContinueBtn) {
            this.performanceContinueBtn.addEventListener('click', () => this.startEditing());
        }

        // Transport controls - Performance
        this.playPauseBtn.addEventListener('click', () => this.togglePlayback());
        this.restartBtn.addEventListener('click', () => this.restart());
        this.progressBar.addEventListener('input', (e) => this.seekTo(parseFloat(e.target.value)));

        // Transport controls - Editing
        this.editPlayPauseBtn.addEventListener('click', () => this.toggleEditPlayback());
        this.editRestartBtn.addEventListener('click', () => this.editRestart());
        this.editProgressBar.addEventListener('input', (e) => this.editSeekTo(parseFloat(e.target.value)));

        // Transport controls - Final
        this.finalPlayPauseBtn.addEventListener('click', () => this.toggleFinalPlayback());
        this.finalRestartBtn.addEventListener('click', () => this.finalRestart());
        this.finalProgressBar.addEventListener('input', (e) => this.finalSeekTo(parseFloat(e.target.value)));

        // Final buttons
        document.getElementById('restart-game-btn').addEventListener('click', () => this.restartGame());
        document.getElementById('exit-btn').addEventListener('click', () => this.exitToMenu());

        // Keyboard controls
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));

        // Canvas events (only add if elements exist)
        if (this.timelineCanvas) {
            console.log('Adding timeline canvas events');
            this.timelineCanvas.addEventListener('contextmenu', (e) => this.handleTimelineRightClick(e));
        } else {
            console.log('Timeline canvas not found');
        }

        // Add event listeners to all editing canvases
        this.editingCanvases.forEach((canvas, index) => {
            if (canvas) {
                console.log(`Adding editing canvas ${index + 1} events`);
                canvas.addEventListener('mousedown', (e) => this.handleEditingMouseDown(e, index));
                canvas.addEventListener('mousemove', (e) => this.handleEditingMouseMove(e, index));
                canvas.addEventListener('mouseup', (e) => this.handleEditingMouseUp(e));
                canvas.addEventListener('mouseleave', (e) => this.handleEditingMouseUp(e));
                canvas.addEventListener('click', (e) => this.handleEditingClick(e, index));
            } else {
                console.log(`Editing canvas ${index + 1} not found`);
            }
        });

        // Also add global mouse events for smoother dragging
        document.addEventListener('mousemove', (e) => this.handleGlobalMouseMove(e));
        document.addEventListener('mouseup', (e) => this.handleGlobalMouseUp(e));
    }

    async init() {
        try {
            // Initialize audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

            // Load sound list
            const response = await fetch('./soundlist.json');
            this.soundList = await response.json();

            console.log(`Loaded ${this.soundList.length} sounds`);
        } catch (error) {
            console.error('Failed to initialize game:', error);
            alert('Failed to load game assets. Please refresh and try again.');
        }
    }

    showScreen(screenName) {
        Object.values(this.screens).forEach(screen => {
            screen.classList.remove('active');
        });
        this.screens[screenName].classList.add('active');
        this.state = screenName;
    }

    showTutorial() {
        this.showScreen('tutorial');
    }

    async startGame() {
        // Resume audio context if needed
        if (this.audioContext && this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }

        this.showScreen('selection');
        this.startSelection();
    }

    async startSelection() {
        // Reset selection state
        this.selectedSounds = [];
        this.availableSounds = [];
        this.selectionTimeLeft = 10;
        this.selectedCount.textContent = '0';
        this.continueBtn.disabled = true;

        // Pick 5 random sounds
        const shuffled = [...this.soundList].sort(() => Math.random() - 0.5);
        this.availableSounds = shuffled.slice(0, 5);

        // Clear and populate sound grid
        this.soundGrid.innerHTML = '';

        for (let i = 0; i < this.availableSounds.length; i++) {
            const soundData = this.availableSounds[i];
            const soundOption = document.createElement('div');
            soundOption.className = 'sound-option';
            soundOption.dataset.index = i;

            // Add skeleton loader
            const skeleton = document.createElement('div');
            skeleton.className = 'sound-skeleton';
            soundOption.appendChild(skeleton);

            // Load icon
            const img = document.createElement('img');
            img.onload = () => {
                skeleton.remove();
                soundOption.appendChild(img);
            };
            img.onerror = () => {
                skeleton.remove();
                soundOption.innerHTML = '🎵'; // Fallback
                soundOption.style.display = 'flex';
                soundOption.style.alignItems = 'center';
                soundOption.style.justifyContent = 'center';
                soundOption.style.fontSize = '2rem';
            };
            img.src = soundData.icon;
            img.alt = `Sound ${i + 1}`;

            // Add event listeners
            soundOption.addEventListener('mouseenter', () => this.previewSound(i));
            soundOption.addEventListener('mouseleave', () => this.stopPreview());
            soundOption.addEventListener('click', () => this.selectSound(i));

            this.soundGrid.appendChild(soundOption);
        }

        // Start countdown
        this.startSelectionCountdown();
    }

    startSelectionCountdown() {
        const updateCountdown = () => {
            this.selectionCountdown.textContent = this.selectionTimeLeft;

            if (this.selectionTimeLeft <= 0 || this.selectedSounds.length === 3) {
                if (this.selectedSounds.length === 3) {
                    this.startPerformance();
                } else {
                    // Auto-select remaining sounds
                    this.autoSelectRemaining();
                }
                return;
            }

            this.selectionTimeLeft--;
            setTimeout(updateCountdown, 1000);
        };

        updateCountdown();
    }

    autoSelectRemaining() {
        const unselected = this.availableSounds
            .map((sound, index) => index)
            .filter(index => !this.selectedSounds.some(s => s.originalIndex === index));

        while (this.selectedSounds.length < 3 && unselected.length > 0) {
            const randomIndex = unselected.splice(Math.floor(Math.random() * unselected.length), 1)[0];
            this.selectSound(randomIndex, true);
        }

        setTimeout(() => this.startPerformance(), 500);
    }

    async previewSound(index) {
        this.stopPreview();

        try {
            const soundData = this.availableSounds[index];
            const response = await fetch(soundData.audio);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

            const source = this.audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(this.audioContext.destination);
            source.start();

            this.currentPreview = source;
        } catch (error) {
            console.error('Failed to preview sound:', error);
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

    playEditPreview(event, scheduleTime) {
        // Stop any current edit preview first
        this.stopEditPreview();

        if (!this.selectedSounds[event.soundIndex]) return;

        const source = this.audioContext.createBufferSource();
        source.buffer = this.selectedSounds[event.soundIndex].audioBuffer;

        // Apply pitch adjustment
        source.detune.value = event.pitchSemitones * 100; // 100 cents per semitone

        source.connect(this.audioContext.destination);
        source.start(scheduleTime);

        // Track this as the current edit preview
        this.currentEditPreview = source;

        // Clear the reference when the sound ends naturally
        source.onended = () => {
            if (this.currentEditPreview === source) {
                this.currentEditPreview = null;
            }
        };
    }

    async selectSound(index, auto = false) {
        if (this.selectedSounds.length >= 3) return;

        const soundOption = document.querySelector(`[data-index="${index}"]`);
        if (soundOption.classList.contains('selected')) return;

        try {
            const soundData = this.availableSounds[index];

            // Load audio buffer
            const response = await fetch(soundData.audio);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

            // Add to selected sounds
            this.selectedSounds.push({
                originalIndex: index,
                audioBuffer: audioBuffer,
                icon: soundData.icon,
                audio: soundData.audio
            });

            // Update UI
            soundOption.classList.add('selected');
            this.selectedCount.textContent = this.selectedSounds.length;

            if (this.selectedSounds.length === 3) {
                this.continueBtn.disabled = false;
                // Disable all other options
                document.querySelectorAll('.sound-option:not(.selected)').forEach(el => {
                    el.classList.add('disabled');
                });
            }
        } catch (error) {
            console.error('Failed to load sound:', error);
        }
    }

    async startPerformance() {
        this.showScreen('performance');
        this.events = [];
        this.performanceTimeLeft = 90; // 1.5 minutes (90 seconds)
        this.phaseCountdown = 3;

        // Setup chosen sounds display
        for (let i = 0; i < 3; i++) {
            const icon = document.getElementById(`sound-${i + 1}-icon`);
            if (this.selectedSounds[i]) {
                icon.src = this.selectedSounds[i].icon;
            }
        }

        // Clear timeline canvas immediately to remove old notes
        this.drawTimeline();

        // Show phase countdown
        this.showPhaseCountdown(() => {
            this.startPerformanceLoop();
        });
    }

    showPhaseCountdown(callback) {
        this.phaseCountdownEl.textContent = this.phaseCountdown;
        this.phaseCountdownEl.style.display = 'block';

        const countdownInterval = setInterval(() => {
            this.phaseCountdown--;
            if (this.phaseCountdown <= 0) {
                clearInterval(countdownInterval);
                this.phaseCountdownEl.style.display = 'none';
                callback();
            } else {
                this.phaseCountdownEl.textContent = this.phaseCountdown;
            }
        }, 1000);
    }

    startPerformanceLoop() {
        this.currentTime = 0;
        this.isPlaying = true;
        this.startTime = this.audioContext.currentTime;
        this.playPauseBtn.textContent = '⏸️';

        // Reset all event scheduling flags when starting
        this.events.forEach(event => {
            event.scheduled = false;
        });

        // Start performance countdown
        this.startPerformanceCountdown();

        // Start scheduling loop
        this.startScheduling();

        // Start animation loop
        this.animationLoop();
    }

    startPerformanceCountdown() {
        const updateCountdown = () => {
            if (this.state !== 'performance') return;

            const minutes = Math.floor(this.performanceTimeLeft / 60);
            const seconds = this.performanceTimeLeft % 60;
            this.performanceCountdown.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

            if (this.performanceTimeLeft <= 0) {
                this.startEditing();
                return;
            }

            this.performanceTimeLeft--;
            setTimeout(updateCountdown, 1000);
        };

        updateCountdown();
    }

    startScheduling() {
        if (this.scheduleInterval) {
            clearInterval(this.scheduleInterval);
        }

        this.scheduleInterval = setInterval(() => {
            if (!this.isPlaying) return;

            this.scheduleEvents();
        }, 50); // Check every 50ms
    }

    scheduleEvents() {
        if (!this.isPlaying) return;

        const currentTime = this.audioContext.currentTime;
        const playbackTime = (currentTime - this.startTime) % this.segmentLength;

        // Schedule events that should play in the next lookahead window
        this.events.forEach(event => {
            if (!event.scheduled) {
                const eventTime = event.startTimeSec;
                let nextEventTime = eventTime;

                // Handle looping
                if (eventTime < playbackTime) {
                    nextEventTime = eventTime + this.segmentLength;
                }

                const scheduleTime = currentTime + (nextEventTime - playbackTime);

                if (scheduleTime <= currentTime + this.lookaheadTime) {
                    this.playEvent(event, scheduleTime);
                    event.scheduled = true;

                    // Reset scheduled flag for next loop
                    setTimeout(() => {
                        event.scheduled = false;
                    }, (this.segmentLength - eventTime + 0.1) * 1000);
                }
            }
        });
    }

    playEvent(event, scheduleTime) {
        if (!this.selectedSounds[event.soundIndex]) return;

        const source = this.audioContext.createBufferSource();
        source.buffer = this.selectedSounds[event.soundIndex].audioBuffer;

        // Apply pitch adjustment
        source.detune.value = event.pitchSemitones * 100; // 100 cents per semitone

        source.connect(this.audioContext.destination);
        source.start(scheduleTime);
    }

    animationLoop() {
        if (this.state === 'performance' && this.isPlaying) {
            this.updateCurrentTime();
            this.drawTimeline();
            requestAnimationFrame(() => this.animationLoop());
        } else if (this.state === 'editing' && this.isPlaying) {
            this.updateCurrentTime();
            this.drawEditingView();
            requestAnimationFrame(() => this.animationLoop());
        } else if (this.state === 'final' && this.isPlaying) {
            this.updateCurrentTime();
            this.drawFinalView();
            requestAnimationFrame(() => this.animationLoop());
        }
    }

    updateCurrentTime() {
        if (this.isPlaying) {
            const elapsed = this.audioContext.currentTime - this.startTime;
            this.currentTime = elapsed % this.segmentLength;
        }

        // Update appropriate progress bar and time display
        if (this.state === 'performance') {
            this.progressBar.value = this.currentTime;
            this.timeDisplay.textContent = `${this.currentTime.toFixed(1)} / ${this.segmentLength.toFixed(1)}`;
        } else if (this.state === 'editing') {
            this.editProgressBar.value = this.currentTime;
            this.editTimeDisplay.textContent = `${this.currentTime.toFixed(1)} / ${this.segmentLength.toFixed(1)}`;
        } else if (this.state === 'final') {
            this.finalProgressBar.value = this.currentTime;
            this.finalTimeDisplay.textContent = `${this.currentTime.toFixed(1)} / ${this.segmentLength.toFixed(1)}`;
        }
    }

    drawTimeline() {
        const canvas = this.timelineCanvas;
        const ctx = this.timelineCtx;
        if (!canvas || !ctx) return;

        const width = canvas.width;
        const height = canvas.height;

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // Draw background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.fillRect(0, 0, width, height);

        // Draw three horizontal tracks for each sound
        const trackHeight = height / 3;

        // Draw track separators
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        for (let i = 1; i < 3; i++) {
            const y = i * trackHeight;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }

        // Draw time grid
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 8; i++) {
            const x = (i / 8) * width;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }

        // Draw track labels
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'left';
        for (let i = 0; i < 3; i++) {
            const y = i * trackHeight + trackHeight / 2;
            ctx.fillText(`Sound ${i + 1}`, 10, y + 5);
        }

        // Draw events on their respective tracks
        this.events.forEach(event => {
            const x = (event.startTimeSec / this.segmentLength) * width;
            const trackY = event.soundIndex * trackHeight + trackHeight / 2;

            // Draw event marker
            ctx.fillStyle = this.getSoundColor(event.soundIndex);
            ctx.beginPath();
            ctx.arc(x, trackY, 8, 0, Math.PI * 2);
            ctx.fill();

            // Add white border for better visibility
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Draw sound number
            ctx.fillStyle = 'white';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText((event.soundIndex + 1).toString(), x, trackY + 4);
        });

        // Draw playhead
        const playheadX = (this.currentTime / this.segmentLength) * width;
        ctx.strokeStyle = '#ff4757';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(playheadX, 0);
        ctx.lineTo(playheadX, height);
        ctx.stroke();
    }

    getSoundColor(soundIndex) {
        const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1'];
        return colors[soundIndex] || '#999';
    }

    handleKeyDown(e) {
        // Only allow keyboard input during performance phase
        if (this.state !== 'performance') return;
        if (!this.isPlaying) return;

        const key = e.key;
        let soundIndex = -1;

        if (key === '1') soundIndex = 0;
        else if (key === '2') soundIndex = 1;
        else if (key === '3') soundIndex = 2;

        if (soundIndex >= 0 && soundIndex < this.selectedSounds.length) {
            e.preventDefault();

            // Visual feedback
            const keyEl = document.querySelector(`.sound-key:nth-child(${soundIndex + 1}) .key`);
            if (keyEl) {
                keyEl.classList.add('pressed');
            }

            // Play sound immediately
            this.playEvent({
                soundIndex: soundIndex,
                pitchSemitones: 0
            }, this.audioContext.currentTime);

            // Record event
            const event = {
                id: this.nextEventId++,
                soundIndex: soundIndex,
                startTimeSec: this.currentTime,
                pitchSemitones: 0,
                scheduled: false
            };

            this.events.push(event);
        }
    }

    handleKeyUp(e) {
        const key = e.key;
        let soundIndex = -1;

        if (key === '1') soundIndex = 0;
        else if (key === '2') soundIndex = 1;
        else if (key === '3') soundIndex = 2;

        if (soundIndex >= 0) {
            const keyEl = document.querySelector(`.sound-key:nth-child(${soundIndex + 1}) .key`);
            if (keyEl) {
                keyEl.classList.remove('pressed');
            }
        }
    }

    handleTimelineRightClick(e) {
        console.log('Timeline right click handler called - state:', this.state);
        e.preventDefault();

        if (this.state !== 'performance' || !this.timelineCanvas) {
            console.log('Timeline right click ignored - state:', this.state, 'canvas:', !!this.timelineCanvas);
            return;
        }

        const rect = this.timelineCanvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        console.log('Timeline right click at:', mouseX, mouseY, 'events count:', this.events.length);

        // Find events near the click (using distance to event markers, not just time)
        const trackHeight = this.timelineCanvas.height / 3;
        const eventsToRemove = this.events.filter(event => {
            const x = (event.startTimeSec / this.segmentLength) * this.timelineCanvas.width;
            const y = event.soundIndex * trackHeight + trackHeight / 2;

            const distance = Math.sqrt(
                Math.pow(mouseX - x, 2) +
                Math.pow(mouseY - y, 2)
            );

            return distance <= 15; // 15px hit radius
        });

        // Remove the closest event
        if (eventsToRemove.length > 0) {
            const closest = eventsToRemove.reduce((prev, curr) => {
                const prevX = (prev.startTimeSec / this.segmentLength) * this.timelineCanvas.width;
                const prevY = prev.soundIndex * trackHeight + trackHeight / 2;
                const currX = (curr.startTimeSec / this.segmentLength) * this.timelineCanvas.width;
                const currY = curr.soundIndex * trackHeight + trackHeight / 2;

                const prevDistance = Math.sqrt(Math.pow(mouseX - prevX, 2) + Math.pow(mouseY - prevY, 2));
                const currDistance = Math.sqrt(Math.pow(mouseX - currX, 2) + Math.pow(mouseY - currY, 2));

                return currDistance < prevDistance ? curr : prev;
            });

            const index = this.events.indexOf(closest);
            if (index > -1) {
                this.events.splice(index, 1);
                console.log('Removed event:', closest); // Debug log

                // Redraw the timeline immediately to show the deletion
                this.drawTimeline();
            }
        }
    }

    togglePlayback() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    play() {
        this.isPlaying = true;
        this.startTime = this.audioContext.currentTime - this.currentTime;
        this.playPauseBtn.textContent = '⏸️';

        // Reset all event scheduling flags when resuming play
        this.events.forEach(event => {
            event.scheduled = false;
        });

        this.startScheduling();
        this.animationLoop();
    }

    pause() {
        this.isPlaying = false;
        this.playPauseBtn.textContent = '▶️';
        if (this.scheduleInterval) {
            clearInterval(this.scheduleInterval);
        }
    }

    restart() {
        this.currentTime = 0;
        this.startTime = this.audioContext.currentTime;
        this.progressBar.value = 0;
        this.timeDisplay.textContent = `0.0 / ${this.segmentLength.toFixed(1)}`;

        // Reset all event scheduling flags so they can be scheduled again immediately
        this.events.forEach(event => {
            event.scheduled = false;
        });
    }

    seekTo(time) {
        this.currentTime = time;
        this.startTime = this.audioContext.currentTime - time;
        this.timeDisplay.textContent = `${time.toFixed(1)} / ${this.segmentLength.toFixed(1)}`;

        // Reset all event scheduling flags when seeking
        this.events.forEach(event => {
            event.scheduled = false;
        });
    }

    async startEditing() {
        this.showScreen('editing');
        this.editingTimeLeft = 60;
        this.phaseCountdown = 3;
        this.isPlaying = false;

        // Reset transport state
        this.currentTime = 0;
        this.editPlayPauseBtn.textContent = '▶️';
        this.editProgressBar.value = 0;
        this.editTimeDisplay.textContent = `0.0 / ${this.segmentLength.toFixed(1)}`;

        // Draw the editing view immediately when showing the screen
        this.drawEditingView();

        this.showEditingPhaseCountdown(() => {
            this.startEditingCountdown();
        });
    }

    showEditingPhaseCountdown(callback) {
        this.editingPhaseCountdownEl.textContent = this.phaseCountdown;
        this.editingPhaseCountdownEl.style.display = 'block';

        const countdownInterval = setInterval(() => {
            this.phaseCountdown--;
            if (this.phaseCountdown <= 0) {
                clearInterval(countdownInterval);
                this.editingPhaseCountdownEl.style.display = 'none';
                callback();
            } else {
                this.editingPhaseCountdownEl.textContent = this.phaseCountdown;
            }
        }, 1000);
    }

    startEditingCountdown() {
        // Draw the editing view immediately when starting
        this.drawEditingView();

        const updateCountdown = () => {
            if (this.state !== 'editing') return;

            this.editingCountdown.textContent = this.editingTimeLeft;

            if (this.editingTimeLeft <= 0) {
                this.startFinalPlayback();
                return;
            }

            this.editingTimeLeft--;
            setTimeout(updateCountdown, 1000);
        };

        updateCountdown();
    }

    drawEditingView() {
        // Draw each sound type on its own canvas
        for (let soundIndex = 0; soundIndex < 3; soundIndex++) {
            this.drawEditingTrack(soundIndex);
        }
    }

    drawEditingTrack(soundIndex) {
        const canvas = this.editingCanvases[soundIndex];
        const ctx = this.editingCtxs[soundIndex];
        if (!canvas || !ctx) return;

        const width = canvas.width;
        const height = canvas.height;

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // Draw background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.fillRect(0, 0, width, height);

        // Draw time grid
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 8; i++) {
            const x = (i / 8) * width;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }

        // Draw center line (0 semitones)
        const centerY = height / 2;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        ctx.lineTo(width, centerY);
        ctx.stroke();

        // Draw semitone lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        for (let i = -12; i <= 12; i++) {
            if (i === 0) continue; // Skip center line
            const y = centerY - (i * this.semitoneHeight);
            if (y >= 0 && y <= height) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
                ctx.stroke();
            }
        }

        // Draw events for this sound type only
        this.events.forEach((event) => {
            if (event.soundIndex !== soundIndex) return; // Only draw events for this sound

            const x = (event.startTimeSec / this.segmentLength) * width;
            const y = centerY - (event.pitchSemitones * this.semitoneHeight);

            // Draw event
            ctx.fillStyle = this.getSoundColor(event.soundIndex);
            ctx.beginPath();
            ctx.arc(x, y, 12, 0, Math.PI * 2);
            ctx.fill();

            // Add border for better visibility
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Draw sound number
            ctx.fillStyle = 'white';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText((event.soundIndex + 1).toString(), x, y + 4);

            // Store position for dragging (with canvas reference)
            event.displayX = x;
            event.displayY = y;
            event.canvasIndex = soundIndex;
        });

        // Draw playhead if playing
        if (this.isPlaying) {
            const playheadX = (this.currentTime / this.segmentLength) * width;
            ctx.strokeStyle = '#ff4757';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(playheadX, 0);
            ctx.lineTo(playheadX, height);
            ctx.stroke();
        }
    }

    handleEditingMouseDown(e, canvasIndex) {
        console.log('handleEditingMouseDown called - state:', this.state, 'canvas index:', canvasIndex);

        const canvas = this.editingCanvases[canvasIndex];
        if (!canvas || this.state !== 'editing') {
            console.log('Editing mousedown ignored - state:', this.state, 'canvas:', !!canvas);
            return;
        }

        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        console.log('Mouse down at:', mouseX, mouseY, 'events count:', this.events.length);

        // Find clicked event (only events for this canvas/sound)
        const clickedEvent = this.events.find(event => {
            if (event.soundIndex !== canvasIndex) return false; // Only events for this sound
            if (!event.displayX || !event.displayY) {
                console.log('Event missing display coordinates:', event);
                return false;
            }
            const distance = Math.sqrt(
                Math.pow(mouseX - event.displayX, 2) +
                Math.pow(mouseY - event.displayY, 2)
            );
            console.log('Checking event at:', event.displayX, event.displayY, 'distance:', distance);
            return distance <= 15; // Increased hit area
        });

        if (clickedEvent) {
            console.log('Found clicked event:', clickedEvent);
            this.draggedNote = clickedEvent;
            this.draggedCanvasIndex = canvasIndex;
            this.dragStartY = mouseY;
            this.dragStartPitch = clickedEvent.pitchSemitones;
            this.isDragging = true;

            // Play the note immediately on mousedown
            this.playEditPreview(clickedEvent, this.audioContext.currentTime);

            // Change cursor
            canvas.style.cursor = 'grabbing';
        } else {
            console.log('No event found near click position');
        }
    }

    handleEditingMouseMove(e, canvasIndex) {
        if (!this.draggedNote || !this.isDragging) return;

        const canvas = this.editingCanvases[this.draggedCanvasIndex];
        if (!canvas) return;

        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const mouseY = e.clientY - rect.top;
        const deltaY = this.dragStartY - mouseY;

        console.log('Dragging, deltaY:', deltaY, 'semitoneHeight:', this.semitoneHeight); // Debug log

        // Calculate new pitch based on mouse movement - each semitoneHeight pixels = 1 semitone
        const pitchChange = Math.round(deltaY / this.semitoneHeight);

        // With individual canvases, we can use the full ±12 semitone range
        const newPitch = Math.max(-12, Math.min(12, this.dragStartPitch + pitchChange));

        console.log('Pitch change:', pitchChange, 'new pitch:', newPitch, 'old pitch:', this.draggedNote.pitchSemitones); // Debug log

        if (newPitch !== this.draggedNote.pitchSemitones) {
            this.draggedNote.pitchSemitones = newPitch;

            // Play preview when pitch changes (responsive feedback)
            this.playEditPreview(this.draggedNote, this.audioContext.currentTime);
        }

        this.drawEditingView();
    }

    handleEditingMouseUp(e) {
        if (this.draggedNote) {
            console.log('Mouse up, ending drag'); // Debug log

            // Stop any current edit preview when dragging ends
            this.stopEditPreview();

            // Reset cursor on the dragged canvas
            if (this.draggedCanvasIndex !== undefined) {
                const canvas = this.editingCanvases[this.draggedCanvasIndex];
                if (canvas) {
                    canvas.style.cursor = 'grab';
                }
            }

            this.draggedNote = null;
            this.draggedCanvasIndex = undefined;
            this.isDragging = false;
        }
    }

    handleEditingClick(e, canvasIndex) {
        // Click handling is now done in mousedown for better responsiveness
        // This method is kept for compatibility but doesn't need to do anything
    }

    handleGlobalMouseMove(e) {
        // Handle dragging even when mouse moves outside canvas
        if (this.draggedNote && this.isDragging && this.state === 'editing') {
            this.handleEditingMouseMove(e);
        }
    }

    handleGlobalMouseUp(e) {
        // End dragging even when mouse is released outside canvas
        if (this.draggedNote && this.isDragging) {
            this.handleEditingMouseUp(e);
        }
    }

    toggleEditPlayback() {
        if (this.isPlaying) {
            this.editPause();
        } else {
            this.editPlay();
        }
    }

    editPlay() {
        this.isPlaying = true;
        this.startTime = this.audioContext.currentTime - this.currentTime;
        this.editPlayPauseBtn.textContent = '⏸️';

        // Reset all event scheduling flags when starting edit playback
        this.events.forEach(event => {
            event.scheduled = false;
        });

        this.startScheduling();
        this.animationLoop();
    }

    editPause() {
        this.isPlaying = false;
        this.editPlayPauseBtn.textContent = '▶️';
        if (this.scheduleInterval) {
            clearInterval(this.scheduleInterval);
        }
    }

    editRestart() {
        this.currentTime = 0;
        this.startTime = this.audioContext.currentTime;
        this.editProgressBar.value = 0;
        this.editTimeDisplay.textContent = `0.0 / ${this.segmentLength.toFixed(1)}`;

        // Reset all event scheduling flags
        this.events.forEach(event => {
            event.scheduled = false;
        });
    }

    editSeekTo(time) {
        this.currentTime = time;
        this.startTime = this.audioContext.currentTime - time;
        this.editTimeDisplay.textContent = `${time.toFixed(1)} / ${this.segmentLength.toFixed(1)}`;

        // Reset all event scheduling flags when seeking
        this.events.forEach(event => {
            event.scheduled = false;
        });
    }

    startFinalPlayback() {
        // Stop any current edit previews when leaving editing phase
        this.stopEditPreview();

        this.showScreen('final');
        this.currentTime = 0;
        this.isPlaying = true;
        this.startTime = this.audioContext.currentTime;
        this.finalPlayPauseBtn.textContent = '⏸️';
        this.finalProgressBar.value = 0;
        this.finalTimeDisplay.textContent = `0.0 / ${this.segmentLength.toFixed(1)}`;

        // Reset all event scheduling flags when starting final playback
        this.events.forEach(event => {
            event.scheduled = false;
        });

        this.startScheduling();
        this.animationLoop();
    }

    drawFinalView() {
        const canvas = this.finalCanvas;
        const ctx = this.finalCtx;
        if (!canvas || !ctx) return;

        const width = canvas.width;
        const height = canvas.height;

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // Draw background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.fillRect(0, 0, width, height);

        // Draw time grid
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;

        for (let i = 0; i <= 8; i++) {
            const x = (i / 8) * width;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }

        // Draw events
        this.events.forEach(event => {
            const x = (event.startTimeSec / this.segmentLength) * width;
            const centerY = height / 2;
            const y = centerY - (event.pitchSemitones * 5); // Visual offset for pitch

            // Draw event marker
            ctx.fillStyle = this.getSoundColor(event.soundIndex);
            ctx.beginPath();
            ctx.arc(x, y, 10, 0, Math.PI * 2);
            ctx.fill();

            // Draw sound number
            ctx.fillStyle = 'white';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText((event.soundIndex + 1).toString(), x, y + 4);
        });

        // Draw playhead
        const playheadX = (this.currentTime / this.segmentLength) * width;
        ctx.strokeStyle = '#ff4757';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(playheadX, 0);
        ctx.lineTo(playheadX, height);
        ctx.stroke();
    }

    toggleFinalPlayback() {
        if (this.isPlaying) {
            this.finalPause();
        } else {
            this.finalPlay();
        }
    }

    finalPlay() {
        this.isPlaying = true;
        this.startTime = this.audioContext.currentTime - this.currentTime;
        this.finalPlayPauseBtn.textContent = '⏸️';

        // Reset all event scheduling flags when starting final playback
        this.events.forEach(event => {
            event.scheduled = false;
        });

        this.startScheduling();
        this.animationLoop();
    }

    finalPause() {
        this.isPlaying = false;
        this.finalPlayPauseBtn.textContent = '▶️';
        if (this.scheduleInterval) {
            clearInterval(this.scheduleInterval);
        }
    }

    finalRestart() {
        this.currentTime = 0;
        this.startTime = this.audioContext.currentTime;
        this.finalProgressBar.value = 0;
        this.finalTimeDisplay.textContent = `0.0 / ${this.segmentLength.toFixed(1)}`;

        // Reset all event scheduling flags
        this.events.forEach(event => {
            event.scheduled = false;
        });
    }

    finalSeekTo(time) {
        this.currentTime = time;
        this.startTime = this.audioContext.currentTime - time;
        this.finalTimeDisplay.textContent = `${time.toFixed(1)} / ${this.segmentLength.toFixed(1)}`;

        // Reset all event scheduling flags when seeking
        this.events.forEach(event => {
            event.scheduled = false;
        });
    }

    restartGame() {
        // Stop any current previews
        this.stopPreview();
        this.stopEditPreview();

        // Reset all game state
        this.events = [];
        this.selectedSounds = [];
        this.availableSounds = [];
        this.nextEventId = 0;
        this.currentTime = 0;
        this.isPlaying = false;

        if (this.scheduleInterval) {
            clearInterval(this.scheduleInterval);
        }

        this.startGame();
    }

    exitToMenu() {
        // Stop any current previews
        this.stopPreview();
        this.stopEditPreview();

        // Reset all game state
        this.events = [];
        this.selectedSounds = [];
        this.availableSounds = [];
        this.nextEventId = 0;
        this.currentTime = 0;
        this.isPlaying = false;

        if (this.scheduleInterval) {
            clearInterval(this.scheduleInterval);
        }

        this.showScreen('menu');
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new MusicGame();
});
