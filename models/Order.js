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
    size: { type: String, trim: true }, // Gestion de la taille, si applicable
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
    products: { type: [productSchema], required: true }, // Liste des produits commandés
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
    notes: { type: String, trim: true }, // Notes supplémentaires pour la commande
    confirmationCode: { type: String, trim: true }, // Pour la confirmation client ou vendeur
  },
  {
    timestamps: true // Ajoute automatiquement createdAt et updatedAt
  }
);

// Hook pre-save pour loguer avant la sauvegarde
orderSchema.pre("save", function (next) {
  console.log("Pré-sauvegarde de la commande :", this);
  next();
});

// Hook post-save pour loguer après la sauvegarde
orderSchema.post("save", function (doc, next) {
  console.log("Commande sauvegardée avec succès :", doc);
  next();
});

// Fonctionnalités supplémentaires intégrées au modèle
orderSchema.methods.addTrackingNumber = function (trackingNumber) {
  this.trackingNumber = trackingNumber;
  console.log("Numéro de suivi ajouté :", trackingNumber);
};

module.exports = mongoose.model("Order", orderSchema);