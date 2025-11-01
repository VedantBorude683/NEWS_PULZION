const User = require('../models/User'); // Adjust path if needed
const webpush = require('web-push'); // <-- [NEW] Import web-push

// @desc    Get user's newsletter subscription status
// @route   GET /api/user/subscription-status
// @access  Private (Requires auth middleware)
exports.getSubscriptionStatus = async (req, res) => {
  try {
    // req.user.id comes from the auth middleware
    const user = await User.findById(req.user.id).select('isSubscribedToNewsletter email');
    if (!user) {
      console.warn(`User not found for ID: ${req.user.id} in getSubscriptionStatus`);
      return res.status(4404).json({ msg: 'User not found' });
    }
    console.log(`Fetched status for ${user.email}: ${user.isSubscribedToNewsletter}`);
    res.json({ isSubscribed: user.isSubscribedToNewsletter });
  } catch (err) {
    console.error('Error getting subscription status:', err.message);
    res.status(500).json({ msg: 'Server Error getting status' });
  }
};

// @desc    Update user's newsletter subscription status
// @route   PUT /api/user/subscription-status
// @access  Private (Requires auth middleware)
exports.updateSubscriptionStatus = async (req, res) => {
  const { isSubscribed } = req.body; // Expecting { isSubscribed: true/false }

  // Basic validation
  if (typeof isSubscribed !== 'boolean') {
      return res.status(400).json({ msg: 'Invalid subscription status provided (must be true or false).' });
  }

  try {
    console.log(`Updating subscription for user ${req.user.id} to ${isSubscribed}`);
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { isSubscribedToNewsletter: isSubscribed },
      { new: true, runValidators: true } // Return updated doc, run schema validators
    ).select('isSubscribedToNewsletter email'); // Only return necessary fields

    if (!user) {
      console.warn(`User not found for ID: ${req.user.id} in updateSubscriptionStatus`);
      return res.status(404).json({ msg: 'User not found' });
    }
    console.log(`Updated status for ${user.email} successfully to ${user.isSubscribedToNewsletter}`);
    res.json({
        msg: `Subscription status updated to: ${isSubscribed ? 'Subscribed' : 'Unsubscribed'}`, // More user-friendly message
        isSubscribed: user.isSubscribedToNewsletter
    });
  } catch (err) {
    console.error('Error updating subscription status:', err.message);
    res.status(500).json({ msg: 'Server Error updating status' });
  }
};

// @desc    Save/Update user's onboarding preferences
// @route   POST /api/user/preferences
// @access  Private (Requires auth middleware)
exports.updateUserPreferences = async (req, res) => {
  // Expecting a body like: { "preferences": ["technology", "sports", ...] }
  const { preferences } = req.body;

  // Basic validation
  if (!Array.isArray(preferences)) {
    return res.status(400).json({ msg: 'Preferences must be an array.' });
  }

  try {
    console.log(`Updating preferences for user ${req.user.id}`);
    
    // Find the user and update just the preferences field
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { preferences: preferences },
      { new: true, runValidators: true } // Return the updated user
    ).select('email preferences'); // Only select what we need

    if (!user) {
      console.warn(`User not found for ID: ${req.user.id} in updateUserPreferences`);
      return res.status(404).json({ msg: 'User not found' });
    }

    console.log(`Preferences saved for ${user.email}: ${user.preferences.join(', ')}`);
    res.json({ msg: 'Preferences saved successfully', preferences: user.preferences });

  } catch (err) {
    console.error('Error updating preferences:', err.message);
    res.status(500).json({ msg: 'Server Error saving preferences' });
  }
};

// --- [NEW] ---

// @desc    Subscribe user to Web Push notifications
// @route   POST /api/user/subscribe
// @access  Private
exports.subscribeToPush = async (req, res) => {
  const subscription = req.body.subscription; // Get subscription object from frontend

  if (!subscription) {
    return res.status(400).json({ msg: 'Subscription object required.' });
  }

  try {
    // Save the subscription object to the user's document
    await User.findByIdAndUpdate(req.user.id, { pushSubscription: subscription });

    console.log(`Push subscription saved for user: ${req.user.id}`);
    res.status(201).json({ msg: 'Push subscription saved.' });
  } catch (err) {
    console.error('Error saving push subscription:', err);
    res.status(500).json({ msg: 'Server error saving subscription.' });
  }
};

// @desc    Send a test push notification
// @route   POST /api/user/test-push
// @access  Private
exports.sendTestNotification = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('pushSubscription');

    if (!user || !user.pushSubscription) {
      return res.status(404).json({ msg: 'User or push subscription not found.' });
    }

    const subscription = user.pushSubscription;
    const payload = JSON.stringify({
      title: 'NewsPulse Test Notification',
      body: 'Success! Your push notifications are working.',
    });

    // Send the notification
    await webpush.sendNotification(subscription, payload);
    
    res.status(200).json({ msg: 'Test notification sent!' });

  } catch (err) {
    console.error('Error sending push:', err);
    
    // If a subscription is expired or invalid, the push service returns an error.
    // A 410 (Gone) or 404 (Not Found) means the subscription is bad and we should delete it.
    if (err.statusCode === 410 || err.statusCode === 404) {
      console.log(`Subscription for user ${req.user.id} is invalid, removing.`);
      await User.findByIdAndUpdate(req.user.id, { pushSubscription: null });
    }
    
    res.status(5.0).json({ msg: 'Server error sending notification.' });
  }
};