/* ════════════════════════════════════════════════════════
   JARVIS VISION AI — script.js
════════════════════════════════════════════════════════ */

const bootOverlay = document.querySelector(".boot-overlay");
const bootBar = document.querySelector(".boot-bar");
const bootLog = document.querySelector(".boot-log");

const cameraFeed = document.getElementById("cameraFeed");

const scanBtn = document.getElementById("scanBtn");
const voiceBtn = document.getElementById("voiceBtn");

const aiResponse = document.getElementById("aiResponse");

const statusDot = document.querySelector(".panel-dot");
const scanBeam = document.querySelector(".scan-beam");
const targetLock = document.querySelector(".target-lock");

const radarCanvas = document.getElementById("radarCanvas");
const radarCtx = radarCanvas.getContext("2d");

const hudCanvas = document.getElementById("hudCanvas");
const hudCtx = hudCanvas.getContext("2d");

let scanning = false;

/* ════════════════════════════════════════════════════════
   BOOT SEQUENCE
════════════════════════════════════════════════════════ */

const bootMessages = [
  "Initializing Stark Neural Systems...",
  "Loading J.A.R.V.I.S Core...",
  "Connecting Vision Matrix...",
  "Calibrating HUD Interface...",
  "Accessing Satellite Grid...",
  "Starting Camera Systems...",
  "AI Modules Online...",
  "System Ready."
];

async function bootSequence() {

  for (let i = 0; i < bootMessages.length; i++) {

    const line = document.createElement("div");
    line.className = "boot-log-line";
    line.textContent = "> " + bootMessages[i];

    bootLog.appendChild(line);

    bootBar.style.width = `${((i + 1) / bootMessages.length) * 100}%`;

    await sleep(700);
  }

  await startCamera();

  bootOverlay.classList.add("fade-out");

  setTimeout(() => {
    bootOverlay.style.display = "none";
  }, 1000);
}

/* ════════════════════════════════════════════════════════
   CAMERA
════════════════════════════════════════════════════════ */

async function startCamera() {

  try {

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user"
      },
      audio: false
    });

    cameraFeed.srcObject = stream;

    cameraFeed.classList.add("active");

    statusDot.classList.add("active");

    toast("CAMERA ONLINE", "success");

  } catch (err) {

    console.error(err);

    toast("CAMERA ACCESS DENIED", "error");
  }
}

/* ════════════════════════════════════════════════════════
   SCAN BUTTON
════════════════════════════════════════════════════════ */

scanBtn.addEventListener("click", async () => {

  if (scanning) return;

  scanning = true;

  scanBtn.classList.add("scanning");

  scanBeam.classList.add("scanning");

  targetLock.classList.add("locked");

  statusDot.classList.remove("active");
  statusDot.classList.add("scanning");

  typeAI(`
    <h3>VISUAL SCAN</h3>
    <p><strong>Target Acquired.</strong></p>
    <p>Running environmental analysis...</p>
  `);

  fakeScanEffect();

  await sleep(3500);

  typeAI(`
    <h3>SCAN COMPLETE</h3>
    <p><strong>STATUS:</strong> Area secure.</p>
    <ul>
      <li>Face Detected</li>
      <li>Light Level Stable</li>
      <li>Motion Tracking Active</li>
      <li>HUD Systems Nominal</li>
    </ul>
  `);

  scanBtn.classList.remove("scanning");

  scanBeam.classList.remove("scanning");

  targetLock.classList.remove("locked");

  statusDot.classList.remove("scanning");
  statusDot.classList.add("active");

  scanning = false;

  toast("SCAN COMPLETE", "success");
});

/* ════════════════════════════════════════════════════════
   VOICE BUTTON
════════════════════════════════════════════════════════ */

voiceBtn.addEventListener("click", () => {

  if (!("webkitSpeechRecognition" in window)) {

    toast("VOICE API NOT SUPPORTED", "error");

    return;
  }

  const recognition = new webkitSpeechRecognition();

  recognition.lang = "en-US";

  recognition.start();

  voiceBtn.classList.add("active");

  toast("VOICE LISTENING...", "success");

  recognition.onresult = (event) => {

    const text = event.results[0][0].transcript;

    typeAI(`
      <h3>VOICE COMMAND</h3>
      <p><strong>User Said:</strong> ${text}</p>
    `);

    toast("VOICE RECEIVED", "success");
  };

  recognition.onend = () => {
    voiceBtn.classList.remove("active");
  };
});

/* ════════════════════════════════════════════════════════
   AI TYPE EFFECT
════════════════════════════════════════════════════════ */

function typeAI(html) {

  aiResponse.innerHTML = "";

  let i = 0;

  const temp = document.createElement("div");
  temp.innerHTML = html;

  const text = temp.innerHTML;

  const interval = setInterval(() => {

    aiResponse.innerHTML = text.slice(0, i) +
      '<span class="type-cursor"></span>';

    i++;

    if (i > text.length) {

      clearInterval(interval);

      aiResponse.innerHTML = text;
    }

  }, 10);
}

/* ════════════════════════════════════════════════════════
   RADAR
════════════════════════════════════════════════════════ */

radarCanvas.width = 200;
radarCanvas.height = 200;

let radarAngle = 0;

function drawRadar() {

  radarCtx.clearRect(0, 0, 200, 200);

  const cx = 100;
  const cy = 100;

  for (let r = 40; r <= 100; r += 30) {

    radarCtx.beginPath();
    radarCtx.arc(cx, cy, r, 0, Math.PI * 2);

    radarCtx.strokeStyle = "rgba(0,212,255,0.15)";
    radarCtx.stroke();
  }

  radarCtx.beginPath();

  radarCtx.moveTo(cx, cy);

  const x = cx + Math.cos(radarAngle) * 100;
  const y = cy + Math.sin(radarAngle) * 100;

  radarCtx.lineTo(x, y);

  radarCtx.strokeStyle = "#00d4ff";
  radarCtx.lineWidth = 2;

  radarCtx.stroke();

  radarAngle += 0.02;

  requestAnimationFrame(drawRadar);
}

drawRadar();

/* ════════════════════════════════════════════════════════
   HUD PARTICLES
════════════════════════════════════════════════════════ */

function resizeHUD() {

  hudCanvas.width = window.innerWidth;
  hudCanvas.height = window.innerHeight;
}

resizeHUD();

window.addEventListener("resize", resizeHUD);

const particles = [];

for (let i = 0; i < 80; i++) {

  particles.push({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    size: Math.random() * 2,
    speed: Math.random() * 0.5 + 0.2
  });
}

function animateHUD() {

  hudCtx.clearRect(0, 0, hudCanvas.width, hudCanvas.height);

  particles.forEach(p => {

    p.y += p.speed;

    if (p.y > window.innerHeight) {
      p.y = 0;
    }

    hudCtx.fillStyle = "rgba(0,212,255,0.4)";

    hudCtx.fillRect(p.x, p.y, p.size, p.size);
  });

  requestAnimationFrame(animateHUD);
}

animateHUD();

/* ════════════════════════════════════════════════════════
   FAKE SCAN EFFECT
════════════════════════════════════════════════════════ */

function fakeScanEffect() {

  document.body.classList.add("glitch");

  setTimeout(() => {
    document.body.classList.remove("glitch");
  }, 400);
}

/* ════════════════════════════════════════════════════════
   TOAST
════════════════════════════════════════════════════════ */

function toast(message, type = "") {

  const toast = document.createElement("div");

  toast.className = `jarvis-toast show ${type}`;

  toast.textContent = message;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.remove("show");
  }, 2500);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

/* ════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════ */

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/* START */
bootSequence();