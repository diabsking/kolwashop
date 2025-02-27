const Order = require("../models/Order");
const nodemailer = require("nodemailer");

// Configuration de Mailo
const transporter = nodemailer.createTransport({
  host: "mail.mailo.com",
  port: 465,
  secure: true,
  auth: {
    user: "kolwazshopp@mailo.com",
    pass: process.env.MAILO_PASSWORD || "1O0C4HbGFMSw" // Utilisez une variable d'environnement pour le mot de passe
  }
});
// Fonction pour afficher le panier
exports.viewCart = (req, res) => {
  // Implémentez ici la logique d'affichage du panier
  res.status(200).json({ message: "Affichage du panier" });
};

// Fonction pour ajouter un produit au panier
exports.addToCart = (req, res) => {
  // Implémentez ici la logique d'ajout au panier
  res.status(200).json({ message: "Produit ajouté au panier" });
};

// Fonction pour confirmer une commande
exports.confirmOrder = async (req, res) => {
  try {
    const { email, address, phoneNumber, cartItems } = req.body;

    if (!email || !address || !phoneNumber || !cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
      return res.status(400).json({ message: "Tous les champs sont requis et le panier ne peut pas être vide !" });
    }

    const sellerOrders = {};

    // Enregistrer chaque commande et regrouper par vendeur
    for (let item of cartItems) {
      if (!item.sellerEmail) {
        console.warn(`Produit "${item.name}" sans email vendeur.`);
        continue;
        console.log("Nouvelle commande enregistrée :", savedOrder);
      }

      // Si la quantité n'est pas fournie, on la définit à 1 par défaut
      const quantity = item.quantity || 1;

      const newOrder = new Order({
        email,
        address,
        phoneNumber,
        product: {
          name: item.name,
          price: item.price,
          description: item.description,
          imageUrl: item.imageUrl,
          sellerEmail: item.sellerEmail,
          quantity: quantity
        },
        status: "Commande en préparation"
      });

      await newOrder.save();

      if (!sellerOrders[item.sellerEmail]) {
        sellerOrders[item.sellerEmail] = [];
      }
      sellerOrders[item.sellerEmail].push(newOrder);
    }

    // Envoi des emails aux vendeurs
    for (let sellerEmail in sellerOrders) {
      const ordersBySeller = sellerOrders[sellerEmail];
      const productDetails = ordersBySeller.map(order =>
        `- ${order.product.name} (${order.product.quantity} x ${order.product.price} FCFA)`
      ).join("\n");

      await transporter.sendMail({
        from: "kolwazshopp@mailo.com",
        to: sellerEmail,
        subject: "Nouvelle commande reçue",
        text: `Bonjour,\n\nVous avez reçu une nouvelle commande.\n\n🛒 Détails de la commande :\n${productDetails}\n\n📍 Informations de livraison :\nAdresse : ${address}\n📞 Téléphone : ${phoneNumber}\n\nMerci de traiter cette commande rapidement.\n\n— Kolwaz Shop`
      });
    }

    // Envoi de l'email de confirmation au client
    const clientProducts = cartItems.map(item =>
      `- ${item.name} (${(item.quantity || 1)} x ${item.price} FCFA)`
    ).join("\n");

    await transporter.sendMail({
      from: "kolwazshopp@mailo.com",
      to: email,
      subject: "Confirmation de votre commande",
      text: `Bonjour,\n\n✅ Votre commande a bien été enregistrée !\n\n🛒 Détails de votre commande :\n${clientProducts}\n\n🚚 Votre commande est en cours de préparation et sera livrée à :\n📍 ${address}\n📞 ${phoneNumber}\n\nMerci pour votre confiance !\n\n— Kolwaz Shop`
    });

    res.status(200).json({ message: `Commande confirmée pour ${cartItems.length} produit(s).` });
  } catch (err) {
    console.error("Erreur lors de la validation de la commande :", err);
    res.status(500).json({ error: err.message });
  }
};

// Fonction pour confirmer la livraison
exports.confirmDelivery = (req, res) => {
  // Implémentez ici la logique de confirmation de livraison
  res.status(200).json({ message: "Livraison confirmée" });
};