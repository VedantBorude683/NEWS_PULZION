const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db'); // Using your path
const path = require('path');
const { scheduleNewsletter } = require('./services/newsletterService');
const { startCacheService } = require('./services/cacheService'); // Import the cache service
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const webpush = require('web-push');

// Load env variables - Make sure this is at the top
dotenv.config({ path: path.resolve(__dirname, './.env') });

const app = express(); // Initialize express app

// --- [NEW] Main Server Start Function ---
// We wrap the startup in an async function to control the order
const startServer = async () => {
  try {
    // --- 1. CONNECT TO MONGO FIRST ---
    await connectDB();
    console.log("MongoDB Connected... (from server.js)");

    // --- 2. CONFIGURE WEB PUSH (after .env is loaded) ---
    const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
    const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

    if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY && process.env.EMAIL_USER) {
      webpush.setVapidDetails(
        `mailto:${process.env.EMAIL_USER}`,
        VAPID_PUBLIC_KEY,
        VAPID_PRIVATE_KEY
      );
      console.log("Web Push configured successfully.");
    } else {
      console.warn("VAPID keys or EMAIL_USER not found. Web Push will not work.");
    }

    // --- 3. APPLY MIDDLEWARE ---
    app.use(cors());
    app.use(express.json());

    // --- 4. DEFINE API ROUTES ---
    app.use('/api/auth', require('./routes/auth'));
    app.use('/api/user', require('./routes/user'));
    app.use('/api/news', require('./routes/news'));

    // --- 5. DEFINE AI & STATIC ROUTES ---
    const frontendPath = path.join(__dirname, '..', 'Frontend');
    app.use(express.static(frontendPath));

    // --- AI News Summarizer Route (Your existing code) ---
    app.post("/api/summarize", async (req, res) => {
      const { content } = req.body;
      if (!content) {
        return res.status(400).json({ error: "No content provided" });
      }
      try {
        const response = await fetch(
          "https://router.huggingface.co/hf-inference/models/facebook/bart-large-cnn",
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${process.env.HF_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ inputs: content }),
          }
        );
        const data = await response.json();
        if (data.error) {
          if (data.error.includes("loading")) {
            await new Promise((resolve) => setTimeout(resolve, 5000)); 
            return res.json({ summary: "Model is warming up, please retry in a few seconds." });
          }
          return res.json({ summary: "Summary unavailable." });
        }
        const summary = data[0]?.summary_text;
        if (!summary) {
          return res.json({ summary: "Summary unavailable." });
        }
        res.json({ summary });
      } catch (err) {
        console.error("🚨 Hugging Face Summarization Error:", err);
        res.status(500).json({ error: "Summarization failed" });
      }
    });

    // --- AI Translation Route (Your existing code) ---
    app.post("/api/translate", async (req, res) => {
      const { text, targetLang } = req.body;
      if (!text || !targetLang)
        return res.status(400).json({ error: "Missing text or target language." });
      try {
        const apiUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
          text
        )}&langpair=en|${targetLang}`;
        const response = await fetch(apiUrl);
        const data = await response.json();
        if (data && data.responseData && data.responseData.translatedText) {
          res.json({ translatedText: data.responseData.translatedText });
        } else {
          res.status(500).json({ error: "Translation failed. Invalid response." });
        }
      } catch (err) {
        console.error("❌ Translation Error:", err);
        res.status(500).json({ error: "Translation service unavailable." });
      }
    });

    // --- 6. SET CATCH-ALL ROUTE ---
    app.get('/', (req, res) => { // Using '*' is more robust
      if (req.path.startsWith('/api/')) {
        return res.status(404).send('API route not found');
      }
      const indexPath = path.resolve(frontendPath, 'index.html');
      res.sendFile(indexPath, (err) => {
          if (err) {
              console.error(`Error sending index.html: ${err.message}`);
              res.status(500).send('Error loading application.');
          }
      });
    });

    // --- 7. START THE SERVER ---
    const PORT = process.env.PORT || 8080;
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);

        // --- 8. START BACKGROUND SERVICES (AFTER server is running) ---
        // These can only run now because they know the DB is connected
        if (process.env.EMAIL_USER && process.env.EMAIL_PASS && process.env.NEWS_API_KEY) {
            scheduleNewsletter();
        } else {
            console.warn('Newsletter scheduling skipped: Env vars missing.');
        }

        if (process.env.NEWS_API_KEY) {
            startCacheService(); // Start the cache update job
        } else {
            console.warn('News Cache Service skipped: NEWS_API_KEY not set.');
        }
    });

  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

// --- 9. RUN THE SERVER ---
startServer();