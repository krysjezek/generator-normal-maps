import './styles.css';

const sourceCanvas = document.querySelector('#sourceCanvas');
const normalCanvas = document.querySelector('#normalCanvas');
const previewCanvas = document.querySelector('#previewCanvas');
const sourceCtx = sourceCanvas.getContext('2d', { willReadFrequently: true });
const normalCtx = normalCanvas.getContext('2d');
const previewCtx = previewCanvas.getContext('2d');

const strengthInput = document.querySelector('#strength');
const smoothInput = document.querySelector('#smooth');
const strengthValue = document.querySelector('#strengthValue');
const smoothValue = document.querySelector('#smoothValue');
const invertInput = document.querySelector('#invert');
const gradientMode = document.querySelector('#gradientMode');
const fileInput = document.querySelector('#fileInput');
const dropZone = document.querySelector('#dropZone');
const previewWrap = document.querySelector('#previewWrap');
const lightOrb = document.querySelector('#lightOrb');

let fileName = 'organic-relief';
let ySign = 1;
let normalPixels = null;
let sourcePixels = null;
let light = { x: 0.68, y: 0.28 };
let updateFrame = 0;
let toastTimer = 0;

function drawDemoHeightmap() {
  const { width: w, height: h } = sourceCanvas;
  sourceCtx.fillStyle = '#070908';
  sourceCtx.fillRect(0, 0, w, h);

  const glow = sourceCtx.createRadialGradient(w * .5, h * .46, 10, w * .5, h * .46, w * .48);
  glow.addColorStop(0, '#2a2d2a');
  glow.addColorStop(1, '#090b0a');
  sourceCtx.fillStyle = glow;
  sourceCtx.fillRect(0, 0, w, h);

  sourceCtx.save();
  sourceCtx.translate(w / 2, h / 2);
  sourceCtx.rotate(-.035);
  sourceCtx.shadowColor = 'rgba(0,0,0,.8)';
  sourceCtx.shadowBlur = 42;
  sourceCtx.shadowOffsetY = 22;
  roundedRect(sourceCtx, -w * .31, -h * .34, w * .62, h * .68, 38);
  sourceCtx.fillStyle = '#141716';
  sourceCtx.fill();
  sourceCtx.shadowColor = 'transparent';

  sourceCtx.strokeStyle = '#dadeda';
  sourceCtx.lineWidth = 5;
  sourceCtx.globalAlpha = .9;
  sourceCtx.beginPath();
  sourceCtx.arc(0, -h * .1, 76, 0, Math.PI * 2);
  sourceCtx.stroke();
  sourceCtx.beginPath();
  sourceCtx.arc(0, -h * .1, 46, 0, Math.PI * 2);
  sourceCtx.stroke();
  sourceCtx.beginPath();
  sourceCtx.moveTo(-54, -h * .1);
  sourceCtx.quadraticCurveTo(0, -h * .2, 54, -h * .1);
  sourceCtx.quadraticCurveTo(0, 0, -54, -h * .1);
  sourceCtx.stroke();

  sourceCtx.fillStyle = '#e3e6e3';
  sourceCtx.textAlign = 'center';
  sourceCtx.font = '500 17px Georgia, serif';
  sourceCtx.letterSpacing = '7px';
  sourceCtx.fillText('TERRAFORM', 0, 87);
  sourceCtx.font = '10px Consolas, monospace';
  sourceCtx.fillStyle = '#aeb3ae';
  sourceCtx.fillText('MATERIAL STUDY · 01', 0, 111);

  sourceCtx.globalAlpha = .75;
  sourceCtx.strokeStyle = '#b7bbb7';
  sourceCtx.lineWidth = 2;
  sourceCtx.beginPath();
  sourceCtx.moveTo(-128, 147); sourceCtx.lineTo(128, 147);
  sourceCtx.stroke();
  sourceCtx.restore();
  cacheSource();
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function cacheSource() {
  const image = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  const gray = new Float32Array(sourceCanvas.width * sourceCanvas.height);
  for (let p = 0, i = 0; p < gray.length; p++, i += 4) {
    gray[p] = (image.data[i] * .299 + image.data[i + 1] * .587 + image.data[i + 2] * .114) / 255;
  }
  sourcePixels = gray;
}

function gaussianKernel(radius) {
  if (radius === 0) return new Float32Array([1]);
  const sigma = Math.max(radius / 3, .35);
  const kernel = new Float32Array(radius * 2 + 1);
  let total = 0;
  for (let i = -radius; i <= radius; i++) {
    const weight = Math.exp(-(i * i) / (2 * sigma * sigma));
    kernel[i + radius] = weight;
    total += weight;
  }
  for (let i = 0; i < kernel.length; i++) kernel[i] /= total;
  return kernel;
}

function blur(input, w, h, radius) {
  if (!radius) return input.slice();
  const kernel = gaussianKernel(radius);
  const temp = new Float32Array(input.length);
  const output = new Float32Array(input.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) sum += input[y * w + Math.max(0, Math.min(w - 1, x + k))] * kernel[k + radius];
      temp[y * w + x] = sum;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) sum += temp[Math.max(0, Math.min(h - 1, y + k)) * w + x] * kernel[k + radius];
      output[y * w + x] = sum;
    }
  }
  return output;
}

