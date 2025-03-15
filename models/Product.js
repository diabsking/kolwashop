// models/Product.js
const mongoose = require("mongoose");

// Sous-schéma pour les avis clients
const reviewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    comment: { type: String },
    rating: { type: Number, min: 1, max: 5, required: true }
  },
  {
    timestamps: true // Ajoute automatiquement createdAt et updatedAt pour chaque avis
  }
);

// Sous-schéma pour les variantes (taille, couleur, etc.)
const variantSchema = new mongoose.Schema(
  {
    variantName: { type: String, required: true },
    sku: { type: String },
    price: { type: Number, required: true },
    stock: { type: Number, default: 0 },
    // Attributs personnalisés (exemple : { color: "red", size: "M" })
    attributes: { type: Map, of: String }
  },
  {
    timestamps: true // Optionnel, si vous souhaitez suivre la date de création et de mise à jour des variantes
  }
);

// Schéma complet du produit
const productSchema = new mongoose.Schema(
  {
    // Informations de base
    sellerEmail: { type: String, required: true },
    productName: { type: String, required: true },
    slug: { type: String, unique: true }, // Pour une URL conviviale
    description: { type: String, required: true },
    price: { type: Number, required: true },
    deliveryTime: { type: String, required: true },
    imageUrl: { type: String, required: true }, // Image principale

    // Multimédia et visuels supplémentaires
    images: [{ type: String }], // Galerie d'images complémentaires
    videoUrl: { type: String },

    // Gestion des remises et classification
    discount: { type: Number, default: 0 },
    discountType: {
      type: String,
      enum: ["percentage", "fixed"],
      default: "percentage"
    },
    category: { type: String },
    tags: [{ type: String }],
    brand: { type: String },
    sku: { type: String },
    barcode: { type: String },
    stock: { type: Number, default: 0 },

    // Avis et évaluations
    rating: { type: Number, default: 0 },
    reviews: [reviewSchema],
    reviewsCount: { type: Number, default: 0 },

    // Variantes du produit (par exemple, différentes tailles ou couleurs)
    variants: [variantSchema],

    // Caractéristiques et spécifications
    features: [{ type: String }],
    weight: { type: Number }, // en kilogrammes par exemple
    dimensions: {
      length: { type: Number },
      width: { type: Number },
      height: { type: Number }
    },

    // Détails d'expédition
    shippingDetails: {
      shippingCost: { type: Number },
      estimatedDelivery: { type: Number } // en jours
    },
    returnPolicy: { type: String },
    warranty: { type: String },

    // Statut et visibilité
    isActive: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },

    // Statistiques d'interaction et popularité
    views: { type: Number, default: 0 },
    addToCart: { type: Number, default: 0 },
    orders: { type: Number, default: 0 },

    // Si vous souhaitez conserver un champ spécifique pour la date de publication,
    // vous pouvez le garder, sinon il est redondant avec createdAt
    publicationDate: { type: Date, default: Date.now }
  },
  {
    timestamps: true // Ajoute automatiquement createdAt et updatedAt au document produit
  }
);

module.exports = mongoose.model("Product", productSchema);