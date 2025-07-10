//elements 
const video =document.getElementById('webcam');
const drawCanvas = document.getElementById('drawCanvas');
const landmarkCanvas = document.getElementById('landmarkCanvas');
const drawCtx = drawCanvas.getContext('2d');
const landmarkCtx = landmarkCanvas.getContext('2d');
const mode_now =document.getElementById('mode_now');
const pencil = document.getElementById('pencil');
const eraser = document.getElementById('eraser');
const colorBar= document.getElementById('colorBar');
const colorCursor = document.getElementById('colorCursor');
const currentcolor= document.getElementById('currentColor');

// initializations
let lastX =null;
let lasty= null;
let smoothX =null;
let smoothY = null;
let drawing = false;
let erasing = false;
let changingColor = false;
let currentGesture= '-';
let currentColor = '#800080'; 
let colorCursorY = 0;
const SMOOTHING =0.36;
const MOVE_THRESHOLD = 0.22;
let lastGestureTime= 0;
const COOLDOWN_MS = 300;

function resize_screen() {
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = drawCanvas.width;
  tempCanvas.height = drawCanvas.height;
  tempCanvas.getContext('2d').drawImage(drawCanvas, 0, 0);
  drawCanvas.width = window.innerWidth;
  drawCanvas.height = window.innerHeight;
  drawCtx.drawImage(tempCanvas, 0, 0, drawCanvas.width, drawCanvas.height);
  colorBar.style.position = 'fixed'; 
  colorBar.style.top = '20px';
  colorBar.style.right = '20px';
  colorBar.style.width = '50px';
  colorBar.style.height = '300px';
  colorBar.style.background = 'linear-gradient(to bottom, #ff0000, #ff00ff, #0000ff, #00ffff, #00ff00, #ffff00, #ff0000, #964B00)';
  colorBar.style.border = '2px solid #333';
  colorBar.style.borderRadius = '8px';
  colorBar.style.zIndex = '6';
  colorBar.style.boxShadow = '0 0 10px rgba(0,0,0,0.3)';
  colorCursor.style.position = 'fixed'; 
  colorCursor.style.width = '60px';
  colorCursor.style.height = '10px';
  colorCursor.style.backgroundColor = 'white';
  colorCursor.style.border = '2px solid #333';
  colorCursor.style.borderRadius = '5px';
  colorCursor.style.left = (window.innerWidth - 70) + 'px'; 
  colorCursor.style.zIndex = '7';
  colorCursor.style.pointerEvents = 'none';
  colorCursor.style.transition = 'top 0.1s ease-out';
  colorCursor.style.display = 'none';
  
  currentcolor.style.position = 'fixed';
  currentcolor.style.top = '330px';
  currentcolor.style.right = '20px';
  currentcolor.style.width = '50px';
  currentcolor.style.height = '30px';
  currentcolor.style.border = '2px solid #333';
  currentcolor.style.borderRadius = '5px';
  currentcolor.style.zIndex = '6';
  currentcolor.style.backgroundColor = currentColor;
  
  document.getElementById('colorLabel').style.position = 'fixed';
  document.getElementById('colorLabel').style.top = '370px';
  document.getElementById('colorLabel').style.right = '20px';
  document.getElementById('colorLabel').style.width = '50px';
  document.getElementById('colorLabel').style.textAlign = 'center';
  document.getElementById('colorLabel').style.fontFamily ="'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
  document.getElementById('colorLabel').style.fontSize = '12px';
  document.getElementById('colorLabel').style.color = '#333';
  document.getElementById('colorLabel').style.zIndex = '6';
}
window.addEventListener('resize', resize_screen);
resize_screen();

function distance(a, b) {
  return Math.hypot(a.x- b.x,a.y - b.y);
}

function midpoint(a, b) {
  return {x:(a.x + b.x) /2, y: (a.y + b.y)/2 };}


// drawing mode(draw when 👌🏻)
function isDrawingMode(landmarks) {
  return (
  distance(landmarks[4],landmarks[8]) < 0.05&&
   distance(landmarks[8], landmarks[20])> 0.06 &&
    distance(landmarks[8], landmarks[17]) > 0.06 );
}

