/**
 * MusicGame - Main game orchestrator
 * Coordinates all systems and manages the overall game flow
 */

// Core systems
import { AudioEngine } from './core/AudioEngine.js';
import { GameState } from './core/GameState.js';
import { UIManager } from './core/UIManager.js';
import { CanvasRenderer } from './core/CanvasRenderer.js';
import { InputController } from './core/InputController.js';
import { Timer } from './core/Timer.js';

// Game phases
import { SelectionPhase } from './phases/SelectionPhase.js';
import { PerformancePhase } from './phases/PerformancePhase.js';
import { EditingPhase } from './phases/EditingPhase.js';
import { FinalPhase } from './phases/FinalPhase.js';

export class MusicGame {
    constructor() {
        // Core systems
        this.audioEngine = new AudioEngine();
        this.gameState = new GameState();
        this.uiManager = new UIManager();
        this.canvasRenderer = new CanvasRenderer();
        this.inputController = new InputController(this.gameState, this.uiManager, this.audioEngine);
        this.timer = new Timer(this.gameState, this.uiManager);

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
    }

    async initialize() {
        try {
            console.log('Initializing MusicGame...');

            // Initialize core systems
            await this.audioEngine.initialize();
            await this.gameState.loadSoundList();
            this.uiManager.initialize();

            // Setup menu event handlers
            this.setupMenuHandlers();

            console.log('MusicGame initialized successfully');
        } catch (error) {
            console.error('Failed to initialize MusicGame:', error);
            alert('Failed to initialize the game. Please refresh and try again.');
        }
    }

    setupMenuHandlers() {
        // Menu buttons
        const menuHandlers = {
            'tutorial-btn': () => this.showTutorial(),
            'play-btn': () => this.startGame(),
            'skip-tutorial-btn': () => this.startGame(),
            'start-tutorial-btn': () => this.startGame()
        };

        this.inputController.setupButtonEvents(menuHandlers);
    }

    showTutorial() {
        this.gameState.setState('tutorial');
        this.uiManager.showScreen('tutorial');
    }

    async startGame() {
        try {
            // Resume audio context if needed
            await this.audioEngine.resume();

            // Reset game state
            this.gameState.resetGameData();

            // Start with selection phase
            this.startSelectionPhase();
        } catch (error) {
            console.error('Failed to start game:', error);
            alert('Failed to start the game. Please try again.');
        }
    }

    startSelectionPhase() {
        // Clean up current phase
        this.cleanupCurrentPhase();

        // Start selection phase
        this.currentPhase = this.selectionPhase;
        this.selectionPhase.start(() => {
            this.startPerformancePhase();
        });
    }

    startPerformancePhase() {
        // Clean up current phase
        this.cleanupCurrentPhase();

        // Start performance phase
        this.currentPhase = this.performancePhase;
        this.performancePhase.start(() => {
            this.startEditingPhase();
        });
    }

    startEditingPhase() {
        // Clean up current phase
        this.cleanupCurrentPhase();

        // Start editing phase
        this.currentPhase = this.editingPhase;
        this.editingPhase.start(() => {
            this.startFinalPhase();
        });
    }

    startFinalPhase() {
        // Clean up current phase
        this.cleanupCurrentPhase();

        // Start final phase
        this.currentPhase = this.finalPhase;
        this.finalPhase.start(
            () => this.restartGame(),  // onRestart
            () => this.exitToMenu()    // onExit
        );
    }

    restartGame() {
        // Clean up current phase
        this.cleanupCurrentPhase();

        // Reset and restart
        this.gameState.resetForNewGame();
        this.timer.resetAllTimers();
        this.startSelectionPhase();
    }

    exitToMenu() {
        // Clean up current phase
        this.cleanupCurrentPhase();

        // Reset to menu
        this.gameState.resetForNewGame();
        this.timer.resetAllTimers();
        this.uiManager.showScreen('menu');
    }

    cleanupCurrentPhase() {
        if (this.currentPhase && typeof this.currentPhase.cleanup === 'function') {
            this.currentPhase.cleanup();
        }
        this.currentPhase = null;
    }

    // Global cleanup method
    cleanup() {
        this.cleanupCurrentPhase();
        this.timer.stopAllTimers();
        this.audioEngine.stopPreview();
        this.audioEngine.stopEditPreview();
        this.inputController.cleanup();
    }
}

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    const game = new MusicGame();
    await game.initialize();

    // Make game globally accessible for debugging
    window.musicGame = game;
});
