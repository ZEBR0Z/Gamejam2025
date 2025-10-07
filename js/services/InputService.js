/**
 * InputService - Manages keyboard and mouse input
 * Handles user interaction events and emits callbacks
 */
export class InputService {
  constructor() {
    this.dragState = {
      isDragging: false,
      draggedNote: null,
      draggedCanvasIndex: null,
      dragStartY: 0,
      dragStartPitch: 0,
    };

    // Handler storage
    this.eventHandlers = new Map();
    this.persistentButtonHandlers = new Map();
    this.currentButtonHandlers = new Map();
    this.currentTransportHandlers = new Map();

    // Bound methods for global listeners
    this.boundKeyDown = (e) => this.handleKeyDown(e);
    this.boundKeyUp = (e) => this.handleKeyUp(e);
    this.boundGlobalMouseMove = (e) => this.handleGlobalMouseMove(e);
    this.boundGlobalMouseUp = (e) => this.handleGlobalMouseUp(e);
  }

  /**
   * Initialize global event listeners
   */
  initialize() {
    document.addEventListener("keydown", this.boundKeyDown);
    document.addEventListener("keyup", this.boundKeyUp);
    document.addEventListener("mousemove", this.boundGlobalMouseMove);
    document.addEventListener("mouseup", this.boundGlobalMouseUp);
    console.log("InputService initialized");
  }

  /**
   * Register a handler for a specific event type and phase
   * @param {string} eventType - Type of event (keyPress, timelineRightClick, etc.)
   * @param {string} phase - Game phase
   * @param {Function} handler - Handler function
   */
  registerHandler(eventType, phase, handler) {
    const key = `${eventType}_${phase}`;
    this.eventHandlers.set(key, handler);
  }

  /**
   * Unregister a handler
   * @param {string} eventType
   * @param {string} phase
   */
  unregisterHandler(eventType, phase) {
    const key = `${eventType}_${phase}`;
    this.eventHandlers.delete(key);
  }

  /**
   * Get handler for event type in current phase
   * @param {string} eventType
   * @param {string} currentPhase
   * @returns {Function|null}
   */
  getHandler(eventType, currentPhase) {
    const key = `${eventType}_${currentPhase}`;
    return this.eventHandlers.get(key);
  }

  /**
   * Handle keydown events (for sound keys 1, 2, 3)
   * @param {KeyboardEvent} e
   */
  handleKeyDown(e) {
    // These will be called by phases via callbacks
    // For now, this is a placeholder that phases can hook into
  }

  /**
   * Handle keyup events
   * @param {KeyboardEvent} e
   */
  handleKeyUp(e) {
    // Placeholder for phases to hook into
  }

  /**
   * Set up canvas event listeners
   * @param {HTMLCanvasElement} canvas
   * @param {string} canvasType - 'timeline' or 'editing'
   * @param {number} canvasIndex - Optional index for editing canvases
   * @param {Object} handlers - Event handlers
   */
  setupCanvasEvents(canvas, canvasType, canvasIndex = null, handlers = {}) {
    if (!canvas) return;

    if (canvasType === "timeline" && handlers.onRightClick) {
      const handleContextMenu = (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        handlers.onRightClick(mouseX, mouseY);
      };
      canvas.addEventListener("contextmenu", handleContextMenu);
      canvas._contextMenuHandler = handleContextMenu;
    } else if (canvasType === "editing") {
      if (handlers.onMouseDown) {
        const handleMouseDown = (e) => {
          e.preventDefault();
          const rect = canvas.getBoundingClientRect();
          const mouseX = e.clientX - rect.left;
          const mouseY = e.clientY - rect.top;

          const result =
            canvasIndex !== null
              ? handlers.onMouseDown(mouseX, mouseY, canvasIndex)
              : handlers.onMouseDown(mouseX, mouseY);

          if (result && result.draggedNote) {
            this.dragState.isDragging = true;
            this.dragState.draggedNote = result.draggedNote;
            this.dragState.draggedCanvasIndex = canvasIndex;
            this.dragState.dragStartY = mouseY;
            this.dragState.dragStartPitch = result.draggedNote.pitchSemitones;
            canvas.style.cursor = "grabbing";
          }
        };
        canvas.addEventListener("mousedown", handleMouseDown);
        canvas._mouseDownHandler = handleMouseDown;
      }

      // Store handlers for drag operations
      canvas._dragHandlers = {
        onMouseMove: handlers.onMouseMove,
        onMouseUp: handlers.onMouseUp,
      };
    }
  }

