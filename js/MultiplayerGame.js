/**
 * MultiplayerGame - Multiplayer version of the music game
 * Integrates with the server for collaborative music creation
 */

// Core systems
import { AudioEngine } from './core/AudioEngine.js';
import { GameState } from './core/GameState.js';
import { UIManager } from './core/UIManager.js';
import { CanvasRenderer } from './core/CanvasRenderer.js';
import { InputController } from './core/InputController.js';
import { Timer } from './core/Timer.js';
import { MultiplayerManager } from './core/MultiplayerManager.js';

// Game phases
import { SelectionPhase } from './phases/SelectionPhase.js';
import { PerformancePhase } from './phases/PerformancePhase.js';
import { EditingPhase } from './phases/EditingPhase.js';
import { FinalPhase } from './phases/FinalPhase.js';

export class MultiplayerGame {
    constructor() {
        // Core systems
        this.audioEngine = new AudioEngine();
        this.gameState = new GameState();
        this.uiManager = new UIManager();
        this.canvasRenderer = new CanvasRenderer();
        this.inputController = new InputController(this.gameState, this.uiManager, this.audioEngine);
        this.timer = new Timer(this.gameState, this.uiManager);
        this.multiplayerManager = new MultiplayerManager();

        // Game phases
        this.selectionPhase = new SelectionPhase(this.gameState, this.uiManager, this.audioEngine, this.timer);
        this.performancePhase = new PerformancePhase(
            this.gameState,
            this.uiManager,
            this.audioEngine,
            this.timer,
            this.canvasRenderer,
            this.inputController
        );
        this.editingPhase = new EditingPhase(
            this.gameState,
            this.uiManager,
            this.audioEngine,
            this.timer,
            this.canvasRenderer,
            this.inputController
        );
        this.finalPhase = new FinalPhase(
            this.gameState,
            this.uiManager,
            this.audioEngine,
            this.canvasRenderer,
            this.inputController
        );

        this.currentPhase = null;
        this.isMultiplayer = true;
        this.serverUrl = 'http://localhost:3000';
    }

    async initialize() {
        try {
            console.log('Initializing MultiplayerGame...');

            // Initialize core systems
            await this.audioEngine.initialize();
            await this.gameState.loadSoundList();
            this.uiManager.initialize();

            // Initialize multiplayer screens
            this.initializeMultiplayerScreens();

            // Setup menu event handlers
            this.setupMenuHandlers();

            // Setup multiplayer event handlers
            this.setupMultiplayerHandlers();

            console.log('MultiplayerGame initialized successfully');
        } catch (error) {
            console.error('Failed to initialize MultiplayerGame:', error);
            alert('Failed to initialize the game. Please refresh and try again.');
        }
    }

    initializeMultiplayerScreens() {
        // Add multiplayer screens to UIManager
        this.uiManager.screens.createLobby = document.getElementById('create-lobby');
        this.uiManager.screens.joinLobby = document.getElementById('join-lobby');
        this.uiManager.screens.lobbyWaiting = document.getElementById('lobby-waiting');

        // Initialize multiplayer elements
        this.uiManager.elements.hostName = document.getElementById('host-name');
        this.uiManager.elements.playerName = document.getElementById('player-name');
        this.uiManager.elements.lobbyCodeInput = document.getElementById('lobby-code');
        this.uiManager.elements.lobbyCodeDisplay = document.getElementById('lobby-code-display');
        this.uiManager.elements.shareableCode = document.getElementById('shareable-code');
        this.uiManager.elements.playerCount = document.getElementById('player-count');
        this.uiManager.elements.playersContainer = document.getElementById('players-container');
        this.uiManager.elements.connectionIndicator = document.getElementById('connection-indicator');
        this.uiManager.elements.gameStarting = document.getElementById('game-starting');
        this.uiManager.elements.startCountdown = document.getElementById('start-countdown');
    }

