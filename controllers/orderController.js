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
  res.status(200).json({ message: "Affichage du panier" });
};

// Fonction pour ajouter un produit au panier
exports.addToCart = (req, res) => {
  res.status(200).json({ message: "Produit ajouté au panier" });
};

// Fonction pour confirmer une commande
exports.confirmOrder = async (req, res) => {
  // Démarrage d'une session pour la transaction
  const session = await Order.startSession();
  try {
    session.startTransaction();

    // Extraction des données envoyées depuis le front-end (clés en français)
    const { courriel, adresse, phoneNumber, panierObjets, customerName } = req.body;
    
    // Vérification des champs requis
    if (
      !courriel?.trim() ||
      !adresse?.trim() ||
      !phoneNumber?.trim() ||
      !Array.isArray(panierObjets) ||
      panierObjets.length === 0
    ) {
      return res.status(400).json({ message: "Tous les champs sont requis et le panier ne peut pas être vide !" });
    }
    
    // Définir le nom du client (si non fourni, on utilise la partie avant '@' du courriel)
    const clientName = customerName && customerName.trim() ? customerName.trim() : courriel.split("@")[0];
    const shippingAddress = adresse;
    
    // Mapping des objets du panier : transformation des clés françaises en clés internes
    const mappedCartItems = panierObjets.map(item => ({
      name: item.nom,
      price: Number(item.prix) || 0, // Conversion explicite en nombre
      description: item.description || "",
      imageUrl: item.imageUrl,
      sellerEmail: item["sellerE-mail"],
      quantity: item.quantity || 1,
      addedAt: item.ajoutéÀ ? new Date(item.ajoutéÀ) : new Date()
    }));
    
    // Regrouper les produits par vendeur
    const ordersBySeller = {};
    mappedCartItems.forEach(item => {
      if (!item.sellerEmail) {
        // Si un produit ne possède pas d'email vendeur, on considère cela comme une erreur bloquante
        throw new Error(`Produit "${item.name}" sans email vendeur.`);
      }
      if (!ordersBySeller[item.sellerEmail]) {
        ordersBySeller[item.sellerEmail] = [];
      }
      ordersBySeller[item.sellerEmail].push(item);
    });
    
    const sellerOrders = {};
    
    // Pour chaque vendeur, créer une commande contenant tous ses produits et la sauvegarder dans la transaction
    for (const sellerEmail in ordersBySeller) {
      const order = new Order({
        customerName: clientName,
        email: courriel,
        shippingAddress,
        phoneNumber,
        products: ordersBySeller[sellerEmail], // Le tableau des produits pour ce vendeur
        orderStatus: "Commande en préparation"
      });
      
      await order.save({ session });
      sellerOrders[sellerEmail] = order;
    }
    
    // Envoi des emails aux vendeurs
    for (const sellerEmail in sellerOrders) {
      const order = sellerOrders[sellerEmail];
      const productDetails = order.products.map(prod =>
        `- ${prod.name} (${prod.quantity} x ${prod.price} FCFA)\n📷 Photo: ${prod.imageUrl}`
      ).join("\n\n");
      
      // Si l'envoi d'un email échoue, l'exception sera capturée et la transaction annulée
      await transporter.sendMail({
        from: "kolwazshopp@mailo.com",
        to: sellerEmail,
        subject: "Nouvelle commande reçue",
        text: `Bonjour,\n\nVous avez reçu une nouvelle commande.\n\n🛒 Détails de la commande :\n${productDetails}\n\n📍 Informations de livraison :\n👤 Client : ${clientName}\n📍 Adresse : ${shippingAddress}\n📞 Téléphone : ${phoneNumber}\n\nMerci de traiter cette commande rapidement.\n\n— Kolwaz Shop`
      });
    }
    
    // Envoi de l'email de confirmation au client (regroupant tous les produits)
    const clientProducts = mappedCartItems.map(item =>
      `- ${item.name} (${item.quantity} x ${item.price} FCFA)`
    ).join("\n");
    
    await transporter.sendMail({
      from: "kolwazshopp@mailo.com",
      to: courriel,
      subject: "Confirmation de votre commande",
      text: `Bonjour ${clientName},\n\n✅ Votre commande a bien été enregistrée !\n\n🛒 Détails de votre commande :\n${clientProducts}\n\n🚚 Votre commande est en cours de préparation et sera livrée à :\n📍 ${shippingAddress}\n📞 ${phoneNumber}\n\nMerci pour votre confiance !\n\n— Kolwaz Shop`
    });
    
    // Validation de la transaction si tous les emails ont été envoyés avec succès
    await session.commitTransaction();
    session.endSession();
    
    res.status(200).json({ message: `Commande confirmée pour ${mappedCartItems.length} produit(s).` });
  } catch (err) {
    // Annulation de la transaction si une erreur survient (par exemple, envoi d'email échoué)
    await session.abortTransaction();
    session.endSession();
    console.error("Erreur lors de la validation de la commande :", err);
    res.status(500).json({ error: err.message });
  }
};

// Fonction pour confirmer la livraison
exports.confirmDelivery = (req, res) => {
  res.status(200).json({ message: "Livraison confirmée" });
};
