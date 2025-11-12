# Animated Gradient Background

This directory contains the GradientGen animated background integration for the voice agent app.

## Files

- **`gradient-engine.js`** - Main WebGL engine (simplified, no UI controls)
- **`gradient-init.js`** - Initialization wrapper with preset configuration
- **`sketch.js`** - Original GradientGen source (for reference/advanced customization)
- **`Image.frag`** - GLSL fragment shader (for reference)
- **`styles.css`** - Original UI styles (not used in background mode)

## How It Works

1. **`gradient-engine.js`** is loaded via Next.js `<Script>` tag in `layout.tsx`
2. Creates two canvas elements:
   - `gradient-canvas` (hidden, WebGL rendering)
   - `gradient-display-canvas` (visible, positioned fixed behind all UI)
3. Renders continuously with therapeutic preset (calm blue gradients, slow movement)
4. Automatically responsive to window resizing

## Current Configuration (Therapeutic Preset)

```javascript
{
  movementMode: 6,        // Flow mode (smooth, organic movement)
  scale: 8.0,             // Large, calm patterns
  velocity: 0.15,         // Slow animation speed
  brightness: 0.7,        // Subdued, not overwhelming
  hue: 220.0,             // Blue tones (calming)
  saturation: 0.6,        // Soft, not vibrant
  rgbMultiplierB: 1.2     // Enhanced blue channel
}
```

## Customization

To change the gradient behavior, edit `gradient-engine.js` and modify the `shaderParams` object (around line 30):

### Color Themes

**Deep Ocean** (current default):
```javascript
hue: 220.0,
saturation: 0.6,
rgbMultiplierR: 0.8,
rgbMultiplierG: 0.9,
rgbMultiplierB: 1.2
```

**Sunset Warm**:
```javascript
hue: 15.0,
saturation: 0.7,
rgbMultiplierR: 1.3,
rgbMultiplierG: 0.9,
rgbMultiplierB: 0.7
```

**Forest Green**:
```javascript
hue: 120.0,
saturation: 0.5,
rgbMultiplierR: 0.7,
rgbMultiplierG: 1.2,
rgbMultiplierB: 0.8
```

**Monochrome**:
```javascript
saturation: 0.2,
rgbMultiplierR: 1.0,
rgbMultiplierG: 1.0,
rgbMultiplierB: 1.0
```

### Animation Speed

- **Very Slow** (meditative): `velocity: 0.05, mode2Speed: 0.8`
- **Slow** (default): `velocity: 0.15, mode2Speed: 1.5`
- **Medium**: `velocity: 0.3, mode2Speed: 2.5`
- **Fast** (energetic): `velocity: 0.5, mode2Speed: 4.0`

### Pattern Scale

- **Large patterns** (calm): `scale: 10.0`
- **Medium** (default): `scale: 8.0`
- **Small patterns** (detailed): `scale: 4.0`

### Opacity

To adjust the background intensity, edit the canvas style in `gradient-engine.js` (line ~58):
```javascript
displayCanvas.style.cssText = `
  ...
  opacity: 0.85;  // 0.5 = subtle, 1.0 = full opacity
`;
```

## Performance

- GPU-accelerated WebGL rendering
- ~60 FPS on modern hardware
- Minimal CPU usage
- Automatically adapts to screen size

## Source

Based on [GradientGen](https://github.com/noegarsoux/GradientGen) by noegarsoux.
Licensed under BSD-3-Clause.

## Troubleshooting

**Gradient not showing:**
1. Check browser console for WebGL errors
2. Ensure browser supports WebGL (all modern browsers do)
3. Verify script is loaded in Network tab

**Too bright/distracting:**
- Reduce `brightness` (try 0.5)
- Reduce `opacity` in canvas styles (try 0.6)
- Increase `scale` for larger, calmer patterns

**Performance issues:**
- Gradient is GPU-accelerated and should run smoothly
- If issues occur, reduce window size or check for other GPU-intensive processes
