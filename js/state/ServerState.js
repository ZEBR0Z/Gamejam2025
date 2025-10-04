/**
 * ServerState - Holds the server-broadcasted state
 * This is the single source of truth for multiplayer game state
 * Read-only for all consumers - only updated by NetworkService
 */

import { StateObserver } from "./StateObserver.js";
import { StateEvent } from "../Constants.js";

export class ServerState {
  constructor() {
    this.observer = new StateObserver();
    this.state = null;
    this.previousState = null;
    this._localPlayerId = null;
  }

  /**
   * Update state from server (only called by NetworkService)
   * @param {Object} newState - New state from server
   */
  update(newState) {
    this.previousState = this.state;
    this.state = newState;

    this.observer.emit(StateEvent.SERVER_STATE_CHANGED, this.previousState, this.state);
  }

  /**
   * Get current state
   * @returns {Object|null} Current server state
   */
  get() {
    return this.state;
  }

  /**
   * Get previous state
   * @returns {Object|null} Previous server state
   */
  getPrevious() {
    return this.previousState;
  }

  /**
   * Subscribe to state changes
   * @param {Function} callback - Called with (previousState, newState)
   * @returns {Function} Unsubscribe function
   */
  onChange(callback) {
    return this.observer.on(StateEvent.SERVER_STATE_CHANGED, callback);
  }

  /**
   * Get lobby code
   * @returns {string|null}
   */
  getLobbyCode() {
    return this.state?.code || null;
  }

  /**
   * Get lobby state (lobby vs in_progress)
   * @returns {string|null}
   */
  getLobbyState() {
    return this.state?.state || null;
  }

  /**
   * Get total number of rounds
   * @returns {number}
   */
  getTotalRounds() {
    return this.state?.rounds || 0;
  }

  /**
   * Get max rounds
   * @returns {number}
   */
  getMaxRounds() {
    return this.state?.rounds || 3;
  }

  /**
   * Get local player ID (stored separately from state)
   * @returns {string|null}
   */
  getLocalPlayerId() {
    return this._localPlayerId || null;
  }

  /**
   * Set local player ID (called by NetworkService)
   * @param {string} playerId
   */
  setLocalPlayerId(playerId) {
    this._localPlayerId = playerId;
  }

  /**
   * Get all players
   * @returns {Array}
   */
  getPlayers() {
    return this.state?.players || [];
  }

  /**
   * Get specific player by ID
   * @param {string} playerId
   * @returns {Object|null}
   */
  getPlayer(playerId) {
    if (!this.state?.players) return null;
    return this.state.players.find((p) => p.id === playerId) || null;
  }

  /**
   * Get assignments for a specific player
   * @param {string} playerId
   * @returns {Array|null} Array of player IDs to work on each round
   */
  getAssignments(playerId) {
    if (!this.state?.assignments) return null;
    return this.state.assignments[playerId] || null;
  }

  /**
   * Get assignment for a specific player and round
   * @param {string} playerId
   * @param {number} round - Round number (1-indexed)
   * @returns {string|null} Player ID whose song to work on
   */
  getAssignment(playerId, round) {
    const assignments = this.getAssignments(playerId);
    if (!assignments || round < 2) return null;

    // Round 1 = own song, Round 2 = index 0, Round 3 = index 1, etc.
    return assignments[round - 2] || null;
  }

  /**
   * Get a player's submission for a specific round
   * @param {string} playerId
   * @param {number} round - Round number (1-indexed)
   * @returns {Object|null}
   */
  getSubmission(playerId, round) {
    const player = this.getPlayer(playerId);
    if (!player?.submissions) return null;

    return player.submissions[round - 1] || null;
  }

  /**
   * Check if all players are at or past a specific phase/round
   * @param {number} round
   * @param {string} phase
   * @returns {boolean}
   */
  areAllPlayersAtPhase(round, phase) {
    const players = this.getPlayers();
    if (players.length === 0) return false;

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

    const targetIndex = phaseOrder.indexOf(phase);

    return players.every((p) => {
      if (p.round > round) return true;
      if (p.round === round) {
        const playerIndex = phaseOrder.indexOf(p.phase);
        return playerIndex >= targetIndex;
      }
      return false;
    });
  }

  /**
   * Check if all players are ready (in lobby)
   * @returns {boolean}
   */
  areAllPlayersReady() {
    const players = this.getPlayers();
    if (players.length < 2) return false;
    return players.every((p) => p.ready);
  }

  /**
   * Clear state (on disconnect)
   */
  clear() {
    this.previousState = null;
    this.state = null;
  }
}
