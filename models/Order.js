const mongoose = require("mongoose");

// Sous-schéma pour un article de commande
const orderItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    imageUrl: { type: String },
    quantity: { type: Number, required: true }
  },
  { _id: false } // Pas d'_id pour chaque article
);

// Sous-schéma pour l'adresse de livraison
const shippingAddressSchema = new mongoose.Schema(
  {
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String },
    postalCode: { type: String, required: true },
    country: { type: String, required: true }
  },
  { _id: false }
);

// Schéma complet de la commande
const orderSchema = new mongoose.Schema(
  {
    // Optionnel : référence à l'utilisateur si applicable
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    // Coordonnées du client
    email: { type: String, required: true },
    phoneNumber: { type: String, required: true },

    // Adresse de livraison détaillée
    shippingAddress: { type: shippingAddressSchema, required: true },

    // Liste des articles commandés
    orderItems: { type: [orderItemSchema], required: true },

    // Mode de paiement par défaut : Paiement à la livraison
    paymentMethod: { type: String, default: "Paiement à la livraison" },

    // Indicateur pour savoir si le paiement a été collecté lors de la livraison
    paymentCollected: { type: Boolean, default: false },
    collectedAt: { type: Date },

    // Détails du coût de la commande
    itemsPrice: { type: Number, required: true, default: 0.0 },
    taxPrice: { type: Number, required: true, default: 0.0 },
    shippingPrice: { type: Number, required: true, default: 0.0 },
    totalPrice: { type: Number, required: true, default: 0.0 },

    // Suivi du statut de la commande
    orderStatus: {
      type: String,
      enum: ["Pending", "Processing", "Out for Delivery", "Delivered", "Cancelled"],
      default: "Pending"
    },
    deliveredAt: { type: Date }
  },
  { timestamps: true } // Ajoute automatiquement createdAt et updatedAt
);

module.exports = mongoose.models.Order || mongoose.model("Order", orderSchema);