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

// Role assignment
socket.on('role', (data) => {
  isAdmin = data.admin;
  roleLabel.textContent = isAdmin ? "Admin" : "Listener";
  if (!isAdmin) player.controls = false;
});

// Full sync on join
socket.on('sync', (data) => {
  state = data;
  player.src = "/music/" + data.currentSong;

  cover.src = data.metadata.cover;
  title.textContent = data.metadata.title;
  artist.textContent = data.metadata.artist;

  repeatBtn.textContent = data.repeat ? "Repeat: ON" : "Repeat: OFF";
});

// Continuous time sync
socket.on('syncTime', (data) => {
  state.paused = data.paused;
  state.repeat = data.repeat;
  state.songTime = data.songTime;

  repeatBtn.textContent = state.repeat ? "Repeat: ON" : "Repeat: OFF";

  if (!isAdmin) {
    // Sync listener player
    if (Math.abs(player.currentTime - state.songTime) > 0.3) {
      player.currentTime = state.songTime;
    }
    if (!state.paused && player.paused) player.play();
    if (state.paused && !player.paused) player.pause();
  }

  seekSlider.value = player.currentTime;
  currentTimeLabel.textContent = format(player.currentTime);
});

// Admin controls
function play() { if (!isAdmin) return; socket.emit("play"); }
function pause() { if (!isAdmin) return; socket.emit("pause"); }
function toggleRepeat() { if (!isAdmin) return; socket.emit("toggleRepeat"); }

// Admin slider control
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

// Repeat logic
player.addEventListener("ended", () => {
  if (!isAdmin) return;
  if (state.repeat) {
    socket.emit("seek", 0);
    socket.emit("play");
  }
});

// Prevent listeners from dragging slider
seekSlider.addEventListener("mousedown", (e) => { if (!isAdmin) e.preventDefault(); });

// Format seconds to mm:ss
function format(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// Set max slider when metadata loads
player.addEventListener("loadedmetadata", () => {
  seekSlider.max = player.duration;
  durationLabel.textContent = format(player.duration);
});