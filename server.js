const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { 
    cors: { 
        origin: "*", // Allows frontend connections from any hosting provider
        methods: ["GET", "POST"]
    } 
});

const players = {};

io.on('connection', (socket) => {
    players[socket.id] = {
        x: Math.floor(Math.random() * 750) + 25,
        y: Math.floor(Math.random() * 550) + 25,
        color: `hsl(${Math.random() * 360}, 70%, 50%)`,
        id: socket.id
    };

    socket.emit('currentPlayers', players);
    socket.broadcast.emit('newPlayer', players[socket.id]);

    socket.on('playerMovement', (movementData) => {
        if (players[socket.id]) {
            players[socket.id].x = movementData.x;
            players[socket.id].y = movementData.y;
            socket.broadcast.emit('playerMoved', players[socket.id]);
        }
    });

    socket.on('chatMessage', (msg) => {
        io.emit('chatMessage', { id: socket.id, message: msg });
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Server running on port ${PORT}`));
