/**
 * CanvasRenderer - Handles all canvas drawing operations
 * Responsible for rendering timelines, editing views, and visual feedback
 */
export class CanvasRenderer {
  constructor() {
    this.soundColors = ["#ff6b6b", "#4ecdc4", "#45b7d1"];
    this.semitoneHeight = 25;
    this.iconCache = new Map(); // Cache for loaded icons
    this.colorCache = new Map(); // Cache for generated colors

    // Scrollable timeline properties
    this.pixelsPerSecond = 200; // How many pixels per second of audio
    this.viewportOffset = 0; // Current scroll position in seconds
    this.autoScrollEnabled = true; // Whether to auto-scroll with playhead
  }

  // Generate a simple hash from a string
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  // Generate a pastel color based on icon filename
  getColorForIcon(iconUrl) {
    if (!iconUrl) return "#ddd"; // Default light gray

    if (this.colorCache.has(iconUrl)) {
      return this.colorCache.get(iconUrl);
    }

    // Extract filename from URL
    const filename = iconUrl.split("/").pop().split(".")[0];

    // Generate hue from filename hash (0-360)
    const hash = this.hashString(filename);
    const hue = hash % 360;

    // Use pastel colors: high lightness (75-85%), moderate saturation (45-65%)
    const saturation = 45 + (hash % 20); // 45-65%
    const lightness = 75 + (hash % 10); // 75-85%

    const color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    this.colorCache.set(iconUrl, color);

    return color;
  }

  // Load icon and cache it
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

  // Get icon for an event (handles both performance and preview/showcase events)
  getEventIcon(event, selectedSounds = null) {
    if (event.icon) {
      return event.icon; // Direct icon from server data (preview/showcase)
    } else if (selectedSounds && selectedSounds[event.soundIndex]) {
      return selectedSounds[event.soundIndex].icon; // Icon from selected sounds (performance/editing)
    }
    return null;
  }

  // Draw a note with icon (synchronous - loads icon if available, otherwise shows fallback)
  drawNoteWithIcon(
    ctx,
    x,
    y,
    radius,
    event,
    selectedSounds = null,
    fallbackNumber = null,
  ) {
    // Get icon URL and determine color
    const iconUrl = this.getEventIcon(event, selectedSounds);
    const backgroundColor = iconUrl
      ? this.getColorForIcon(iconUrl)
      : this.soundColors[event.soundIndex] || "#999";

    // Draw background circle
    ctx.fillStyle = backgroundColor;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    // Add white border for better visibility
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Try to draw icon if already cached
    if (iconUrl && this.iconCache.has(iconUrl)) {
      const icon = this.iconCache.get(iconUrl);
      if (icon) {
        // Draw icon centered in the circle
        const iconSize = radius * 1.4; // Icon slightly smaller than circle
        ctx.save();

        // Create circular clipping path
        ctx.beginPath();
        ctx.arc(x, y, radius - 2, 0, Math.PI * 2);
        ctx.clip();

        // Draw the icon
        ctx.drawImage(
          icon,
          x - iconSize / 2,
          y - iconSize / 2,
          iconSize,
          iconSize,
        );

        ctx.restore();
        return true; // Successfully drew icon
      }
    }

    // Load icon asynchronously for next frame if not cached
    if (iconUrl && !this.iconCache.has(iconUrl)) {
      this.loadIcon(iconUrl); // Fire and forget for next render
    }

    // Fallback to number if icon not available
    if (fallbackNumber !== null) {
      ctx.fillStyle = "white";
      ctx.font = "12px Arial";
      ctx.textAlign = "center";
      ctx.fillText(fallbackNumber.toString(), x, y + 4);
    }

    return false; // Did not draw icon
  }

  // Calculate viewport parameters for scrollable timeline
  calculateViewport(currentTime, segmentLength, canvasWidth) {
    const viewportDuration = canvasWidth / this.pixelsPerSecond;

    if (this.autoScrollEnabled) {
      // Auto-scroll logic: start scrolling when playhead passes halfway across screen
      const halfViewport = viewportDuration / 2;

      if (currentTime > halfViewport) {
        // Keep playhead at center of screen once scrolling starts
        this.viewportOffset = currentTime - halfViewport;
      } else {
        // Show from beginning until playhead reaches center
        this.viewportOffset = 0;
      }

      // Don't scroll past the end
      const maxOffset = Math.max(0, segmentLength - viewportDuration);
      this.viewportOffset = Math.min(this.viewportOffset, maxOffset);
    }

    return {
      startTime: this.viewportOffset,
      endTime: this.viewportOffset + viewportDuration,
      viewportDuration,
    };
  }

  // Convert time to screen X coordinate
  timeToX(time, viewport) {
    return (time - viewport.startTime) * this.pixelsPerSecond;
  }

  // Convert screen X coordinate to time
  xToTime(x, viewport) {
    return viewport.startTime + x / this.pixelsPerSecond;
  }

