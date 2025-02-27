const mongoose = require("mongoose");

// Définition d'un sous-schema pour le produit
const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    price: { type: Number, required: true },
    description: { type: String },
    imageUrl: { type: String },
    sellerEmail: { type: String, required: true },
    quantity: { type: Number, required: true }
  },
  { _id: false } // Désactivation de _id pour ce sous-document
);

// Schema de la commande
const orderSchema = new mongoose.Schema({
  email: { type: String, required: true },         // Adresse e-mail du client
  phoneNumber: { type: String, required: true },     // Numéro de téléphone du client
  address: { type: String, required: true },         // Adresse de livraison
  product: { type: productSchema, required: true },  // Détails du produit commandé
  status: { type: String, default: "Commande en préparation" }, // Statut de la commande
  orderDate: { type: Date, default: Date.now }       // Date de la commande
});

module.exports = mongoose.model("Order", orderSchema);