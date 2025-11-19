// ======================================================
// ===============  USER-ADJUSTABLE SETTINGS  ============
// ======================================================

// ----- Tunnel layout -----
let rectSpacing = 50;          // Z-distance between consecutive shapes
let numRects = 202;            // Total slices (primary + secondary) in the tunnel
let perspectiveDistance = 500; // Perspective strength (higher = weaker perspective)
const primaryShapeCount = 15;   // total Shape 1 outlines in the tunnel
const secondaryShapeCount = 202; // total Shape 2 outlines in the tunnel

// ----- Time Stamp & Loop -----
const timestampFontPath = 'typefaces/SohneMono-Leicht.otf';
let overlayFontSize = 16;       // timestamp text size
let overlayButtonSize = 21;   // play/pause glyph size
const overlayRGB = [100, 100, 100];
const restartDelaySeconds = 0;  // pause before loop restarts

// ----- Camera control -----
let cameraScale = 0.4;        // Zoom out (<1) / Zoom in (>1)

// ----- Line stroke style -----
let lineWeight = 0.7;          // Base line thickness
let lineRGB = [100, 100, 100]; // Line color
let lineAlpha = 255;           // Line opacity (0–255)

// ----- Audio -----
let audioFile = 'bridge.wav';  // Path to audio file
let audioDuration = 130;       // Duration in seconds (used for timing)
let animationDuration = audioDuration + 6; // ensure visuals outlast audio

// ----- Tunnel SVG shape dimensions -----
const tunnelShapeWidth = 1170;
const tunnelShapeHeight = 516;

// ======================================================
// ===================== INTERNAL STATE ==================
// (You normally do NOT change these)
// ======================================================

let baseShapeWidth;
let baseShapeHeight;
let referenceCanvasHeight;
let sound;
let zOffset = 0;
let speed;
let shapeSequence = [];
let isAnimating = false;
let isPaused = false;
let animationEndDistance = 0;
let pendingRestart = false;
let restartTimer = null;
let elapsedFrames = 0;
let animationRunTimeSeconds = 0;
let animationTotalSeconds = 0;
let timestampFont;
let playButtonBounds = { x: 0, y: 0, size: 0 };
let pausedAudioTime = 0;
let restartFramesRemaining = 0;

const circleDefs = [
  { cx: 435.5, cy: 78.5, r: 24.5 },
  { cx: 734.5, cy: 78.5, r: 24.5 }
];

const shapeDefinitions = {
  primary: {
    width: 1170,
    height: 516,
    pathStrings: [
      'M585 124.5H550.5L535 110.5V83.4999M585 57.5H550.5L535 72.9999V95.4999',
      'M18 30L27.5 70.5C451.5 84 486 191 487.5 202.5L503 514.5H585M18 30H1V1H66.5V22M18 30H66.5M66.5 30L585 32M66.5 30V22M585 46H511L499 58V115L541 137.5H585M585 16.5H537V22H66.5M489 58V115L471.634 124.5H453.634L354 69.5V58L365.5 46H477L489 58Z',
      'M585 124.5H619.5L635 110.5V83.4999M585 57.5H619.5L635 72.9999V95.4999',
      'M1152 30L1142.5 70.5C718.5 84 684 191 682.5 202.5L667 514.5H585M1152 30H1169V1H1103.5V22M1152 30H1103.5M1103.5 30L585 32M1103.5 30V22M585 46H659L671 58V115L629 137.5H585M585 16.5H633V22H1103.5M681 58V115L698.366 124.5H716.366L816 69.5V58L804.5 46H693L681 58Z'
    ],
    circles: circleDefs
  },
  secondary: {
    width: 1170,
    height: 204,
    pathStrings: [
      'M585 124.5H550.5L535 110.5V83.4999M585 57.5H550.5L535 72.9999V95.4999',
      'M18 30L27.5 70.5C451.5 84 486 191 487.5 202.5H585M18 30H1V1H66.5V22M18 30H66.5M66.5 30L585 32M66.5 30V22M585 46H511L499 58V115L541 137.5H585M585 16.5H537V22H66.5M489 58V115L471.634 124.5H453.634L354 69.5V58L365.5 46H477L489 58Z',
      'M585 124.5H619.5L635 110.5V83.4999M585 57.5H619.5L635 72.9999V95.4999',
      'M1152 30L1142.5 70.5C718.5 84 684 191 682.5 202.5H585M1152 30H1169V1H1103.5V22M1152 30H1103.5M1103.5 30L585 32M1103.5 30V22M585 46H659L671 58V115L629 137.5H585M585 16.5H633V22H1103.5M681 58V115L698.366 124.5H716.366L816 69.5V58L804.5 46H693L681 58Z'
    ],
    circles: circleDefs
  }
};


// ======================================================
// =============== p5.js SETUP & DRAW LOOP ===============
// ======================================================

