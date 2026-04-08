const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mm = require('music-metadata');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Serve frontend
app.use(express.static('public'));

// Serve FLAC
app.use('/music', express.static('music', {
  setHeaders: (res, path) => {
    if (path.endsWith(".flac")) res.setHeader("Content-Type", "audio/flac");
  }
}));

// Server state
let state = {
  currentSong: "song.flac",
  songTime: 0, 
  paused: true,
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
  if (!adminId) adminId = socket.id;

  socket.emit('role', { admin: socket.id === adminId });
  socket.emit('sync', state);
  io.emit('adminChanged', { adminId });

  // Admin controls
  socket.on('play', () => { if (socket.id !== adminId) return; state.paused = false; });
  socket.on('pause', () => { if (socket.id !== adminId) return; state.paused = true; });
  socket.on('seek', (time) => { if (socket.id !== adminId) return; state.songTime = time; });
  socket.on('toggleRepeat', () => { if (socket.id !== adminId) return; state.repeat = !state.repeat; });

  socket.on('disconnect', () => {
    if (socket.id === adminId) adminId = null;
    io.emit('adminChanged', { adminId });
  });
});

// Server-driven sync interval (200ms)
setInterval(() => {
  if (!state.paused) state.songTime += 0.2;
  io.emit('syncTime', { songTime: state.songTime, paused: state.paused, repeat: state.repeat });
}, 200);

// Start server
loadMetadata().then(() => {
  server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});