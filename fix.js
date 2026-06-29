const fs = require('fs');
let code = fs.readFileSync('app-v1.6.js', 'utf8');

// The code currently has a broken scanRadarFrame.
// Let's find the start of scanRadarFrame and the end of getDirectionName.
const startIdx = code.indexOf('async function scanRadarFrame');
const endIdx = code.indexOf('function analyzeStormMovement');

if (startIdx !== -1 && endIdx !== -1) {
  const cleanCode = code.substring(0, startIdx) + 
\sync function scanRadarFrame(host, path, lat, lon) {
  const cx = lon2px(lon, NOWCAST_ZOOM);
  const cy = lat2px(lat, NOWCAST_ZOOM);
  const tx = Math.floor(cx / TILE_SIZE);
  const ty = Math.floor(cy / TILE_SIZE);
  
  const offsetX = cx - (tx * TILE_SIZE) + TILE_SIZE;
  const offsetY = cy - (ty * TILE_SIZE) + TILE_SIZE;
  
  const canvas = document.getElementById("radar-scanner-canvas") || document.createElement("canvas");
  canvas.width = TILE_SIZE * 3;
  canvas.height = TILE_SIZE * 3;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  const promises = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const tileUrl = \\System.Management.Automation.Internal.Host.InternalHost\/256/\/\/\/2/1_1.png\;
      promises.push(loadImageToCanvas(ctx, tileUrl, (dx + 1) * TILE_SIZE, (dy + 1) * TILE_SIZE));
    }
  }
  
  await Promise.all(promises);
  
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let nearestDist = Infinity;
  let nearestDx = 0;
  let nearestDy = 0;
  
  const maxRadius = 120; // ~36km
  
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const idx = (y * canvas.width + x) * 4;
      const r = imgData[idx];
      const g = imgData[idx+1];
      const b = imgData[idx+2];
      const a = imgData[idx+3];
      
      // Filter out light rain (cyan/blue) and noise
      const isSignificantRain = (r > 150 || g > 150) && (b < 150 || r > 150);
      
      if (a > 50 && isSignificantRain) {
        const dx = x - offsetX;
        const dy = y - offsetY;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        if (dist < nearestDist && dist <= maxRadius) {
          nearestDist = dist;
          nearestDx = dx;
          nearestDy = dy;
        }
      }
    }
  }
  
  return { dist: nearestDist, dx: nearestDx, dy: nearestDy };
}

function loadImageToCanvas(ctx, url, x, y) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      ctx.drawImage(img, x, y);
      resolve();
    };
    img.onerror = () => resolve();
    img.src = url;
  });
}

function getDirectionName(dx, dy) {
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  if (angle > -22.5 && angle <= 22.5) return "????????";
  if (angle > 22.5 && angle <= 67.5) return "????????????????";
  if (angle > 67.5 && angle <= 112.5) return "???";
  if (angle > 112.5 && angle <= 157.5) return "???????????????";
  if (angle > 157.5 || angle <= -157.5) return "???????";
  if (angle > -157.5 && angle <= -112.5) return "?????????????????";
  if (angle > -112.5 && angle <= -67.5) return "?????";
  if (angle > -67.5 && angle <= -22.5) return "??????????????????";
  return "??????????";
}

\ + code.substring(endIdx);

  fs.writeFileSync('app-v1.6.js', cleanCode, 'utf8');
  console.log('Successfully repaired the file!');
} else {
  console.log('Failed to find indices');
}