    setupMenuHandlers() {
        // Menu buttons
        const menuHandlers = {
            'tutorial-btn': () => this.showTutorial(),
            'create-lobby-btn': () => this.showCreateLobby(),
            'join-lobby-btn': () => this.showJoinLobby(),
            'skip-tutorial-btn': () => this.uiManager.showScreen('main-menu'),
            'start-tutorial-btn': () => this.uiManager.showScreen('main-menu')
        };

        this.inputController.setupButtonEvents(menuHandlers);
    }

    setupMultiplayerHandlers() {
        // Lobby creation and joining
        const lobbyHandlers = {
            'back-to-menu-btn': () => this.uiManager.showScreen('main-menu'),
            'back-to-menu-from-join-btn': () => this.uiManager.showScreen('main-menu'),
            'create-lobby-confirm-btn': () => this.createLobby(),
            'join-lobby-confirm-btn': () => this.joinLobby(),
            'leave-lobby-btn': () => this.leaveLobby(),
            'ready-btn': () => this.setReady()
        };

        this.inputController.setupButtonEvents(lobbyHandlers);

        // Input field handlers
        const lobbyCodeInput = this.uiManager.elements.lobbyCodeInput;
        if (lobbyCodeInput) {
            lobbyCodeInput.addEventListener('input', (e) => {
                e.target.value = e.target.value.toUpperCase();
            });
        }

        // Multiplayer event callbacks
        this.multiplayerManager.onGameStateUpdate = (gameState) => {
            this.updateLobbyUI(gameState);
        };

        this.multiplayerManager.onPlayerJoined = (player, gameState) => {
            this.updateLobbyUI(gameState);
            this.showNotification(`${player.name} joined the lobby`);
        };

        this.multiplayerManager.onPlayerLeft = (playerId, gameState) => {
            this.updateLobbyUI(gameState);
            this.showNotification('A player left the lobby');
        };

        this.multiplayerManager.onGameStarted = (gameState) => {
            this.hideGameStarting();
            this.startMultiplayerGame(gameState);
        };

        this.multiplayerManager.onPhaseChange = (gameState) => {
            this.handlePhaseChange(gameState);
        };
    }

    showTutorial() {
        this.gameState.setState('tutorial');
        this.uiManager.showScreen('tutorial');
    }

    showCreateLobby() {
        this.uiManager.showScreen('create-lobby');
        const hostNameInput = this.uiManager.elements.hostName;
        if (hostNameInput) {
            hostNameInput.focus();
        }
    }

    showJoinLobby() {
        this.uiManager.showScreen('join-lobby');
        const playerNameInput = this.uiManager.elements.playerName;
        if (playerNameInput) {
            playerNameInput.focus();
        }
    }

    async createLobby() {
        const hostName = this.uiManager.elements.hostName?.value.trim();
        if (!hostName) {
            alert('Please enter your name');
            return;
        }

        try {
            // Connect to server
            const connected = await this.multiplayerManager.connect(this.serverUrl);
            if (!connected) {
                alert('Failed to connect to server. Please try again.');
                return;
            }

            // Create lobby
            const response = await this.multiplayerManager.createLobby(hostName);
            if (response.success) {
                this.showLobbyWaiting(response.gameState);
            } else {
                alert(response.error || 'Failed to create lobby');
            }
        } catch (error) {
            console.error('Error creating lobby:', error);
            alert('Failed to create lobby. Please try again.');
        }
    }

    async joinLobby() {
        const playerName = this.uiManager.elements.playerName?.value.trim();
        const lobbyCode = this.uiManager.elements.lobbyCodeInput?.value.trim();

        if (!playerName) {
            alert('Please enter your name');
            return;
        }

        if (!lobbyCode || lobbyCode.length !== 6) {
            alert('Please enter a valid 6-character lobby code');
            return;
        }

        try {
            // Connect to server
            const connected = await this.multiplayerManager.connect(this.serverUrl);
            if (!connected) {
                alert('Failed to connect to server. Please try again.');
                return;
            }

            // Join lobby
            const response = await this.multiplayerManager.joinLobby(lobbyCode, playerName);
            if (response.success) {
                this.showLobbyWaiting(response.gameState);
            } else {
                alert(response.error || 'Failed to join lobby');
            }
        } catch (error) {
            console.error('Error joining lobby:', error);
            alert('Failed to join lobby. Please try again.');
        }
    }

