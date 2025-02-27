const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  date: { type: Date, default: Date.now },
  vendor: { type: String, required: true },
  vendorEmail: { type: String, required: true }, // Email du vendeur
  isActive: { type: Boolean, default: true }
});

module.exports = mongoose.model('Product', productSchema);