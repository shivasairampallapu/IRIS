/* ═══════════════════════════════════════════════════════
   IRIS VISION AI — script.js
   Intelligent Recognition Interface System
   AI-powered camera with object detection, OCR, translation
═══════════════════════════════════════════════════════ */

// ─────────────────────────────────────────────────────
// GLOBAL STATE
// ─────────────────────────────────────────────────────
const state = {
    apiKey: localStorage.getItem('gemini_api_key') || '',
    detectionModel: null,
    ocrReady: false,
    gpsEnabled: false,
    voiceActive: false,
    selectedLanguage: 'en',
    lastAnalysis: null,
    detectedObjects: [],
    currentLocation: null,
    map: null,
    animationFrameId: null,
};

// ─────────────────────────────────────────────────────
// DOM ELEMENTS
// ─────────────────────────────────────────────────────
const dom = {
    bootScreen: document.getElementById('boot-screen'),
    apiModal: document.getElementById('api-modal'),
    app: document.getElementById('app'),
    camera: document.getElementById('camera'),
    overlay: document.getElementById('overlay'),
    
    // Status indicators
    statusTexts: {
        camera: document.getElementById('s-camera'),
        objdet: document.getElementById('s-objdet'),
        ocr: document.getElementById('s-ocr'),
        gps: document.getElementById('s-gps'),
        gemini: document.getElementById('s-gemini'),
        voice: document.getElementById('s-voice'),
    },
    
    // Counters & info
    objCount: document.getElementById('obj-count'),
    objBars: document.getElementById('obj-bars'),
    mainStatus: document.getElementById('main-status-text'),
    fpsCounter: document.getElementById('fps-counter'),
    
    // Analysis
    analysisContent: document.getElementById('analysis-content'),
    typingDots: document.getElementById('typing-dots'),
    
    // Controls
    btnAnalyze: document.getElementById('btn-analyze'),
    btnTranslate: document.getElementById('btn-translate'),
    btnScan: document.getElementById('btn-scan'),
    btnVoice: document.getElementById('btn-voice'),
    btnClear: document.getElementById('btn-clear'),
    settingsBtn: document.getElementById('settings-btn'),
    
    // Map & Radar
    minimap: document.getElementById('minimap'),
    mapFooter: document.getElementById('map-footer'),
    radarCanvas: document.getElementById('radar-canvas'),
    hpCoords: document.getElementById('hp-coords'),
    
    // Language
    langButtons: document.querySelectorAll('.lb-btn'),
    
    // Effects
    scanFlash: document.getElementById('scan-flash'),
    scanSweep: document.getElementById('scan-sweep'),
    voiceOverlay: document.getElementById('voice-overlay'),
};

// ─────────────────────────────────────────────────────
// BOOT SEQUENCE
// ─────────────────────────────────────────────────────
class BootSequence {
    constructor() {
        this.bootLog = document.getElementById('boot-log');
        this.bootProgress = document.getElementById('boot-progress-bar');
    }

    async run() {
        const logs = [
            'Initializing neural core...',
            'Loading vision engine...',
            'Activating sensors...',
            'Configuring AI modules...',
            'Syncing geolocation...',
            'Ready for deployment.',
        ];

        let progress = 0;
        for (const log of logs) {
            this.log(log);
            progress += 16.67;
            this.bootProgress.style.width = progress + '%';
            await new Promise(r => setTimeout(r, 400));
        }

        await new Promise(r => setTimeout(r, 600));
        this.complete();
    }

    log(message) {
        const line = document.createElement('div');
        line.textContent = '▸ ' + message;
        this.bootLog.appendChild(line);
        this.bootLog.scrollTop = this.bootLog.scrollHeight;
    }

    complete() {
        dom.bootScreen.classList.add('hidden');
        dom.apiModal.classList.remove('hidden');
        UIController.initEventListeners();
    }
}