    showLobbyWaiting(gameState) {
        this.uiManager.showScreen('lobby-waiting');
        this.updateLobbyUI(gameState);

        // Set lobby code displays
        const lobbyCode = this.multiplayerManager.getLobbyCode();
        if (this.uiManager.elements.lobbyCodeDisplay) {
            this.uiManager.elements.lobbyCodeDisplay.textContent = lobbyCode;
        }
        if (this.uiManager.elements.shareableCode) {
            this.uiManager.elements.shareableCode.textContent = lobbyCode;
        }
    }

    updateLobbyUI(gameState) {
        if (!gameState) return;

        // Update player count
        if (this.uiManager.elements.playerCount) {
            this.uiManager.elements.playerCount.textContent = gameState.players.length;
        }

        // Update players list
        if (this.uiManager.elements.playersContainer) {
            this.uiManager.elements.playersContainer.innerHTML = '';

            gameState.players.forEach(player => {
                const playerItem = document.createElement('div');
                playerItem.className = 'player-item';

                const playerName = document.createElement('span');
                playerName.className = 'player-name';
                playerName.textContent = player.name;

                const playerStatus = document.createElement('span');
                playerStatus.className = 'player-status';

                if (player.isHost) {
                    playerStatus.textContent = 'Host';
                    playerStatus.classList.add('host');
                } else if (player.isReady) {
                    playerStatus.textContent = 'Ready';
                    playerStatus.classList.add('ready');
                } else {
                    playerStatus.textContent = 'Not Ready';
                }

                playerItem.appendChild(playerName);
                playerItem.appendChild(playerStatus);
                this.uiManager.elements.playersContainer.appendChild(playerItem);
            });
        }

        // Update ready button
        const readyBtn = document.getElementById('ready-btn');
        const currentPlayer = gameState.players.find(p => p.id === this.multiplayerManager.getPlayerId());
        if (readyBtn && currentPlayer) {
            if (currentPlayer.isReady) {
                readyBtn.textContent = 'Ready ✓';
                readyBtn.disabled = true;
            } else {
                readyBtn.textContent = 'Ready';
                readyBtn.disabled = false;
            }
        }
    }

    setReady() {
        this.multiplayerManager.setReady();
        this.showGameStarting();
    }

    showGameStarting() {
        const gameStarting = this.uiManager.elements.gameStarting;
        if (gameStarting) {
            gameStarting.style.display = 'block';

            // Start countdown
            let countdown = 3;
            const countdownElement = this.uiManager.elements.startCountdown;

            const updateCountdown = () => {
                if (countdownElement) {
                    countdownElement.textContent = countdown;
                }

                countdown--;
                if (countdown >= 0) {
                    setTimeout(updateCountdown, 1000);
                }
            };

            updateCountdown();
        }
    }

    hideGameStarting() {
        const gameStarting = this.uiManager.elements.gameStarting;
        if (gameStarting) {
            gameStarting.style.display = 'none';
        }
    }

    leaveLobby() {
        this.multiplayerManager.disconnect();
        this.uiManager.showScreen('main-menu');
    }

    async startMultiplayerGame(gameState) {
        try {
            // Resume audio context if needed
            await this.audioEngine.resume();

            // Reset game state
            this.gameState.resetGameData();

            // Load available sounds from server
            this.gameState.availableSounds = gameState.availableSounds.map(index =>
                this.gameState.soundList[index]
            );

            // Start with selection phase
            this.startSelectionPhase();
        } catch (error) {
            console.error('Failed to start multiplayer game:', error);
            alert('Failed to start the game. Please try again.');
        }
    }

    handlePhaseChange(gameState) {
        console.log('Phase changed to:', gameState.state);

        switch (gameState.state) {
            case 'performance':
                this.startPerformancePhase();
                break;
            case 'editing':
                this.startEditingPhase();
                break;
            case 'final':
                this.startFinalPhase();
                break;
        }
    }

