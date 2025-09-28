/**
 * WaitingPhase - Handles the waiting for players phase
 * Shows a simple waiting screen while everyone completes their songs
 */
export class WaitingPhase {
    constructor(gameState, uiManager, multiplayerManager) {
        this.gameState = gameState;
        this.uiManager = uiManager;
        this.multiplayerManager = multiplayerManager;
        this.onPhaseComplete = null;
    }

    start(onComplete) {
        this.onPhaseComplete = onComplete;

        console.log('Starting waiting phase');
        this.gameState.setState('waiting-for-players');
        this.uiManager.showScreen('waiting-for-players');

        // Update the waiting screen with current game state
        const gameState = this.multiplayerManager.getGameState();
        if (gameState) {
            this.uiManager.updateWaitingScreen(gameState);
        }

        // Set up multiplayer event handlers
        this.setupEventHandlers();
    }

    setupEventHandlers() {
        // Listen for waiting updates from server
        this.multiplayerManager.onWaitingUpdate = (gameState) => {
            this.updateWaitingUI(gameState);
        };

        // Listen for phase changes (when all players have submitted)
        this.multiplayerManager.onPhaseChange = (gameState) => {
            if (gameState.state === 'song-preview' || gameState.state === 'final-showcase') {
                this.complete(gameState);
            }
        };
    }

    updateWaitingUI(gameState) {
        this.uiManager.updateWaitingScreen(gameState);
    }

    complete(gameState) {
        console.log('Waiting phase complete, transitioning to:', gameState.state);
        if (this.onPhaseComplete) {
            this.onPhaseComplete(gameState);
        }
    }

    cleanup() {
        // Clean up event handlers
        this.multiplayerManager.onWaitingUpdate = null;
        // Note: Don't clear onPhaseChange as it might be used by other phases
    }
}
