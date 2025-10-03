/**
 * BasePhase - Abstract base class for all game phases
 * Defines the lifecycle and common interface for phases
 *
 * Lifecycle:
 * 1. enter() - Called when phase starts
 * 2. update(deltaTime) - Optional game loop (called every frame)
 * 3. exit() - Called when phase ends
 */
export class BasePhase {
  constructor(services) {
    if (new.target === BasePhase) {
      throw new Error("BasePhase is abstract and cannot be instantiated directly");
    }

    // Services injected by Game controller
    this.audio = services.audio;
    this.network = services.network;
    this.ui = services.ui;
    this.canvas = services.canvas;
    this.input = services.input;
    this.serverState = services.serverState;
    this.localState = services.localState;

    // Phase state
    this.isActive = false;
    this.onCompleteCallback = null;
    this.onSecondaryCallback = null;
  }

  /**
   * Enter the phase (setup)
   * @param {Function} onComplete - Callback when phase is complete
   * @param {Function} onSecondary - Optional secondary callback (e.g., exit to menu)
   */
  async enter(onComplete, onSecondary = null) {
    this.isActive = true;
    this.onCompleteCallback = onComplete;
    this.onSecondaryCallback = onSecondary;
    console.log(`Entering phase: ${this.constructor.name}`);
  }

  /**
   * Update phase (called every frame if needed)
   * @param {number} deltaTime - Time since last frame in seconds
   */
  update(deltaTime) {
    // Override in subclass if needed
  }

  /**
   * Exit the phase (cleanup)
   */
  exit() {
    this.isActive = false;
    console.log(`Exiting phase: ${this.constructor.name}`);
  }

  /**
   * Complete the phase and trigger callback
   */
  complete() {
    if (this.onCompleteCallback) {
      this.onCompleteCallback();
    }
  }

  /**
   * Trigger secondary callback (e.g., exit to menu)
   */
  triggerSecondary() {
    if (this.onSecondaryCallback) {
      this.onSecondaryCallback();
    }
  }

  /**
   * Check if phase is active
   * @returns {boolean}
   */
  active() {
    return this.isActive;
  }
}