// ─────────────────────────────────────────────────────
// CAMERA & DETECTION
// ─────────────────────────────────────────────────────
class CameraController {
    static async init() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' },
                audio: false,
            });
            
            dom.camera.srcObject = stream;
            dom.camera.onloadedmetadata = () => {
                StatusController.update('camera', 'ONLINE', 'st-online');
                this.startDetection();
            };
        } catch (error) {
            console.error('Camera error:', error);
            StatusController.update('camera', 'ERROR', 'st-offline');
            AlertController.show('Camera access denied');
        }
    }

    static startDetection() {
        if (!state.detectionModel) return;

        const ctx = dom.overlay.getContext('2d');
        let frameCount = 0;
        let lastTime = Date.now();

        const detectFrame = async () => {
            frameCount++;
            const now = Date.now();

            // Update FPS counter
            if (now - lastTime >= 1000) {
                dom.fpsCounter.textContent = frameCount + ' FPS';
                frameCount = 0;
                lastTime = now;
            }

            try {
                const predictions = await state.detectionModel.detect(dom.camera);
                state.detectedObjects = predictions;

                // Clear canvas
                ctx.clearRect(0, 0, dom.overlay.width, dom.overlay.height);

                // Update dimensions
                dom.overlay.width = dom.camera.videoWidth;
                dom.overlay.height = dom.camera.videoHeight;

                // Draw detections
                predictions.forEach((pred, idx) => {
                    this.drawBox(ctx, pred);
                    if (idx < 3) {
                        this.updateConfidenceBar(idx, pred);
                    }
                });

                // Update object counter
                dom.objCount.textContent = predictions.length;

                // Update ticker
                if (predictions.length > 0) {
                    const names = predictions.slice(0, 5).map(p => p.class.toUpperCase()).join(' • ');
                    document.getElementById('ticker-inner').textContent = names;
                }

                // Update radar
                RadarController.update(predictions);
            } catch (error) {
                console.error('Detection error:', error);
            }

            state.animationFrameId = requestAnimationFrame(detectFrame);
        };

        detectFrame();
    }

    static drawBox(ctx, pred) {
        const { bbox, class: className, score } = pred;
        const [x, y, width, height] = bbox;

        // Main box
        ctx.strokeStyle = '#00eaff';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#00eaff';
        ctx.shadowBlur = 8;
        ctx.strokeRect(x, y, width, height);

        // Corners
        const cornerLen = 15;
        ctx.fillStyle = '#00eaff';
        
        // Top-left
        ctx.fillRect(x, y, cornerLen, 2);
        ctx.fillRect(x, y, 2, cornerLen);
        
        // Top-right
        ctx.fillRect(x + width - cornerLen, y, cornerLen, 2);
        ctx.fillRect(x + width - 2, y, 2, cornerLen);
        
        // Bottom-left
        ctx.fillRect(x, y + height - 2, cornerLen, 2);
        ctx.fillRect(x, y + height - cornerLen, 2, cornerLen);
        
        // Bottom-right
        ctx.fillRect(x + width - cornerLen, y + height - 2, cornerLen, 2);
        ctx.fillRect(x + width - 2, y + height - cornerLen, 2, cornerLen);

        // Label
        const label = `${className} ${Math.round(score * 100)}%`;
        ctx.font = 'bold 12px Arial';
        ctx.fillStyle = '#020c1b';
        ctx.fillRect(x, y - 25, label.length * 8, 22);
        ctx.fillStyle = '#00eaff';
        ctx.fillText(label, x + 4, y - 8);
    }

    static updateConfidenceBar(idx, pred) {
        let container = dom.objBars;
        let row = container.querySelector(`[data-idx="${idx}"]`);

        if (!row) {
            row = document.createElement('div');
            row.className = 'ob-row';
            row.dataset.idx = idx;
            row.innerHTML = `
                <div class="ob-name">
                    <span class="ob-label"></span>
                    <span class="ob-conf"></span>
                </div>
                <div class="ob-bar-track">
                    <div class="ob-bar-fill"></div>
                </div>
            `;
            container.appendChild(row);
        }

        const conf = Math.round(pred.score * 100);
        row.querySelector('.ob-label').textContent = pred.class.toUpperCase();
        row.querySelector('.ob-conf').textContent = conf + '%';
        row.querySelector('.ob-bar-fill').style.width = conf + '%';
    }
}

// ─────────────────────────────────────────────────────
// GEMINI VISION API
// ─────────────────────────────────────────────────────
class GeminiController {
    static async analyze(canvasOrText) {
        if (!state.apiKey) {
            AlertController.show('API key required for analysis');
            return;
        }

        StatusController.update('gemini', 'ACTIVE', 'st-loading');
        UIController.showTypingDots(true);

        try {
            let base64Image;

            if (canvasOrText instanceof HTMLVideoElement) {
                const canvas = document.createElement('canvas');
                canvas.width = canvasOrText.videoWidth;
                canvas.height = canvasOrText.videoHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(canvasOrText, 0, 0);
                base64Image = canvas.toDataURL('image/jpeg').split(',')[1];
            } else {
                base64Image = canvasOrText;
            }

            const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + state.apiKey, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            {
                                inline_data: {
                                    mime_type: 'image/jpeg',
                                    data: base64Image,
                                }
                            },
                            {
                                text: `You are IRIS, a futuristic AI vision assistant. Analyze this image and provide:
1. Location/Place identification
2. Key landmarks or objects visible
3. Historical or cultural significance
4. Travel tips if applicable
5. Safety information
Be concise but informative. Format with bullet points.`,
                            }
                        ]
                    }]
                })
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            const analysisText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No analysis available';
            
            state.lastAnalysis = analysisText;
            UIController.displayAnalysis(analysisText);
            StatusController.update('gemini', 'ONLINE', 'st-online');
        } catch (error) {
            console.error('Gemini error:', error);
            AlertController.show('Analysis failed: ' + error.message);
            StatusController.update('gemini', 'ERROR', 'st-offline');
        } finally {
            UIController.showTypingDots(false);
        }
    }
}

