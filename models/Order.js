const mongoose = require("mongoose");

// Sous-schema pour les produits commandés
const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    description: { type: String, trim: true },
    imageUrl: { type: String, trim: true },
    sellerEmail: { type: String, required: true, lowercase: true, trim: true },
    quantity: { type: Number, required: true, min: 1, default: 1 },
    addedAt: { type: Date, default: Date.now }
  }
);

// Schema complet de la commande
const orderSchema = new mongoose.Schema(
  {
    customerName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phoneNumber: { type: String, required: true, trim: true },
    shippingAddress: { type: String, required: true, trim: true },
    products: { type: [productSchema], required: true }, // Adapté pour plusieurs produits
    orderStatus: {
      type: String,
      enum: ["Commande en préparation", "Expédiée", "Livrée", "Annulée"],
      default: "Commande en préparation"
    },
    paymentStatus: {
      type: String,
      enum: ["Non payé", "Payé", "Remboursé"],
      default: "Non payé"
    },
    shippingCost: { type: Number, default: 0, min: 0 },
    trackingNumber: { type: String, trim: true },
    notes: { type: String, trim: true }
  },
  {
    timestamps: true // Ajoute automatiquement createdAt et updatedAt
  }
);

module.exports = mongoose.model("Order", orderSchema);
