const mongoose = require("mongoose");

// Sous-schéma pour une adresse
const addressSchema = new mongoose.Schema(
  {
    street: { type: String },
    city: { type: String },
    state: { type: String },
    postalCode: { type: String },
    country: { type: String }
  },
  { _id: false }
);

// Schéma complet pour le modèle User
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phone: { type: String },
    avatar: { type: String }, // URL de la photo de profil
    addresses: [addressSchema], // Possibilité d'avoir plusieurs adresses
    role: { type: String, enum: ["user", "admin"], default: "user" },
    isVerified: { type: Boolean, default: false },
    wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    orders: [{ type: mongoose.Schema.Types.ObjectId, ref: "Order" }],
    lastLogin: { type: Date }
  },
  { timestamps: true } // Ajoute automatiquement createdAt et updatedAt
);

module.exports = mongoose.models.User || mongoose.model("User", userSchema);