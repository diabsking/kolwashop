const Order = require("../models/Order");
const nodemailer = require("nodemailer");

// Configuration de Mailo
const transporter = nodemailer.createTransport({
  host: "mail.mailo.com",
  port: 465,
  secure: true,
  auth: {
    user: "kolwazshopp@mailo.com",
    pass: process.env.MAILO_PASSWORD || "1O0C4HbGFMSw" // Remplace par une variable d’environnement
  }
});

// Fonction pour confirmer une commande
exports.confirmOrder = async (req, res) => {
  try {
    // Extraction des données envoyées depuis le front-end
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
    
    // Définition du nom du client
    const clientName = customerName?.trim() || courriel.split("@")[0];
    const shippingAddress = adresse;
    
    // Mapping des objets du panier
    const mappedCartItems = panierObjets.map(item => ({
      name: item.nom,
      price: item.prix,
      description: item.description || "",
      imageUrl: item.imageUrl,
      sellerEmail: item.sellerEmail, // Correction du champ
      quantity: item.quantity || 1,
      addedAt: item.ajouteA || new Date() // Correction de "ajoutéÀ"
    }));
    
    // Regrouper les produits par vendeur
    const ordersBySeller = {};
    mappedCartItems.forEach(item => {
      if (!item.sellerEmail) {
        console.warn(`Produit "${item.name}" sans email vendeur.`);
        return;
      }
      if (!ordersBySeller[item.sellerEmail]) {
        ordersBySeller[item.sellerEmail] = [];
      }
      ordersBySeller[item.sellerEmail].push(item);
    });
    
    const sellerOrders = {};
    
    // Création des commandes pour chaque vendeur
    for (const sellerEmail in ordersBySeller) {
      const order = new Order({
        customerName: clientName,
        email: courriel,
        shippingAddress,
        phoneNumber,
        products: ordersBySeller[sellerEmail],
        orderStatus: "Commande en préparation"
      });
      
      await order.save();
      sellerOrders[sellerEmail] = order;
    }
    
    // Envoi des emails aux vendeurs
    for (const sellerEmail in sellerOrders) {
      const order = sellerOrders[sellerEmail];
      const productDetails = order.products.map(prod =>
        `- ${prod.name} (${prod.quantity} x ${prod.price} FCFA)\n📷 Photo: ${prod.imageUrl}`
      ).join("\n\n");
      
      await transporter.sendMail({
        from: "kolwazshopp@mailo.com",
        to: sellerEmail,
        subject: "Nouvelle commande reçue",
        text: `Bonjour,\n\nVous avez reçu une nouvelle commande.\n\n🛒 Détails de la commande :\n${productDetails}\n\n📍 Informations de livraison :\n👤 Client : ${clientName}\n📍 Adresse : ${shippingAddress}\n📞 Téléphone : ${phoneNumber}\n\nMerci de traiter cette commande rapidement.\n\n— Kolwaz Shop`
      });
    }
    
    // Envoi de l'email de confirmation au client
    const clientProducts = mappedCartItems.map(item =>
      `- ${item.name} (${item.quantity} x ${item.price} FCFA)`
    ).join("\n");
    
    await transporter.sendMail({
      from: "kolwazshopp@mailo.com",
      to: courriel,
      subject: "Confirmation de votre commande",
      text: `Bonjour ${clientName},\n\n✅ Votre commande a bien été enregistrée !\n\n🛒 Détails de votre commande :\n${clientProducts}\n\n🚚 Votre commande est en cours de préparation et sera livrée à :\n📍 ${shippingAddress}\n📞 ${phoneNumber}\n\nMerci pour votre confiance !\n\n— Kolwaz Shop`
    });
    
    res.status(200).json({ message: `Commande confirmée pour ${mappedCartItems.length} produit(s).` });
  } catch (err) {
    console.error("Erreur lors de la validation de la commande :", err);
    res.status(500).json({ error: err.message });
  }
};