// ─────────────────────────────────────────────────────
// OCR & TRANSLATION
// ─────────────────────────────────────────────────────
class OCRController {
    static async extractText(canvasOrVideo) {
        StatusController.update('ocr', 'ACTIVE', 'st-loading');
        UIController.showTypingDots(true);

        try {
            const canvas = document.createElement('canvas');
            if (canvasOrVideo instanceof HTMLVideoElement) {
                canvas.width = canvasOrVideo.videoWidth;
                canvas.height = canvasOrVideo.videoHeight;
                canvas.getContext('2d').drawImage(canvasOrVideo, 0, 0);
            } else {
                canvas = canvasOrVideo;
            }

            const { data: { text } } = await Tesseract.recognize(canvas, 'eng');
            
            StatusController.update('ocr', 'ONLINE', 'st-online');
            return text.trim();
        } catch (error) {
            console.error('OCR error:', error);
            AlertController.show('OCR failed: ' + error.message);
            StatusController.update('ocr', 'ERROR', 'st-offline');
            return '';
        } finally {
            UIController.showTypingDots(false);
        }
    }

    static async translateText(text) {
        if (!state.apiKey) {
            AlertController.show('API key required for translation');
            return text;
        }

        const languageMap = {
            'en': 'English',
            'hi': 'Hindi',
            'te': 'Telugu',
            'ta': 'Tamil',
            'ja': 'Japanese',
            'fr': 'French',
            'es': 'Spanish',
        };

        try {
            const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + state.apiKey, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: `Translate this text to ${languageMap[state.selectedLanguage]}. Return ONLY the translation, nothing else:\n\n${text}`
                        }]
                    }]
                })
            });

            const data = await response.json();
            return data.candidates?.[0]?.content?.parts?.[0]?.text || text;
        } catch (error) {
            console.error('Translation error:', error);
            return text;
        }
    }
}

// ─────────────────────────────────────────────────────
// VOICE CONTROL
// ─────────────────────────────────────────────────────
class VoiceController {
    static init() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.warn('Speech Recognition not supported');
            StatusController.update('voice', 'UNAVAILABLE', 'st-offline');
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
        this.recognition.lang = 'en-US';

        this.recognition.onstart = () => {
            state.voiceActive = true;
            dom.voiceOverlay.classList.remove('hidden');
            dom.btnVoice.classList.add('is-active');
            StatusController.update('voice', 'LISTENING', 'st-active');
        };

        this.recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript.toLowerCase();
            this.processCommand(transcript);
        };

        this.recognition.onend = () => {
            state.voiceActive = false;
            dom.voiceOverlay.classList.add('hidden');
            dom.btnVoice.classList.remove('is-active');
            StatusController.update('voice', 'STANDBY', 'st-online');
        };

        this.recognition.onerror = (event) => {
            console.error('Speech error:', event.error);
            StatusController.update('voice', 'ERROR', 'st-offline');
        };

        StatusController.update('voice', 'STANDBY', 'st-online');
    }

    static start() {
        if (this.recognition) {
            this.recognition.start();
        }
    }

    static processCommand(transcript) {
        if (transcript.includes('analyze')) {
            GeminiController.analyze(dom.camera);
        } else if (transcript.includes('translate') || transcript.includes('read')) {
            UIController.handleTranslateClick();
        } else if (transcript.includes('scan')) {
            UIController.handleScanClick();
        } else if (transcript.includes('clear')) {
            UIController.handleClearClick();
        } else {
            this.speak(`Command not recognized: ${transcript}`);
        }
    }

    static speak(text) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1;
        window.speechSynthesis.speak(utterance);
    }
}

// ─────────────────────────────────────────────────────
// GEOLOCATION & MAP
// ─────────────────────────────────────────────────────
class LocationController {
    static init() {
        if (!navigator.geolocation) {
            StatusController.update('gps', 'UNAVAILABLE', 'st-offline');
            return;
        }

        this.initMap();
        this.getLocation();
    }

