const Order = require("../models/Order");
const nodemailer = require("nodemailer");

// Configuration de Mailo (utilisation du host recommandé)
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
  console.log("Affichage du panier demandé");
  res.status(200).json({ message: "Affichage du panier" });
};

// Fonction pour ajouter un produit au panier
exports.addToCart = (req, res) => {
  console.log("Ajout d'un produit au panier");
  res.status(200).json({ message: "Produit ajouté au panier" });
};

// Fonction pour confirmer une commande basée sur le panier
exports.confirmOrder = async (req, res) => {
  console.log("Requête de confirmation de commande reçue");

  // Extraction des données envoyées dans le body
  const { email, address, phoneNumber, cart } = req.body;
  console.log("Données reçues :", { email, address, phoneNumber, cart });

  // Vérification des champs requis
  if (
    !email?.trim() ||
    !address?.trim() ||
    !phoneNumber?.trim() ||
    !Array.isArray(cart) ||
    cart.length === 0
  ) {
    console.error("Validation échouée : Champs manquants ou panier vide");
    return res.status(400).json({ message: "Tous les champs sont requis et le panier ne peut pas être vide !" });
  }

  // Déterminer le nom du client à partir de l'email
  const clientName = email.split("@")[0];
  const shippingAddress = address;
  console.log("Nom du client déterminé :", clientName);

  // Mapping des produits du panier pour assurer la cohérence des clés
  const mappedCartItems = cart.map(item => ({
    name: item.name,
    price: Number(item.price) || 0,
    description: item.description || "",
    imageUrl: item.imageUrl,
    sellerEmail: item.sellerEmail, // Seller email indispensable pour regrouper les commandes par vendeur
    quantity: item.quantity || 1,
    addedAt: item.addedAt ? new Date(item.addedAt) : new Date()
  }));

  mappedCartItems.forEach(item => console.log("Produit mappé :", item));

  // Regrouper les produits par vendeur (chaque vendeur recevra une commande distincte)
  const ordersBySeller = {};
  for (const item of mappedCartItems) {
    if (!item.sellerEmail) {
      const errorMsg = `Produit "${item.name}" sans email vendeur.`;
      console.error(errorMsg);
      return res.status(400).json({ message: errorMsg });
    }
    if (!ordersBySeller[item.sellerEmail]) {
      ordersBySeller[item.sellerEmail] = [];
    }
    ordersBySeller[item.sellerEmail].push(item);
  }
  console.log("Produits regroupés par vendeur :", ordersBySeller);

  // Démarrer une session pour gérer la transaction
  const session = await Order.startSession();
  try {
    session.startTransaction();
    console.log("Transaction démarrée");

    const sellerOrders = {};

    // Pour chaque vendeur, créer une commande et l'enregistrer dans la transaction
    for (const sellerEmail in ordersBySeller) {
      console.log(`Création de la commande pour le vendeur : ${sellerEmail}`);
      const order = new Order({
        customerName: clientName,
        email,
        shippingAddress,
        phoneNumber,
        products: ordersBySeller[sellerEmail],
        orderStatus: "Commande en préparation"
      });
      await order.save({ session });
      console.log(`Commande sauvegardée pour le vendeur : ${sellerEmail}`);
      sellerOrders[sellerEmail] = order;
    }

    // Envoi d'un email à chaque vendeur avec les détails de la commande
    for (const sellerEmail in sellerOrders) {
      const order = sellerOrders[sellerEmail];
      const productDetails = order.products
        .map(prod =>
          `- ${prod.name} (${prod.quantity} x ${prod.price} FCFA)\nURL de la photo: ${prod.imageUrl}`
        )
        .join("\n\n");

      console.log(`Envoi de l'email au vendeur : ${sellerEmail}`);
      await transporter.sendMail({
        from: "kolwazshopp@mailo.com",
        to: sellerEmail,
        subject: "Nouvelle commande reçue",
        text: `Bonjour,\n\nVous avez reçu une nouvelle commande.\n\nDétails de la commande :\n${productDetails}\n\nInformations de livraison :\nClient : ${clientName}\nAdresse : ${shippingAddress}\nTéléphone : ${phoneNumber}\n\nMerci de traiter cette commande rapidement.\n\n— Kolwaz Shop`
      });
      console.log(`Email envoyé au vendeur : ${sellerEmail}`);
    }

    // Envoi de l'email de confirmation au client avec le récapitulatif de sa commande
    const clientProducts = mappedCartItems
      .map(item => `- ${item.name} (${item.quantity} x ${item.price} FCFA)`)
      .join("\n");
    console.log("Envoi de l'email de confirmation au client :", email);
    await transporter.sendMail({
      from: "kolwazshopp@mailo.com",
      to: email,
      subject: "Confirmation de votre commande",
      text: `Bonjour ${clientName},\n\nVotre commande a bien été enregistrée !\n\nDétails de votre commande :\n${clientProducts}\n\nVotre commande est en cours de préparation et sera livrée à l'adresse suivante :\n${shippingAddress}\nTéléphone : ${phoneNumber}\n\nMerci pour votre confiance !\n\n— Kolwaz Shop`
    });
    console.log("Email de confirmation envoyé au client :", email);

    // Valider la transaction
    await session.commitTransaction();
    console.log("Transaction validée");
    res.status(200).json({ message: `Commande confirmée pour ${mappedCartItems.length} produit(s).` });
  } catch (err) {
    // Annuler la transaction en cas d'erreur et retourner l'erreur
    await session.abortTransaction();
    console.error("Erreur lors de la validation de la commande :", err);
    res.status(500).json({ error: err.message });
  } finally {
    session.endSession();
  }
};

// Fonction pour confirmer la livraison
exports.confirmDelivery = (req, res) => {
  console.log("Confirmation de livraison reçue");
  res.status(200).json({ message: "Livraison confirmée" });
};