function generateNormalMap() {
  if (!sourcePixels) return;
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  const strength = Number(strengthInput.value);
  const radius = Number(smoothInput.value);
  const invert = invertInput.checked ? -1 : 1;
  const heights = blur(sourcePixels, w, h, radius);
  const output = normalCtx.createImageData(w, h);
  normalPixels = new Float32Array(w * h * 3);
  let maxTilt = 0;

  const sample = (x, y) => heights[Math.max(0, Math.min(h - 1, y)) * w + Math.max(0, Math.min(w - 1, x))];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let gx, gy;
      if (gradientMode.value === 'central') {
        gx = (sample(x + 1, y) - sample(x - 1, y)) * .5;
        gy = (sample(x, y + 1) - sample(x, y - 1)) * .5;
      } else {
        gx = ((sample(x + 1, y - 1) + 2 * sample(x + 1, y) + sample(x + 1, y + 1)) - (sample(x - 1, y - 1) + 2 * sample(x - 1, y) + sample(x - 1, y + 1))) * .125;
        gy = ((sample(x - 1, y + 1) + 2 * sample(x, y + 1) + sample(x + 1, y + 1)) - (sample(x - 1, y - 1) + 2 * sample(x, y - 1) + sample(x + 1, y - 1))) * .125;
      }
      const nx0 = -gx * strength * invert * 12;
      const ny0 = gy * strength * invert * ySign * 12;
      const invLength = 1 / Math.hypot(nx0, ny0, 1);
      const nx = nx0 * invLength;
      const ny = ny0 * invLength;
      const nz = invLength;
      const p = y * w + x;
      const i = p * 4;
      output.data[i] = Math.round((nx * .5 + .5) * 255);
      output.data[i + 1] = Math.round((ny * .5 + .5) * 255);
      output.data[i + 2] = Math.round((nz * .5 + .5) * 255);
      output.data[i + 3] = 255;
      normalPixels[p * 3] = nx;
      normalPixels[p * 3 + 1] = ny;
      normalPixels[p * 3 + 2] = nz;
      maxTilt = Math.max(maxTilt, Math.acos(Math.min(1, nz)));
    }
  }
  normalCtx.putImageData(output, 0, 0);
  document.querySelector('#tiltLabel').textContent = `MAX TILT ${Math.round(maxTilt * 180 / Math.PI)}°`;
  renderPreview();
}

function renderPreview() {
  if (!normalPixels) return;
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  const image = previewCtx.createImageData(w, h);
  const lx0 = (light.x - .5) * 2.2;
  const ly0 = (light.y - .5) * -2.2;
  const lz0 = .8;
  const lInv = 1 / Math.hypot(lx0, ly0, lz0);
  const lx = lx0 * lInv, ly = ly0 * lInv, lz = lz0 * lInv;
  for (let p = 0; p < w * h; p++) {
    const n = p * 3;
    const i = p * 4;
    const diffuse = Math.max(0, normalPixels[n] * lx + normalPixels[n + 1] * ly + normalPixels[n + 2] * lz);
    const ambient = .035;
    const value = Math.min(255, Math.round((ambient + Math.pow(diffuse, 1.4) * .38) * 255));
    image.data[i] = Math.round(value * .79);
    image.data[i + 1] = Math.round(value * .88);
    image.data[i + 2] = Math.round(value * .82);
    image.data[i + 3] = 255;
  }
  previewCtx.putImageData(image, 0, 0);
}

