const mongoose = require('mongoose');

// Définir le schéma du modèle
const sellerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  storeName: { type: String, required: true },
  verified: { type: Boolean, default: false },
}, { timestamps: true });

// Créer le modèle `Seller`, en s'assurant qu'il n'est pas redéclaré
module.exports = mongoose.models.Seller || mongoose.model('Seller', sellerSchema);