// Gradient Background Initializer
// This script sets up the animated gradient background for the voice agent app

(function() {
  'use strict';

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGradient);
  } else {
    initGradient();
  }

  function initGradient() {
    console.log('Initializing gradient background...');

    // Create canvas elements if they don't exist
    let canvas = document.getElementById('gradient-canvas');
    let displayCanvas = document.getElementById('gradient-display-canvas');

    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'gradient-canvas';
      canvas.style.display = 'none';
      document.body.appendChild(canvas);
    }

    if (!displayCanvas) {
      displayCanvas = document.createElement('canvas');
      displayCanvas.id = 'gradient-display-canvas';
      displayCanvas.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        z-index: -1;
        opacity: 0.85;
      `;
      document.body.insertBefore(displayCanvas, document.body.firstChild);
    }

    // Override the default IDs used by sketch.js
    window.gradientCanvasId = 'gradient-canvas';
    window.gradientDisplayCanvasId = 'gradient-display-canvas';

    // Therapeutic preset configuration (calm, ambient)
    window.gradientConfig = {
      movementMode: 6,        // Flow mode
      scale: 8.0,             // Larger patterns
      phaseX: 0.1,
      velocity: 0.15,         // Slow, calming movement
      mode1Detail: 150.0,
      mode1Twist: 0.0,
      mode2Speed: 1.5,        // Slower animation
      brightness: 0.7,        // Subdued brightness
      hue: 220.0,             // Blue hue
      saturation: 0.6,        // Soft saturation
      vibrance: 0.0,
      contrast: 1.0,
      rgbMultiplierR: 0.8,
      rgbMultiplierG: 0.9,
      rgbMultiplierB: 1.2,    // More blue
      colorOffset: 0.0,
      grainAmount: 0.0,
      grainSize: 2.0,
      posterize: 256.0,
      scanlines: 0.0,
      scanlineWidth: 1.0,
      gradientColors: [],
      exportResolution: 4096,
      hideUI: true            // Custom flag to hide all UI elements
    };

    console.log('Gradient background initialized with therapeutic preset');
  }
})();