  /**
   * Clean up canvas events
   * @param {HTMLCanvasElement} canvas
   */
  cleanupCanvasEvents(canvas) {
    if (!canvas) return;

    if (canvas._contextMenuHandler) {
      canvas.removeEventListener("contextmenu", canvas._contextMenuHandler);
      delete canvas._contextMenuHandler;
    }

    if (canvas._mouseDownHandler) {
      canvas.removeEventListener("mousedown", canvas._mouseDownHandler);
      delete canvas._mouseDownHandler;
    }

    delete canvas._dragHandlers;
    canvas.style.cursor = "";
  }

  /**
   * Handle global mouse move (for dragging)
   * @param {MouseEvent} e
   */
  handleGlobalMouseMove(e) {
    if (!this.dragState.isDragging || !this.dragState.draggedNote) return;

    // Find the canvas with drag handlers
    const canvases = document.querySelectorAll("canvas");
    for (const canvas of canvases) {
      if (canvas._dragHandlers && canvas._dragHandlers.onMouseMove) {
        const rect = canvas.getBoundingClientRect();
        const mouseY = e.clientY - rect.top;

        canvas._dragHandlers.onMouseMove(
          this.dragState.draggedNote,
          this.dragState.dragStartY,
          this.dragState.dragStartPitch,
          mouseY
        );
        break;
      }
    }
  }

  /**
   * Handle global mouse up (for dragging)
   * @param {MouseEvent} e
   */
  handleGlobalMouseUp(e) {
    if (!this.dragState.isDragging) return;

    // Find the canvas with drag handlers
    const canvases = document.querySelectorAll("canvas");
    for (const canvas of canvases) {
      if (canvas._dragHandlers && canvas._dragHandlers.onMouseUp) {
        canvas._dragHandlers.onMouseUp(this.dragState.draggedNote);
        canvas.style.cursor = "grab";
        break;
      }
    }

    // Reset drag state
    this.dragState.isDragging = false;
    this.dragState.draggedNote = null;
    this.dragState.draggedCanvasIndex = null;
    this.dragState.dragStartY = 0;
    this.dragState.dragStartPitch = 0;
  }

  /**
   * Set up persistent button event listeners
   * @param {Object} buttonHandlers - Map of button IDs to handler functions
   */
  setupPersistentButtonEvents(buttonHandlers) {
    Object.entries(buttonHandlers).forEach(([buttonId, handler]) => {
      const button = document.getElementById(buttonId);
      if (button) {
        button.addEventListener("click", handler);
        this.persistentButtonHandlers.set(buttonId, {
          element: button,
          handler: handler,
        });
      }
    });
  }

  /**
   * Set up button event listeners for current phase
   * @param {Object} buttonHandlers - Map of button IDs to handler functions
   */
  setupButtonEvents(buttonHandlers) {
    this.cleanupButtonEvents();

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

  /**
   * Clean up current button events
   */
  cleanupButtonEvents() {
    if (this.currentButtonHandlers) {
      this.currentButtonHandlers.forEach(({ element, handler }) => {
        element.removeEventListener("click", handler);
      });
      this.currentButtonHandlers.clear();
    }
  }

  /**
   * Clean up persistent button events
   */
  cleanupPersistentButtonEvents() {
    if (this.persistentButtonHandlers) {
      this.persistentButtonHandlers.forEach(({ element, handler }) => {
        element.removeEventListener("click", handler);
      });
      this.persistentButtonHandlers.clear();
    }
  }

  /**
   * Set up transport control events (play/pause, progress bars)
   * @param {Object} transportHandlers - Map of control IDs to handler functions
   */
  setupTransportEvents(transportHandlers) {
    this.cleanupTransportEvents();

    Object.entries(transportHandlers).forEach(([controlId, handler]) => {
      const control = document.getElementById(controlId);
      if (control) {
        let eventHandler;
        let eventType;

        if (control.type === "range") {
          eventType = "input";
          eventHandler = (e) => handler(parseFloat(e.target.value));
        } else {
          eventType = "click";
          eventHandler = handler;
        }

        control.addEventListener(eventType, eventHandler);
        this.currentTransportHandlers.set(controlId, {
          element: control,
          eventType: eventType,
          handler: eventHandler,
        });
      }
    });
  }

  /**
   * Clean up transport events
   */
  cleanupTransportEvents() {
    if (this.currentTransportHandlers) {
      this.currentTransportHandlers.forEach(({ element, eventType, handler }) => {
        element.removeEventListener(eventType, handler);
      });
      this.currentTransportHandlers.clear();
    }
  }

  /**
   * Clean up all event listeners
   */
  cleanup() {
    document.removeEventListener("keydown", this.boundKeyDown);
    document.removeEventListener("keyup", this.boundKeyUp);
    document.removeEventListener("mousemove", this.boundGlobalMouseMove);
    document.removeEventListener("mouseup", this.boundGlobalMouseUp);

    this.cleanupTransportEvents();
    this.cleanupButtonEvents();
    this.cleanupPersistentButtonEvents();

    this.eventHandlers.clear();
  }
}
