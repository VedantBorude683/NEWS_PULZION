const cron = require('node-cron');
const axios = require('axios');
const CachedArticle = require('../models/CachedArticle'); // Import our new model

const NEWS_API_KEY = process.env.NEWS_API_KEY;
const NEWS_API_BASE_URL = 'https://newsapi.org/v2/top-headlines';
const CATEGORIES = ['general', 'business', 'technology', 'entertainment', 'health', 'science', 'sports'];

/**
 * Helper function to add a simple delay
 */
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fetches news for a specific category and saves new articles to the DB.
 */
const fetchAndCacheNews = async (category) => {
  console.log(`[Cache Service] Fetching news for category: ${category}`);
  try {
    const response = await axios.get(NEWS_API_BASE_URL, {
      params: {
        category: category,
        language: 'en',
        country: 'us', // Default to 'us' for general caching
        apiKey: NEWS_API_KEY,
        pageSize: 40 // Get a good batch to check
      },
    });

    const articles = response.data.articles;
    if (!articles || articles.length === 0) {
      console.log(`[Cache Service] No articles found for ${category}.`);
      return;
    }

    const articlesToCache = articles.map(article => ({
      ...article,
      category: category,
    }));

    await CachedArticle.insertMany(articlesToCache, { ordered: false });
    
    console.log(`[Cache Service] Successfully checked/updated ${category}.`);

  } catch (error) {
    if (error.code === 11000) {
      console.log(`[Cache Service] Finished ${category} with some duplicates (which is normal).`);
    } else {
      console.error(`[Cache Service] Error fetching for ${category}:`, error.message);
    }
  }
};

/**
 * Starts the cron job to update the cache.
 */
const startCacheService = () => {
  console.log('📰 [Cache Service] Starting news cache service...');
  
  // Cron job: "at minute 0 and 30 past every hour"
  cron.schedule('0,30 * * * *', async () => {
    console.log('⏰ [Cron Job] Running scheduled cache update...');
    
    // [MODIFIED] Fetch all categories one by one, with a delay
    for (const category of CATEGORIES) {
      await fetchAndCacheNews(category);
      await wait(5000); // <-- Wait 5 seconds before next call
    }
    
    console.log('⏰ [Cron Job] Cache update finished.');
  });

  // [MODIFIED] Run it once immediately on server start, with a delay
  (async () => {
    console.log('[Cache Service] Running initial cache fill on startup...');
    for (const category of CATEGORIES) {
      await fetchAndCacheNews(category);
      await wait(5000); // <-- Wait 5 seconds before next call
    }
    console.log('[Cache Service] Initial cache fill finished.');
  })();
};

module.exports = { startCacheService };