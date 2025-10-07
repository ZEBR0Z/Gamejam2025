/**
 * Constants - Central configuration and constant values
 */

export const PhaseType = {
  LOBBY: "lobby",
  SELECTION: "selection",
  PREVIEW: "preview",
  SOUND_REPLACEMENT: "sound_replacement",
  PERFORMANCE: "performance",
  EDITING: "editing",
  WAITING: "waiting_for_players",
  SHOWCASE: "showcase",
};

export const GameConfig = {
  SERVER_URL: "http://localhost:8000",
  DEFAULT_SEGMENT_LENGTH: 8, // seconds (overridden by backing track)
  SELECTION_TIME: 30, // seconds
  PERFORMANCE_TIME: 90, // seconds
  EDITING_TIME: 60, // seconds
  REPLACEMENT_TIME: 30, // seconds
  SOUNDS_TO_SELECT: 3,
  SOUNDS_TO_CHOOSE_FROM: 5,
  MIN_PLAYERS: 2,
  LOBBY_START_COUNTDOWN: 3, // seconds
};

export const StateEvent = {
  SERVER_STATE_CHANGED: "server_state_changed",
  LOCAL_STATE_CHANGED: "local_state_changed",
  PHASE_ENTERED: "phase_entered",
  PHASE_EXITED: "phase_exited",
};

export const NetworkEvent = {
  CONNECTED: "connected",
  DISCONNECTED: "disconnected",
  CONNECTION_ERROR: "connection_error",
};

export const LobbyState = {
  LOBBY: "lobby",
  IN_PROGRESS: "in_progress",
};
