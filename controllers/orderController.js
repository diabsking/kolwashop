// controllers/orderController.js
const Order = require("../models/Order");
const nodemailer = require("nodemailer");

// Configuration de Mailo (en utilisant les variables d'environnement pour la sécurité)
const transporter = nodemailer.createTransport({
  host: "mail.mailo.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,   // Doit être défini dans votre fichier .env
    pass: process.env.MAILO_PASSWORD  // Doit être défini dans votre fichier .env
  }
});

// Affichage du panier (exemple)
exports.viewCart = (req, res) => {
  console.log("Affichage du panier demandé");
  res.status(200).json({ message: "Affichage du panier" });
};

// Ajout d'un produit au panier (exemple)
exports.addToCart = (req, res) => {
  console.log("Ajout d'un produit au panier");
  res.status(200).json({ message: "Produit ajouté au panier" });
};

// Confirmation de la commande
exports.confirmOrder = async (req, res) => {
  console.log("Commande de confirmation reçue");

  const { courriel, adresse, phoneNumber, panierObjets } = req.body;
  console.log("Données reçues :", { courriel, adresse, phoneNumber, panierObjets });

  // Validation des champs obligatoires
  if (
    !courriel?.trim() ||
    !adresse?.trim() ||
    !phoneNumber?.trim() ||
    !Array.isArray(panierObjets) ||
    panierObjets.length === 0
  ) {
    console.error("Validation échouée : Champs manquants ou panier vide.");
    return res.status(400).json({ message: "Tous les champs sont requis et le panier ne peut pas être vide !" });
  }

  // Extraction du nom du client à partir de l'email
  const clientName = courriel.split("@")[0];
  const shippingAddress = adresse;
  console.log("Nom du client déterminé :", clientName);

  // Mappage des produits en tenant compte des clés alternatives (sellerE-mail et Quantité)
  const mappedCartItems = panierObjets.map(item => ({
    name: item.nom,
    price: Number(item.prix) || 0,
    description: item.description || "",
    imageUrl: item.imageUrl,
    sellerEmail: item.sellerEmail || item["sellerE-mail"],
    quantity: item.quantity || item["Quantité"] || 1,
    addedAt: item.addedAt ? new Date(item.addedAt) : new Date()
  }));

  mappedCartItems.forEach(item => console.log("Produit mappé :", item));

  // Regroupement des produits par vendeur
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

  // Démarrage d'une session Mongoose pour la transaction
  let session;
  try {
    session = await Order.startSession();
    session.startTransaction();
    console.log("Transaction démarrée");

    const sellerOrders = {};

    // Création d'une commande pour chaque vendeur
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

    // Envoi d'un email à chaque vendeur avec le détail de la commande
    for (const sellerEmail in sellerOrders) {
      const order = sellerOrders[sellerEmail];
      const productDetails = order.products
        .map(prod =>
          `- ${prod.name} (${prod.quantity} x ${prod.price} FCFA)\nURL de la photo : ${prod.imageUrl}`
        )
        .join("\n\n");

      console.log(`Tentative d'envoi de l'email au vendeur : ${sellerEmail}`);
      try {
        const mailResponseVendor = await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: sellerEmail,
          subject: "Nouvelle commande reçue",
          text: `Bonjour,\n\nVous avez reçu une nouvelle commande.\n\nDétails de la commande :\n${productDetails}\n\nInformations de livraison :\nClient : ${clientName}\nAdresse : ${shippingAddress}\nTéléphone : ${phoneNumber}\n\nMerci de traiter cette commande rapidement.\n\n— Kolwaz Shop`
        });
        console.log(`Email envoyé au vendeur ${sellerEmail} avec réponse :`, mailResponseVendor);
      } catch (mailErr) {
        console.error(`Erreur lors de l'envoi de l'email au vendeur ${sellerEmail} :`, mailErr);
        throw mailErr;
      }
    }

    // Envoi de l'email de confirmation au client
    const clientProducts = mappedCartItems
      .map(item => `- ${item.name} (${item.quantity} x ${item.price} FCFA)`)
      .join("\n");
    console.log("Tentative d'envoi de l'email de confirmation au client :", courriel);
    try {
      const mailResponseClient = await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: courriel,
        subject: "Confirmation de votre commande",
        text: `Bonjour ${clientName},\n\nVotre commande a bien été enregistrée !\n\nDétails de votre commande :\n${clientProducts}\n\nVotre commande est en cours de préparation et sera livrée à l'adresse suivante :\n${shippingAddress}\nTéléphone : ${phoneNumber}\n\nMerci pour votre confiance !\n\n— Kolwaz Shop`
      });
      console.log(`Email de confirmation envoyé au client ${courriel} avec réponse :`, mailResponseClient);
    } catch (mailErrClient) {
      console.error(`Erreur lors de l'envoi de l'email de confirmation au client ${courriel} :`, mailErrClient);
      throw mailErrClient;
    }

    // Validation de la transaction
    await session.commitTransaction();
    console.log("Transaction validée");
    session.endSession();

    return res.status(200).json({ message: `Commande confirmée pour ${mappedCartItems.length} produit(s).` });
  } catch (err) {
    console.error("Erreur lors de la validation de la commande :", err);
    if (session && session.inTransaction()) {
      await session.abortTransaction();
      session.endSession();
    }
    return res.status(500).json({ error: err.message });
  }
};

// Confirmation de livraison (exemple)
exports.confirmDelivery = (req, res) => {
  console.log("Confirmation de livraison reçue");
  res.status(200).json({ message: "Livraison confirmée" });
};