function scheduleUpdate() {
  cancelAnimationFrame(updateFrame);
  updateFrame = requestAnimationFrame(generateNormalMap);
}

function updateRange(input) {
  const percent = ((Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min))) * 100;
  input.parentElement.style.setProperty('--fill', `${percent}%`);
}

function syncControls() {
  strengthValue.innerHTML = `${Number(strengthInput.value).toFixed(1)}<span>×</span>`;
  smoothValue.innerHTML = `${smoothInput.value}<span>px</span>`;
  updateRange(strengthInput);
  updateRange(smoothInput);
  scheduleUpdate();
}

function loadFile(file) {
  if (!file?.type.startsWith('image/')) return showToast('Please choose an image file');
  const image = new Image();
  image.onload = () => {
    sourceCanvas.width = normalCanvas.width = previewCanvas.width = image.naturalWidth;
    sourceCanvas.height = normalCanvas.height = previewCanvas.height = image.naturalHeight;
    sourceCtx.drawImage(image, 0, 0);
    fileName = file.name.replace(/\.[^.]+$/, '');
    document.querySelector('#fileMeta').textContent = `${image.naturalWidth} × ${image.naturalHeight}`;
    cacheSource();
    generateNormalMap();
    URL.revokeObjectURL(image.src);
    showToast('Heightmap loaded');
  };
  image.src = URL.createObjectURL(file);
}

function showToast(message) {
  const toast = document.querySelector('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 1900);
}

strengthInput.addEventListener('input', syncControls);
smoothInput.addEventListener('input', syncControls);
invertInput.addEventListener('change', () => {
  document.querySelector('.switch-copy b').textContent = invertInput.checked ? 'Black is raised' : 'White is raised';
  document.querySelector('#invertHint').textContent = invertInput.checked ? 'Dark areas come forward' : 'Light areas come forward';
  scheduleUpdate();
});
gradientMode.addEventListener('change', scheduleUpdate);

document.querySelectorAll('[data-y]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-y]').forEach(item => item.classList.toggle('active', item === button));
  ySign = Number(button.dataset.y);
  document.querySelector('#conventionLabel').textContent = ySign === 1 ? 'OPENGL · +Y' : 'DIRECTX · −Y';
  scheduleUpdate();
}));

document.querySelector('#uploadButton').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => loadFile(fileInput.files[0]));
['dragenter', 'dragover'].forEach(type => dropZone.addEventListener(type, event => { event.preventDefault(); dropZone.classList.add('dragging'); }));
['dragleave', 'drop'].forEach(type => dropZone.addEventListener(type, event => { event.preventDefault(); dropZone.classList.remove('dragging'); }));
dropZone.addEventListener('drop', event => loadFile(event.dataTransfer.files[0]));

previewWrap.addEventListener('pointermove', event => {
  if (event.buttons !== 1 && event.pointerType !== 'touch') return;
  const rect = previewWrap.getBoundingClientRect();
  light.x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  light.y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
  lightOrb.style.left = `${light.x * 100}%`;
  lightOrb.style.top = `${light.y * 100}%`;
  previewWrap.style.setProperty('--light-x', `${light.x * 100}%`);
  previewWrap.style.setProperty('--light-y', `${light.y * 100}%`);
  requestAnimationFrame(renderPreview);
});

document.querySelector('#resetButton').addEventListener('click', () => {
  strengthInput.value = 1;
  smoothInput.value = 3;
  invertInput.checked = false;
  gradientMode.value = 'sobel';
  ySign = 1;
  document.querySelectorAll('[data-y]').forEach(item => item.classList.toggle('active', item.dataset.y === '1'));
  document.querySelector('#conventionLabel').textContent = 'OPENGL · +Y';
  document.querySelector('.switch-copy b').textContent = 'White is raised';
  document.querySelector('#invertHint').textContent = 'Light areas come forward';
  syncControls();
  showToast('Defaults restored');
});

document.querySelector('#downloadButton').addEventListener('click', () => {
  normalCanvas.toBlob(blob => {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${fileName}-normal.png`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    showToast('Normal map exported');
  }, 'image/png');
});

drawDemoHeightmap();
syncControls();