//erasing mode (erase when✌🏻)
function isErasingMode(landmarks) {
  return (
    distance(landmarks[4], landmarks[8]) > 0.06 &&
    landmarks[8].y < landmarks[6].y &&
    landmarks [12].y < landmarks[10].y &&
    landmarks[16].y > landmarks[14].y &&
    landmarks[20].y > landmarks[18].y
  );
}
 //changing color mode(change color when👆🏻)
function isChangingColorMode(landmarks) {
  return ( distance(landmarks[4], landmarks[8]) > 0.1 &&
    landmarks[8].y <landmarks [6].y &&
landmarks[12].y >landmarks[10].y &&
    landmarks[16].y > landmarks[14].y &&
    landmarks[20].y >landmarks[18].y );
}

function getColorFromPosition(y) {
  const rect = colorBar.getBoundingClientRect();
  let percent = (y - rect.top)/ rect.height;
  percent = Math.max(0, Math.min(1, percent)); 
  
  if (percent < 0.125) return `rgb(${255}, ${0}, ${Math.round(percent * 8 * 255)})`; 
  else if (percent < 0.25) return `rgb(${Math.round(255 - (percent-0.125)*8*255)}, ${0}, ${255})`; 
  else if (percent < 0.375) return `rgb(${0}, ${Math.round((percent-0.25)*8*255)}, ${255})`; 
  else if (percent < 0.5) return `rgb(${0}, ${255}, ${Math.round(255 - (percent-0.375)*8*255)})`; 
  else if (percent < 0.625) return `rgb(${Math.round((percent-0.5)*8*255)}, ${255}, ${0})`;
  else if (percent < 0.75) return `rgb(${255}, ${Math.round(255 - (percent-0.625)*8*255)}, ${0})`; 
  else if (percent < 0.875) return `rgb(${255}, ${0}, ${0})`; 
  else return `rgb(${Math.round(150 + (percent-0.875)*8*105)}, ${Math.round(75 + (percent-0.875)*8*75)}, ${0})`; 
}

const hands = new Hands({
  locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});

hands.setOptions({maxNumHands: 1,modelComplexity: 1,minDetectionConfidence:0.7,minTrackingConfidence: 0.7});