    startSelectionPhase() {
        // Clean up current phase
        this.cleanupCurrentPhase();

        // Start selection phase normally - client handles everything
        this.currentPhase = this.selectionPhase;

        this.selectionPhase.start(() => {
            // Selection complete - immediately go to performance phase
            console.log('Selection phase complete, moving to performance phase');
            this.startPerformancePhase();
        });
    }

    startPerformancePhase() {
        // Clean up current phase
        this.cleanupCurrentPhase();

        // Start performance phase immediately - no server communication needed
        this.currentPhase = this.performancePhase;

        this.performancePhase.start(() => {
            // Performance complete - immediately go to editing phase
            console.log('Performance phase complete, moving to editing phase');
            this.startEditingPhase();
        });
    }

    startEditingPhase() {
        // Clean up current phase
        this.cleanupCurrentPhase();

        // Start editing phase immediately - no server communication needed
        this.currentPhase = this.editingPhase;

        this.editingPhase.start(() => {
            // Editing complete - submit song to server and go to final phase
            console.log('Editing phase complete, submitting song and moving to final phase');
            this.submitSongToServer();
            this.startFinalPhase();
        });
    }

    startFinalPhase() {
        // Clean up current phase
        this.cleanupCurrentPhase();

        // Get all final songs from server
        this.multiplayerManager.getFinalSongs().then(response => {
            if (response.success && response.songs.length > 0) {
                // For now, just show the first song
                // In a full implementation, you'd allow cycling through all songs
                const firstSong = response.songs[0];
				if (firstSong && firstSong.songData) {
                    // Convert song data back to events format for playback
                    this.gameState.events = firstSong.songData.map((soundEvent, index) => ({
                        id: index,
                        soundIndex: 0, // We'll need to map this properly
                        startTimeSec: soundEvent.time,
                        pitchSemitones: soundEvent.pitch || 0,
                        scheduled: false
                    }));

                    console.log('Loaded song for final phase:', firstSong.songData);
                }
            }

            // Start final phase
            this.currentPhase = this.finalPhase;
            this.finalPhase.start(
                () => this.restartGame(),  // onRestart
                () => this.exitToMenu()    // onExit
            );
        });
    }

    submitSongToServer() {
        // Convert events to song format with filenames
        const songData = this.gameState.events.map(event => {
            const selectedSound = this.gameState.selectedSounds[event.soundIndex];
            return {
                audio: selectedSound.audio, // filename like "sounds/21.wav"
                icon: selectedSound.icon,   // filename like "sounds/21__icon.png"
                time: event.startTimeSec,
                pitch: event.pitchSemitones || 0
            };
        });

        // Submit song data to server
        this.multiplayerManager.submitSong(songData);
        console.log('Song submitted to server:', songData);
    }

    restartGame() {
        // For multiplayer, return to lobby
        this.leaveLobby();
    }

    exitToMenu() {
        // Clean up and return to menu
        this.cleanupCurrentPhase();
        this.multiplayerManager.disconnect();
        this.gameState.resetForNewGame();
        this.timer.resetAllTimers();
        this.uiManager.showScreen('main-menu');
    }

    cleanupCurrentPhase() {
        if (this.currentPhase && typeof this.currentPhase.cleanup === 'function') {
            this.currentPhase.cleanup();
        }
        this.currentPhase = null;
    }

    showNotification(message) {
        // Simple notification system
        console.log('Notification:', message);
        // Could implement a toast notification system here
    }

    // Global cleanup method
    cleanup() {
        this.cleanupCurrentPhase();
        this.timer.stopAllTimers();
        this.audioEngine.stopPreview();
        this.audioEngine.stopEditPreview();
        this.inputController.cleanup();
        this.multiplayerManager.disconnect();
    }
}

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    const game = new MultiplayerGame();
    await game.initialize();

    // Make game globally accessible for debugging
    window.multiplayerGame = game;
});
