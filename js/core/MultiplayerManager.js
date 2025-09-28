/**
 * MultiplayerManager - Handles multiplayer communication with the server
 * Manages WebSocket connections and game state synchronization
 */
export class MultiplayerManager {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.playerId = null;
        this.lobbyCode = null;
        this.gameState = null;
        this.currentSong = null;

        // Event callbacks
        this.onGameStateUpdate = null;
        this.onPhaseChange = null;
        this.onPlayerJoined = null;
        this.onPlayerLeft = null;
        this.onSongSubmitted = null;
        this.onGameStarted = null;
        this.onAllPlayersReady = null;
        this.onWaitingUpdate = null;
    }

    async connect(serverUrl = 'http://localhost:3000') {
        try {
            // Load Socket.IO client
            if (!window.io) {
                await this.loadSocketIO(serverUrl);
            }

            this.socket = window.io(serverUrl);

            this.socket.on('connect', () => {
                console.log('Connected to multiplayer server');
                this.isConnected = true;
            });

            this.socket.on('disconnect', () => {
                console.log('Disconnected from multiplayer server');
                this.isConnected = false;
            });

            this.setupEventHandlers();

            return new Promise((resolve) => {
                this.socket.on('connect', () => resolve(true));
            });
        } catch (error) {
            console.error('Failed to connect to multiplayer server:', error);
            return false;
        }
    }

    async loadSocketIO(serverUrl) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = `${serverUrl}/socket.io/socket.io.js`;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    setupEventHandlers() {
        this.socket.on('playerJoined', (data) => {
            console.log('Player joined:', data.player.name);
            this.gameState = data.gameState;
            if (this.onPlayerJoined) {
                this.onPlayerJoined(data.player, data.gameState);
            }
        });

        this.socket.on('playerLeft', (data) => {
            console.log('Player left:', data.playerId);
            this.gameState = data.gameState;
            if (this.onPlayerLeft) {
                this.onPlayerLeft(data.playerId, data.gameState);
            }
        });

        this.socket.on('playerReady', (data) => {
            console.log('Player ready:', data.playerId);
            this.gameState = data.gameState;
            if (this.onGameStateUpdate) {
                this.onGameStateUpdate(data.gameState);
            }
        });

        this.socket.on('allPlayersReady', (data) => {
            console.log('All players ready!');
            this.gameState = data.gameState;
            if (this.onAllPlayersReady) {
                this.onAllPlayersReady(data.gameState);
            }
        });

        this.socket.on('gameStarted', (data) => {
            console.log('Game started!');
            this.gameState = data.gameState;
            if (this.onGameStarted) {
                this.onGameStarted(data.gameState);
            }
        });

        this.socket.on('phaseChanged', (data) => {
            console.log('Phase changed to:', data.gameState.state);
            this.gameState = data.gameState;
            if (this.onPhaseChange) {
                this.onPhaseChange(data.gameState);
            }
        });

        this.socket.on('soundSelected', (data) => {
            console.log('Sound selected:', data.soundIndex);
            // Update local state if needed
        });

        this.socket.on('songSubmitted', (data) => {
            console.log('Song submitted by:', data.playerId);
            this.gameState = data.gameState;
            if (this.onSongSubmitted) {
                this.onSongSubmitted(data.playerId, data.gameState);
            }
        });

        this.socket.on('waitingUpdate', (data) => {
            console.log('Waiting for players update');
            this.gameState = data.gameState;
            if (this.onWaitingUpdate) {
                this.onWaitingUpdate(data.gameState);
            }
        });
    }

    async createLobby(playerName) {
        if (!this.isConnected) return null;

        return new Promise((resolve) => {
            this.socket.emit('createLobby', { playerName }, (response) => {
                if (response.success) {
                    this.playerId = response.playerId;
                    this.lobbyCode = response.lobbyCode;
                    this.gameState = response.gameState;
                    console.log(`Created lobby: ${this.lobbyCode}`);
                }
                resolve(response);
            });
        });
    }

    async joinLobby(lobbyCode, playerName) {
        if (!this.isConnected) return null;

        return new Promise((resolve) => {
            this.socket.emit('joinLobby', { lobbyCode: lobbyCode.toUpperCase(), playerName }, (response) => {
                if (response.success) {
                    this.playerId = response.playerId;
                    this.lobbyCode = lobbyCode.toUpperCase();
                    this.gameState = response.gameState;
                    console.log(`Joined lobby: ${this.lobbyCode}`);
                }
                resolve(response);
            });
        });
    }

    setReady() {
        if (!this.isConnected || !this.lobbyCode) return;

        this.socket.emit('playerReady', {});
        console.log('Set ready status');
    }

    completeSelection() {
        if (!this.isConnected || !this.lobbyCode) return;

        this.socket.emit('completeSelection');
        console.log('Completed sound selection');
    }

    submitSong(songData, selectedSounds = null) {
        if (!this.isConnected || !this.lobbyCode) return;

        this.socket.emit('submitSong', { songData, selectedSounds });
        console.log('Submitted song with', songData.length, 'sound events');
    }

    async getCurrentSong() {
        if (!this.isConnected || !this.lobbyCode) return null;

        return new Promise((resolve) => {
            this.socket.emit('getCurrentSong', (response) => {
                if (response.success) {
                    this.currentSong = response.song;
                    this.gameState = response.gameState;
                }
                resolve(response);
            });
        });
    }

    async getPreviousSong() {
        if (!this.isConnected || !this.lobbyCode) return null;

        return new Promise((resolve) => {
            this.socket.emit('getPreviousSong', (response) => {
                resolve(response);
            });
        });
    }

    continueToPerformance() {
        if (!this.isConnected || !this.lobbyCode) return;

        this.socket.emit('continueToPerformance');
        console.log('Continuing to performance phase');
    }

    async getFinalSongs() {
        if (!this.isConnected || !this.lobbyCode) return null;

        return new Promise((resolve) => {
            this.socket.emit('getFinalSongs', (response) => {
                resolve(response);
            });
        });
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        this.isConnected = false;
        this.playerId = null;
        this.lobbyCode = null;
        this.gameState = null;
        this.currentSong = null;
    }

    // Getters
    getPlayerId() {
        return this.playerId;
    }

    getLobbyCode() {
        return this.lobbyCode;
    }

    getGameState() {
        return this.gameState;
    }

    getCurrentSongData() {
        return this.currentSong;
    }

    isInLobby() {
        return this.isConnected && this.lobbyCode && this.playerId;
    }

    isHost() {
        if (!this.gameState || !this.playerId) return false;
        const player = this.gameState.players.find(p => p.id === this.playerId);
        return player ? player.isHost : false;
    }
}
