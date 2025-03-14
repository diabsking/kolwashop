// Import des dépendances et configuration de l'environnement
console.log("Démarrage du serveur...");
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const session = require("express-session");
const jwt = require("jsonwebtoken");
const path = require("path");
const cron = require("node-cron");
const nodemailer = require("nodemailer");
const Order = require("./models/Order");
const Product = require("./models/Product"); 

// Initialisation de l'application Express
const app = express();


// Configuration des middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true
}));

// Configuration de Mongoose
const mongoURI = 'mongodb+srv://senfood75:2tzzELuHlxge6eQ8@cluster1.te14d.mongodb.net/kolwazshop?retryWrites=true&w=majority&appName=Cluster1';

mongoose.connect(mongoURI, {
    connectTimeoutMS: 30000,
    serverSelectionTimeoutMS: 30000
}).then(() => {
    console.log('Connexion à MongoDB réussie !');
}).catch(err => {
    console.error('Erreur de connexion à MongoDB :', err);
});

// Importation des modèles, middlewares et routes
const { isAuthenticated, isSeller, verifyToken } = require("./middlewares/authMiddleware");
const { parseContentType } = require("./utils.js");
const sellerRoutes = require("./routes/sellerRoutes");
const productRoutes = require("./routes/productRoutes");
const orderRoutes = require("./routes/orderRoutes");
const { cleanExpiredProducts } = require("./scheduler/cleanup");
const sellerController = require('./controllers/sellerController');

// Définition des routes pour les pages statiques
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});
app.get("/espace-vendeur", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "espace-vendeur.html"));
});
app.get("/dashboard-vendeur", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "Tableau de bord.html"));
});
app.get("/panier", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "panier.html"));
});
app.get("/Administrateur", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "Administrateur.html"));
});

// Servir les fichiers statiques depuis le dossier 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Déclaration des routes d'API
app.use("/api/sellers", sellerRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);

// Exemple d'une route utilisant le modèle Order
app.get("/orders/all", async (req, res) => {
  try {
    const orders = await Order.find();
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Middleware pour afficher le Content-Type des requêtes (après le parsing)
app.use((req, res, next) => {
  const contentType = req.headers["content-type"];
  if (!contentType) {
    console.log("Aucun Content-Type détecté.");
  } else {
    const parsedType = parseContentType(contentType);
    console.log("Content-Type analysé :", parsedType);
  }
  console.log("Headers de la requête :", req.headers);
  console.log("Corps de la requête :", req.body);
  next();
});

// Route pour accéder aux images dans le dossier 'uploads'
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Planification du nettoyage des annonces expirées (tous les jours à minuit)
cron.schedule("0 0 * * *", () => {
  console.log("🧹 Exécution du nettoyage des annonces expirées...");
  cleanExpiredProducts();
});

// Middleware de gestion des erreurs
app.use((err, req, res, next) => {
  console.error("❌ Erreur détectée :", err);
  res.status(500).json({
    error: "Une erreur est survenue",
    message: err.message,
  });
});

// Gestion du panier en mémoire (pour test)
let cart = [];

// Routes de gestion du panier
app.post('/api/add-to-cart', (req, res) => {
  const productData = req.body;
  console.log('Produit ajouté au panier:', productData);
  if (!productData.name || !productData.price) {
    return res.status(400).json({ success: false, message: 'Données incomplètes' });
  }
  cart.push(productData);
  res.json({ success: true, cart });
});

app.get('/api/get-cart', (req, res) => {
  res.json({ cart });
});

app.post('/api/update-cart', (req, res) => {
  cart = req.body.cart || [];
  res.json({ success: true, cart });
});

// Configuration du transporteur pour l'envoi d'e-mails
const transporter = nodemailer.createTransport({
  host: "mail.mailo.com",
  port: 465,
  secure: true,
  auth: {
    user: "kolwazshopp@mailo.com",
    pass: process.env.MAILO_PASSWORD,
  }
});
app.use("/api/orders", require("./routes/orderRoutes"));

// Exemple de cron job pour nettoyer les comptes non vérifiés toutes les 10 minutes
setInterval(() => {
  sellerController.deleteUnverifiedAccounts();
}, 10 * 60 * 1000); // Exécuter toutes les 10 minutes

const deleteProductByNameAndSeller = async (productName, sellerEmail) => {
    try {
        const result = await Product.deleteOne({ productName, sellerEmail });

        if (result.deletedCount > 0) {
            console.log(`✅ Produit "${productName}" supprimé avec succès pour le vendeur ${sellerEmail}.`);
        } else {
            console.log(`⚠️ Aucun produit trouvé avec ce nom et cet email.`);
        }
    } catch (error) {
        console.error("❌ Erreur lors de la suppression du produit :", error);
    }
};

// Route API pour supprimer un produit
app.post('/api/deleteProduct', async (req, res) => {
  const { productId, sellerEmail, reason } = req.body;
  try {
    // Suppression du produit dans la base de données
    const product = await Product.findByIdAndDelete(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: "Produit non trouvé" });
    }

    // Préparation de l'e-mail
    const mailOptions = {
      from: "kolwazshopp@mailo.com",
      to: sellerEmail,
      subject: `Suppression de votre produit (ID: ${productId})`,
      text: `Bonjour,

Votre produit avec l'ID ${productId} a été supprimé pour la raison suivante :
"${reason}"

Si vous avez des questions, merci de contacter notre support.

Cordialement,
L'équipe Kolwaz Shop`
    };

    // Envoi de l'e-mail
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("Erreur lors de l'envoi de l'e-mail :", error);
        return res.status(500).json({ success: false, message: "Erreur lors de l'envoi de l'e-mail" });
      }
      console.log("E-mail envoyé :", info.response);
      res.json({ success: true, message: "Produit supprimé et e-mail envoyé au vendeur" });
    });
  } catch (err) {
    console.error("Erreur serveur :", err);
    res.status(500).json({ success: false, message: "Erreur serveur" });
  }
});
deleteProductByNameAndSeller("", "");

// Démarrage du serveur
const port = process.env.PORT || 3000;
app.listen(port, '0.0.0.0', () => {
  console.log(`Serveur en ligne sur le port ${port}`);
});