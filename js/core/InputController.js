/**
 * InputController - Manages keyboard and mouse input
 * Handles user interaction events and delegates to appropriate handlers
 */
export class InputController {
  constructor(gameState, uiManager, audioEngine) {
    this.gameState = gameState;
    this.uiManager = uiManager;
    this.audioEngine = audioEngine;

    // Dragging state
    this.dragState = {
      isDragging: false,
      draggedNote: null,
      draggedCanvasIndex: null,
      dragStartY: 0,
      dragStartPitch: 0,
    };

    this.eventHandlers = new Map();
    this.currentTransportHandlers = new Map();
    this.currentButtonHandlers = new Map();
    this.persistentButtonHandlers = new Map();
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Keyboard events
    document.addEventListener("keydown", (e) => this.handleKeyDown(e));
    document.addEventListener("keyup", (e) => this.handleKeyUp(e));

    // Global mouse events for smooth dragging
    document.addEventListener("mousemove", (e) =>
      this.handleGlobalMouseMove(e),
    );
    document.addEventListener("mouseup", (e) => this.handleGlobalMouseUp(e));

    console.log("InputController event listeners setup complete");
  }

  // Register event handlers for different phases
  registerHandler(eventType, phase, handler) {
    const key = `${eventType}_${phase}`;
    this.eventHandlers.set(key, handler);
  }

  // Remove event handlers
  unregisterHandler(eventType, phase) {
    const key = `${eventType}_${phase}`;
    this.eventHandlers.delete(key);
  }

  // Get appropriate handler for current state
  getHandler(eventType) {
    const key = `${eventType}_${this.gameState.getState()}`;
    return this.eventHandlers.get(key);
  }

  // Keyboard handling
  handleKeyDown(e) {
    const currentState = this.gameState.getState();

    // Allow keyboard input during performance and editing phases
    if (currentState !== "performance" && currentState !== "editing") return;

    // For performance phase, only allow when playing
    if (currentState === "performance" && !this.gameState.playback.isPlaying)
      return;

    const key = e.key;
    let soundIndex = -1;

    if (key === "1") soundIndex = 0;
    else if (key === "2") soundIndex = 1;
    else if (key === "3") soundIndex = 2;

    if (soundIndex >= 0 && soundIndex < this.gameState.selectedSounds.length) {
      e.preventDefault();

      // Visual feedback
      this.uiManager.showKeyPress(soundIndex);

      // Handle the keypress
      const handler = this.getHandler("keyPress");
      if (handler) {
        handler(soundIndex);
      }
    }
  }

  handleKeyUp(e) {
    const key = e.key;
    let soundIndex = -1;

    if (key === "1") soundIndex = 0;
    else if (key === "2") soundIndex = 1;
    else if (key === "3") soundIndex = 2;

    if (soundIndex >= 0) {
      this.uiManager.hideKeyPress(soundIndex);
    }
  }

  // Canvas mouse events
  setupCanvasEvents(canvas, canvasType, canvasIndex = null) {
    if (!canvas) return;

    // Timeline canvas (performance phase)
    if (canvasType === "timeline") {
      canvas.addEventListener("contextmenu", (e) =>
        this.handleTimelineRightClick(e),
      );
    }

    // Editing canvas
    else if (canvasType === "editing") {
      canvas.addEventListener("mousedown", (e) =>
        this.handleEditingMouseDown(e, canvasIndex),
      );
      canvas.addEventListener("mousemove", (e) =>
        this.handleEditingMouseMove(e, canvasIndex),
      );
      canvas.addEventListener("mouseup", (e) => this.handleEditingMouseUp(e));
      canvas.addEventListener("mouseleave", (e) =>
        this.handleEditingMouseUp(e),
      );
    }
  }

