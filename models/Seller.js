const mongoose = require('mongoose');

// Sous-schéma pour les avis sur le vendeur
const sellerReviewSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rating: { type: Number, min: 1, max: 5, required: true },
  comment: { type: String },
  createdAt: { type: Date, default: Date.now }
});

// Schéma complet du vendeur
const sellerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  storeName: { type: String, required: true },
  storeDescription: { type: String },
  phone: { type: String },
  address: {
    street: { type: String },
    city: { type: String },
    state: { type: String },
    zip: { type: String },
    country: { type: String }
  },
  profileImage: { type: String },
  verified: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  rating: { type: Number, default: 0 },
  reviews: [sellerReviewSchema],
  socialLinks: {
    facebook: { type: String },
    twitter: { type: String },
    instagram: { type: String },
    website: { type: String }
  }
}, { timestamps: true });

module.exports = mongoose.models.Seller || mongoose.model('Seller', sellerSchema);