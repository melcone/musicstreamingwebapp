const socket = io();

const player = document.getElementById("player");
const roleLabel = document.getElementById("roleLabel");
const seekSlider = document.getElementById("seekSlider");
const currentTimeLabel = document.getElementById("currentTime");
const durationLabel = document.getElementById("duration");

const cover = document.getElementById("cover");
const title = document.getElementById("title");
const artist = document.getElementById("artist");
const repeatBtn = document.getElementById("repeat");

let isAdmin = false;
let state = {};

// Role
socket.on('role', (data) => {
  isAdmin = data.admin;
  roleLabel.textContent = isAdmin ? "Admin" : "Listener";
  if (!isAdmin) player.controls = false;
});

// Sync
socket.on("sync", (data) => {
  state = data;

  player.src = "/music/" + data.currentSong;

  cover.src = data.metadata.cover;
  title.textContent = data.metadata.title;
  artist.textContent = data.metadata.artist;

  repeatBtn.textContent = data.repeat ? "Repeat: ON" : "Repeat: OFF";

  if (data.paused) {
    player.currentTime = data.pauseTime;
    player.pause();
  } else {
    player.currentTime = (Date.now() - data.startTime) / 1000;
    player.play();
  }
});

// Controls
function play() {
  if (!isAdmin) return;
  socket.emit("play");
}

function pause() {
  if (!isAdmin) return;
  socket.emit("pause");
}

function toggleRepeat() {
  if (!isAdmin) return;
  socket.emit("toggleRepeat");
}

// Metadata loaded
player.addEventListener("loadedmetadata", () => {
  seekSlider.max = player.duration;
  durationLabel.textContent = format(player.duration);
});

// Admin slider
seekSlider.addEventListener("input", () => {
  if (!isAdmin) return;
  player.currentTime = seekSlider.value;
});

seekSlider.addEventListener("change", () => {
  if (!isAdmin) return;
  socket.emit("seek", parseFloat(seekSlider.value));
});

// Admin updates slider
player.addEventListener("timeupdate", () => {
  if (isAdmin) {
    seekSlider.value = player.currentTime;
    currentTimeLabel.textContent = format(player.currentTime);
  }
});

// 🔁 Repeat logic (ADMIN ONLY)
player.addEventListener("ended", () => {
  if (!isAdmin) return;
  if (state.repeat) {
    socket.emit("seek", 0);
    socket.emit("play");
  }
});

// 🔥 Listener continuous sync
setInterval(() => {
  if (isAdmin) return;
  if (!player.src) return;

  if (!state.paused) {
    const target = (Date.now() - state.startTime) / 1000;

    if (Math.abs(player.currentTime - target) > 0.3) {
      player.currentTime = target;
    }

    if (player.paused) player.play();
  } else {
    player.currentTime = state.pauseTime;
    if (!player.paused) player.pause();
  }

  seekSlider.value = player.currentTime;
  currentTimeLabel.textContent = format(player.currentTime);

}, 200);

// Prevent listener dragging
seekSlider.addEventListener("mousedown", (e) => {
  if (!isAdmin) e.preventDefault();
});

// Format
function format(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}