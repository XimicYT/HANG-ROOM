const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { 
    cors: { origin: "*", methods: ["GET", "POST"] } 
});

const players = {};
const projectiles = {};
let projectileIdCounter = 0;

const ARENA_WIDTH = 1600;
const ARENA_HEIGHT = 1200;
const PLAYER_SIZE = 20;
const PROJ_SPEED = 12;
const PROJ_DAMAGE = 20;

io.on('connection', (socket) => {
    socket.on('joinGame', (data) => {
        players[socket.id] = {
            id: socket.id,
            name: (data.name || 'Guest').substring(0, 12),
            color: data.color || '#00ffcc',
            x: Math.floor(Math.random() * (ARENA_WIDTH - 100)) + 50,
            y: Math.floor(Math.random() * (ARENA_HEIGHT - 100)) + 50,
            hp: 100,
            kills: 0,
            deaths: 0
        };
        socket.emit('initGame', { 
            id: socket.id, 
            players, 
            projectiles, 
            config: { width: ARENA_WIDTH, height: ARENA_HEIGHT } 
        });
        socket.broadcast.emit('newPlayer', players[socket.id]);
    });

    socket.on('playerMovement', (movementData) => {
        const p = players[socket.id];
        if (p && p.hp > 0) {
            p.x = movementData.x;
            p.y = movementData.y;
            socket.broadcast.emit('playerMoved', { id: socket.id, x: p.x, y: p.y });
        }
    });

    socket.on('shoot', (targetData) => {
        const p = players[socket.id];
        if (p && p.hp > 0) {
            const pid = ++projectileIdCounter;
            const dx = targetData.x - p.x;
            const dy = targetData.y - p.y;
            const dist = Math.hypot(dx, dy) || 1;
            
            projectiles[pid] = {
                id: pid,
                ownerId: socket.id,
                color: p.color,
                x: p.x,
                y: p.y,
                vx: (dx / dist) * PROJ_SPEED,
                vy: (dy / dist) * PROJ_SPEED,
                life: 60 
            };
        }
    });

    socket.on('chatMessage', (msg) => {
        const p = players[socket.id];
        if (p) {
            io.emit('chatMessage', { name: p.name, color: p.color, message: msg.substring(0, 60) });
        }
    });

    socket.on('disconnect', () => {
        if (players[socket.id]) {
            delete players[socket.id];
            io.emit('playerDisconnected', socket.id);
        }
    });
});

// Server Heartbeat Loop (60Hz Physics & Sync Engine)
setInterval(() => {
    for (let pid in projectiles) {
        const proj = projectiles[pid];
        proj.x += proj.vx;
        proj.y += proj.vy;
        proj.life--;

        // 1. Boundary or expiration life checks
        if (proj.x < 0 || proj.x > ARENA_WIDTH || proj.y < 0 || proj.y > ARENA_HEIGHT || proj.life  {
                        if (players[respawnId]) {
                            players[respawnId].hp = 100;
                            players[respawnId].x = Math.floor(Math.random() * (ARENA_WIDTH - 100)) + 50;
                            players[respawnId].y = Math.floor(Math.random() * (ARENA_HEIGHT - 100)) + 50;
                            io.emit('playerRespawn', players[respawnId]);
                        }
                    }, 3000);
                }

                delete projectiles[pid];
                break;
            }
        }
    }

    // Synchronize projectile positions across all clients 60 times/sec
    io.emit('projectilesUpdate', projectiles);
}, 1000 / 60);

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Arena Engine active on port ${PORT}`));
