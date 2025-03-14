const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // Pour le hachage du mot de passe

// Schéma pour l'adresse du vendeur
const addressSchema = new mongoose.Schema({
  street: { type: String, trim: true },
  city: { type: String, trim: true },
  postalCode: { type: String, trim: true },
  country: { type: String, trim: true }
}, { _id: false });

// Schéma principal du vendeur
const sellerSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/.+\@.+\..+/, 'Veuillez entrer une adresse email valide']
  },
  password: { type: String, required: true },
  storeName: { type: String, required: true, trim: true },
  verified: { type: Boolean, default: false },

  // Informations complémentaires
  phone: { type: String, trim: true },
  address: addressSchema,
  website: { type: String, trim: true },
  logoUrl: { type: String, trim: true }, // URL du logo du magasin
  description: { type: String, trim: true },

  // Liens vers les réseaux sociaux
  socialLinks: {
    facebook: { type: String, trim: true },
    twitter: { type: String, trim: true },
    instagram: { type: String, trim: true },
    linkedin: { type: String, trim: true }
  },

  // Référence aux produits associés au vendeur
  products: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],

  // Statistiques et évaluations
  rating: { type: Number, default: 0, min: 0, max: 5 },
  reviewsCount: { type: Number, default: 0 }
}, { timestamps: true });

// Pré-hook pour hacher le mot de passe avant l'enregistrement
sellerSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Méthode d'instance pour comparer le mot de passe fourni avec le mot de passe haché
sellerSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Créer le modèle `Seller`, en évitant la redéclaration si déjà existant
module.exports = mongoose.models.Seller || mongoose.model('Seller', sellerSchema);