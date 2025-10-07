/**
 * Player - Player data model with helper methods
 * Wraps server player data with useful accessors
 */
export class Player {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.ready = data.ready;
    this.round = data.round;
    this.phase = data.phase;
    this.submissions = data.submissions || [];
  }

  /**
   * Check if player is ready (in lobby)
   * @returns {boolean}
   */
  isReady() {
    return this.ready;
  }

  /**
   * Get player's current round
   * @returns {number}
   */
  getCurrentRound() {
    return this.round;
  }

  /**
   * Get player's current phase
   * @returns {string}
   */
  getCurrentPhase() {
    return this.phase;
  }

  /**
   * Get submission for a specific round
   * @param {number} round - Round number (1-indexed)
   * @returns {Object|null}
   */
  getSubmission(round) {
    return this.submissions[round - 1] || null;
  }

  /**
   * Get latest submission
   * @returns {Object|null}
   */
  getLatestSubmission() {
    return this.submissions[this.submissions.length - 1] || null;
  }

  /**
   * Check if player has submitted for a specific round
   * @param {number} round
   * @returns {boolean}
   */
  hasSubmittedForRound(round) {
    return !!this.submissions[round - 1];
  }

  /**
   * Check if player is at or past a specific phase in a round
   * @param {number} round
   * @param {string} phase
   * @returns {boolean}
   */
  isAtOrPastPhase(round, phase) {
    if (this.round > round) return true;

    if (this.round === round) {
      const phaseOrder = [
        "lobby",
        "selection",
        "preview",
        "sound_replacement",
        "performance",
        "editing",
        "waiting_for_players",
        "showcase",
      ];

      const currentIndex = phaseOrder.indexOf(this.phase);
      const targetIndex = phaseOrder.indexOf(phase);

      return currentIndex >= targetIndex;
    }

    return false;
  }

  /**
   * Create Player instance from server data
   * @param {Object} data - Server player data
   * @returns {Player}
   */
  static fromServerData(data) {
    return new Player(data);
  }

  /**
   * Create array of Player instances from server data
   * @param {Array} playersData - Array of server player data
   * @returns {Array<Player>}
   */
  static fromServerArray(playersData) {
    return playersData.map((data) => Player.fromServerData(data));
  }
}
