const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");

// Vérification que toutes les fonctions du contrôleur existent
const controllerMethods = ["viewCart", "addToCart", "confirmOrder", "confirmDelivery"];
controllerMethods.forEach((method) => {
  if (typeof orderController[method] !== "function") {
    console.error(`La fonction ${method} est introuvable dans le contrôleur de commande !`);
  }
});

// Définition des routes
router.get("/view-cart", safeRoute(orderController.viewCart));
router.post("/add-to-cart", safeRoute(orderController.addToCart));
router.post("/confirm-order", safeRoute(orderController.confirmOrder));
router.post("/confirm-delivery", safeRoute(orderController.confirmDelivery));

/**
 * Middleware pour sécuriser les routes.
 * Attrape automatiquement les erreurs et les gère proprement.
 */
function safeRoute(controllerFunction) {
  return async (req, res, next) => {
    try {
      if (!controllerFunction) {
        return res.status(500).json({ message: "Fonctionnalité non implémentée." });
      }
      await controllerFunction(req, res, next);
    } catch (error) {
      console.error("Erreur attrapée dans la route :", error);
      res.status(500).json({ message: "Une erreur est survenue.", error: error.message });
    }
  };
}

module.exports = router;