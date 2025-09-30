/**
 * InputController - Manages keyboard and mouse input
 * Handles user interaction events and delegates to appropriate handlers
 */
export class InputController {
  constructor(gameState, uiManager, audioEngine) {
    this.gameState = gameState;
    this.uiManager = uiManager;
    this.audioEngine = audioEngine;

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
    document.addEventListener("keydown", (e) => this.handleKeyDown(e));
    document.addEventListener("keyup", (e) => this.handleKeyUp(e));
    document.addEventListener("mousemove", (e) =>
      this.handleGlobalMouseMove(e),
    );
    document.addEventListener("mouseup", (e) => this.handleGlobalMouseUp(e));

    console.log("InputController event listeners setup complete");
  }

  /**
   * Registers an event handler for a specific phase
   * @param {string} eventType - Type of event to handle
   * @param {string} phase - Game phase for this handler
   * @param {Function} handler - Handler function to execute
   */
  registerHandler(eventType, phase, handler) {
    const key = `${eventType}_${phase}`;
    this.eventHandlers.set(key, handler);
  }

  unregisterHandler(eventType, phase) {
    const key = `${eventType}_${phase}`;
    this.eventHandlers.delete(key);
  }

  getHandler(eventType) {
    const key = `${eventType}_${this.gameState.getState()}`;
    return this.eventHandlers.get(key);
  }

  handleKeyDown(e) {
    const currentState = this.gameState.getState();

    if (currentState !== "performance" && currentState !== "editing") return;

    if (currentState === "performance" && !this.gameState.playback.isPlaying)
      return;

    const key = e.key;
    let soundIndex = -1;

    if (key === "1") soundIndex = 0;
    else if (key === "2") soundIndex = 1;
    else if (key === "3") soundIndex = 2;

    if (soundIndex >= 0 && soundIndex < this.gameState.selectedSounds.length) {
      e.preventDefault();

      this.uiManager.showKeyPress(soundIndex);

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

  /**
   * Sets up event listeners for canvas interactions
   * @param {HTMLCanvasElement} canvas - Canvas element to attach events to
   * @param {string} canvasType - Type of canvas ('timeline' or 'editing')
   * @param {number} canvasIndex - Optional index for editing canvases
   */
  setupCanvasEvents(canvas, canvasType, canvasIndex = null) {
    if (!canvas) return;

    if (canvasType === "timeline") {
      canvas.addEventListener("contextmenu", (e) =>
        this.handleTimelineRightClick(e),
      );
    } else if (canvasType === "editing") {
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

  handleEditingMouseDown(e, canvasIndex) {
    const currentState = this.gameState.getState();
    if (currentState !== "editing") return;

    const canvas =
      canvasIndex !== null && canvasIndex !== undefined
        ? this.uiManager.getEditingCanvas(canvasIndex)
        : this.uiManager.getCanvas("editingTimelineCanvas");
    if (!canvas) return;

    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const handler = this.getHandler("editingMouseDown");
    if (handler) {
      const result =
        canvasIndex !== null && canvasIndex !== undefined
          ? handler(mouseX, mouseY, canvasIndex)
          : handler(mouseX, mouseY);

      if (result && result.draggedNote) {
        this.dragState.isDragging = true;
        this.dragState.draggedNote = result.draggedNote;
        this.dragState.draggedCanvasIndex =
          canvasIndex !== null && canvasIndex !== undefined
            ? canvasIndex
            : null;
        this.dragState.dragStartY = mouseY;
        this.dragState.dragStartPitch = result.draggedNote.pitchSemitones;

        canvas.style.cursor = "grabbing";
      }
    }
  }

  handleEditingMouseMove(e, canvasIndex) {
    if (!this.dragState.isDragging || !this.dragState.draggedNote) return;

    const canvas =
      this.dragState.draggedCanvasIndex !== null
        ? this.uiManager.getEditingCanvas(this.dragState.draggedCanvasIndex)
        : this.uiManager.getCanvas("editingTimelineCanvas");
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

    const canvas =
      this.dragState.draggedCanvasIndex !== null
        ? this.uiManager.getEditingCanvas(this.dragState.draggedCanvasIndex)
        : this.uiManager.getCanvas("editingTimelineCanvas");
    if (canvas) {
      canvas.style.cursor = "grab";
    }

    const handler = this.getHandler("editingMouseUp");
    if (handler) {
      handler(this.dragState.draggedNote);
    }

    this.dragState.isDragging = false;
    this.dragState.draggedNote = null;
    this.dragState.draggedCanvasIndex = null;
    this.dragState.dragStartY = 0;
    this.dragState.dragStartPitch = 0;
  }

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

  /**
   * Sets up button event listeners that persist across phases
   * @param {Object} buttonHandlers - Map of button IDs to handler functions
   */
  setupPersistentButtonEvents(buttonHandlers) {
    console.log(
      "setupPersistentButtonEvents called with:",
      Object.keys(buttonHandlers),
    );
    if (!this.persistentButtonHandlers) {
      this.persistentButtonHandlers = new Map();
    }

    Object.entries(buttonHandlers).forEach(([buttonId, handler]) => {
      const button = document.getElementById(buttonId);
      console.log(
        `Setting up button ${buttonId}:`,
        button ? "found" : "NOT FOUND",
      );
      if (button) {
        button.addEventListener("click", handler);
        console.log(`Added click listener to ${buttonId}`);

        this.persistentButtonHandlers.set(buttonId, {
          element: button,
          handler: handler,
        });
      }
    });
  }

  /**
   * Sets up button event listeners for the current phase
   * @param {Object} buttonHandlers - Map of button IDs to handler functions
   */
  setupButtonEvents(buttonHandlers) {
    this.cleanupButtonEvents();

    this.currentButtonHandlers = new Map();

    Object.entries(buttonHandlers).forEach(([buttonId, handler]) => {
      const button = document.getElementById(buttonId);
      if (button) {
        button.addEventListener("click", handler);

        this.currentButtonHandlers.set(buttonId, {
          element: button,
          handler: handler,
        });
      }
    });
  }

  cleanupButtonEvents() {
    if (this.currentButtonHandlers) {
      this.currentButtonHandlers.forEach(({ element, handler }) => {
        element.removeEventListener("click", handler);
      });
      this.currentButtonHandlers.clear();
    }
  }

  cleanupPersistentButtonEvents() {
    if (this.persistentButtonHandlers) {
      this.persistentButtonHandlers.forEach(({ element, handler }) => {
        element.removeEventListener("click", handler);
      });
      this.persistentButtonHandlers.clear();
    }
  }

  /**
   * Sets up transport control event listeners (play/pause, progress bars)
   * @param {Object} transportHandlers - Map of control IDs to handler functions
   */
  setupTransportEvents(transportHandlers) {
    this.cleanupTransportEvents();

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

        this.currentTransportHandlers.set(controlId, {
          element: control,
          eventType: control.type === "range" ? "input" : "click",
          handler: eventHandler,
        });
      }
    });
  }

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

  cleanup() {
    document.removeEventListener("keydown", this.handleKeyDown);
    document.removeEventListener("keyup", this.handleKeyUp);
    document.removeEventListener("mousemove", this.handleGlobalMouseMove);
    document.removeEventListener("mouseup", this.handleGlobalMouseUp);

    this.cleanupTransportEvents();
    this.cleanupButtonEvents();
    this.cleanupPersistentButtonEvents();

    this.eventHandlers.clear();

    console.log("InputController cleaned up");
  }
}
