// Leave io() blank so it automatically connects to your Render URL when hosted
const socket = io(); 
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const chatBox = document.getElementById('chat-box');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');

let players = {};
const speed = 4;
const playerSize = 15;
const keys = { w: false, a: false, s: false, d: false };

window.addEventListener('keydown', (e) => {
    if (document.activeElement === chatInput) return;
    if (e.key.toLowerCase() in keys) keys[e.key.toLowerCase()] = true;
});
window.addEventListener('keyup', (e) => {
    if (e.key.toLowerCase() in keys) keys[e.key.toLowerCase()] = false;
});

window.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        if (document.activeElement === chatInput) { chatForm.requestSubmit(); } 
        else { chatInput.focus(); }
    }
});

chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const msg = chatInput.value.trim();
    if (msg) { socket.emit('chatMessage', msg); chatInput.value = ''; }
    chatInput.blur();
});

socket.on('currentPlayers', (serverPlayers) => players = serverPlayers);
socket.on('newPlayer', (playerInfo) => players[playerInfo.id] = playerInfo);
socket.on('playerMoved', (playerInfo) => { if (players[playerInfo.id]) players[playerInfo.id] = playerInfo; });
socket.on('playerDisconnected', (id) => delete players[id]);
socket.on('chatMessage', (data) => {
    const msgElement = document.createElement('div');
    msgElement.className = 'chat-msg';
    msgElement.innerHTML = `<strong>[${data.id.substring(0, 4)}]:</strong> ${data.message}`;
    chatBox.appendChild(msgElement);
    chatBox.scrollTop = chatBox.scrollHeight;
});

function update() {
    if (players[socket.id]) {
        let moved = false;
        let p = players[socket.id];
        if (keys.w && p.y > playerSize) { p.y -= speed; moved = true; }
        if (keys.s && p.y < canvas.height - playerSize) { p.y += speed; moved = true; }
        if (keys.a && p.x > playerSize) { p.x -= speed; moved = true; }
        if (keys.d && p.x < canvas.width - playerSize) { p.x += speed; moved = true; }
        if (moved) socket.emit('playerMovement', { x: p.x, y: p.y });
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let id in players) {
        const p = players[id];
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, playerSize, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(id.substring(0, 4), p.x, p.y - (playerSize + 5));
    }
}

function loop() { update(); draw(); requestAnimationFrame(loop); }
loop();