    static initMap() {
        state.map = L.map('minimap').setView([17.3850, 78.4867], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap',
            maxZoom: 19,
        }).addTo(state.map);

        this.marker = null;
    }

    static getLocation() {
        navigator.geolocation.watchPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                state.currentLocation = { latitude, longitude };

                dom.hpCoords.textContent = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
                dom.mapFooter.textContent = `📍 GPS ACTIVE • Accuracy: ${Math.round(position.coords.accuracy)}m`;

                // Update map
                if (state.map) {
                    state.map.setView([latitude, longitude], 15);
                    if (this.marker) {
                        this.marker.setLatLng([latitude, longitude]);
                    } else {
                        this.marker = L.marker([latitude, longitude], {
                            icon: L.icon({
                                iconUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2224%22 height=%2224%22 viewBox=%220 0 24 24%22%3E%3Ccircle cx=%2212%22 cy=%2212%22 r=%229%22 fill=%22%2300eaff%22 opacity=%220.8%22/%3E%3Ccircle cx=%2212%22 cy=%2212%22 r=%224%22 fill=%22%2300eaff%22/%3E%3C/svg%3E',
                                iconSize: [24, 24],
                                iconAnchor: [12, 12],
                            })
                        }).addTo(state.map);
                    }
                }

                StatusController.update('gps', 'ONLINE', 'st-online');
            },
            (error) => {
                console.error('Geolocation error:', error);
                StatusController.update('gps', 'ERROR', 'st-offline');
            },
            { enableHighAccuracy: true }
        );
    }
}

// ─────────────────────────────────────────────────────
// RADAR VISUALIZATION
// ─────────────────────────────────────────────────────
class RadarController {
    static update(predictions) {
        const canvas = dom.radarCanvas;
        const ctx = canvas.getContext('2d');

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#00eaff';

        // Normalize positions to radar
        predictions.forEach((pred) => {
            const [x, y, w, h] = pred.bbox;
            const centerX = (x + w / 2) / dom.camera.videoWidth;
            const centerY = (y + h / 2) / dom.camera.videoHeight;

            const radarX = centerX * canvas.width;
            const radarY = centerY * canvas.height;

            ctx.fillRect(radarX - 2, radarY - 2, 4, 4);
        });

        const detectedCount = predictions.length;
        document.getElementById('radar-label').textContent = `${detectedCount} TARGETS TRACKED`;
    }
}

// ─────────────────────────────────────────────────────
// STATUS CONTROLLER
// ─────────────────────────────────────────────────────
class StatusController {
    static update(system, status, className = '') {
        const element = dom.statusTexts[system];
        if (element) {
            element.textContent = status;
            element.className = 'sg-val ' + className;
        }
    }
}

