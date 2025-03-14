const Order = require("../models/Order");
const nodemailer = require("nodemailer");

// Configuration de Mailo (utilisation du host recommandé)
const transporter = nodemailer.createTransport({
  host: "mail.mailo.com",
  port: 465,
  secure: true,
  auth: {
    user: "kolwazshopp@mailo.com",
    pass: process.env.MAILO_PASSWORD // Assurez-vous d'utiliser une variable d'environnement
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

// Fonction pour confirmer une commande
exports.confirmOrder = async (req, res) => {
  console.log("Requête de confirmation de commande reçue");
  const session = await Order.startSession();
  try {
    session.startTransaction();
    console.log("Transaction démarrée");

    const { courriel, adresse, phoneNumber, panierObjets, customerName } = req.body;
    console.log("Données reçues :", { courriel, adresse, phoneNumber, panierObjets, customerName });

    if (!courriel?.trim() || !adresse?.trim() || !phoneNumber?.trim() || !Array.isArray(panierObjets) || panierObjets.length === 0) {
      console.error("Validation échouée : Champs manquants ou panier vide");
      return res.status(400).json({ message: "Tous les champs sont requis et le panier ne peut pas être vide !" });
    }

    const clientName = customerName?.trim() || courriel.split("@")[0];
    console.log("Nom du client déterminé :", clientName);

    const mappedCartItems = panierObjets.map(item => ({
      name: item.nom,
      price: Number(item.prix) || 0,
      description: item.description || "",
      imageUrl: item.imageUrl,
      sellerEmail: item["sellerE-mail"],
      quantity: item.quantity || 1,
      addedAt: item.ajoutéÀ ? new Date(item.ajoutéÀ) : new Date()
    }));
    console.log("Produits mappés :", mappedCartItems);

    const ordersBySeller = mappedCartItems.reduce((acc, item) => {
      if (!item.sellerEmail) {
        throw new Error(`Produit \"${item.name}\" sans email vendeur.`);
      }
      acc[item.sellerEmail] = acc[item.sellerEmail] || [];
      acc[item.sellerEmail].push(item);
      return acc;
    }, {});
    console.log("Produits regroupés par vendeur :", ordersBySeller);

    const sellerOrders = {};

    for (const sellerEmail in ordersBySeller) {
      console.log(`Création de la commande pour le vendeur: ${sellerEmail}`);
      const order = new Order({
        customerName: clientName,
        email: courriel,
        shippingAddress: adresse,
        phoneNumber,
        products: ordersBySeller[sellerEmail],
        orderStatus: "Commande en préparation"
      });

      await order.save({ session });
      console.log(`Commande sauvegardée pour le vendeur: ${sellerEmail}`);
      sellerOrders[sellerEmail] = order;
    }

    for (const sellerEmail in sellerOrders) {
      const order = sellerOrders[sellerEmail];
      const productDetails = order.products.map(prod => `- ${prod.name} (${prod.quantity} x ${prod.price} FCFA)\n📷 Photo: ${prod.imageUrl}`).join("\n\n");

      console.log(`Envoi de l'email au vendeur: ${sellerEmail}`);
      await transporter.sendMail({
        from: "kolwazshopp@mailo.com",
        to: sellerEmail,
        subject: "Nouvelle commande reçue",
        text: `Bonjour,\n\nVous avez reçu une nouvelle commande.\n\n🛒 Détails de la commande :\n${productDetails}\n\n📍 Informations de livraison :\n👤 Client : ${clientName}\n📍 Adresse : ${adresse}\n📞 Téléphone : ${phoneNumber}\n\nMerci de traiter cette commande rapidement.\n\n— Kolwaz Shop`
      });
      console.log(`Email envoyé au vendeur: ${sellerEmail}`);
    }

    const clientProducts = mappedCartItems.map(item => `- ${item.name} (${item.quantity} x ${item.price} FCFA)`).join("\n");

    console.log("Envoi de l'email de confirmation au client :", courriel);
    await transporter.sendMail({
      from: "kolwazshopp@mailo.com",
      to: courriel,
      subject: "Confirmation de votre commande",
      text: `Bonjour ${clientName},\n\n✅ Votre commande a bien été enregistrée !\n\n🛒 Détails de votre commande :\n${clientProducts}\n\n🚚 Votre commande est en cours de préparation et sera livrée à :\n📍 ${adresse}\n📞 ${phoneNumber}\n\nMerci pour votre confiance !\n\n— Kolwaz Shop`
    });
    console.log("Email de confirmation envoyé au client :", courriel);

    await session.commitTransaction();
    session.endSession();
    console.log("Transaction validée");

    res.status(200).json({ message: `Commande confirmée pour ${mappedCartItems.length} produit(s).` });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("Erreur lors de la validation de la commande :", err);
    res.status(500).json({ error: err.message });
  }
};

// Fonction pour confirmer la livraison
exports.confirmDelivery = (req, res) => {
  console.log("Confirmation de livraison reçue");
  res.status(200).json({ message: "Livraison confirmée" });
};
