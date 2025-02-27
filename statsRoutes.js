const express = require('express');
const statController = require('../controllers/statController'); // Assurez-vous que ce chemin est correct
const router = express.Router();

// Vérifiez que ces fonctions existent dans statController
router.get('/product/:id', statController.getProductById);  // Vérifiez que cette fonction est bien définie
router.get('/stats', statController.getStats);  // Vérifiez que cette fonction est bien définie
// Route DELETE pour supprimer un produit
router.delete('/produit/:id', statController.deleteProduct);  // Utiliser router.delete

module.exports = router;