  // Timeline rendering (Performance phase) - now with scrolling support
  drawTimeline(
    canvas,
    events,
    currentTime,
    segmentLength,
    selectedSounds = null,
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Calculate viewport for scrolling
    const viewport = this.calculateViewport(currentTime, segmentLength, width);

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw background
    ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
    ctx.fillRect(0, 0, width, height);

    // Draw three horizontal tracks for each sound
    const trackHeight = height / 3;

    // Draw track separators
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 2;
    for (let i = 1; i < 3; i++) {
      const y = i * trackHeight;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw time grid for viewport
    this.drawScrollableTimeGrid(ctx, width, height, viewport);

    // Draw track labels
    this.drawTrackLabels(ctx, trackHeight);

    // Draw events that are visible in the current viewport
    events.forEach((event) => {
      if (
        event.startTimeSec >= viewport.startTime &&
        event.startTimeSec <= viewport.endTime
      ) {
        const x = this.timeToX(event.startTimeSec, viewport);
        const trackY = event.soundIndex * trackHeight + trackHeight / 2;

        // Draw event marker with icon
        this.drawNoteWithIcon(
          ctx,
          x,
          trackY,
          8,
          event,
          selectedSounds,
          event.soundIndex + 1,
        );

        // Store display coordinates for interaction
        event.displayX = x;
        event.displayY = trackY;
      }
    });

    // Draw playhead
    this.drawScrollablePlayhead(ctx, currentTime, viewport, width, height);
  }

  // Editing view rendering (individual sound tracks) - now with scrolling support
  drawEditingTrack(
    canvas,
    events,
    currentTime,
    segmentLength,
    soundIndex,
    isPlaying,
    selectedSounds = null,
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Calculate viewport for scrolling
    const viewport = this.calculateViewport(currentTime, segmentLength, width);

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw background
    ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
    ctx.fillRect(0, 0, width, height);

    // Draw time grid for viewport
    this.drawScrollableTimeGrid(ctx, width, height, viewport);

    // Draw pitch grid
    this.drawPitchGrid(ctx, width, height);

    // Draw events for this sound type only that are visible in viewport
    const soundEvents = events.filter(
      (event) =>
        event.soundIndex === soundIndex &&
        event.startTimeSec >= viewport.startTime &&
        event.startTimeSec <= viewport.endTime,
    );

    soundEvents.forEach((event) => {
      const x = this.timeToX(event.startTimeSec, viewport);
      const centerY = height / 2;
      const y = centerY - event.pitchSemitones * this.semitoneHeight;

      // Draw event with icon
      this.drawNoteWithIcon(
        ctx,
        x,
        y,
        12,
        event,
        selectedSounds,
        event.soundIndex + 1,
      );

      // Store position for interaction (extend the event object)
      event.displayX = x;
      event.displayY = y;
      event.canvasIndex = soundIndex;
    });

    // Draw playhead if playing
    if (isPlaying) {
      this.drawScrollablePlayhead(ctx, currentTime, viewport, width, height);
    }
  }

  // Final view rendering (combined timeline) - now with scrolling support
  drawFinalView(canvas, events, currentTime, totalTime) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Calculate viewport for scrolling (use totalTime as segmentLength)
    const viewport = this.calculateViewport(currentTime, totalTime, width);

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw background
    ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
    ctx.fillRect(0, 0, width, height);

    // Draw time grid for viewport
    this.drawScrollableTimeGrid(ctx, width, height, viewport);

    // Draw events that are visible in the current viewport
    events.forEach((event) => {
      if (
        event.startTimeSec >= viewport.startTime &&
        event.startTimeSec <= viewport.endTime
      ) {
        const x = this.timeToX(event.startTimeSec, viewport);
        const centerY = height / 2;
        const y = centerY - event.pitchSemitones * 5; // Visual offset for pitch

        // Draw event with icon (events already have icon property from server)
        this.drawNoteWithIcon(
          ctx,
          x,
          y,
          10,
          event,
          null, // No selectedSounds needed as events have direct icon property
          event.soundIndex + 1,
        );
      }
    });

    // Draw playhead
    this.drawScrollablePlayhead(ctx, currentTime, viewport, width, height);
  }

  // Helper methods
  drawTimeGrid(ctx, width, height, segmentLength) {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 1;

    const divisions = Math.ceil(segmentLength);
    for (let i = 0; i <= divisions; i++) {
      const x = (i / divisions) * width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
  }

  // Scrollable time grid for viewport-based timeline
  drawScrollableTimeGrid(ctx, width, height, viewport) {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 1;

    // Draw grid lines at second intervals
    const startSecond = Math.floor(viewport.startTime);
    const endSecond = Math.ceil(viewport.endTime);

    for (let i = startSecond; i <= endSecond; i++) {
      const x = this.timeToX(i, viewport);
      if (x >= 0 && x <= width) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();

        // Draw time labels
        ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
        ctx.font = "10px Arial";
        ctx.textAlign = "center";
        ctx.fillText(`${i}s`, x, 15);
      }
    }
  }

