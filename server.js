const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { 
    cors: { origin: "*", methods: ["GET", "POST"] } 
});

const players = {};
const projectiles = {};
let projectileIdCounter = 0;

// Arena mechanics configuration
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
                life: 60 // Disappears after 60 frames (~1 sec)
            };
            io.emit('newProjectile', projectiles[pid]);
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

// Physics and Collision Engine Server loop (Runs at 60Hz)
setInterval(() => {
    // Process Projectiles
    for (let pid in projectiles) {
        const proj = projectiles[pid];
        proj.x += proj.vx;
        proj.y += proj.vy;
        proj.life--;

        // Arena boundary check
        if (proj.x < 0 || proj.x > ARENA_WIDTH || proj.y < 0 || proj.y > ARENA_HEIGHT || proj.life <= 0) {
            delete projectiles[pid];
            io.emit('destroyProjectile', pid);
            continue;
        }

        // Hitscan check against live targets
        for (let targetId in players) {
            const target = players[targetId];
            if (targetId === proj.ownerId || target.hp <= 0) continue;

            const distance = Math.hypot(target.x - proj.x, target.y - proj.y);
            if (distance < PLAYER_SIZE + 4) {
                target.hp -= PROJ_DAMAGE;
                
                // Process knockback parameters to push the hit player backward
                const kx = proj.vx * 0.4;
                const ky = proj.vy * 0.4;
                target.x = Math.max(PLAYER_SIZE, Math.min(ARENA_WIDTH - PLAYER_SIZE, target.x + kx));
                target.y = Math.max(PLAYER_SIZE, Math.min(ARENA_HEIGHT - PLAYER_SIZE, target.y + ky));

                io.emit('playerHit', { 
                    id: target.id, 
                    hp: target.hp, 
                    x: target.x, 
                    y: target.y,
                    damage: PROJ_DAMAGE,
                    angle: Math.atan2(proj.vy, proj.vx)
                });

                if (target.hp <= 0) {
                    target.deaths++;
                    const killer = players[proj.ownerId];
                    if (killer) {
                        killer.kills++;
                        io.emit('killNotification', { killer: killer.name, victim: target.name });
                        io.emit('updateLeaderboard', { id: killer.id, kills: killer.kills });
                    }
                    io.emit('updateLeaderboard', { id: target.id, deaths: target.deaths });
                    
                    // Trigger delayed respawn loop
                    setTimeout(() => {
                        if (players[targetId]) {
                            players[targetId].hp = 100;
                            players[targetId].x = Math.floor(Math.random() * (ARENA_WIDTH - 100)) + 50;
                            players[targetId].y = Math.floor(Math.random() * (ARENA_HEIGHT - 100)) + 50;
                            io.emit('playerRespawn', players[targetId]);
                        }
                    }, 3000);
                }

                delete projectiles[pid];
                io.emit('destroyProjectile', pid);
                break;
            }
        }
    }
}, 1000 / 60);

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Arena Engine humming on port ${PORT}`));
