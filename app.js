/* PicPuzzle — pure frontend sliding puzzle
   - Upload image → slice via Canvas → solvable shuffle (n-puzzle parity)
   - Click or arrow keys to slide tiles
   - Move counter + timer + preview toggle
   - No libs, no backend, works from file://
*/

const SIZE = 480; // canvas square
const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d', { alpha: false });

const fileInput = document.getElementById('fileInput');
const gridSel = document.getElementById('gridSize');
const shuffleBtn = document.getElementById('shuffleBtn');
const restartBtn = document.getElementById('restartBtn');
const previewBtn = document.getElementById('previewBtn');
const movesEl = document.getElementById('moves');
const timeEl = document.getElementById('time');
const previewImg = document.getElementById('preview');

const modal = document.getElementById('modal');
const resultText = document.getElementById('resultText');
const closeModal = document.getElementById('closeModal');

let N = parseInt(gridSel.value, 10);
let img = new Image();
let tiles = [];        // permutation of tile indices 0..N*N-1 (last = blank)
let blankIndex = null;
let originalTiles = null;

let moves = 0, timerId = null, startTime = null;

const pad2 = n => (n<10?`0${n}`:`${n}`);
function setTime(s){ timeEl.textContent = `${pad2(Math.floor(s/60))}:${pad2(s%60)}`; }
function startTimer(){ stopTimer(); startTime = Date.now(); timerId = setInterval(()=>setTime(Math.floor((Date.now()-startTime)/1000)), 1000); }
function stopTimer(){ if (timerId) clearInterval(timerId); timerId = null; }
function resetHUD(){ moves = 0; movesEl.textContent = moves; setTime(0); }

function coords(i){ return [i % N, Math.floor(i / N)]; }
function manhattan(a,b){ const [ax,ay]=coords(a), [bx,by]=coords(b); return Math.abs(ax-bx)+Math.abs(ay-by); }
function canMove(i){ return manhattan(i, blankIndex) === 1; }
function swap(i,j){ [tiles[i],tiles[j]]=[tiles[j],tiles[i]]; if(i===blankIndex) blankIndex=j; else if(j===blankIndex) blankIndex=i; }

function draw(){
  ctx.fillStyle = '#eef2ff'; ctx.fillRect(0,0,SIZE,SIZE);
  if (!img.complete || !tiles.length) return;
  const tileSize = SIZE / N;
  for (let i=0;i<tiles.length;i++){
    const val = tiles[i];
    if (val === N*N-1) continue; // blank
    const sx = (val % N) * (img.width / N);
    const sy = Math.floor(val / N) * (img.height / N);
    const dx = (i % N) * tileSize;
    const dy = Math.floor(i / N) * tileSize;
    ctx.drawImage(img, sx, sy, img.width/N, img.height/N, dx, dy, tileSize, tileSize);
    ctx.strokeStyle = 'rgba(17,24,39,.06)'; ctx.strokeRect(dx+0.5, dy+0.5, tileSize-1, tileSize-1);
  }
}

function clickToIndex(x,y){
  const s = SIZE/N;
  const col = Math.floor(x/s), row = Math.floor(y/s);
  return row * N + col;
}

canvas.addEventListener('click', (e)=>{
  if (!tiles.length) return;
  const r = canvas.getBoundingClientRect();
  const idx = clickToIndex(e.clientX - r.left, e.clientY - r.top);
  if (canMove(idx)){
    swap(idx, blankIndex);
    moves++; movesEl.textContent = moves;
    draw(); checkSolved();
  }
});

document.addEventListener('keydown', (e)=>{
  if (!tiles.length) return;
  const [bx,by]=coords(blankIndex);
  let t=null;
  if (e.key==='ArrowUp' && by < N-1) t = blankIndex + N;
  if (e.key==='ArrowDown' && by > 0)  t = blankIndex - N;
  if (e.key==='ArrowLeft' && bx < N-1) t = blankIndex + 1;
  if (e.key==='ArrowRight' && bx > 0)  t = blankIndex - 1;
  if (t!=null){
    swap(t, blankIndex);
    moves++; movesEl.textContent = moves;
    draw(); checkSolved();
  }
});

function solved(){
  for (let i=0;i<tiles.length-1;i++) if (tiles[i] !== i) return false;
  return tiles[tiles.length-1] === tiles.length-1;
}

function checkSolved(){
  if (!solved()) return;
  stopTimer();
  const sec = Math.floor((Date.now()-startTime)/1000);
  resultText.textContent = `Grid ${N}×${N} • ${moves} moves • ${sec}s`;
  modal.classList.add('show');
}

closeModal?.addEventListener('click', ()=> modal.classList.remove('show'));

function isSolvable(arr, N){
  const flat = arr.filter(v => v !== N*N-1);
  let inv = 0;
  for (let i=0;i<flat.length;i++)
    for (let j=i+1;j<flat.length;j++)
      if (flat[i] > flat[j]) inv++;
  if (N % 2 === 1) return inv % 2 === 0;
  const blankRowFromBottom = N - Math.floor(arr.indexOf(N*N-1)/N);
  return (blankRowFromBottom % 2 === 0) ? (inv % 2 === 1) : (inv % 2 === 0);
}

function shuffledSolvable(N){
  const a = Array.from({length:N*N}, (_,i)=>i);
  do{
    for (let i=a.length-1;i>0;i--){
      const j = (Math.random()*(i+1))|0; [a[i],a[j]] = [a[j],a[i]];
    }
  } while (!isSolvable(a,N) || a.every((v,i)=>v===i)); // avoid solved
  return a;
}

function prepareTiles(){
  tiles = shuffledSolvable(N);
  blankIndex = tiles.indexOf(N*N-1);
  originalTiles = tiles.slice();
  resetHUD(); draw(); startTimer();
}

function restart(){
  if (!originalTiles) return;
  tiles = originalTiles.slice();
  blankIndex = tiles.indexOf(N*N-1);
  resetHUD(); draw(); startTimer();
}

function loadImageFile(file){
  const reader = new FileReader();
  reader.onload = e => {
    const src = e.target.result;
    const inImg = new Image();
    inImg.onload = ()=>{
      // cover-fit into a square offscreen canvas
      const off = document.createElement('canvas');
      off.width = off.height = SIZE;
      const octx = off.getContext('2d');
      const scale = Math.max(SIZE/inImg.width, SIZE/inImg.height);
      const w = inImg.width*scale, h = inImg.height*scale;
      octx.drawImage(inImg, (SIZE-w)/2, (SIZE-h)/2, w, h);
      img = new Image();
      img.onload = ()=>{ draw(); prepareTiles(); previewImg.src = off.toDataURL(); previewImg.style.display='none'; };
      const dataUrl = off.toDataURL();
      img.src = dataUrl;
    };
    inImg.src = src;
  };
  reader.readAsDataURL(file);
}

/* UI wiring */
fileInput.addEventListener('change', e=>{
  const f = e.target.files?.[0];
  if (f) loadImageFile(f);
});
gridSel.addEventListener('change', ()=>{
  N = parseInt(gridSel.value,10);
  if (img.src) prepareTiles(); else draw();
});
shuffleBtn.addEventListener('click', ()=> { if (img.src) prepareTiles(); });
restartBtn.addEventListener('click', restart);
previewBtn.addEventListener('click', ()=>{
  previewImg.style.display = previewImg.style.display === 'none' ? 'block' : 'none';
});

/* init */
draw();
