// Simplified Gradient Engine - Background Only (No UI)
// Adapted from GradientGen for use as an animated background

(function() {
  'use strict';

  // Configuration
  const canvas = document.getElementById('gradient-canvas') || createCanvas('gradient-canvas', true);
  const displayCanvas = document.getElementById('gradient-display-canvas') || createCanvas('gradient-display-canvas', false);
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  const displayCtx = displayCanvas.getContext('2d');

  if (!gl) {
    console.error('WebGL not available');
    return;
  }

  function createCanvas(id, hidden) {
    const c = document.createElement('canvas');
    c.id = id;
    if (hidden) c.style.display = 'none';
    document.body.appendChild(c);
    return c;
  }

  // Shader parameters with therapeutic defaults
  let shaderParams = {
    scale: 8.0,
    phaseX: 0.1,
    velocity: 0.15,
    mode1Detail: 150.0,
    mode1Twist: 0.0,
    mode2Speed: 1.5,
    brightness: 0.7,
    hue: 220.0,
    saturation: 0.6,
    vibrance: 0.0,
    contrast: 1.0,
    rgbMultiplierR: 0.8,
    rgbMultiplierG: 0.9,
    rgbMultiplierB: 1.2,
    colorOffset: 0.0,
    grainAmount: 0.0,
    grainSize: 2.0,
    posterize: 256.0,
    scanlines: 0.0,
    scanlineWidth: 1.0,
    movementMode: 6,
    gradientColors: []
  };

  // Override with config if provided
  if (window.gradientConfig) {
    Object.assign(shaderParams, window.gradientConfig);
  }

  let shaderPrograms = {};
  let buffers = {};
  let startTime = Date.now();
  let frameCount = 0;

  // Vertex shader
  const vertexShaderSource = `
    attribute vec2 aPosition;
    void main() {
      gl_Position = vec4(aPosition, 0.0, 1.0);
    }
  `;

  // Fragment shader with embedded Image.frag logic
  const IMAGE_SHADER_SOURCE = `
    precision highp float;

    uniform vec2 iResolution;
    uniform float iTime;
    uniform int iFrame;
    uniform vec4 iMouse;

    uniform float uScale;
    uniform float uPhaseX;
    uniform float uVelocity;
    uniform float uMode1Detail;
    uniform float uMode1Twist;
    uniform float uMode2Speed;
    uniform float uBrightness;
    uniform float uHue;
    uniform float uSaturation;
    uniform float uVibrance;
    uniform float uContrast;
    uniform float uRgbMultiplierR;
    uniform float uRgbMultiplierG;
    uniform float uRgbMultiplierB;
    uniform float uColorOffset;
    uniform float uGrainAmount;
    uniform float uGrainSize;
    uniform float uPosterize;
    uniform float uScanlines;
    uniform float uScanlineWidth;

    #define time iTime

    const float arrow_density = 4.5;
    const float arrow_length = 0.45;
    const int iterationTime1 = 20;
    const int iterationTime2 = 20;

    float f(in vec2 p) {
      return sin(p.x + sin(p.y + time * uPhaseX)) * sin(p.y * p.x * 0.1 + time * uVelocity);
    }

    struct Field {
      vec2 vel;
      vec2 pos;
    };

    Field field(in vec2 p) {
      Field fld;
      vec2 ep = vec2(0.05, 0.0);
      vec2 rz = vec2(0.0);

      for(int i = 0; i < iterationTime1; i++) {
        float t0 = f(p);
        float t1 = f(p + ep.xy);
        float t2 = f(p + ep.yx);
        vec2 g = vec2((t1 - t0), (t2 - t0)) / ep.xx;
        vec2 t = vec2(-g.y, g.x);

        p += (uMode1Twist * 0.01) * t + g * (1.0 / uMode1Detail);
        p.x = p.x + sin(time * uMode2Speed / 10.0) / 10.0;
        p.y = p.y + cos(time * uMode2Speed / 10.0) / 10.0;
        rz = g;
      }

      for(int i = 1; i < iterationTime2; i++) {
        p.x += 0.3 / float(i) * sin(float(i) * 3.0 * p.y + time * uMode2Speed) + 0.5;
        p.y += 0.3 / float(i) * cos(float(i) * 3.0 * p.x + time * uMode2Speed) + 0.5;
      }

      fld.vel = rz;
      fld.pos = p;
      return fld;
    }

    vec3 getRGB(in Field fld) {
      vec2 p = fld.pos;
      float r = cos(p.x + p.y + 1.0) * 0.5 + 0.5;
      float g = sin(p.x + p.y + 1.0) * 0.5 + 0.5;
      float b = (sin(p.x + p.y) + cos(p.x + p.y)) * 0.3 + 0.5;
      return vec3(r, g, b);
    }

    // Color adjustments
    vec3 hueShift(vec3 color, float hue) {
      const vec3 k = vec3(0.57735, 0.57735, 0.57735);
      float cosAngle = cos(hue);
      return vec3(color * cosAngle + cross(k, color) * sin(hue) + k * dot(k, color) * (1.0 - cosAngle));
    }

    vec3 adjustSaturation(vec3 color, float saturation) {
      float gray = dot(color, vec3(0.299, 0.587, 0.114));
      return mix(vec3(gray), color, saturation);
    }

    vec3 adjustContrast(vec3 color, float contrast) {
      return (color - 0.5) * contrast + 0.5;
    }

    void main() {
      vec2 p = gl_FragCoord.xy / iResolution.xy - 0.5;
      p.x *= iResolution.x / iResolution.y;
      p *= uScale;

      Field fld = field(p);
      vec3 col = getRGB(fld) * 0.85;

      // Apply color adjustments
      col = hueShift(col, uHue * 0.01745329);  // Convert degrees to radians
      col = adjustSaturation(col, uSaturation);
      col = adjustContrast(col, uContrast);
      col *= vec3(uRgbMultiplierR, uRgbMultiplierG, uRgbMultiplierB);
      col *= uBrightness;

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  function compileShader(source, type) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compilation error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  function createProgram(vertexShader, fragmentShader) {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program linking error:', gl.getProgramInfoLog(program));
      return null;
    }
    return program;
  }

  function init() {
    // Compile shaders
    const vertexShader = compileShader(vertexShaderSource, gl.VERTEX_SHADER);
    const fragmentShader = compileShader(IMAGE_SHADER_SOURCE, gl.FRAGMENT_SHADER);

    if (!vertexShader || !fragmentShader) {
      console.error('Failed to compile shaders');
      return;
    }

    shaderPrograms.image = createProgram(vertexShader, fragmentShader);

    if (!shaderPrograms.image) {
      console.error('Failed to create shader program');
      return;
    }

    // Create quad buffer
    buffers.quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1
    ]), gl.STATIC_DRAW);

    // Resize canvas
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Start render loop
    requestAnimationFrame(render);

    console.log('Gradient background engine initialized');
  }

  function resizeCanvas() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    canvas.width = width;
    canvas.height = height;
    displayCanvas.width = width;
    displayCanvas.height = height;
    gl.viewport(0, 0, width, height);
  }

  function render() {
    frameCount++;
    const time = (Date.now() - startTime) / 1000.0;

    // Bind framebuffer to canvas (default)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);

    const program = shaderPrograms.image;
    gl.useProgram(program);

    // Set uniforms
    const resLoc = gl.getUniformLocation(program, 'iResolution');
    if (resLoc) gl.uniform2f(resLoc, canvas.width, canvas.height);

    const timeLoc = gl.getUniformLocation(program, 'iTime');
    if (timeLoc) gl.uniform1f(timeLoc, time);

    const frameLoc = gl.getUniformLocation(program, 'iFrame');
    if (frameLoc) gl.uniform1i(frameLoc, frameCount);

    const mouseLoc = gl.getUniformLocation(program, 'iMouse');
    if (mouseLoc) gl.uniform4f(mouseLoc, 0, 0, 0, 0);

    // Shader parameters
    const scaleLoc = gl.getUniformLocation(program, 'uScale');
    if (scaleLoc) gl.uniform1f(scaleLoc, shaderParams.scale);

    const phaseXLoc = gl.getUniformLocation(program, 'uPhaseX');
    if (phaseXLoc) gl.uniform1f(phaseXLoc, shaderParams.phaseX);

    const velocityLoc = gl.getUniformLocation(program, 'uVelocity');
    if (velocityLoc) gl.uniform1f(velocityLoc, shaderParams.velocity);

    const mode1DetailLoc = gl.getUniformLocation(program, 'uMode1Detail');
    if (mode1DetailLoc) gl.uniform1f(mode1DetailLoc, shaderParams.mode1Detail);

    const mode1TwistLoc = gl.getUniformLocation(program, 'uMode1Twist');
    if (mode1TwistLoc) gl.uniform1f(mode1TwistLoc, shaderParams.mode1Twist);

    const mode2SpeedLoc = gl.getUniformLocation(program, 'uMode2Speed');
    if (mode2SpeedLoc) gl.uniform1f(mode2SpeedLoc, shaderParams.mode2Speed);

    const brightnessLoc = gl.getUniformLocation(program, 'uBrightness');
    if (brightnessLoc) gl.uniform1f(brightnessLoc, shaderParams.brightness);

    const hueLoc = gl.getUniformLocation(program, 'uHue');
    if (hueLoc) gl.uniform1f(hueLoc, shaderParams.hue);

    const saturationLoc = gl.getUniformLocation(program, 'uSaturation');
    if (saturationLoc) gl.uniform1f(saturationLoc, shaderParams.saturation);

    const vibranceLoc = gl.getUniformLocation(program, 'uVibrance');
    if (vibranceLoc) gl.uniform1f(vibranceLoc, shaderParams.vibrance);

    const contrastLoc = gl.getUniformLocation(program, 'uContrast');
    if (contrastLoc) gl.uniform1f(contrastLoc, shaderParams.contrast);

    const rgbRLoc = gl.getUniformLocation(program, 'uRgbMultiplierR');
    if (rgbRLoc) gl.uniform1f(rgbRLoc, shaderParams.rgbMultiplierR);

    const rgbGLoc = gl.getUniformLocation(program, 'uRgbMultiplierG');
    if (rgbGLoc) gl.uniform1f(rgbGLoc, shaderParams.rgbMultiplierG);

    const rgbBLoc = gl.getUniformLocation(program, 'uRgbMultiplierB');
    if (rgbBLoc) gl.uniform1f(rgbBLoc, shaderParams.rgbMultiplierB);

    const colorOffsetLoc = gl.getUniformLocation(program, 'uColorOffset');
    if (colorOffsetLoc) gl.uniform1f(colorOffsetLoc, shaderParams.colorOffset);

    const grainAmountLoc = gl.getUniformLocation(program, 'uGrainAmount');
    if (grainAmountLoc) gl.uniform1f(grainAmountLoc, shaderParams.grainAmount);

    const grainSizeLoc = gl.getUniformLocation(program, 'uGrainSize');
    if (grainSizeLoc) gl.uniform1f(grainSizeLoc, shaderParams.grainSize);

    const posterizeLoc = gl.getUniformLocation(program, 'uPosterize');
    if (posterizeLoc) gl.uniform1f(posterizeLoc, shaderParams.posterize);

    const scanlinesLoc = gl.getUniformLocation(program, 'uScanlines');
    if (scanlinesLoc) gl.uniform1f(scanlinesLoc, shaderParams.scanlines);

    const scanlineWidthLoc = gl.getUniformLocation(program, 'uScanlineWidth');
    if (scanlineWidthLoc) gl.uniform1f(scanlineWidthLoc, shaderParams.scanlineWidth);

    // Bind quad and draw
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.quad);
    const positionLoc = gl.getAttribLocation(program, 'aPosition');
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Copy to display canvas
    const imageData = new ImageData(canvas.width, canvas.height);
    gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, imageData.data);

    // Flip vertically (WebGL coordinates)
    const flipped = new Uint8ClampedArray(imageData.data.length);
    for (let y = 0; y < canvas.height; y++) {
      const srcY = canvas.height - 1 - y;
      const srcOffset = srcY * canvas.width * 4;
      const dstOffset = y * canvas.width * 4;
      flipped.set(imageData.data.subarray(srcOffset, srcOffset + canvas.width * 4), dstOffset);
    }
    imageData.data.set(flipped);

    displayCtx.putImageData(imageData, 0, 0);

    requestAnimationFrame(render);
  }

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
