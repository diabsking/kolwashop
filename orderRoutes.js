const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");

// Vérifie que toutes les fonctions du contrôleur existent
if (
  !orderController.viewCart ||
  !orderController.addToCart ||
  !orderController.confirmOrder ||
  !orderController.confirmDelivery
) {
  throw new Error("Une ou plusieurs fonctions du contrôleur de commande sont introuvables !");
}

// Définition des routes
router.get("/view-cart", orderController.viewCart);
router.post("/add-to-cart", orderController.addToCart);
router.post("/confirm-order", orderController.confirmOrder);
router.post("/confirm-delivery", orderController.confirmDelivery);

module.exports = router;