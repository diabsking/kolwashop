const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  courriel: { type: String, required: true }, // Correspond à "email" dans la requête
  adresse: { type: String, required: true }, // Correspond à "address" dans la requête
  phoneNumber: { type: String, required: true },
  panierObjets: [{  // Correspond à "cartItems" dans la requête
      nom: { type: String, required: true }, // Correspond à "name"
      description: { type: String, default: "Aucune description" }, // Ajout d’une valeur par défaut
      imageUrl: String,
      prix: { type: Number, required: true }, // Correspond à "price"
      sellerEmail: String,
      quantity: { type: Number, required: true, default: 1 }, // Valeur par défaut
      size: { type: Number, default: null } // Facultatif
  }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Order', orderSchema);