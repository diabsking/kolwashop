// middlewares/authMiddleware.js

const jwt = require('jsonwebtoken');
const Seller = require('../models/Seller');  // Assure-toi que le chemin du modèle est correct

// Middleware pour vérifier l'authentification
const isAuthenticated = async (req, res, next) => {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  const token = authHeader && authHeader.replace('Bearer ', '').trim();
  console.log('Token reçu:', token);

  if (!token) {
    console.error('Aucun token trouvé dans la requête.');
    return res.status(401).json({ message: 'Accès non autorisé ! Vous devez vous connecter.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Token décodé:', decoded);
    req.user = decoded; // Ajoute les données du token à req.user
    next();
  } catch (error) {
    console.error('Erreur de vérification du token:', error.message);
    return res.status(401).json({ message: 'Token invalide ou expiré.' });
  }
};

// Middleware pour vérifier si l'utilisateur est un vendeur
const isSeller = async (req, res, next) => {
  if (!req.user || !req.user.id) {
    console.error('Utilisateur non authentifié ou ID manquant.');
    return res.status(401).json({ message: 'Accès non autorisé ! Vous devez vous connecter.' });
  }

  console.log('Vérification si l\'utilisateur est un vendeur:', req.user.id);

  try {
    const seller = await Seller.findById(req.user.id);  // Utilisation de req.user.id après validation du token
    if (!seller) {
      console.error('Vendeur non trouvé pour l\'ID:', req.user.id);
      return res.status(403).json({ message: 'Accès réservé aux vendeurs.' });
    }
    console.log('Vendeur trouvé:', seller);
    next();
  } catch (err) {
    console.error('Erreur lors de la vérification du vendeur:', err.message);
    return res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

module.exports = { isAuthenticated, isSeller };