const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors'); // 1. Added cors dependency

const app = express();

// 2. Enable CORS for Express routes (if you add REST endpoints later)
app.use(cors({
    origin: "*", // Allows any frontend to connect. Change to your specific domain in production.
    methods: ["GET", "POST"]
}));

const server = http.createServer(app);

// 3. Configure Socket.io with CORS rules
const io = new Server(server, {
    cors: {
        origin: "*", // Allows any frontend domain to establish a websocket connection
        methods: ["GET", "POST"]
    }
});

// Optional: Keep this if you still want to serve a local fallback frontend
app.use(express.static('public'));

const players = {};

// Generate a few soccer balls around the center of the map
const balls = {
    'ball1': { x: 2, y: 0.4, z: -3, vx: 0, vy: 0, vz: 0, holderId: null },
    'ball2': { x: -2, y: 0.4, z: 3, vx: 0, vy: 0, vz: 0, holderId: null },
    'ball3': { x: 0, y: 0.4, z: 5, vx: 0, vy: 0, vz: 0, holderId: null }
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
        if(balls[ballId] && balls[ballId].holderId === null) {
            balls[ballId].holderId = socket.id;
            io.emit('ballUpdate', { id: ballId, ball: balls[ballId] });
        }
    });

    socket.on('dropBall', (data) => {
        if(balls[data.id] && balls[data.id].holderId === socket.id) {
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
        if(balls[data.id] && balls[data.id].holderId === socket.id) {
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
        if(balls[data.id] && balls[data.id].holderId === socket.id) {
            balls[data.id].x = data.x;
            balls[data.id].y = data.y;
            balls[data.id].z = data.z;
            socket.broadcast.emit('ballUpdate', { id: data.id, ball: balls[data.id] });
        }
    });
    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
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

        // 2. Gravity and Bouncing (Now checks if it's above the floor!)
        if (b.holderId === null && (b.y > 0.4 || Math.abs(b.vx) > 0.01 || Math.abs(b.vy) > 0.01 || Math.abs(b.vz) > 0.01)) {
            b.x += b.vx;
            b.y += b.vy;
            b.z += b.vz;
            b.vy -= 0.02; // Gravity pulls it down
            
            // Floor collision (0.4 is the ball's radius)
            if (b.y <= 0.4 && Math.abs(b.x) < 100 && Math.abs(b.z) < 100) {
                b.y = 0.4;
                b.vy *= -0.6; // Bounce elasticity
                b.vx *= 0.8;  // Ground friction
                b.vz *= 0.8;
                
                // Put it to sleep if it's barely moving to save server power
                if (Math.abs(b.vy) < 0.05) b.vy = 0;
                if (Math.abs(b.vx) < 0.01) b.vx = 0;
                if (Math.abs(b.vz) < 0.01) b.vz = 0;
            }
            needsUpdate = true;

            // 3. Player Collision (Kicking & Yeeting)
            for (let pid in players) {
                let p = players[pid];
                // Check distance (assuming player center is slightly above their feet)
                let dx = b.x - p.x; let dy = b.y - (p.y + 1); let dz = b.z - p.z;
                let dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
                
                if (dist < 1.5) {
                    let speed = Math.sqrt(b.vx*b.vx + b.vy*b.vy + b.vz*b.vz);
                    if (speed > 1.0) { 
                        // The ball is flying fast! Yeet the player!
                        io.to(pid).emit('knockback', { vx: b.vx, vy: 0.5, vz: b.vz });
                        b.vx *= -0.5; b.vz *= -0.5; // Ball bounces off the player's face
                    } else { 
                        // Gentle collision: Player kicks the ball
                        b.vx += dx * 0.05; 
                        b.vz += dz * 0.05;
                    }
                    needsUpdate = true;
                }
            }
        }
    }
    
    // Broadcast the moving balls to everyone 30 times a second
    if (needsUpdate) {
        io.emit('currentBalls', balls);
    }
}, 1000 / 30);
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Next-Gen Server cooking on port ${PORT}`);
});
