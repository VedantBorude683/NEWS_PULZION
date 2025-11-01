const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth'); // Import auth middleware
const {
  getSubscriptionStatus,
  updateSubscriptionStatus,
  updateUserPreferences,
  subscribeToPush,       // <-- [NEW] Import this
  sendTestNotification   // <-- [NEW] And this
} = require('../controllers/user'); // Import controller functions

// --- Protected User Routes ---

// GET /api/user/subscription-status
// Gets the logged-in user's current newsletter subscription status
router.get('/subscription-status', authMiddleware, getSubscriptionStatus);

// PUT /api/user/subscription-status
// Updates the logged-in user's newsletter subscription status
// Expects JSON body: { "isSubscribed": boolean }
router.put('/subscription-status', authMiddleware, updateSubscriptionStatus);

// POST /api/user/preferences (Onboarding)
router.post('/preferences', authMiddleware, updateUserPreferences);

// --- [NEW] Web Push Routes ---

// @route   POST /api/user/subscribe
// @desc    Saves the user's push notification subscription object
// @access  Private
router.post('/subscribe', authMiddleware, subscribeToPush);

// @route   POST /api/user/test-push
// @desc    Sends a test notification to the user
// @access  Private
router.post('/test-push', authMiddleware, sendTestNotification);

module.exports = router;