const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mm = require('music-metadata');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve frontend
app.use(express.static('public'));

// Serve FLAC
app.use('/music', express.static('music', {
  setHeaders: (res, path) => {
    if (path.endsWith(".flac")) {
      res.setHeader("Content-Type", "audio/flac");
    }
  }
}));

// State
let state = {
  currentSong: "song.flac",
  startTime: Date.now(),
  paused: true,
  pauseTime: 0,
  repeat: false,
  metadata: {
    title: "",
    artist: "",
    cover: ""
  }
};

let adminId = null;

// Load FLAC metadata
async function loadMetadata() {
  const metadata = await mm.parseFile('./music/song.flac');

  state.metadata.title = metadata.common.title || "Unknown Title";
  state.metadata.artist = metadata.common.artist || "Unknown Artist";

  if (metadata.common.picture?.length > 0) {
    const pic = metadata.common.picture[0];
    fs.writeFileSync('./public/cover.jpg', pic.data);
    state.metadata.cover = "/cover.jpg";
  }
}

// Socket logic
io.on('connection', (socket) => {

  if (!adminId) {
    adminId = socket.id;
    socket.emit('role', { admin: true });
  } else {
    socket.emit('role', { admin: false });
  }

  socket.emit('sync', state);
  io.emit('adminChanged', { adminId });

  socket.on('play', () => {
    if (socket.id !== adminId) return;
    state.startTime = Date.now() - state.pauseTime * 1000;
    state.paused = false;
    io.emit('sync', state);
  });

  socket.on('pause', () => {
    if (socket.id !== adminId) return;
    state.pauseTime = (Date.now() - state.startTime) / 1000;
    state.paused = true;
    io.emit('sync', state);
  });

  socket.on('seek', (time) => {
    if (socket.id !== adminId) return;
    state.startTime = Date.now() - time * 1000;
    state.pauseTime = time;
    io.emit('sync', state);
  });

  socket.on('toggleRepeat', () => {
    if (socket.id !== adminId) return;
    state.repeat = !state.repeat;
    io.emit('sync', state);
  });

  socket.on('disconnect', () => {
    if (socket.id === adminId) adminId = null;
    io.emit('adminChanged', { adminId });
  });
});

// Start server after metadata loads
loadMetadata().then(() => {
  server.listen(3000, () => {
    console.log("http://localhost:3000");
  });
});