hands.onResults(results => {
  landmarkCtx.clearRect(0, 0, landmarkCanvas.width, landmarkCanvas.height);
  const now = Date.now();

  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    const landmarks = results.multiHandLandmarks[0];
    const indexTip = landmarks[8];
    const thumbTip= landmarks[4];
    const middleTip = landmarks[12];

    const pencilMid = midpoint(thumbTip, indexTip);
    const pencilX = (1 - pencilMid.x) * drawCanvas.width;
    const pencilY = pencilMid.y * drawCanvas.height;
    const x= (1 - indexTip.x) * drawCanvas.width;
    const y = indexTip.y * drawCanvas.height;

    if (smoothX=== null || smoothY=== null) {
      smoothX = x;
      smoothY = y;
    } else { smoothX +=SMOOTHING * (x - smoothX);
      smoothY += SMOOTHING * (y - smoothY);
    }

    const isDraw = isDrawingMode(landmarks);
    const isErase = isErasingMode(landmarks);
    const isColorChange = isChangingColorMode(landmarks);

    if (isDraw && now - lastGestureTime > COOLDOWN_MS) {
      currentGesture = "Drawing Mode";
      drawing = true;
      erasing = false;
      changingColor = false;
      colorCursor.style.display = 'none';
      lastGestureTime = now;
} else if (isErase && now - lastGestureTime > COOLDOWN_MS) {
      currentGesture= "Erasing Mode";
      drawing = false;
      erasing = true;
      changingColor = false;
      colorCursor.style.display = 'none';
      lastGestureTime = now;
    } else if (isColorChange && now - lastGestureTime > COOLDOWN_MS) {
      currentGesture = "Changing color Mode";
      drawing = false;
      erasing = false;
      changingColor = true;
      colorCursor.style.display = 'block';
      lastGestureTime = now;
    } else if (!isDraw && !isErase && !isColorChange) {
      currentGesture = "-";
      drawing = false;
      erasing = false;
      changingColor = false;
      colorCursor.style.display = 'none';
      lastX = null;
      lasty = null;
    }

    if (!erasing && !changingColor) {
      pencil.style.display = 'block';
      pencil.style.left = `${pencilX}px`;
      pencil.style.top = `${pencilY - 15}px`;
      eraser.style.display = 'none';
    } else if (erasing) {
      pencil.style.display = 'none';
      const eraseMid = midpoint(indexTip, middleTip);
      const eraseX = (1 - eraseMid.x) * drawCanvas.width;
      const eraseY = eraseMid.y * drawCanvas.height;
      eraser.style.display = 'block';
      eraser.style.left = `${eraseX}px`;
      eraser.style.top = `${eraseY}px`;

      drawCtx.save();
      drawCtx.beginPath();
      drawCtx.arc(eraseX, eraseY, 20, 0, 2 * Math.PI);
      drawCtx.clip();
      drawCtx.clearRect(eraseX - 25, eraseY - 25, 50, 50);
      drawCtx.restore();
    } else if (changingColor) {
      pencil.style.display = 'none';
      eraser.style.display = 'none';
      
      const barRect = colorBar.getBoundingClientRect();
            const cursorY = Math.max(barRect.top, Math.min(barRect.bottom - 10, smoothY));
      const relativeY = cursorY - barRect.top;
      colorCursor.style.top = `${cursorY}px`;
      colorCursor.style.left = `${barRect.left - 5}px`;
            currentColor = getColorFromPosition(cursorY + 5);
      currentcolor.style.backgroundColor = currentColor;
      drawCtx.strokeStyle = currentColor;
    }

    if (drawing) {
      const dx = smoothX - lastX;
      const dy = smoothY - lasty;
      const dist = Math.hypot(dx, dy);

      if (lastX !== null && lasty !== null && dist > MOVE_THRESHOLD) {
        drawCtx.beginPath();
        drawCtx.moveTo(lastX, lasty);
        drawCtx.lineTo(smoothX, smoothY);
        drawCtx.strokeStyle = currentColor;
        drawCtx.lineWidth = 4;
        drawCtx.lineCap = 'round';
        drawCtx.stroke();
      }
      lastX = smoothX;
      lasty = smoothY;
    }

    const connections= [[0, 1], [1, 2], [2, 3], [3, 4],
      [0, 5], [5, 6], [6, 7], [7, 8],[5, 9], [9, 10], 
      [10, 11], [11, 12],
     [9, 13], [13, 14], 
     [14, 15], [15, 16],
      [13, 17], [17, 18], [18, 19], [19, 20],[0, 17]
    ];
    landmarkCtx.strokeStyle = 'green';
    landmarkCtx.lineWidth = 2;
    connections.forEach(([start, end]) => {
      const x1 = landmarks[start].x * landmarkCanvas.width;
      const y1 = landmarks[start].y * landmarkCanvas.height;
      const x2 = landmarks[end].x * landmarkCanvas.width;
      const y2 = landmarks[end].y * landmarkCanvas.height;
      landmarkCtx.beginPath();
      landmarkCtx.moveTo(x1, y1);
      landmarkCtx.lineTo(x2, y2);
      landmarkCtx.stroke();
    });

    landmarks.forEach(pt => {
      const px = pt.x * landmarkCanvas.width;
      const py = pt.y * landmarkCanvas.height;
      landmarkCtx.beginPath();
      landmarkCtx.arc(px, py, 5, 0, 2 * Math.PI);
      landmarkCtx.fillStyle = 'red';
      landmarkCtx.fill();
    });

  } else {
    currentGesture = '-';
    drawing = false;
    erasing = false;
    changingColor = false;
    lastX = null;
    lasty = null;
    smoothX = null;
    smoothY = null;
    pencil.style.display = 'none';
    eraser.style.display = 'none';
    colorCursor.style.display = 'none';
  }

  mode_now.textContent= currentGesture === '-' ? '' : currentGesture;
});

const camera = new Camera(video, {
  onFrame: async () => {
    await hands.send({ image: video });
  },
  width: 640,
  height: 480
});
camera.start();
video.addEventListener('loadedmetadata', () => {
  landmarkCanvas.width = video.videoWidth;
  landmarkCanvas.height = video.videoHeight;
  landmarkCanvas.style.width = video.style.width;
  landmarkCanvas.style.height = video.style.height;
  landmarkCanvas.style.bottom = video.style.bottom;
  landmarkCanvas.style.right = video.style.right;
});