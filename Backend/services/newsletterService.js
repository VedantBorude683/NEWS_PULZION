// --- VERY IMPORTANT: Ensure this is at the TOP ---
const fetch = require('node-fetch');
// --- Other requires ---
const nodemailer = require('nodemailer');
const cron = require('node-cron');
const User = require('../models/User'); // Adjust path if needed (e.g., ../models/User)
require('dotenv').config();

// --- Nodemailer Setup ---
let transporter;
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    try {
        transporter = nodemailer.createTransport({
            service: process.env.EMAIL_SERVICE || 'gmail',
            auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
        });
        console.log('Nodemailer transporter configured successfully.');
    } catch (error) {
        console.error('Failed to create Nodemailer transporter:', error);
        transporter = null;
    }
} else {
    console.warn('Email credentials (EMAIL_USER, EMAIL_PASS) not found in .env. Newsletter service will be disabled.');
    transporter = null;
}

// --- Fetch Top Headlines ---
async function getTopHeadlines(category = 'general', country = 'us') {
  const NEWS_API_URL_TOP = 'https://newsapi.org/v2/top-headlines';
  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey) {
    console.error('[Newsletter] NEWS_API_KEY is missing in .env.');
    return [];
  }

  try {
    const url = `${NEWS_API_URL_TOP}?country=${country}&category=${category}&pageSize=5&apiKey=${apiKey}&language=en`;
    // --- THIS LINE USES fetch ---
    const response = await fetch(url);
    // --- ---
    if (!response.ok) {
       const errorData = await response.json().catch(() => ({}));
       throw new Error(`NewsAPI error: ${errorData.message || response.statusText} (${response.status})`);
    }
    const data = await response.json();
    if (data.status === 'ok' && data.articles) {
      console.log(`[Newsletter] Fetched ${data.articles.length} headlines.`);
      return data.articles.filter(a => a.title && a.title !== '[Removed]' && a.url);
    } else {
      console.error('[Newsletter] NewsAPI did not return status ok:', data);
      return [];
    }
  } catch (error) {
    console.error('[Newsletter] Error fetching headlines:', error.message); // Log only the message for clarity
    return [];
  }
}

// --- Format Email Content ---
function formatEmailBody(headlines) {
    if (!headlines || headlines.length === 0) {
      return '<p>No top headlines found today. Check back tomorrow!</p>';
    }
    let body = `<h1 style="color: #362E6F;">Top Headlines - ${new Date().toLocaleDateString()}</h1><ul style="list-style: none; padding: 0;">`;
    headlines.forEach(article => {
      body += `
        <li style="margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #eee;">
          <strong style="font-size: 1.1em; display: block; margin-bottom: 5px;">
            <a href="${article.url}" target="_blank" style="text-decoration: none; color: #362E6F;">${article.title}</a>
          </strong>
          <span style="color: #5F6368; font-size: 0.9em;">Source: ${article.source.name}</span>
          ${article.description ? `<p style="margin-top: 8px; font-size: 0.95em; color: #333; line-height: 1.5;">${article.description}</p>` : ''}
        </li>
      `;
    });
    body += '</ul><p style="margin-top: 25px; font-size: 0.8em; color: #888; text-align: center;">You are receiving this because you subscribed to the NewsPulse Daily Digest. Visit your profile settings on the website to unsubscribe.</p>';
    return `<html><head><style>body { font-family: Poppins, sans-serif; }</style></head><body><div style="max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">${body}</div></body></html>`;
}

// --- Send Newsletter Function ---
async function sendNewsletter() {
    if (!transporter) { console.error('[Newsletter] Cannot send: Email transporter not configured.'); return; }
    console.log(`[${new Date().toISOString()}] Running newsletter task (every minute)...`); // Indicate test frequency
    try {
        const subscribers = await User.find({ isSubscribedToNewsletter: true }).select('email');
        if (subscribers.length === 0) { console.log('[Newsletter] No subscribers found. Skipping.'); return; }
        const recipientEmails = subscribers.map(sub => sub.email);
        console.log(`[Newsletter] Found ${recipientEmails.length} subscribers.`);
        const headlines = await getTopHeadlines('general', 'us'); // Now fetch should work
        if (headlines.length === 0) { console.log('[Newsletter] No headlines fetched. Skipping sending.'); return; }
        const emailBody = formatEmailBody(headlines);
        const subject = `[TEST] NewsPulse Digest - ${new Date().toLocaleTimeString()}`; // Test subject
        console.log(`[Newsletter] Attempting to send test newsletter...`);
        const mailOptions = {
            from: `"NewsPulse Digest (Test)" <${process.env.EMAIL_USER}>`,
            //to: 'vedantborude77@gmail.com', // <-- HARDCODED test email
            bcc: recipientEmails, // Commented out for testing
            subject: subject, html: emailBody,
        };
        transporter.sendMail(mailOptions, (error, info) => {
             if (error) { return console.error('[Newsletter] Error sending test email:', error.message); }
             console.log('[Newsletter] Test email sent successfully! Message ID:', info.messageId);
        });
    } catch (error) { console.error('[Newsletter] Error in sendNewsletter function:', error); }
}

// --- Schedule the Task ---
function scheduleNewsletter() {
    if (!transporter) { console.warn('[Scheduler] Newsletter scheduling skipped...'); return; }
    // --- CRON SCHEDULE FOR TESTING ---
    const scheduleTime = '* * * * *'; // Runs Every Minute
    // const scheduleTime = '0 8 * * *'; // Original: 8:00 AM Daily
    // ---------------------------------
    if (cron.validate(scheduleTime)) {
        cron.schedule(scheduleTime, () => { console.log(`[Scheduler] Triggering scheduled newsletter send (every minute) at ${new Date().toISOString()}`); sendNewsletter(); }, { scheduled: true, timezone: "Asia/Kolkata" });
        console.log(`[Scheduler] Newsletter job scheduled: ${scheduleTime} (Timezone: Asia/Kolkata)`);
    } else { console.error('[Scheduler] Invalid cron schedule:', scheduleTime); }
}

module.exports = { scheduleNewsletter, sendNewsletter };