  // Timeline right-click handling (delete events)
  handleTimelineRightClick(e) {
    e.preventDefault();

    const currentState = this.gameState.getState();
    if (currentState !== "performance") return;

    const handler = this.getHandler("timelineRightClick");
    if (handler) {
      const canvas = this.uiManager.getElement("timelineCanvas");
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        handler(mouseX, mouseY);
      }
    }
  }

  // Editing mouse handling
  handleEditingMouseDown(e, canvasIndex) {
    const currentState = this.gameState.getState();
    if (currentState !== "editing") return;

    // Use unified editing timeline canvas instead of individual canvases
    const canvas =
      canvasIndex !== null && canvasIndex !== undefined
        ? this.uiManager.getEditingCanvas(canvasIndex) // Legacy individual canvas
        : this.uiManager.getCanvas("editingTimelineCanvas"); // New unified canvas
    if (!canvas) return;

    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const handler = this.getHandler("editingMouseDown");
    if (handler) {
      // For unified timeline, don't pass canvasIndex
      const result =
        canvasIndex !== null && canvasIndex !== undefined
          ? handler(mouseX, mouseY, canvasIndex) // Legacy individual canvas
          : handler(mouseX, mouseY); // New unified canvas

      // Update drag state
      if (result && result.draggedNote) {
        this.dragState.isDragging = true;
        this.dragState.draggedNote = result.draggedNote;
        // Use null for unified timeline, preserve actual index for legacy individual canvases
        this.dragState.draggedCanvasIndex =
          canvasIndex !== null && canvasIndex !== undefined
            ? canvasIndex
            : null;
        this.dragState.dragStartY = mouseY;
        this.dragState.dragStartPitch = result.draggedNote.pitchSemitones;

        // Change cursor
        canvas.style.cursor = "grabbing";
      }
    }
  }

  handleEditingMouseMove(e, canvasIndex) {
    if (!this.dragState.isDragging || !this.dragState.draggedNote) return;

    // Use unified editing timeline canvas instead of individual canvases
    const canvas =
      this.dragState.draggedCanvasIndex !== null
        ? this.uiManager.getEditingCanvas(this.dragState.draggedCanvasIndex) // Legacy individual canvas
        : this.uiManager.getCanvas("editingTimelineCanvas"); // New unified canvas
    if (!canvas) return;

    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mouseY = e.clientY - rect.top;

    const handler = this.getHandler("editingMouseMove");
    if (handler) {
      handler(
        this.dragState.draggedNote,
        this.dragState.dragStartY,
        this.dragState.dragStartPitch,
        mouseY,
      );
    }
  }

  handleEditingMouseUp(e) {
    if (!this.dragState.isDragging) return;

    // Reset cursor
    const canvas =
      this.dragState.draggedCanvasIndex !== null
        ? this.uiManager.getEditingCanvas(this.dragState.draggedCanvasIndex) // Legacy individual canvas
        : this.uiManager.getCanvas("editingTimelineCanvas"); // New unified canvas
    if (canvas) {
      canvas.style.cursor = "grab";
    }

    const handler = this.getHandler("editingMouseUp");
    if (handler) {
      handler(this.dragState.draggedNote);
    }

    // Reset drag state
    this.dragState.isDragging = false;
    this.dragState.draggedNote = null;
    this.dragState.draggedCanvasIndex = null;
    this.dragState.dragStartY = 0;
    this.dragState.dragStartPitch = 0;
  }

  // Global mouse events (for smooth dragging outside canvas)
  handleGlobalMouseMove(e) {
    if (this.dragState.isDragging && this.gameState.getState() === "editing") {
      this.handleEditingMouseMove(e, this.dragState.draggedCanvasIndex);
    }
  }

  handleGlobalMouseUp(e) {
    if (this.dragState.isDragging) {
      this.handleEditingMouseUp(e);
    }
  }

  // Button event setup for persistent UI (like main menu)
  setupPersistentButtonEvents(buttonHandlers) {
    console.log("setupPersistentButtonEvents called with:", Object.keys(buttonHandlers));
    // Store persistent handler references separately
    if (!this.persistentButtonHandlers) {
      this.persistentButtonHandlers = new Map();
    }

    Object.entries(buttonHandlers).forEach(([buttonId, handler]) => {
      const button = document.getElementById(buttonId);
      console.log(`Setting up button ${buttonId}:`, button ? "found" : "NOT FOUND");
      if (button) {
        button.addEventListener("click", handler);
        console.log(`Added click listener to ${buttonId}`);

        // Store the handler reference for cleanup
        this.persistentButtonHandlers.set(buttonId, {
          element: button,
          handler: handler,
        });
      }
    });
  }

  // Button event setup for phase-specific events
  setupButtonEvents(buttonHandlers) {
    // Clean up any existing phase-specific button events first
    this.cleanupButtonEvents();

    // Store handler references for cleanup
    this.currentButtonHandlers = new Map();

    Object.entries(buttonHandlers).forEach(([buttonId, handler]) => {
      const button = document.getElementById(buttonId);
      if (button) {
        button.addEventListener("click", handler);

        // Store the handler reference for cleanup
        this.currentButtonHandlers.set(buttonId, {
          element: button,
          handler: handler,
        });
      }
    });
  }

  // Clean up phase-specific button event listeners
  cleanupButtonEvents() {
    if (this.currentButtonHandlers) {
      this.currentButtonHandlers.forEach(({ element, handler }) => {
        element.removeEventListener("click", handler);
      });
      this.currentButtonHandlers.clear();
    }
  }

  // Clean up persistent button event listeners (called on full cleanup)
  cleanupPersistentButtonEvents() {
    if (this.persistentButtonHandlers) {
      this.persistentButtonHandlers.forEach(({ element, handler }) => {
        element.removeEventListener("click", handler);
      });
      this.persistentButtonHandlers.clear();
    }
  }

  // Transport control setup
  setupTransportEvents(transportHandlers) {
    // Clean up any existing transport events first
    this.cleanupTransportEvents();

    // Store handler references for cleanup
    this.currentTransportHandlers = new Map();

    Object.entries(transportHandlers).forEach(([controlId, handler]) => {
      const control = document.getElementById(controlId);
      if (control) {
        let eventHandler;
        if (control.type === "range") {
          eventHandler = (e) => handler(parseFloat(e.target.value));
          control.addEventListener("input", eventHandler);
        } else {
          eventHandler = handler;
          control.addEventListener("click", eventHandler);
        }

        // Store the handler reference for cleanup
        this.currentTransportHandlers.set(controlId, {
          element: control,
          eventType: control.type === "range" ? "input" : "click",
          handler: eventHandler,
        });
      }
    });
  }

  // Clean up transport event listeners
  cleanupTransportEvents() {
    if (this.currentTransportHandlers) {
      this.currentTransportHandlers.forEach(
        ({ element, eventType, handler }) => {
          element.removeEventListener(eventType, handler);
        },
      );
      this.currentTransportHandlers.clear();
    }
  }

  // Clean up event listeners
  cleanup() {
    // Remove global event listeners
    document.removeEventListener("keydown", this.handleKeyDown);
    document.removeEventListener("keyup", this.handleKeyUp);
    document.removeEventListener("mousemove", this.handleGlobalMouseMove);
    document.removeEventListener("mouseup", this.handleGlobalMouseUp);

    // Clean up transport and button events
    this.cleanupTransportEvents();
    this.cleanupButtonEvents();
    this.cleanupPersistentButtonEvents();

    // Clear handlers
    this.eventHandlers.clear();

    console.log("InputController cleaned up");
  }
}
