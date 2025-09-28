/**
 * CanvasRenderer - Handles all canvas drawing operations
 * Responsible for rendering timelines, editing views, and visual feedback
 */
export class CanvasRenderer {
    constructor() {
        this.soundColors = ['#ff6b6b', '#4ecdc4', '#45b7d1'];
        this.semitoneHeight = 25;
    }

    // Timeline rendering (Performance phase)
    drawTimeline(canvas, events, currentTime, segmentLength) {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const width = canvas.width;
        const height = canvas.height;

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // Draw background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.fillRect(0, 0, width, height);

        // Draw three horizontal tracks for each sound
        const trackHeight = height / 3;

        // Draw track separators
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        for (let i = 1; i < 3; i++) {
            const y = i * trackHeight;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }

        // Draw time grid
        this.drawTimeGrid(ctx, width, height, segmentLength);

        // Draw track labels
        this.drawTrackLabels(ctx, trackHeight);

        // Draw events on their respective tracks
        events.forEach(event => {
            const x = (event.startTimeSec / segmentLength) * width;
            const trackY = event.soundIndex * trackHeight + trackHeight / 2;

            // Draw event marker
            ctx.fillStyle = this.soundColors[event.soundIndex] || '#999';
            ctx.beginPath();
            ctx.arc(x, trackY, 8, 0, Math.PI * 2);
            ctx.fill();

            // Add white border for better visibility
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Draw sound number
            ctx.fillStyle = 'white';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText((event.soundIndex + 1).toString(), x, trackY + 4);
        });

        // Draw playhead
        this.drawPlayhead(ctx, currentTime, segmentLength, width, height);
    }

    // Editing view rendering (individual sound tracks)
    drawEditingTrack(canvas, events, currentTime, segmentLength, soundIndex, isPlaying) {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const width = canvas.width;
        const height = canvas.height;

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // Draw background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.fillRect(0, 0, width, height);

        // Draw time grid
        this.drawTimeGrid(ctx, width, height, segmentLength);

        // Draw pitch grid
        this.drawPitchGrid(ctx, width, height);

        // Draw events for this sound type only
        const soundEvents = events.filter(event => event.soundIndex === soundIndex);

        soundEvents.forEach(event => {
            const x = (event.startTimeSec / segmentLength) * width;
            const centerY = height / 2;
            const y = centerY - (event.pitchSemitones * this.semitoneHeight);

            // Draw event
            ctx.fillStyle = this.soundColors[event.soundIndex] || '#999';
            ctx.beginPath();
            ctx.arc(x, y, 12, 0, Math.PI * 2);
            ctx.fill();

            // Add border for better visibility
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Draw sound number
            ctx.fillStyle = 'white';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText((event.soundIndex + 1).toString(), x, y + 4);

            // Store position for interaction (extend the event object)
            event.displayX = x;
            event.displayY = y;
            event.canvasIndex = soundIndex;
        });

        // Draw playhead if playing
        if (isPlaying) {
            this.drawPlayhead(ctx, currentTime, segmentLength, width, height);
        }
    }

    // Final view rendering (combined timeline)
    drawFinalView(canvas, events, currentTime, totalTime) {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const width = canvas.width;
        const height = canvas.height;

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // Draw background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.fillRect(0, 0, width, height);

        // Draw time grid for the full timeline
        this.drawTimeGrid(ctx, width, height, totalTime);

        // Draw events
        events.forEach(event => {
            const x = (event.startTimeSec / totalTime) * width;
            const centerY = height / 2;
            const y = centerY - (event.pitchSemitones * 5); // Visual offset for pitch

            // Draw event marker
            ctx.fillStyle = this.soundColors[event.soundIndex] || '#999';
            ctx.beginPath();
            ctx.arc(x, y, 10, 0, Math.PI * 2);
            ctx.fill();

            // Draw sound number
            ctx.fillStyle = 'white';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText((event.soundIndex + 1).toString(), x, y + 4);
        });

        // Draw playhead
        this.drawPlayhead(ctx, currentTime, totalTime, width, height);
    }

    // Helper methods
    drawTimeGrid(ctx, width, height, segmentLength) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
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

    drawPitchGrid(ctx, width, height) {
        const centerY = height / 2;

        // Draw center line (0 semitones)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        ctx.lineTo(width, centerY);
        ctx.stroke();

        // Draw semitone lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        for (let i = -12; i <= 12; i++) {
            if (i === 0) continue; // Skip center line
            const y = centerY - (i * this.semitoneHeight);
            if (y >= 0 && y <= height) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
                ctx.stroke();
            }
        }
    }

    drawTrackLabels(ctx, trackHeight) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'left';
        for (let i = 0; i < 3; i++) {
            const y = i * trackHeight + trackHeight / 2;
            ctx.fillText(`Sound ${i + 1}`, 10, y + 5);
        }
    }

    drawPlayhead(ctx, currentTime, segmentLength, width, height) {
        const playheadX = (currentTime / segmentLength) * width;
        ctx.strokeStyle = '#ff4757';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(playheadX, 0);
        ctx.lineTo(playheadX, height);
        ctx.stroke();
    }

    // Interaction helpers
    getEventAtPosition(events, mouseX, mouseY, canvas, segmentLength, soundIndex = null) {
        if (!canvas) return null;

        const width = canvas.width;
        const height = canvas.height;

        // Find events near the click position
        const candidateEvents = events.filter(event => {
            if (soundIndex !== null && event.soundIndex !== soundIndex) {
                return false;
            }

            // Check if event has display coordinates
            if (!event.displayX || !event.displayY) {
                // Calculate coordinates if not available
                const x = (event.startTimeSec / segmentLength) * width;
                let y;

                if (soundIndex !== null) {
                    // Editing view - use pitch-based Y position
                    const centerY = height / 2;
                    y = centerY - (event.pitchSemitones * this.semitoneHeight);
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
                Math.pow(mouseY - event.displayY, 2)
            );

            return distance <= 15; // Hit radius
        });

        if (candidateEvents.length === 0) return null;

        // Return the closest event
        return candidateEvents.reduce((prev, curr) => {
            const prevDistance = Math.sqrt(
                Math.pow(mouseX - prev.displayX, 2) +
                Math.pow(mouseY - prev.displayY, 2)
            );
            const currDistance = Math.sqrt(
                Math.pow(mouseX - curr.displayX, 2) +
                Math.pow(mouseY - curr.displayY, 2)
            );

            return currDistance < prevDistance ? curr : prev;
        });
    }

    // Calculate pitch change from mouse movement
    calculatePitchChange(deltaY) {
        return Math.round(deltaY / this.semitoneHeight);
    }

    // Constrain pitch to valid range
    constrainPitch(pitch, min = -12, max = 12) {
        return Math.max(min, Math.min(max, pitch));
    }
}
