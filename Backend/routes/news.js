// routes/news.js (Complete, Rewritten for Caching)

const express = require('express');
const router = express.Router();
const axios = require('axios'); // Still needed for GNews
const authMiddleware = require('../middleware/auth');
const User = require('../models/User');
const CachedArticle = require('../models/CachedArticle'); // <-- [NEW] IMPORT YOUR CACHE

// --- GNews Configuration (Unchanged) ---
const GNEWS_API_KEY = process.env.GNEWS_API_KEY;
const GNEWS_BASE_URL = 'https://gnews.io/api/v4/top-headlines';

// --- Local News Route (Unchanged) ---
// This route still hits a live API, which is fine.
router.get('/local', async (req, res) => {
  const { city } = req.query;
  if (!GNEWS_API_KEY) {
    return res.status(500).json({ msg: 'Server setup error: GNews API key not found.' });
  }
  if (!city) {
    return res.status(400).json({ msg: 'City is required.' });
  }
  try {
    const params = { q: city, lang: 'en', country: 'any', max: 20, apikey: GNEWS_API_KEY };
    const response = await axios.get(GNEWS_BASE_URL, { params });
    const remappedArticles = response.data.articles.map(article => ({
      source: { name: article.source.name },
      title: article.title,
      description: article.description,
      url: article.url,
      urlToImage: article.image,
      publishedAt: article.publishedAt,
      content: article.content,
    }));
    res.json({ articles: remappedArticles });
  } catch (error) {
    console.error('GNews API Error:', error.response ? error.response.data : error.message);
    res.status(500).json({ msg: 'Failed to fetch local news.' });
  }
});

// --- [REWRITTEN] "For You" Feed Route ---
// This now reads from your cache instead of NewsAPI.
router.get('/foryou', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('preferences');

    if (!user || !user.preferences || user.preferences.length === 0) {
      return res.status(400).json({
        msg: 'No preferences set. Please complete onboarding.',
        articles: [],
      });
    }
    
    // 1. Get the user's preferences
    const categories = user.preferences;

    // 2. Query YOUR database for articles in those categories
    const articles = await CachedArticle.find({
      category: { $in: categories } // Find any article whose category is in the user's list
    })
    .sort({ publishedAt: -1 }) // Get the newest ones
    .limit(100); // Send a max of 100

    // 3. Shuffle the results
    const shuffledArticles = articles.sort(() => 0.5 - Math.random());
    
    res.json({ articles: shuffledArticles });

  } catch (error) {
    console.error('For You Feed Error (Cache):', error.message);
    res.status(500).json({ msg: 'Failed to build your feed from cache.' });
  }
});

// --- [REWRITTEN] General News & Search Route ---
// This now reads from your cache instead of NewsAPI.
router.get('/', async (req, res) => {
  const { category, q } = req.query; // 'country' is no longer supported here

  try {
    let articles;

    if (q) {
      // --- This is a SEARCH query ---
      // It uses the text index we created in the model
      articles = await CachedArticle.find(
        { $text: { $search: q } },
        { score: { $meta: "textScore" } } // Sort by relevance
      )
      .sort({ score: { $meta: "textScore" } })
      .limit(40);
    
    } else {
      // --- This is a CATEGORY query ---
      const targetCategory = category || 'general';
      articles = await CachedArticle.find({
        category: targetCategory
      })
      .sort({ publishedAt: -1 }) // Get newest first
      .limit(40);
    }
    
    // Send the articles back (in the same format as before)
    res.json({ status: 'ok', totalResults: articles.length, articles: articles });

  } catch (error) {
    console.error('General News Error (Cache):', error.message);
    res.status(500).json({ msg: 'Failed to fetch news from cache.' });
  }
});

module.exports = router;