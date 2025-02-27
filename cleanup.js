// scheduler/cleanup.js
const Product = require("../models/Product");

exports.cleanExpiredProducts = async () => {
  try {
    const now = new Date();
    // Supprimer les produits publiés depuis plus de 45 jours
    await Product.deleteMany({ 
      createdAt: { $lt: new Date(now - 45 * 24 * 60 * 60 * 1000) }
    });
    console.log("Nettoyage des annonces expirées effectué.");
  } catch (err) {
    console.error("Erreur lors du nettoyage :", err);
  }
};