/**
 * CanvasService - Handles all canvas drawing operations
 * Responsible for rendering timelines, editing views, and visual feedback
 */
export class CanvasService {
  constructor() {
    this.soundColors = ["#ff6b6b", "#4ecdc4", "#45b7d1"];
    this.semitoneHeight = 25;
    this.iconCache = new Map();
    this.colorCache = new Map();
    this.pixelsPerSecond = 200;
    this.viewportOffset = 0;
    this.autoScrollEnabled = true;
  }

  /**
   * Hash string to generate consistent color
   * @param {string} str
   * @returns {number}
   */
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  /**
   * Get color for an icon URL (cached)
   * @param {string} iconUrl
   * @returns {string} HSL color string
   */
  getColorForIcon(iconUrl) {
    if (!iconUrl) return "#ddd";

    if (this.colorCache.has(iconUrl)) {
      return this.colorCache.get(iconUrl);
    }

    const filename = iconUrl.split("/").pop().split(".")[0];
    const hash = this.hashString(filename);
    const hue = hash % 360;
    const saturation = 45 + (hash % 20);
    const lightness = 75 + (hash % 10);

    const color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    this.colorCache.set(iconUrl, color);

    return color;
  }

  /**
   * Load an icon image and cache it
   * @param {string} iconUrl
   * @returns {Promise<Image|null>}
   */
  async loadIcon(iconUrl) {
    if (!iconUrl) return null;

    if (this.iconCache.has(iconUrl)) {
      return this.iconCache.get(iconUrl);
    }

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        this.iconCache.set(iconUrl, img);
        resolve(img);
      };
      img.onerror = () => {
        console.warn(`Failed to load icon: ${iconUrl}`);
        resolve(null);
      };
      img.src = iconUrl;
    });
  }

  /**
   * Get icon URL from event
   * @param {Object} event
   * @param {Array} selectedSounds
   * @returns {string|null}
   */
  getEventIcon(event, selectedSounds = null) {
    if (event.icon) {
      return event.icon;
    } else if (selectedSounds && selectedSounds[event.soundIndex]) {
      return selectedSounds[event.soundIndex].icon;
    }
    return null;
  }

  /**
   * Draw a note with an icon on the canvas
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x
   * @param {number} y
   * @param {number} radius
   * @param {Object} event
   * @param {Array} selectedSounds
   * @param {number} fallbackNumber
   * @param {number} opacity
   * @returns {boolean} True if icon was drawn
   */
  drawNoteWithIcon(
    ctx,
    x,
    y,
    radius,
    event,
    selectedSounds = null,
    fallbackNumber = null,
    opacity = 1.0
  ) {
    const iconUrl = this.getEventIcon(event, selectedSounds);
    const backgroundColor = iconUrl
      ? this.getColorForIcon(iconUrl)
      : this.soundColors[event.soundIndex] || "#999";

    ctx.save();
    ctx.globalAlpha = opacity;

    // Draw background circle
    ctx.fillStyle = backgroundColor;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    // White border
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Try to draw icon if cached
    if (iconUrl && this.iconCache.has(iconUrl)) {
      const icon = this.iconCache.get(iconUrl);
      if (icon) {
        const iconSize = radius * 1.4;
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, radius - 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(icon, x - iconSize / 2, y - iconSize / 2, iconSize, iconSize);
        ctx.restore();
        ctx.restore();
        return true;
      }
    }

    // Load icon asynchronously for next frame
    if (iconUrl && !this.iconCache.has(iconUrl)) {
      this.loadIcon(iconUrl);
    }

    // Fallback to number
    if (fallbackNumber !== null) {
      ctx.fillStyle = "white";
      ctx.font = "12px HeatSans";
      ctx.textAlign = "center";
      ctx.fillText(fallbackNumber.toString(), x, y + 4);
    }

    ctx.restore();
    return false;
  }

  /**
   * Calculate viewport for scrolling
   * @param {number} currentTime
   * @param {number} segmentLength
   * @param {number} canvasWidth
   * @returns {Object} {startTime, endTime, viewportDuration}
   */
  calculateViewport(currentTime, segmentLength, canvasWidth) {
    const viewportDuration = canvasWidth / this.pixelsPerSecond;

    if (this.autoScrollEnabled) {
      const halfViewport = viewportDuration / 2;

      if (currentTime > halfViewport) {
        this.viewportOffset = currentTime - halfViewport;
      } else {
        this.viewportOffset = 0;
      }

      const maxOffset = Math.max(0, segmentLength - viewportDuration);
      this.viewportOffset = Math.min(this.viewportOffset, maxOffset);
    }

    return {
      startTime: this.viewportOffset,
      endTime: this.viewportOffset + viewportDuration,
      viewportDuration,
    };
  }

  /**
   * Convert time to screen X coordinate
   * @param {number} time
   * @param {Object} viewport
   * @returns {number}
   */
  timeToX(time, viewport) {
    return (time - viewport.startTime) * this.pixelsPerSecond;
  }

  /**
   * Convert screen X coordinate to time
   * @param {number} x
   * @param {Object} viewport
   * @returns {number}
   */
  xToTime(x, viewport) {
    return viewport.startTime + x / this.pixelsPerSecond;
  }

  /**
   * Draw timeline (performance phase)
   * @param {HTMLCanvasElement} canvas
   * @param {Array} events
   * @param {number} currentTime
   * @param {number} segmentLength
   * @param {Array} selectedSounds
   */
  drawTimeline(canvas, events, currentTime, segmentLength, selectedSounds = null) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const viewport = this.calculateViewport(currentTime, segmentLength, width);

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
    ctx.fillRect(0, 0, width, height);

    // Three horizontal tracks
    const trackHeight = height / 3;

    // Track separators
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 2;
    for (let i = 1; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * trackHeight);
      ctx.lineTo(width, i * trackHeight);
      ctx.stroke();
    }

    // Time grid
    this.drawScrollableTimeGrid(ctx, width, height, viewport);

    // Track labels
    this.drawTrackLabels(ctx, trackHeight);

    // Draw events
    events.forEach((event) => {
      if (event.startTimeSec >= viewport.startTime && event.startTimeSec <= viewport.endTime) {
        const x = this.timeToX(event.startTimeSec, viewport);
        const trackY = event.soundIndex * trackHeight + trackHeight / 2;

        this.drawNoteWithIcon(ctx, x, trackY, 13, event, selectedSounds, event.soundIndex + 1);

        event.displayX = x;
        event.displayY = trackY;
      }
    });

    // Playhead
    this.drawScrollablePlayhead(ctx, currentTime, viewport, width, height);
  }

  /**
   * Draw editing track (single sound)
   * @param {HTMLCanvasElement} canvas
   * @param {Array} events
   * @param {number} currentTime
   * @param {number} segmentLength
   * @param {number} soundIndex
   * @param {boolean} isPlaying
   * @param {Array} selectedSounds
   */
  drawEditingTrack(
    canvas,
    events,
    currentTime,
    segmentLength,
    soundIndex,
    isPlaying,
    selectedSounds = null
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const viewport = this.calculateViewport(currentTime, segmentLength, width);

    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
    ctx.fillRect(0, 0, width, height);

    // Grids
    this.drawScrollableTimeGrid(ctx, width, height, viewport);
    this.drawPitchGrid(ctx, width, height);

    // Draw events for this sound
    const soundEvents = events.filter(
      (event) =>
        event.soundIndex === soundIndex &&
        event.startTimeSec >= viewport.startTime &&
        event.startTimeSec <= viewport.endTime
    );

    soundEvents.forEach((event) => {
      const x = this.timeToX(event.startTimeSec, viewport);
      const centerY = height / 2;
      const y = centerY - event.pitchSemitones * this.semitoneHeight;

      this.drawNoteWithIcon(ctx, x, y, 13, event, selectedSounds, event.soundIndex + 1);

      event.displayX = x;
      event.displayY = y;
      event.canvasIndex = soundIndex;
    });

    // Playhead
    if (isPlaying) {
      this.drawScrollablePlayhead(ctx, currentTime, viewport, width, height);
    }
  }

  /**
   * Draw editing timeline (all sounds with transparency)
   * @param {HTMLCanvasElement} canvas
   * @param {Array} events
   * @param {number} currentTime
   * @param {number} segmentLength
   * @param {number} selectedSoundIndex
   * @param {boolean} isPlaying
   * @param {Array} selectedSounds
   */
  drawEditingTimeline(
    canvas,
    events,
    currentTime,
    segmentLength,
    selectedSoundIndex,
    isPlaying,
    selectedSounds = null
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const viewport = this.calculateViewport(currentTime, segmentLength, width);

    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
    ctx.fillRect(0, 0, width, height);

    // Grids
    this.drawScrollableTimeGrid(ctx, width, height, viewport);
    this.drawPitchGrid(ctx, width, height);

    // Draw all events with transparency
    const visibleEvents = events.filter(
      (event) =>
        event.startTimeSec >= viewport.startTime && event.startTimeSec <= viewport.endTime
    );

    visibleEvents.forEach((event) => {
      const x = this.timeToX(event.startTimeSec, viewport);
      const centerY = height / 2;
      const y = centerY - event.pitchSemitones * this.semitoneHeight;

      const isSelected = event.soundIndex === selectedSoundIndex;
      const opacity = isSelected ? 1.0 : 0.2;

      this.drawNoteWithIcon(ctx, x, y, 13, event, selectedSounds, event.soundIndex + 1, opacity);

      event.displayX = x;
      event.displayY = y;
    });

    // Playhead - always show in editing mode
    this.drawScrollablePlayhead(ctx, currentTime, viewport, width, height);
  }

  /**
   * Draw final view (combined timeline)
   * @param {HTMLCanvasElement} canvas
   * @param {Array} events
   * @param {number} currentTime
   * @param {number} totalTime
   */
  drawFinalView(canvas, events, currentTime, totalTime) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const viewport = this.calculateViewport(currentTime, totalTime, width);

    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
    ctx.fillRect(0, 0, width, height);

    // Time grid
    this.drawScrollableTimeGrid(ctx, width, height, viewport);

    // Draw events
    events.forEach((event) => {
      if (event.startTimeSec >= viewport.startTime && event.startTimeSec <= viewport.endTime) {
        const x = this.timeToX(event.startTimeSec, viewport);
        const centerY = height / 2;
        const y = centerY - event.pitchSemitones * 5;

        this.drawNoteWithIcon(ctx, x, y, 13, event, null, event.soundIndex + 1);
      }
    });

    // Playhead
    this.drawScrollablePlayhead(ctx, currentTime, viewport, width, height);
  }

  /**
   * Draw scrollable time grid
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} width
   * @param {number} height
   * @param {Object} viewport
   */
  drawScrollableTimeGrid(ctx, width, height, viewport) {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 1;

    const startSecond = Math.floor(viewport.startTime);
    const endSecond = Math.ceil(viewport.endTime);

    for (let i = startSecond; i <= endSecond; i++) {
      const x = this.timeToX(i, viewport);
      if (x >= 0 && x <= width) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();

        // Time labels
        ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
        ctx.font = "10px Basis";
        ctx.textAlign = "center";
        ctx.fillText(`${i}s`, x, 15);
      }
    }
  }

  /**
   * Draw pitch grid
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} width
   * @param {number} height
   */
  drawPitchGrid(ctx, width, height) {
    const centerY = height / 2;

    // Center line (0 semitones)
    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();

    // Semitone lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 1;
    for (let i = -12; i <= 12; i++) {
      if (i === 0) continue;
      const y = centerY - i * this.semitoneHeight;
      if (y >= 0 && y <= height) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    }
  }

  /**
   * Draw track labels
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} trackHeight
   */
  drawTrackLabels(ctx, trackHeight) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.font = "14px HeatSans";
    ctx.textAlign = "left";
    for (let i = 0; i < 3; i++) {
      const y = i * trackHeight + trackHeight / 2;
      ctx.fillText(`SOUND ${i + 1}`, 10, y + 5);
    }
  }

  /**
   * Draw scrollable playhead
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} currentTime
   * @param {Object} viewport
   * @param {number} width
   * @param {number} height
   */
  drawScrollablePlayhead(ctx, currentTime, viewport, width, height) {
    const playheadX = this.timeToX(currentTime, viewport);

    if (playheadX >= 0 && playheadX <= width) {
      ctx.strokeStyle = "#ff4757";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();

      // Triangle at top
      ctx.fillStyle = "#ff4757";
      ctx.beginPath();
      ctx.moveTo(playheadX - 6, 0);
      ctx.lineTo(playheadX + 6, 0);
      ctx.lineTo(playheadX, 12);
      ctx.closePath();
      ctx.fill();
    }
  }

  /**
   * Get event at mouse position
   * @param {Array} events
   * @param {number} mouseX
   * @param {number} mouseY
   * @param {HTMLCanvasElement} canvas
   * @param {number} segmentLength
   * @param {number} soundIndex
   * @param {number} currentTime
   * @returns {Object|null}
   */
  getEventAtPosition(events, mouseX, mouseY, canvas, segmentLength, soundIndex = null, currentTime = 0) {
    if (!canvas) return null;

    const width = canvas.width;
    const height = canvas.height;
    const viewport = this.calculateViewport(currentTime, segmentLength, width);

    const candidateEvents = events.filter((event) => {
      if (soundIndex !== null && event.soundIndex !== soundIndex) return false;
      if (event.startTimeSec < viewport.startTime || event.startTimeSec > viewport.endTime) return false;

      // Calculate coordinates if not set
      if (!event.displayX || !event.displayY) {
        const x = this.timeToX(event.startTimeSec, viewport);
        let y;

        if (soundIndex !== null) {
          const centerY = height / 2;
          y = centerY - event.pitchSemitones * this.semitoneHeight;
        } else {
          const trackHeight = height / 3;
          y = event.soundIndex * trackHeight + trackHeight / 2;
        }

        event.displayX = x;
        event.displayY = y;
      }

      const distance = Math.sqrt(
        Math.pow(mouseX - event.displayX, 2) + Math.pow(mouseY - event.displayY, 2)
      );

      return distance <= 15;
    });

    if (candidateEvents.length === 0) return null;

    // Return closest
    return candidateEvents.reduce((prev, curr) => {
      const prevDistance = Math.sqrt(
        Math.pow(mouseX - prev.displayX, 2) + Math.pow(mouseY - prev.displayY, 2)
      );
      const currDistance = Math.sqrt(
        Math.pow(mouseX - curr.displayX, 2) + Math.pow(mouseY - curr.displayY, 2)
      );
      return currDistance < prevDistance ? curr : prev;
    });
  }

  /**
   * Get time at mouse position
   * @param {number} mouseX
   * @param {HTMLCanvasElement} canvas
   * @param {number} segmentLength
   * @param {number} currentTime
   * @returns {number}
   */
  getTimeAtPosition(mouseX, canvas, segmentLength, currentTime = 0) {
    if (!canvas) return 0;
    const viewport = this.calculateViewport(currentTime, segmentLength, canvas.width);
    return this.xToTime(mouseX, viewport);
  }

  /**
   * Calculate pitch change from vertical mouse movement
   * @param {number} deltaY
   * @returns {number}
   */
  calculatePitchChange(deltaY) {
    return Math.round(deltaY / this.semitoneHeight);
  }

  /**
   * Constrain pitch value
   * @param {number} pitch
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  constrainPitch(pitch, min = -12, max = 12) {
    return Math.max(min, Math.min(max, pitch));
  }

  /**
   * Set auto-scroll enabled/disabled
   * @param {boolean} enabled
   */
  setAutoScroll(enabled) {
    this.autoScrollEnabled = enabled;
  }

  /**
   * Reset scroll to beginning
   */
  resetScroll() {
    this.viewportOffset = 0;
    this.autoScrollEnabled = true;
  }
}
