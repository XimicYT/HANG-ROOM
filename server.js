const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors'); // 1. Require the CORS package

const app = express();

// 2. Enable CORS for your Express routes
app.use(cors()); 

const server = http.createServer(app);

// 3. Enable CORS for your Socket.io server
const io = new Server(server, {
    cors: {
        origin: "*", // Allows any frontend URL to connect
        methods: ["GET", "POST"]
    }
});

app.use(express.static('public'));

const players = {};
// ... [The rest of your game variables and io.on('connection') logic goes here] ...

// Generate a few soccer balls around the center of the map
const balls = {
  'ball1': { x: 2, y: 0.4, z: -3, vx: 0, vy: 0, vz: 0, holderId: null },
  'ball2': { x: -4, y: 0.4, z: 1, vx: 0, vy: 0, vz: 0, holderId: null },
  'ball3': { x: 1, y: 0.4, z: 5, vx: 0, vy: 0, vz: 0, holderId: null },
  'ball4': { x: -2, y: 0.4, z: -8, vx: 0, vy: 0, vz: 0, holderId: null },
  'ball5': { x: 6, y: 0.4, z: 3, vx: 0, vy: 0, vz: 0, holderId: null },
  'ball6': { x: -5, y: 0.4, z: -2, vx: 0, vy: 0, vz: 0, holderId: null },
  'ball7': { x: 0, y: 0.4, z: 7, vx: 0, vy: 0, vz: 0, holderId: null },
  'ball8': { x: 8, y: 0.4, z: -4, vx: 0, vy: 0, vz: 0, holderId: null }
};

const grenades = {
  'grenade1': { x: 5, y: 0.4, z: 0, vx: 0, vy: 0, vz: 0, holderId: null, pinPulled: false, timer: 0, hidden: false },
  'grenade2': { x: -3, y: 0.4, z: 4, vx: 0, vy: 0, vz: 0, holderId: null, pinPulled: false, timer: 0, hidden: false },
  'grenade3': { x: 2, y: 0.4, z: -6, vx: 0, vy: 0, vz: 0, holderId: null, pinPulled: false, timer: 0, hidden: false },
  'grenade4': { x: -7, y: 0.4, z: -1, vx: 0, vy: 0, vz: 0, holderId: null, pinPulled: false, timer: 0, hidden: false },
  'grenade5': { x: 4, y: 0.4, z: 8, vx: 0, vy: 0, vz: 0, holderId: null, pinPulled: false, timer: 0, hidden: false },
  'grenade6': { x: -1, y: 0.4, z: -9, vx: 0, vy: 0, vz: 0, holderId: null, pinPulled: false, timer: 0, hidden: false },
  'grenade7': { x: 9, y: 0.4, z: 2, vx: 0, vy: 0, vz: 0, holderId: null, pinPulled: false, timer: 0, hidden: false },
  'grenade8': { x: -6, y: 0.4, z: 5, vx: 0, vy: 0, vz: 0, holderId: null, pinPulled: false, timer: 0, hidden: false }
};

const bats = {
  'bat1': { x: 3, y: 0.4, z: -5, vx: 0, vy: 0, vz: 0, holderId: null },
  'bat2': { x: -2, y: 0.4, z: 3, vx: 0, vy: 0, vz: 0, holderId: null },
  'bat3': { x: 6, y: 0.4, z: -1, vx: 0, vy: 0, vz: 0, holderId: null },
  'bat4': { x: -4, y: 0.4, z: -7, vx: 0, vy: 0, vz: 0, holderId: null },
  'bat5': { x: 1, y: 0.4, z: 9, vx: 0, vy: 0, vz: 0, holderId: null },
  'bat6': { x: -8, y: 0.4, z: 2, vx: 0, vy: 0, vz: 0, holderId: null },
  'bat7': { x: 5, y: 0.4, z: -4, vx: 0, vy: 0, vz: 0, holderId: null },
  'bat8': { x: -1, y: 0.4, z: -3, vx: 0, vy: 0, vz: 0, holderId: null }
};