function preload() {
  timestampFont = loadFont(timestampFontPath);
  sound = loadSound(audioFile);
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  referenceCanvasHeight = windowHeight;
  noFill();

  stroke(lineRGB[0], lineRGB[1], lineRGB[2], lineAlpha);
  strokeWeight(lineWeight);
  if (sound && sound.playMode) {
    sound.playMode('restart');
  }

  compileShapePaths();
  buildShapeSequence();
  numRects = shapeSequence.length;

  calculateSpeed();
  updateBaseShapeSize();
}

function draw() {
  background(0);

  translate(width / 2, height / 2);

  let shouldRenderShapes = !pendingRestart;

  if (isAnimating && !pendingRestart && !isPaused) {
    zOffset += speed;
    incrementElapsedFrames();
    if (zOffset >= animationEndDistance) {
      zOffset = animationEndDistance;
      isAnimating = false;
      scheduleRestart();
      shouldRenderShapes = false;
    }
  }

  if (shouldRenderShapes) {
    for (let i = -10; i < numRects; i++) {
      if (i < 0) continue;
      if (i >= shapeSequence.length) break;

      let zPos = i * rectSpacing - zOffset;
      let perspectiveScale = perspectiveDistance / (perspectiveDistance + zPos);

      if (perspectiveScale <= 0) continue;

      let w = baseShapeWidth * perspectiveScale * cameraScale;
      let shapeDef = shapeSequence[i];
      let shapeScale = w / shapeDef.width;

      drawTunnelShape(shapeDef, shapeScale);
    }
  }

  if (pendingRestart && restartFramesRemaining > 0) {
    restartFramesRemaining--;
    incrementElapsedFrames();
  }

  drawOverlay();
}

function calculateSpeed() {
  let tunnelLength = rectSpacing * numRects;
  speed = tunnelLength / (animationDuration * 60);  // frames → seconds
  animationEndDistance =
    Math.max(0, (shapeSequence.length - 1) * rectSpacing + perspectiveDistance);
  animationRunTimeSeconds = animationEndDistance / (speed * 60);
  animationTotalSeconds = animationRunTimeSeconds + restartDelaySeconds;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  updateBaseShapeSize();
}

function mousePressed() {
  if (isPointInPlayButton(mouseX, mouseY)) {
    togglePlayPause(true);
  }
}

function updateBaseShapeSize() {
  baseShapeWidth = tunnelShapeWidth;
  baseShapeHeight = tunnelShapeHeight;
}

// ======================================================
// ================== SHAPE DRAW FUNCTION ================
// ======================================================

function drawTunnelShape(shapeDef, scaleFactor) {
  if (!shapeDef || !shapeDef.paths || !shapeDef.paths.length) return;

  push();
  scale(scaleFactor);

  translate(
    -Math.round(shapeDef.width / 2),
    -Math.round(tunnelShapeHeight / 2)
  );

  const ctx = drawingContext;
  ctx.save();

  ctx.strokeStyle = `rgba(${lineRGB[0]}, ${lineRGB[1]}, ${lineRGB[2]}, ${
    lineAlpha / 255
  })`;

  ctx.lineWidth = lineWeight / Math.sqrt(scaleFactor);

  shapeDef.paths.forEach(p => ctx.stroke(p));

  if (shapeDef.circles) {
    shapeDef.circles.forEach(circle => {
      ctx.beginPath();
      ctx.arc(circle.cx, circle.cy, circle.r, 0, TWO_PI);
      ctx.stroke();
    });
  }

  ctx.restore();
  pop();
}

function compileShapePaths() {
  Object.values(shapeDefinitions).forEach(def => {
    def.paths = def.pathStrings.map(str => new Path2D(str));
  });
}

function buildShapeSequence() {
  shapeSequence = [];
  if (!primaryShapeCount) return;

  let segmentCount = primaryShapeCount + 1; // secondary blocks before, between, after
  let secondaryPerSegment = secondaryShapeCount / segmentCount;
  let secondaryPlaced = 0;

  for (let segment = 0; segment < segmentCount; segment++) {
    let targetSecondaryTotal = Math.round((segment + 1) * secondaryPerSegment);
    let toAdd = Math.max(0, targetSecondaryTotal - secondaryPlaced);

    for (let j = 0; j < toAdd; j++) {
      shapeSequence.push(shapeDefinitions.secondary);
    }

    secondaryPlaced += toAdd;

    if (segment < primaryShapeCount) {
      shapeSequence.push(shapeDefinitions.primary);
    }
  }

  while (secondaryPlaced < secondaryShapeCount) {
    shapeSequence.push(shapeDefinitions.secondary);
    secondaryPlaced++;
  }
}

function startAnimationCycle(playAudio) {
  pendingRestart = false;
  isPaused = false;
  restartFramesRemaining = 0;
  if (restartTimer) {
    clearTimeout(restartTimer);
    restartTimer = null;
  }

  zOffset = 0;
  isAnimating = true;
  elapsedFrames = 0;
  pausedAudioTime = 0;

  if (playAudio) {
    stopAudioTrack();
    if (sound) sound.play();
  }
}

