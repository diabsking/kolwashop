const Order = require("../models/Order");
const nodemailer = require("nodemailer");

// Configuration de Mailo
const transporter = nodemailer.createTransport({
  host: "mail.mailo.com",
  port: 465,
  secure: true,
  auth: {
    user: "kolwazshopp@mailo.com",
    pass: process.env.MAILO_PASSWORD // Assurez-vous d'utiliser une variable d'environnement pour des raisons de sécurité
  }
});

// Afficher le panier (pour debug ou API)
exports.viewCart = (req, res) => {
  console.log("Affichage du panier.");
  res.status(200).json({ message: "Affichage du panier." });
};

// Ajouter un produit au panier (pour debug ou extension API)
exports.addToCart = (req, res) => {
  console.log("Ajout d'un produit au panier.");
  res.status(200).json({ message: "Produit ajouté au panier." });
};

// Confirmer une commande
exports.confirmOrder = async (req, res) => {
  console.log("Confirmation de commande reçue.");

  const { courriel, adresse, phoneNumber, panierObjets } = req.body;

  // Vérification des champs obligatoires
  if (!courriel || !adresse || !phoneNumber || !Array.isArray(panierObjets) || panierObjets.length === 0) {
    console.error("Validation échouée : Champs manquants ou panier vide.");
    return res.status(400).json({ message: "Tous les champs sont requis et le panier ne peut pas être vide !" });
  }

  const clientName = courriel.split("@")[0];
  console.log("Nom du client :", clientName);

  // Organisation des articles du panier
  const mappedCartItems = panierObjets.map(item => ({
    name: item.name,
    price: Number(item.price) || 0,
    quantity: item.quantity || 1,
    size: item.size || null, // Ajout de la taille si disponible
    imageUrl: item.imageUrl,
    sellerEmail: item.sellerEmail || null
  }));

  // Regrouper les produits par vendeur
  const ordersBySeller = {};
  for (const item of mappedCartItems) {
    if (!item.sellerEmail) {
      return res.status(400).json({ message: `Produit "${item.name}" sans email vendeur.` });
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
    console.log("Transaction démarrée.");

    for (const sellerEmail in ordersBySeller) {
      const order = new Order({
        customerName: clientName,
        email: courriel,
        shippingAddress: adresse,
        phoneNumber,
        products: ordersBySeller[sellerEmail],
        orderStatus: "Commande en préparation"
      });

      // Sauvegarder chaque commande dans la base de données
      await order.save({ session });
      console.log(`Commande sauvegardée pour le vendeur : ${sellerEmail}`);

      // Envoi de l'email au vendeur
      const productDetails = ordersBySeller[sellerEmail]
        .map(item => `- ${item.name} (${item.quantity} x ${item.price} FCFA)`)
        .join("\n");
      await transporter.sendMail({
        from: "kolwazshopp@mailo.com",
        to: sellerEmail,
        subject: "Nouvelle commande reçue",
        text: `Bonjour,\n\nUne nouvelle commande a été reçue :\n\n${productDetails}\n\nAdresse de livraison : ${adresse}\nTéléphone : ${phoneNumber}`
      });
      console.log(`Email envoyé au vendeur : ${sellerEmail}`);
    }

    // Email de confirmation au client
    const clientProducts = mappedCartItems
      .map(item => `- ${item.name} (${item.quantity} x ${item.price} FCFA)`)
      .join("\n");
    await transporter.sendMail({
      from: "kolwazshopp@mailo.com",
      to: courriel,
      subject: "Confirmation de votre commande",
      text: `Bonjour ${clientName},\n\nVotre commande a été confirmée !\n\nDétails :\n${clientProducts}\n\nAdresse de livraison : ${adresse}\nTéléphone : ${phoneNumber}`
    });
    console.log("Email de confirmation envoyé au client.");

    await session.commitTransaction();
    console.log("Transaction validée.");
    res.status(200).json({ message: `Commande confirmée pour ${mappedCartItems.length} produit(s).` });
  } catch (err) {
    await session.abortTransaction();
    console.error("Erreur lors de la transaction :", err);
    res.status(500).json({ error: "Erreur lors de la confirmation de la commande." });
  } finally {
    session.endSession();
  }
};

// Confirmation de livraison
exports.confirmDelivery = (req, res) => {
  console.log("Confirmation de livraison reçue.");
  res.status(200).json({ message: "Livraison confirmée." });
};