io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    // Only create the player in the world when they hit the Join button
    socket.on('joinGame', (profileData) => {
        players[socket.id] = {
            x: (Math.random() - 0.5) * 20,
            y: 2,
            z: (Math.random() - 0.5) * 20,
            ry: 0,
            color: profileData.color || '#00ffff',
            name: profileData.name || `User_${socket.id.substring(0, 4)}`
        };

        // Send existing world data to the newly joined player
        socket.emit('currentBalls', balls);
        socket.emit('currentGrenades', grenades);
        socket.emit('currentBats', bats);
        socket.emit('currentPlayers', players);

        // Tell everyone else a new player spawned
        socket.broadcast.emit('newPlayer', {
            id: socket.id,
            player: players[socket.id]
        });
    });

    // Upgraded movement listener tracking jumps and rotation
    socket.on('playerMovement', (movementData) => {
        if (!players[socket.id]) return; // Ignore movement if they haven't joined yet
        players[socket.id].x = movementData.x;
        players[socket.id].y = movementData.y;
        players[socket.id].z = movementData.z;
        players[socket.id].ry = movementData.ry;

        socket.broadcast.emit('playerMoved', {
            id: socket.id,
            ...players[socket.id]
        });
    });
    // Upgraded chat to use customized names
    socket.on('chatMessage', (msg) => {
        if (players[socket.id]) {
            io.emit('chatMessage', {
                name: players[socket.id].name,
                text: msg,
                color: players[socket.id].color
            });
        }
    });

    // --- BALL INTERACTION LOGIC ---
    socket.on('pickupBall', (ballId) => {
        if (balls[ballId] && balls[ballId].holderId === null) {
            balls[ballId].holderId = socket.id;
            io.emit('ballUpdate', { id: ballId, ball: balls[ballId] });
        }
    });

    socket.on('dropBall', (data) => {
        if (balls[data.id] && balls[data.id].holderId === socket.id) {
            balls[data.id].holderId = null;
            balls[data.id].x = data.x;
            balls[data.id].y = data.y;
            balls[data.id].z = data.z;
            balls[data.id].vx = 0; // Gentle drop has zero velocity
            balls[data.id].vy = 0;
            balls[data.id].vz = 0;
            io.emit('ballUpdate', { id: data.id, ball: balls[data.id] });
        }
    });

    socket.on('throwBall', (data) => {
        if (balls[data.id] && balls[data.id].holderId === socket.id) {
            balls[data.id].holderId = null;
            balls[data.id].x = data.x;
            balls[data.id].y = data.y;
            balls[data.id].z = data.z;
            balls[data.id].vx = data.vx; // Apply the YEET velocity
            balls[data.id].vy = data.vy;
            balls[data.id].vz = data.vz;
            io.emit('ballUpdate', { id: data.id, ball: balls[data.id] });
        }
    });

    socket.on('ballMoved', (data) => {
        if (balls[data.id] && balls[data.id].holderId === socket.id) {
            balls[data.id].x = data.x;
            balls[data.id].y = data.y;
            balls[data.id].z = data.z;
            socket.broadcast.emit('ballUpdate', { id: data.id, ball: balls[data.id] });
        }
    });

    // --- GRENADE EVENTS ---
    socket.on('pickupGrenade', (id) => {
        if (grenades[id] && grenades[id].holderId === null && !grenades[id].hidden) {
            grenades[id].holderId = socket.id;
            io.emit('grenadeUpdate', { id: id, grenade: grenades[id] });
        }
    });

    socket.on('dropGrenade', (data) => {
        if (grenades[data.id] && grenades[data.id].holderId === socket.id) {
            grenades[data.id].holderId = null;
            grenades[data.id].x = data.x;
            grenades[data.id].y = data.y;
            grenades[data.id].z = data.z;
            grenades[data.id].vx = 0;
            grenades[data.id].vy = 0;
            grenades[data.id].vz = 0;
            if (data.pullPin && !grenades[data.id].pinPulled) {
                grenades[data.id].pinPulled = true;
                grenades[data.id].timer = 90; // 3 seconds at 30 ticks/sec
            }
            io.emit('grenadeUpdate', { id: data.id, grenade: grenades[data.id] });
        }
    });

    socket.on('throwGrenade', (data) => {
        if (grenades[data.id] && grenades[data.id].holderId === socket.id) {
            grenades[data.id].holderId = null;
            grenades[data.id].x = data.x;
            grenades[data.id].y = data.y;
            grenades[data.id].z = data.z;
            grenades[data.id].vx = data.vx;
            grenades[data.id].vy = data.vy;
            grenades[data.id].vz = data.vz;
            if (!grenades[data.id].pinPulled) {
                grenades[data.id].pinPulled = true;
                grenades[data.id].timer = 90; 
            }
            io.emit('grenadeUpdate', { id: data.id, grenade: grenades[data.id] });
        }
    });

    socket.on('grenadeMoved', (data) => {
        if (grenades[data.id] && grenades[data.id].holderId === socket.id) {
            grenades[data.id].x = data.x;
            grenades[data.id].y = data.y;
            grenades[data.id].z = data.z;
            socket.broadcast.emit('grenadeUpdate', { id: data.id, grenade: grenades[data.id] });
        }
    });

    socket.on('pullGrenadePin', (id) => {
        if (grenades[id] && grenades[id].holderId === socket.id && !grenades[id].pinPulled) {
            grenades[id].pinPulled = true;
            grenades[id].timer = 90; // Start the 3-second fuse while holding
            io.emit('grenadeUpdate', { id: id, grenade: grenades[id] });
        }
    });

    // --- BAT EVENTS ---
    socket.on('pickupBat', (id) => {
        if (bats[id] && bats[id].holderId === null) {
            bats[id].holderId = socket.id;
            io.emit('batUpdate', { id, bat: bats[id] });
        }
    });
    socket.on('dropBat', (data) => {
        if (bats[data.id] && bats[data.id].holderId === socket.id) {
            bats[data.id].holderId = null;
            bats[data.id].x = data.x; bats[data.id].y = data.y; bats[data.id].z = data.z;
            bats[data.id].vx = 0;
            bats[data.id].vy = 0;
            bats[data.id].vz = 0;
            io.emit('batUpdate', { id: data.id, bat: bats[data.id] });
        }
    });
    socket.on('swingBat', () => {
        const p = players[socket.id];
        if (!p) return;
        for (let pid in players) {
            if (pid === socket.id) continue;
            let target = players[pid];
            let dist = Math.sqrt((p.x-target.x)**2 + (p.y-target.y)**2 + (p.z-target.z)**2);
            if (dist < 4.0) { // Hitbox distance
                let dx = target.x - p.x; let dz = target.z - p.z;
                let len = Math.sqrt(dx*dx + dz*dz) || 1;
                io.to(pid).emit('knockback', { vx: -(dx/len)*1.5, vy: 1.0, vz: -(dz/len)*1.5 });
            }
        }
    });
    socket.on('batMoved', (data) => {
    if (bats[data.id] && bats[data.id].holderId === socket.id) {
        bats[data.id].x = data.x;
        bats[data.id].y = data.y;
        bats[data.id].z = data.z;
        // FIX: Store and broadcast rotation data
        bats[data.id].rx = data.rx;
        bats[data.id].ry = data.ry;
        bats[data.id].rz = data.rz;
        
        socket.broadcast.emit('batUpdate', { id: data.id, bat: bats[data.id] });
    }
});
    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        
        // FIX: Force drop all held items so they don't get locked forever
        for (let id in balls) {
            if (balls[id].holderId === socket.id) {
                balls[id].holderId = null;
                io.emit('ballUpdate', { id: id, ball: balls[id] });
            }
        }
        for (let id in grenades) {
            if (grenades[id].holderId === socket.id) {
                grenades[id].holderId = null;
                io.emit('grenadeUpdate', { id: id, grenade: grenades[id] });
            }
        }
        // Bat Physics & Floor Collision
    for (let id in bats) {
        let bt = bats[id];
        if (bt.holderId === null) {
            bt.x += bt.vx; bt.y += bt.vy; bt.z += bt.vz;
            bt.vy -= 0.02; // Gravity
            if (bt.y <= 0.3 && Math.abs(bt.x) < 100 && Math.abs(bt.z) < 100) {
                bt.y = 0.3;
                bt.vy = 0;
                bt.vx *= 0.5;
                bt.vz *= 0.5;
                if (Math.abs(bt.vx) < 0.01) bt.vx = 0;
                if (Math.abs(bt.vz) < 0.01) bt.vz = 0;
            }
            needsUpdate = true;
        }
    }

    // Broadcast the updates to everyone 30 times a second
    if (needsUpdate) {
        io.emit('currentBalls', balls);
        io.emit('currentGrenades', grenades);
        io.emit('currentBats', bats);
    }

        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});
