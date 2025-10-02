/**
 * PhaseManager - State machine for game phase transitions
 * @description Prevents invalid transitions and ensures proper cleanup between phases
 */
export class PhaseManager {
  constructor() {
    this.currentPhase = null;
    this.currentPhaseName = null;
    this.phases = new Map();

    this.validTransitions = new Map([
      ["selection", ["performance"]],
      ["performance", ["editing"]],
      ["editing", ["waiting_for_players"]],
      ["waiting_for_players", ["preview", "showcase"]],
      ["preview", ["sound_replacement"]],
      ["sound_replacement", ["performance"]],
      ["showcase", ["menu"]],
    ]);

    this.onTransition = null;
  }

  /**
   * @param {string} name - Phase name
   * @param {Object} phaseInstance - Phase instance with start/cleanup methods
   */
  registerPhase(name, phaseInstance) {
    this.phases.set(name, phaseInstance);
  }

  getCurrentPhaseName() {
    return this.currentPhaseName;
  }

  /**
   * @param {string} targetPhase - Phase to transition to
   * @returns {boolean} Whether transition is valid
   */
  canTransitionTo(targetPhase) {
    if (!this.currentPhaseName) {
      return true;
    }

    const allowedTransitions = this.validTransitions.get(this.currentPhaseName);
    return allowedTransitions && allowedTransitions.includes(targetPhase);
  }

  /**
   * @param {string} phaseName - Phase to transition to
   * @param {...any} args - Arguments to pass to phase.start()
   * @returns {boolean} Success status
   */
  transitionTo(phaseName, ...args) {
    if (!this.canTransitionTo(phaseName)) {
      console.error(
        `Invalid transition from '${this.currentPhaseName}' to '${phaseName}'`,
      );
      return false;
    }

    const targetPhase = this.phases.get(phaseName);
    if (!targetPhase) {
      console.error(`Phase '${phaseName}' not registered`);
      return false;
    }

    if (this.currentPhase && typeof this.currentPhase.cleanup === "function") {
      this.currentPhase.cleanup();
    }

    this.currentPhase = targetPhase;
    this.currentPhaseName = phaseName;

    if (this.onTransition) {
      this.onTransition(phaseName, this.currentPhase);
    }

    if (typeof targetPhase.start === "function") {
      targetPhase.start(...args);
    }

    return true;
  }

  /**
   * Force transition bypassing validation
   * @param {string} phaseName - Phase to transition to
   * @param {...any} args - Arguments to pass to phase.start()
   * @returns {boolean} Success status
   */
  forceTransitionTo(phaseName, ...args) {
    const targetPhase = this.phases.get(phaseName);
    if (!targetPhase) {
      console.error(`Phase '${phaseName}' not registered`);
      return false;
    }

    if (this.currentPhase && typeof this.currentPhase.cleanup === "function") {
      this.currentPhase.cleanup();
    }

    this.currentPhase = targetPhase;
    this.currentPhaseName = phaseName;

    if (this.onTransition) {
      this.onTransition(phaseName, this.currentPhase);
    }

    if (typeof targetPhase.start === "function") {
      targetPhase.start(...args);
    }

    return true;
  }

  cleanup() {
    if (this.currentPhase && typeof this.currentPhase.cleanup === "function") {
      this.currentPhase.cleanup();
    }
    this.currentPhase = null;
    this.currentPhaseName = null;
  }

  getValidNextPhases() {
    if (!this.currentPhaseName) {
      return Array.from(this.validTransitions.keys());
    }
    return this.validTransitions.get(this.currentPhaseName) || [];
  }
}