  drawPitchGrid(ctx, width, height) {
    const centerY = height / 2;

    // Draw center line (0 semitones)
    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();

    // Draw semitone lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 1;
    for (let i = -12; i <= 12; i++) {
      if (i === 0) continue; // Skip center line
      const y = centerY - i * this.semitoneHeight;
      if (y >= 0 && y <= height) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    }
  }

  drawTrackLabels(ctx, trackHeight) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "left";
    for (let i = 0; i < 3; i++) {
      const y = i * trackHeight + trackHeight / 2;
      ctx.fillText(`Sound ${i + 1}`, 10, y + 5);
    }
  }

  drawPlayhead(ctx, currentTime, segmentLength, width, height) {
    const playheadX = (currentTime / segmentLength) * width;
    ctx.strokeStyle = "#ff4757";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, height);
    ctx.stroke();
  }

  // Scrollable playhead for viewport-based timeline
  drawScrollablePlayhead(ctx, currentTime, viewport, width, height) {
    const playheadX = this.timeToX(currentTime, viewport);

    // Only draw playhead if it's visible in the current viewport
    if (playheadX >= 0 && playheadX <= width) {
      ctx.strokeStyle = "#ff4757";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();

      // Add a triangular playhead indicator at the top
      ctx.fillStyle = "#ff4757";
      ctx.beginPath();
      ctx.moveTo(playheadX - 6, 0);
      ctx.lineTo(playheadX + 6, 0);
      ctx.lineTo(playheadX, 12);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Interaction helpers - updated for scrollable timeline
  getEventAtPosition(
    events,
    mouseX,
    mouseY,
    canvas,
    segmentLength,
    soundIndex = null,
    currentTime = 0,
  ) {
    if (!canvas) return null;

    const width = canvas.width;
    const height = canvas.height;

    // Calculate viewport for scrollable timeline
    const viewport = this.calculateViewport(currentTime, segmentLength, width);

    // Find events near the click position
    const candidateEvents = events.filter((event) => {
      if (soundIndex !== null && event.soundIndex !== soundIndex) {
        return false;
      }

      // Only consider events visible in current viewport
      if (
        event.startTimeSec < viewport.startTime ||
        event.startTimeSec > viewport.endTime
      ) {
        return false;
      }

      // Check if event has display coordinates, otherwise calculate them
      if (!event.displayX || !event.displayY) {
        // Calculate coordinates using viewport
        const x = this.timeToX(event.startTimeSec, viewport);
        let y;

        if (soundIndex !== null) {
          // Editing view - use pitch-based Y position
          const centerY = height / 2;
          y = centerY - event.pitchSemitones * this.semitoneHeight;
        } else {
          // Timeline view - use track-based Y position
          const trackHeight = height / 3;
          y = event.soundIndex * trackHeight + trackHeight / 2;
        }

        event.displayX = x;
        event.displayY = y;
      }

      const distance = Math.sqrt(
        Math.pow(mouseX - event.displayX, 2) +
          Math.pow(mouseY - event.displayY, 2),
      );

      return distance <= 15; // Hit radius
    });

    if (candidateEvents.length === 0) return null;

    // Return the closest event
    return candidateEvents.reduce((prev, curr) => {
      const prevDistance = Math.sqrt(
        Math.pow(mouseX - prev.displayX, 2) +
          Math.pow(mouseY - prev.displayY, 2),
      );
      const currDistance = Math.sqrt(
        Math.pow(mouseX - curr.displayX, 2) +
          Math.pow(mouseY - curr.displayY, 2),
      );

      return currDistance < prevDistance ? curr : prev;
    });
  }

  // Add method to convert mouse position to time in scrollable timeline
  getTimeAtPosition(mouseX, canvas, segmentLength, currentTime = 0) {
    if (!canvas) return 0;

    const viewport = this.calculateViewport(
      currentTime,
      segmentLength,
      canvas.width,
    );
    return this.xToTime(mouseX, viewport);
  }

  // Calculate pitch change from mouse movement
  calculatePitchChange(deltaY) {
    return Math.round(deltaY / this.semitoneHeight);
  }

  // Constrain pitch to valid range
  constrainPitch(pitch, min = -12, max = 12) {
    return Math.max(min, Math.min(max, pitch));
  }

  // Manual scrolling controls
  setAutoScroll(enabled) {
    this.autoScrollEnabled = enabled;
  }

  scrollToTime(time) {
    this.autoScrollEnabled = false;
    this.viewportOffset = time;
  }

  scrollBy(deltaTime) {
    this.autoScrollEnabled = false;
    this.viewportOffset += deltaTime;
    this.viewportOffset = Math.max(0, this.viewportOffset);
  }

  resetScroll() {
    this.viewportOffset = 0;
    this.autoScrollEnabled = true;
  }
}
