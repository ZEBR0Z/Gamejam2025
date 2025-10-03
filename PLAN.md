# Client-Side Rewrite Plan

## Overview
Rewrite the entire client-side architecture with clearer separation of concerns, centralized state management, and explicit responsibilities. Server state becomes the single source of truth accessible by all components.

---

## Architecture

### State Layer
- **ServerState** - Holds server-broadcasted state (players, assignments, rounds)
- **LocalGameState** - Client-only state (selected sounds, events, playback)
- **StateObserver** - Simple pub/sub for state change notifications

### Service Layer (Stateless)
- **AudioService** - Web Audio API wrapper (play sounds, manage audio)
- **NetworkService** - Socket.IO communication wrapper
- **UIService** - DOM manipulation and screen management
- **CanvasService** - Canvas rendering
- **InputService** - Keyboard/mouse input handling

### Controller Layer
- **Game** - Main orchestrator, phase transitions, state change handler

### Phase Layer
- **BasePhase** - Abstract class with lifecycle (enter, update, exit)
- **LobbyPhase** - Waiting room, ready system
- **SelectionPhase** - Pick 3 sounds from 5
- **PreviewPhase** - Listen to assigned song so far
- **SoundReplacementPhase** - Pick new sounds for current round
- **PerformancePhase** - Record new segment
- **EditingPhase** - Edit recorded segment
- **WaitingPhase** - Wait for other players
- **ShowcasePhase** - View all completed songs

### Model Layer
- **Player** - Player data model with helper methods
- **Song** - Song composition with format conversion
- **SoundEvent** - Sound event data model

---

## File Structure

```
js/
├── state/
│   ├── ServerState.js
│   ├── LocalGameState.js
│   └── StateObserver.js
│
├── services/
│   ├── AudioService.js
│   ├── NetworkService.js
│   ├── UIService.js
│   ├── CanvasService.js
│   └── InputService.js
│
├── models/
│   ├── Player.js
│   ├── Song.js
│   └── SoundEvent.js
│
├── phases/
│   ├── BasePhase.js
│   ├── LobbyPhase.js
│   ├── SelectionPhase.js
│   ├── PreviewPhase.js
│   ├── SoundReplacementPhase.js
│   ├── PerformancePhase.js
│   ├── EditingPhase.js
│   ├── WaitingPhase.js
│   └── ShowcasePhase.js
│
├── Constants.js
├── Game.js
└── main.js
```

---

## Implementation Checklist

### Phase 1: Foundation
- [x] Create `Constants.js` (phase names, config values, event types)
- [x] Create `state/StateObserver.js` (simple pub/sub)
- [x] Create `state/ServerState.js` (server state container)
- [x] Create `state/LocalGameState.js` (client state container)

### Phase 2: Models
- [x] Create `models/Player.js`
- [x] Create `models/SoundEvent.js`
- [x] Create `models/Song.js`

### Phase 3: Services
- [x] Create `services/AudioService.js` (refactor from AudioEngine)
- [x] Create `services/NetworkService.js` (refactor from MultiplayerManager)
- [x] Create `services/UIService.js` (refactor from UIManager)
- [x] Create `services/CanvasService.js` (refactor from CanvasRenderer)
- [x] Create `services/InputService.js` (refactor from InputController)

### Phase 4: Phase System
- [x] Create `phases/BasePhase.js` (abstract base class)
- [x] Create `phases/LobbyPhase.js`
- [x] Create `phases/SelectionPhase.js`
- [x] Create `phases/PreviewPhase.js`
- [x] Create `phases/SoundReplacementPhase.js`
- [x] Create `phases/PerformancePhase.js`
- [x] Create `phases/EditingPhase.js`
- [x] Create `phases/WaitingPhase.js`
- [x] Create `phases/ShowcasePhase.js`

### Phase 5: Main Controller
- [x] Create `Game.js` (main orchestrator)
- [x] Create `main.js` (bootstrap)

### Phase 6: Integration & Testing
- [x] Wire everything together
- [ ] Test lobby creation/joining
- [ ] Test ready system and game start
- [ ] Test full round flow (selection → preview → replacement → performance → editing → waiting)
- [ ] Test round transitions
- [ ] Test showcase phase
- [ ] Test error handling and edge cases

### Phase 7: Cleanup
- [ ] Remove old files from `js/core/`
- [ ] Remove old files from `js/phases/`
- [x] Update index.html script imports
- [ ] Final testing

---

## Key Principles

1. **Server state is source of truth** - All game logic reads from ServerState
2. **Services are stateless** - They operate on data passed to them
3. **Phases are self-contained** - Each phase manages its own UI and logic
4. **Clear data flow** - Server → ServerState → Game → Phase → Services → UI
5. **No backwards compatibility** - Clean slate, better architecture

---

## Preserved

- Server network architecture (broadcast state, client decides)
- Game flow and rules
- HTML/CSS structure
- Asset loading system (audiomap.json)

---

## Notes

- Each checkbox represents a complete, testable unit
- Services should be tested in isolation before integration
- Phases can be implemented in parallel once BasePhase exists
- Game.js is the last piece that ties everything together
