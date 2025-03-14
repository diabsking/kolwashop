// controllers/orderController.js
const Order = require("../models/Order");
const nodemailer = require("nodemailer");

// Configuration de Mailo (utilisation du host recommandé)
const transporter = nodemailer.createTransport({
  host: "mail.mailo.com",
  port: 465,
  secure: true,
  auth: {
    user: "kolwazshopp@mailo.com",
    pass: process.env.MAILO_PASSWORD || "1O0C4HbGFMSw" // Veillez à utiliser une variable d'environnement pour le mot de passe
  }
});

// Afficher le panier (exemple)
exports.viewCart = (req, res) => {
  console.log("Affichage du panier demandé");
  res.status(200).json({ message: "Affichage du panier" });
};

// Ajouter un produit au panier (exemple)
exports.addToCart = (req, res) => {
  console.log("Ajout d'un produit au panier");
  res.status(200).json({ message: "Produit ajouté au panier" });
};

// Confirmer une commande basée sur le panier
exports.confirmOrder = async (req, res) => {
  console.log("Requête de confirmation de commande reçue");

  const { courriel, adresse, phoneNumber, panierObjets } = req.body;
  console.log("Données reçues :", { courriel, adresse, phoneNumber, panierObjets });

  if (
    !courriel?.trim() ||
    !adresse?.trim() ||
    !phoneNumber?.trim() ||
    !Array.isArray(panierObjets) ||
    panierObjets.length === 0
  ) {
    console.error("Validation échouée : Champs manquants ou panier vide");
    return res.status(400).json({ message: "Tous les champs sont requis et le panier ne peut pas être vide !" });
  }

  const clientName = courriel.split("@")[0];
  const shippingAddress = adresse;
  console.log("Nom du client déterminé :", clientName);

  // Mapping des produits – on récupère ici item.nom, item.prix, item.imageUrl, et sellerEmail
  const mappedCartItems = panierObjets.map(item => ({
    name: item.nom,
    price: Number(item.prix) || 0,
    description: item.description || "",
    imageUrl: item.imageUrl,
    sellerEmail: item.sellerEmail, // on attend directement sellerEmail dans le JSON
    quantity: item.quantity || 1,
    addedAt: item.addedAt ? new Date(item.addedAt) : new Date()
  }));

  mappedCartItems.forEach(item => console.log("Produit mappé :", item));

  // Regrouper les produits par vendeur
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

  const session = await Order.startSession();
  try {
    session.startTransaction();
    console.log("Transaction démarrée");

    const sellerOrders = {};

    // Création de la commande pour chaque vendeur
    for (const sellerEmail in ordersBySeller) {
      console.log(`Création de la commande pour le vendeur : ${sellerEmail}`);
      const order = new Order({
        customerName: clientName,
        email: courriel,
        shippingAddress,
        phoneNumber,
        products: ordersBySeller[sellerEmail],
        orderStatus: "Commande en préparation"
      });
      await order.save({ session });
      console.log(`Commande sauvegardée pour le vendeur : ${sellerEmail}`);
      sellerOrders[sellerEmail] = order;
    }

    // Envoi d'un email à chaque vendeur
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

    // Envoi d'un email de confirmation au client
    const clientProducts = mappedCartItems
      .map(item => `- ${item.name} (${item.quantity} x ${item.price} FCFA)`)
      .join("\n");
    console.log("Envoi de l'email de confirmation au client :", courriel);
    await transporter.sendMail({
      from: "kolwazshopp@mailo.com",
      to: courriel,
      subject: "Confirmation de votre commande",
      text: `Bonjour ${clientName},\n\nVotre commande a bien été enregistrée !\n\nDétails de votre commande :\n${clientProducts}\n\nVotre commande est en cours de préparation et sera livrée à l'adresse suivante :\n${shippingAddress}\nTéléphone : ${phoneNumber}\n\nMerci pour votre confiance !\n\n— Kolwaz Shop`
    });
    console.log("Email de confirmation envoyé au client :", courriel);

    await session.commitTransaction();
    console.log("Transaction validée");
    res.status(200).json({ message: `Commande confirmée pour ${mappedCartItems.length} produit(s).` });
  } catch (err) {
    await session.abortTransaction();
    console.error("Erreur lors de la validation de la commande :", err);
    res.status(500).json({ error: err.message });
  } finally {
    session.endSession();
  }
};

exports.confirmDelivery = (req, res) => {
  console.log("Confirmation de livraison reçue");
  res.status(200).json({ message: "Livraison confirmée" });
};