// --- SERVER PHYSICS & RESPAWN LOOP ---
setInterval(() => {
    let needsUpdate = false;
    for (let id in balls) {
        let b = balls[id];

        // 1. Off-Map Check (If it falls into the void or flies too far)
        if (b.y < -10 || Math.abs(b.x) > 105 || Math.abs(b.z) > 105) {
            b.x = (Math.random() - 0.5) * 10;
            b.y = 10; // Drop it from the sky near the center
            b.z = (Math.random() - 0.5) * 10;
            b.vx = 0; b.vy = 0; b.vz = 0;
            b.holderId = null; // Force anyone holding it to drop it
            needsUpdate = true;
        }

        if (b.holderId === null) {
            // Divide the movement into 3 mini-steps to check collisions along the way
            const subSteps = 3;
            let stepX = b.vx / subSteps;
            let stepY = b.vy / subSteps;
            let stepZ = b.vz / subSteps;

            for (let i = 0; i < subSteps; i++) {
                b.x += stepX; b.y += stepY; b.z += stepZ;

                // Player Collision (checked 3 times per frame for accuracy)
                for (let pid in players) {
                    let p = players[pid];
                    let dx = b.x - p.x; let dy = b.y - (p.y + 1); let dz = b.z - p.z;
                    let dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

                    if (dist < 1.5 && dist > 0) {
                        let overlap = 1.5 - dist;
                        b.x += (dx / dist) * overlap;
                        b.y += (dy / dist) * overlap;
                        b.z += (dz / dist) * overlap;

                        let speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy + b.vz * b.vz);
                        if (speed > 1.0) {
                            io.to(pid).emit('knockback', { vx: b.vx, vy: 0.5, vz: b.vz });
                            b.vx *= -0.5; b.vz *= -0.5;
                        } else {
                            b.vx += (dx / dist) * 0.1; b.vz += (dz / dist) * 0.1;
                        }
                        break; // Exit the sub-step loop if it hits someone
                    }
                }
            }

            // Gravity and Floor Collision (applied once after movement)
            b.vy -= 0.02;
            if (b.y <= 0.4 && Math.abs(b.x) < 100 && Math.abs(b.z) < 100) {
                b.y = 0.4; b.vy *= -0.6; b.vx *= 0.8; b.vz *= 0.8;
                if (Math.abs(b.vy) < 0.05) b.vy = 0;
                if (Math.abs(b.vx) < 0.01) b.vx = 0;
                if (Math.abs(b.vz) < 0.01) b.vz = 0;
            }
            needsUpdate = true;
        }
    }

    // Grenade Explosion & Physics Logic
    for (let id in grenades) {
        let g = grenades[id];
        if (g.hidden) continue;

        if (g.pinPulled) {
            g.timer--;
            needsUpdate = true;
            if (g.timer <= 0) {
                // Trigger explosion!
                io.emit('grenadeExplosion', { x: g.x, y: g.y, z: g.z });
                
                // Yeet players caught in radius
                for (let pid in players) {
                    let p = players[pid];
                    let dx = p.x - g.x; let dy = p.y - g.y; let dz = p.z - g.z;
                    let dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
                    if (dist < 10) {
                        let force = (10 - dist) * 0.15; // Reduced force multiplier for players
                        io.to(pid).emit('knockback', { vx: -(dx/dist)*force, vy: force * 0.6, vz: -(dz/dist)*force });
                    }
                }
                
                // Yeet soccer balls caught in radius
                for (let bid in balls) {
                    let b = balls[bid];
                    if (b.holderId) continue;
                    let bdx = b.x - g.x; let bdy = b.y - g.y; let bdz = b.z - g.z;
                    let bdist = Math.sqrt(bdx*bdx + bdy*bdy + bdz*bdz);
                    if (bdist < 10) {
                        let force = (10 - bdist) * 0.25; // Reduced force multiplier for balls
                        b.vx += (bdx/bdist)*force; b.vy += force * 0.8; b.vz += (bdz/bdist)*force;
                    }
                }

                // Hide and schedule respawn
                g.hidden = true;
                g.pinPulled = false;
                g.holderId = null;
                
                setTimeout(() => {
                    g.x = (Math.random() - 0.5) * 10;
                    g.y = 10;
                    g.z = (Math.random() - 0.5) * 10;
                    g.vx = 0; g.vy = 0; g.vz = 0;
                    g.hidden = false;
                    io.emit('grenadeUpdate', { id: id, grenade: g });
                }, 2000);
            }
        }

        if (g.holderId === null && !g.hidden) {
            g.x += g.vx; g.y += g.vy; g.z += g.vz;
            g.vy -= 0.02; // Gravity
            if (g.y <= 0.2 && Math.abs(g.x) < 100 && Math.abs(g.z) < 100) {
                g.y = 0.2; 
                g.vy = 0; // Set vertical velocity to 0 to completely kill the bounce
                g.vx *= 0.5; // High friction so it comes to a stop quickly
                g.vz *= 0.5; 
                if (Math.abs(g.vx) < 0.01) g.vx = 0;
                if (Math.abs(g.vz) < 0.01) g.vz = 0;
            }
            needsUpdate = true;
        }
    }

    // Broadcast the updates to everyone 30 times a second
    if (needsUpdate) {
        io.emit('currentBalls', balls);
        io.emit('currentGrenades', grenades);
    }
}, 1000 / 30);
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Next-Gen Server cooking on http://localhost:${PORT}`);
});
