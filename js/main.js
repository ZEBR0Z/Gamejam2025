import { Game } from "./Game.js";

/**
 * main.js - Application entry point
 * Initializes and starts the game
 */

let game = null;

/**
 * Initialize the game when DOM is ready
 */
async function init() {
  try {
    console.log("Starting game initialization...");

    // Create game instance
    game = new Game();

    // Initialize game
    await game.initialize();

    console.log("Game ready!");
  } catch (error) {
    console.error("Failed to initialize game:", error);

    // Show error dialog
    const errorDialog = document.getElementById("error-dialog");
    const errorMessage = document.getElementById("error-message");
    if (errorDialog && errorMessage) {
      errorMessage.textContent = "Failed to start game. Please refresh the page.";
      errorDialog.showModal();
    } else {
      alert("Failed to start game. Please refresh the page.");
    }
  }
}

/**
 * Cleanup on page unload
 */
window.addEventListener("beforeunload", () => {
  if (game) {
    game.cleanup();
  }
});

// Start when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
