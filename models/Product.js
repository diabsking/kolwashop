// models/Product.js
const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  sellerEmail: { type: String, required: true },
  productName: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, required: true },
  deliveryTime: { type: String, required: true },
  imageUrl: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },

  // Nouveaux champs pour calculer la popularité
  views: { type: Number, default: 0 }, // Nombre de vues
  addToCart: { type: Number, default: 0 }, // Nombre d'ajouts au panier
  orders: { type: Number, default: 0 }, // Nombre de commandes
  publicationDate: { type: Date, default: Date.now } // Date de publication du produit
});

module.exports = mongoose.model("Product", productSchema);