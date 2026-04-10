// 1. Client-Side Routing: Get Room from URL
const params = new URLSearchParams(window.location.search);
const roomID = params.get('room') || 'general';
document.getElementById('roomLabel').innerText = roomID;

// 2. Connect with Room ID for immediate isolation
const socket = io({ 
    query: { room: roomID } 
});

const canvas = document.getElementById('whiteboard');
const ctx = canvas.getContext('2d');
const saveState = document.getElementById('saveState');

// Handle High-DPI displays and resizing
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

let drawing = false;
let currentPos = { x: 0, y: 0 };
let color = '#000000';

// Room Switcher Logic
function joinRoom() {
    const r = document.getElementById('roomInput').value.trim();
    if (r) window.location.href = `/?room=${encodeURIComponent(r)}`;
}

// Allow pressing Enter to join room
document.getElementById('roomInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') joinRoom();
});

// Main Drawing Function
function draw(x0, y0, x1, y1, c, s, emit) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.strokeStyle = c;
    ctx.lineWidth = s;
    ctx.lineCap = 'round';
    ctx.stroke();
    
    if (emit) {
        saveState.innerText = "Syncing...";
        // SD Concept: Data Normalization
        socket.emit('drawing', {
            x0: x0 / canvas.width,
            y0: y0 / canvas.height,
            x1: x1 / canvas.width,
            y1: y1 / canvas.height,
            color: c,
            size: s
        });
        clearTimeout(window.sTimer);
        window.sTimer = setTimeout(() => saveState.innerText = "Synced", 500);
    }
}

// Mouse/Touch Events
canvas.addEventListener('mousedown', (e) => { 
    drawing = true; 
    currentPos = { x: e.clientX, y: e.clientY }; 
});

canvas.addEventListener('mousemove', (e) => {
    if (!drawing) return;
    const size = document.getElementById('brushSize').value;
    draw(currentPos.x, currentPos.y, e.clientX, e.clientY, color, size, true);
    currentPos = { x: e.clientX, y: e.clientY };
});

canvas.addEventListener('mouseup', () => drawing = false);
canvas.addEventListener('mouseout', () => drawing = false);

// WebSocket Listeners
socket.on('drawing', (d) => {
    draw(d.x0 * canvas.width, d.y0 * canvas.height, 
         d.x1 * canvas.width, d.y1 * canvas.height, d.color, d.size, false);
});

socket.on('history', (history) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Wipe before loading new room
    history.forEach(d => {
        draw(d.x0 * canvas.width, d.y0 * canvas.height, 
             d.x1 * canvas.width, d.y1 * canvas.height, d.color, d.size, false);
    });
});

socket.on('presence', (c) => document.getElementById('activeUsers').innerText = c);
socket.on('clear', () => ctx.clearRect(0, 0, canvas.width, canvas.height));

// UI Color Pickers (with Eraser Fix)
document.querySelectorAll('.color').forEach(el => {
    el.onclick = (e) => {
        document.querySelector('.color.active').classList.remove('active');
        // currentTarget ensures we grab the outer div, even if we click the eraser emoji
        e.currentTarget.classList.add('active');
        color = e.currentTarget.getAttribute('data-color');
    };
});