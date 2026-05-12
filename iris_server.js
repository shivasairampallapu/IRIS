/* ═══════════════════════════════════════════════════════
   IRIS VISION AI — iris-server.js
   Optional Express Backend (Production)
   
   Use this for:
   - Hiding API keys
   - Rate limiting
   - Caching results
   - Authentication
═══════════════════════════════════════════════════════ */

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

const app = express();

// ─────────────────────────────────────────────────────
// MIDDLEWARE
// ─────────────────────────────────────────────────────

// CORS - Allow requests from IRIS frontend
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:8000'],
    credentials: true
}));

// Parse JSON
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiting
const analysisLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 20, // 20 requests per minute per IP
    message: 'Too many requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
});

const voiceLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    skip: (req) => req.path !== '/api/voice'
});

// ─────────────────────────────────────────────────────
// HEALTH CHECK
// ─────────────────────────────────────────────────────
app.get('/health', (req, res) => {
    res.json({
        status: 'IRIS Systems Online',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        geminiConfigured: !!process.env.GEMINI_API_KEY
    });
});

// ─────────────────────────────────────────────────────
// GEMINI VISION ANALYSIS ENDPOINT
// ─────────────────────────────────────────────────────
app.post('/api/analyze', analysisLimiter, async (req, res) => {
    try {
        const { imageBase64, prompt } = req.body;

        if (!imageBase64) {
            return res.status(400).json({ error: 'Image required' });
        }

        if (!process.env.GEMINI_API_KEY) {
            return res.status(503).json({ error: 'Gemini API not configured' });
        }

        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
            {
                contents: [{
                    parts: [
                        {
                            inline_data: {
                                mime_type: 'image/jpeg',
                                data: imageBase64,
                            }
                        },
                        {
                            text: prompt || `You are IRIS, a futuristic AI vision assistant. Analyze this image and provide:
1. Location/Place identification
2. Key landmarks or objects visible
3. Historical or cultural significance
4. Travel tips if applicable
5. Safety information
Be concise but informative. Format with bullet points.`
                        }
                    ]
                }]
            },
            {
                timeout: 30000,
                headers: { 'Content-Type': 'application/json' }
            }
        );

        const analysisText = response.data.candidates?.[0]?.content?.parts?.[0]?.text;

        res.json({
            success: true,
            analysis: analysisText,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Analysis error:', error.message);
        
        if (error.response?.status === 429) {
            return res.status(429).json({ error: 'API rate limited, try again later' });
        }
        
        res.status(500).json({
            error: 'Analysis failed',
            message: error.message
        });
    }
});

// ─────────────────────────────────────────────────────
// TRANSLATION ENDPOINT
// ─────────────────────────────────────────────────────
app.post('/api/translate', analysisLimiter, async (req, res) => {
    try {
        const { text, targetLanguage } = req.body;

        if (!text || !targetLanguage) {
            return res.status(400).json({ error: 'Text and language required' });
        }

        if (!process.env.GEMINI_API_KEY) {
            return res.status(503).json({ error: 'Gemini API not configured' });
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

        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
            {
                contents: [{
                    parts: [{
                        text: `Translate this text to ${languageMap[targetLanguage] || targetLanguage}. Return ONLY the translation, nothing else:\n\n${text}`
                    }]
                }]
            },
            { timeout: 15000 }
        );

        const translatedText = response.data.candidates?.[0]?.content?.parts?.[0]?.text;

        res.json({
            success: true,
            original: text,
            translated: translatedText,
            targetLanguage: targetLanguage,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Translation error:', error.message);
        res.status(500).json({
            error: 'Translation failed',
            message: error.message
        });
    }
});

// ─────────────────────────────────────────────────────
// VOICE PROCESSING ENDPOINT
// ─────────────────────────────────────────────────────
app.post('/api/voice', voiceLimiter, async (req, res) => {
    try {
        const { transcript, command } = req.body;

        if (!transcript) {
            return res.status(400).json({ error: 'Transcript required' });
        }

        // Process voice command
        const response = {
            success: true,
            transcript: transcript,
            detectedCommand: command,
            action: null,
            response: null
        };

        if (transcript.includes('analyze')) {
            response.action = 'analyze';
            response.response = 'Starting visual analysis...';
        } else if (transcript.includes('translate') || transcript.includes('read')) {
            response.action = 'translate';
            response.response = 'Extracting and translating text...';
        } else if (transcript.includes('scan')) {
            response.action = 'scan';
            response.response = 'Performing full environment scan...';
        } else if (transcript.includes('location') || transcript.includes('where')) {
            response.action = 'location';
            response.response = 'Acquiring GPS coordinates...';
        } else {
            response.action = 'unknown';
            response.response = 'Command not recognized';
        }

        res.json(response);

    } catch (error) {
        console.error('Voice processing error:', error.message);
        res.status(500).json({
            error: 'Voice processing failed',
            message: error.message
        });
    }
});

// ─────────────────────────────────────────────────────
// LOCATION ENRICHMENT ENDPOINT
// ─────────────────────────────────────────────────────
app.post('/api/location', async (req, res) => {
    try {
        const { latitude, longitude } = req.body;

        if (!latitude || !longitude) {
            return res.status(400).json({ error: 'Coordinates required' });
        }

        // You can integrate with services like:
        // - OpenWeatherMap API
        // - Overpass API
        // - Google Places API
        // - Nominatim reverse geocoding

        // For now, return basic info
        const response = {
            success: true,
            coordinates: { latitude, longitude },
            timestamp: new Date().toISOString(),
            // Add more data from external APIs here
        };

        res.json(response);

    } catch (error) {
        console.error('Location error:', error.message);
        res.status(500).json({
            error: 'Location enrichment failed',
            message: error.message
        });
    }
});

// ─────────────────────────────────────────────────────
// STATS ENDPOINT
// ─────────────────────────────────────────────────────
app.get('/api/stats', (req, res) => {
    res.json({
        serverTime: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        version: '4.7.2',
    });
});

// ─────────────────────────────────────────────────────
// ERROR HANDLING
// ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Endpoint not found',
        path: req.path,
        method: req.method
    });
});

// ─────────────────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════╗
║    IRIS Vision AI Backend Server Started             ║
╠═══════════════════════════════════════════════════════╣
║  Server: http://localhost:${PORT}                     ║
║  Health: http://localhost:${PORT}/health              ║
║  Env: ${process.env.NODE_ENV || 'development'}${' '.repeat(40)}║
╚═══════════════════════════════════════════════════════╝
    `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    process.exit(0);
});

module.exports = app;