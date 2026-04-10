const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// Sharded Data Store (Simulating Redis)
const roomsData = {}; 

io.on('connection', (socket) => {
    // 1. FORCE ROOM FROM QUERY (Hard Isolation)
    const room = socket.handshake.query.room || 'general';
    
    // Join the logical shard
    socket.join(room);
    console.log(`[AUTH] User ${socket.id} joined shard: ${room}`);

    if (!roomsData[room]) roomsData[room] = [];
    
    // 2. State Sync: Send existing strokes to the new node
    socket.emit('history', roomsData[room]);

    // 3. Presence Tracking
    io.to(room).emit('presence', io.sockets.adapter.rooms.get(room)?.size || 0);

    // 4. Data Ingestion
    socket.on('drawing', (data) => {
        if (!roomsData[room]) roomsData[room] = [];
        
        roomsData[room].push(data);
        // Memory Guard: Limit history to 3000 vectors per room
        if(roomsData[room].length > 3000) roomsData[room].shift();
        
        // Broadcast ONLY to this specific room (excluding sender)
        socket.to(room).emit('drawing', data);
    });

    socket.on('clear', () => {
        roomsData[room] = [];
        io.to(room).emit('clear'); // Tell everyone in room to wipe canvas
    });

    socket.on('disconnect', () => {
        io.to(room).emit('presence', io.sockets.adapter.rooms.get(room)?.size || 0);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));