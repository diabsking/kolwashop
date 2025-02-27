const User = require('../models/User');
const Order = require('../models/Order');
const Product = require('../models/Product');
const nodemailer = require('nodemailer');
const { startOfWeek, endOfWeek, subDays, startOfMonth } = require('date-fns');

// Fonction pour récupérer les statistiques
const getStats = async (req, res) => {
  try {
    const ordersThisWeek = await Order.countDocuments({
      createdAt: {
        $gte: startOfWeek(new Date(), { weekStartsOn: 1 }),
        $lt: endOfWeek(new Date(), { weekStartsOn: 1 })
      }
    });

    const usersThisWeek = await User.countDocuments({
      createdAt: {
        $gte: startOfWeek(new Date()),
        $lt: endOfWeek(new Date())
      }
    });

    const productsThisWeek = await Product.countDocuments({
      createdAt: {
        $gte: startOfWeek(new Date(), { weekStartsOn: 1 }),
        $lt: endOfWeek(new Date(), { weekStartsOn: 1 })
      }
    });

    const activeProducts = await Product.countDocuments({ isDeleted: false });
    const newProductsLast30Days = await Product.countDocuments({
      createdAt: { $gte: subDays(new Date(), 30) }
    });

    const totalSalesThisMonth = await Order.aggregate([
      { $match: { createdAt: { $gte: startOfMonth(new Date()) } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);

    res.json({
      ordersThisWeek,
      usersThisWeek,
      productsThisWeek,
      activeProducts,
      newProductsLast30Days,
      totalSalesThisMonth
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des statistiques :", error);
    res.status(500).json({ message: "Erreur serveur lors de la récupération des statistiques." });
  }
};

// Fonction pour récupérer un produit par ID
const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Produit non trouvé' });
    }
    res.json(product);
  } catch (error) {
    console.error('Erreur lors de la récupération du produit', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Fonction pour supprimer un produit
const deleteProduct = async (req, res) => {
  const productId = req.params.id;
  try {
    // Vérifier si le produit existe
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Produit non trouvé' });
    }

    // Supprimer le produit
    await Product.findByIdAndDelete(productId);

    // Récupérer l'email du vendeur
    const vendorEmail = product.vendorEmail;

    // Configurer le transporteur pour l'email
    const transporter = nodemailer.createTransport({
      service: 'Mailo',
      auth: {
        user: process.env.MAIL_USER || 'kolwazshopp@mailo.com',
        pass: process.env.MAIL_PASS || '1O0C4HbGFMSw'
      }
    });

    // Configurer le message de l'email
    const mailOptions = {
      from: process.env.MAIL_USER || 'kolwazshopp@mailo.com',
      to: vendorEmail,
      subject: 'Votre produit a été supprimé',
      text: `Bonjour,

Votre produit a été supprimé de notre plateforme en raison du non-respect de nos consignes. Si vous pensez qu'il s'agit d'une erreur, veuillez nous contacter.

Cordialement,
L'équipe Kolwaz Shop`
    };

    // Envoyer l'email
    await transporter.sendMail(mailOptions);

    // Réponse de succès
    res.json({ message: 'Produit supprimé et email envoyé au vendeur.' });
  } catch (error) {
    console.error("Erreur lors de la suppression du produit :", error);
    res.status(500).json({ message: "Erreur serveur lors de la suppression du produit." });
  }
};

module.exports = { getStats, deleteProduct, getProductById };