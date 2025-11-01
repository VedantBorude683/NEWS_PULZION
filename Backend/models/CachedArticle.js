// models/CachedArticle.js (Complete New File)

const mongoose = require('mongoose');

const CachedArticleSchema = new mongoose.Schema({
  // We're saving the article data exactly as it comes from NewsAPI
  source: {
    id: { type: String },
    name: { type: String }
  },
  author: { type: String },
  title: { type: String },
  description: { type: String },
  url: {
    type: String,
    required: true,
    unique: true // This is the magic. We can't save the same article twice.
  },
  urlToImage: { type: String },
  publishedAt: {
    type: Date,
    index: true // Add an index so we can sort by date quickly
  },
  content: { type: String },
  
  // Our custom field
  category: {
    type: String,
    required: true,
    index: true // Add an index so we can query by category quickly
  }
});
CachedArticleSchema.index({ title: 'text', description: 'text', content: 'text' });
module.exports = mongoose.model('CachedArticle', CachedArticleSchema);