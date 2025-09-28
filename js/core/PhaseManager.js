/**
 * PhaseManager - Manages game phase transitions with proper state machine
 * Prevents invalid transitions and ensures proper cleanup between phases
 */
export class PhaseManager {
  constructor() {
    this.currentPhase = null;
    this.currentPhaseName = null;
    this.phases = new Map();

    // Define valid transitions
    this.validTransitions = new Map([
      ["selection", ["performance"]],
      ["performance", ["editing"]],
      ["editing", ["waiting-for-players"]],
      ["waiting-for-players", ["preview", "showcase"]],
      ["preview", ["performance"]],
      ["showcase", ["menu"]], // Only exit to menu allowed
    ]);

    this.onTransition = null; // Callback for when transitions happen
  }

  /**
   * Register a phase with the manager
   */
  registerPhase(name, phaseInstance) {
    this.phases.set(name, phaseInstance);
  }

  /**
   * Get the current phase name
   */
  getCurrentPhaseName() {
    return this.currentPhaseName;
  }

  /**
   * Check if a transition is valid
   */
  canTransitionTo(targetPhase) {
    if (!this.currentPhaseName) {
      // No current phase, allow any initial phase
      return true;
    }

    const allowedTransitions = this.validTransitions.get(this.currentPhaseName);
    return allowedTransitions && allowedTransitions.includes(targetPhase);
  }

  /**
   * Transition to a new phase
   */
  transitionTo(phaseName, ...args) {
    // Validate transition
    if (!this.canTransitionTo(phaseName)) {
      console.error(
        `Invalid transition from '${this.currentPhaseName}' to '${phaseName}'`,
      );
      return false;
    }

    // Get the target phase
    const targetPhase = this.phases.get(phaseName);
    if (!targetPhase) {
      console.error(`Phase '${phaseName}' not registered`);
      return false;
    }

    console.log(
      `Phase transition: ${this.currentPhaseName || "none"} -> ${phaseName}`,
    );

    // Cleanup current phase
    if (this.currentPhase && typeof this.currentPhase.cleanup === "function") {
      this.currentPhase.cleanup();
    }

    // Set new phase
    this.currentPhase = targetPhase;
    this.currentPhaseName = phaseName;

    // Notify about transition
    if (this.onTransition) {
      this.onTransition(phaseName, this.currentPhase);
    }

    // Start the new phase
    if (typeof targetPhase.start === "function") {
      targetPhase.start(...args);
    }

    return true;
  }

  /**
   * Force transition (bypasses validation) - use carefully
   */
  forceTransitionTo(phaseName, ...args) {
    const targetPhase = this.phases.get(phaseName);
    if (!targetPhase) {
      console.error(`Phase '${phaseName}' not registered`);
      return false;
    }

    console.log(
      `Force transition: ${this.currentPhaseName || "none"} -> ${phaseName}`,
    );

    // Cleanup current phase
    if (this.currentPhase && typeof this.currentPhase.cleanup === "function") {
      this.currentPhase.cleanup();
    }

    // Set new phase
    this.currentPhase = targetPhase;
    this.currentPhaseName = phaseName;

    // Notify about transition
    if (this.onTransition) {
      this.onTransition(phaseName, this.currentPhase);
    }

    // Start the new phase
    if (typeof targetPhase.start === "function") {
      targetPhase.start(...args);
    }

    return true;
  }

  /**
   * Cleanup current phase without transitioning
   */
  cleanup() {
    if (this.currentPhase && typeof this.currentPhase.cleanup === "function") {
      this.currentPhase.cleanup();
    }
    this.currentPhase = null;
    this.currentPhaseName = null;
  }

  /**
   * Get list of valid next phases from current phase
   */
  getValidNextPhases() {
    if (!this.currentPhaseName) {
      return Array.from(this.validTransitions.keys());
    }
    return this.validTransitions.get(this.currentPhaseName) || [];
  }
}