function keyPressed() {
  if (key === 'f' || key === 'F') {
    let fs = fullscreen();
    fullscreen(!fs);
    return;
  }

  if (key === ' ') {
    togglePlayPause(true);
  }
}

function togglePlayPause(allowAudioRestart = true) {
  if (!isAnimating && !pendingRestart) {
    startAnimationCycle(allowAudioRestart);
    return;
  }

  if (pendingRestart) {
    startAnimationCycle(allowAudioRestart);
    return;
  }

  if (isPaused) {
    isPaused = false;
    resumeAudioFromPause();
  } else {
    isPaused = true;
    pauseAudioTrack();
  }
}

function pauseAudioTrack() {
  if (sound && sound.isPlaying()) {
    pausedAudioTime = sound.currentTime();
    sound.pause();
  }
}

function resumeAudioFromPause() {
  if (!sound) return;
  let cueStart = pausedAudioTime || 0;
  if (sound.duration) {
    cueStart = constrain(cueStart, 0, sound.duration());
  }
  pausedAudioTime = 0;
  sound.play(0, 1, 1, cueStart);
}

function scheduleRestart() {
  pendingRestart = true;
  restartFramesRemaining = Math.round(restartDelaySeconds * 60);
  stopAudioTrack();
  if (restartTimer) clearTimeout(restartTimer);
  restartTimer = setTimeout(() => {
    restartTimer = null;
    startAnimationCycle(true);
  }, restartDelaySeconds * 1000);
}

function stopAudioTrack() {
  if (sound) sound.stop();
  pausedAudioTime = 0;
}

function incrementElapsedFrames() {
  let totalFrames = Math.round(getTotalDurationSeconds() * 60);
  if (elapsedFrames < totalFrames) {
    elapsedFrames++;
  }
}

function getTotalDurationSeconds() {
  return animationTotalSeconds || (animationDuration + restartDelaySeconds);
}

function drawOverlay() {
  let totalSeconds = getTotalDurationSeconds();
  let currentSeconds = min(elapsedFrames / 60, totalSeconds);
  let currentText = formatTime(currentSeconds);
  let totalText = formatTime(totalSeconds);
  let timeLabel = `${currentText}/${totalText}`;

  push();
  resetMatrix();
  textAlign(RIGHT, BOTTOM);
  textFont(timestampFont || 'monospace');
  textSize(overlayFontSize);

  let margin = 20;
  let tsX = width - margin;
  let tsY = height - margin;
  let labelWidth = textWidth(timeLabel);
  let buttonSize = overlayButtonSize;
  let gap = overlayFontSize * 0.75;
  let buttonX = tsX - labelWidth - gap - buttonSize;
  if (buttonX < margin) {
    buttonX = margin;
  }
  let buttonY = tsY - (overlayFontSize + buttonSize) / 2;

  playButtonBounds = { x: buttonX, y: buttonY, size: buttonSize };

  drawPlayPauseButton(buttonX, buttonY, buttonSize);

  fill(overlayRGB[0], overlayRGB[1], overlayRGB[2], 220);
  noStroke();
  text(timeLabel, tsX, tsY);
  pop();
}

function drawPlayPauseButton(x, y, size) {
  push();
  resetMatrix();
  let centerX = x + size / 2 +2;
  let centerY = y + size / 2 -1;
  fill(overlayRGB[0], overlayRGB[1], overlayRGB[2], 220);
  noStroke();

  if (isAnimating && !isPaused && !pendingRestart) {
    let barWidth = size * 0.18;
    let barHeight = size * 0.5;
    let spacing = size * 0.12;
    rectMode(CENTER);
    rect(centerX - spacing, centerY, barWidth, barHeight);
    rect(centerX + spacing, centerY, barWidth, barHeight);
    rectMode(CORNER);
  } else {
    noStroke();
    beginShape();
    vertex(centerX - size * 0.18, centerY - size * 0.28);
    vertex(centerX - size * 0.18, centerY + size * 0.28);
    vertex(centerX + size * 0.22, centerY);
    endShape(CLOSE);
  }
  pop();
}

function isPointInPlayButton(mx, my) {
  if (!playButtonBounds || playButtonBounds.size <= 0) return false;
  return (
    mx >= playButtonBounds.x &&
    mx <= playButtonBounds.x + playButtonBounds.size &&
    my >= playButtonBounds.y &&
    my <= playButtonBounds.y + playButtonBounds.size
  );
}

function formatTime(seconds) {
  let mins = Math.floor(seconds / 60);
  let secs = Math.floor(seconds % 60);
  let mm = mins.toString().padStart(2, '0');
  let ss = secs.toString().padStart(2, '0');
  return `${mm}:${ss}`;
}