// ─────────────────────────────────────────────────────
// UI CONTROLLER
// ─────────────────────────────────────────────────────
class UIController {
    static initEventListeners() {
        // API Modal
        document.getElementById('confirm-api').addEventListener('click', () => this.confirmAPI());
        document.getElementById('skip-api').addEventListener('click', () => this.skipAPI());

        // Control buttons
        dom.btnAnalyze.addEventListener('click', () => this.handleAnalyzeClick());
        dom.btnTranslate.addEventListener('click', () => this.handleTranslateClick());
        dom.btnScan.addEventListener('click', () => this.handleScanClick());
        dom.btnVoice.addEventListener('click', () => this.handleVoiceClick());
        dom.btnClear.addEventListener('click', () => this.handleClearClick());
        dom.settingsBtn.addEventListener('click', () => this.showSettings());

        // Language selector
        dom.langButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                dom.langButtons.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                state.selectedLanguage = e.target.dataset.lang;
            });
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key.toLowerCase() === 'a') this.handleAnalyzeClick();
            if (e.key.toLowerCase() === 't') this.handleTranslateClick();
            if (e.key.toLowerCase() === 's') this.handleScanClick();
            if (e.key.toLowerCase() === 'v') this.handleVoiceClick();
            if (e.key.toLowerCase() === 'c') this.handleClearClick();
        });
    }

    static confirmAPI() {
        const key = document.getElementById('api-key-input').value.trim();
        if (!key) {
            AlertController.show('Please enter a valid API key');
            return;
        }
        state.apiKey = key;
        localStorage.setItem('gemini_api_key', key);
        this.startApp();
    }

    static skipAPI() {
        AlertController.show('Limited mode: Analysis features disabled');
        this.startApp();
    }

    static async startApp() {
        dom.apiModal.classList.add('hidden');
        dom.app.classList.remove('hidden');

        // Initialize all systems
        await this.initSystems();
    }

    static async initSystems() {
        StatusController.update('camera', 'INIT', 'st-loading');
        CameraController.init();

        // Load detection model
        try {
            StatusController.update('objdet', 'LOADING', 'st-loading');
            state.detectionModel = await cocoSsd.load();
            StatusController.update('objdet', 'ONLINE', 'st-online');
        } catch (error) {
            console.error('Model load error:', error);
            StatusController.update('objdet', 'ERROR', 'st-offline');
        }

        // Initialize voice
        VoiceController.init();

        // Initialize location
        LocationController.init();

        // Set main status
        dom.mainStatus.textContent = 'ACTIVE';
    }

    static handleAnalyzeClick() {
        dom.btnAnalyze.classList.add('is-active');
        GeminiController.analyze(dom.camera);
        setTimeout(() => dom.btnAnalyze.classList.remove('is-active'), 200);
    }

    static async handleTranslateClick() {
        dom.btnTranslate.classList.add('is-active');
        UIController.showTypingDots(true);

        try {
            const text = await OCRController.extractText(dom.camera);
            if (text) {
                const translated = await OCRController.translateText(text);
                UIController.displayAnalysis(`📖 EXTRACTED TEXT\n\n${text}\n\n🌐 TRANSLATED\n\n${translated}`);
                VoiceController.speak(translated);
            }
        } catch (error) {
            AlertController.show('Translation failed');
        } finally {
            UIController.showTypingDots(false);
            dom.btnTranslate.classList.remove('is-active');
        }
    }

    static handleScanClick() {
        dom.btnScan.classList.add('is-active');
        dom.scanFlash.classList.add('flash');
        dom.scanSweep.classList.add('sweeping');

        setTimeout(() => {
            dom.scanFlash.classList.remove('flash');
            dom.scanSweep.classList.remove('sweeping');
            dom.btnScan.classList.remove('is-active');
        }, 900);

        // Optional: Perform analysis on scan
        GeminiController.analyze(dom.camera);
    }

    static handleVoiceClick() {
        if (state.voiceActive) {
            VoiceController.recognition?.stop();
        } else {
            VoiceController.start();
        }
    }

    static handleClearClick() {
        dom.analysisContent.innerHTML = `
            <div class="analysis-idle">
                <div class="ai-pulse">
                    <div class="aip-ring r1"></div>
                    <div class="aip-ring r2"></div>
                    <div class="aip-center">◎</div>
                </div>
                <p class="ai-text">IRIS ACTIVE<br><span>Use controls below to interact</span></p>
            </div>
        `;
        state.lastAnalysis = null;
    }

    static displayAnalysis(text) {
        const html = `
            <div class="result-anim">
                <div class="a-tag">⬡ IRIS ANALYSIS</div>
                <div class="a-body">${text.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</div>
            </div>
        `;
        dom.analysisContent.innerHTML = html;
    }

    static showTypingDots(show) {
        dom.typingDots.classList.toggle('hidden', !show);
    }

    static showSettings() {
        const key = prompt('Enter Gemini API Key:', state.apiKey);
        if (key) {
            state.apiKey = key;
            localStorage.setItem('gemini_api_key', key);
            AlertController.show('API key updated');
        }
    }
}

// ─────────────────────────────────────────────────────
// ALERT CONTROLLER
// ─────────────────────────────────────────────────────
class AlertController {
    static show(message) {
        const alert = document.createElement('div');
        alert.style.cssText = `
            position: fixed;
            bottom: 120px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(255, 80, 80, 0.15);
            border: 1px solid rgba(255, 80, 80, 0.4);
            color: #ff6060;
            padding: 12px 20px;
            border-radius: 2px;
            font-family: 'Share Tech Mono', monospace;
            font-size: 11px;
            z-index: 100;
            animation: fadeUp 0.4s ease-out;
        `;
        alert.textContent = '⚠ ' + message;
        document.body.appendChild(alert);

        setTimeout(() => {
            alert.style.opacity = '0';
            alert.style.transition = 'opacity 0.4s';
            setTimeout(() => alert.remove(), 400);
        }, 3000);
    }
}

// ─────────────────────────────────────────────────────
// INITIALIZE ON LOAD
// ─────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
    const boot = new BootSequence();
    await boot.run();
});

// Cleanup on unload
window.addEventListener('beforeunload', () => {
    if (state.animationFrameId) {
        cancelAnimationFrame(state.animationFrameId);
    }
});
