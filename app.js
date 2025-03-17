console.log("Démarrage du serveur...");
require("dotenv").config();

const express = require("express");
const multer = require('multer');
const mongoose = require("mongoose");
const cors = require("cors");
const session = require("express-session");
const jwt = require("jsonwebtoken");
const path = require("path");
const cron = require("node-cron");
const nodemailer = require("nodemailer");

// Import des modèles
const Order = require("./models/Order");
const Product = require("./models/Product");

// Import des routes 
const sellerRoutes = require("./routes/sellerRoutes");
const productRoutes = require("./routes/productRoutes");
const orderRoutes = require("./routes/orderRoutes"); // Potentielle redondance avec ordersRoutes, à vérifier

// Import des middlewares et utilitaires
const { isAuthenticated, isSeller, verifyToken } = require("./middlewares/authMiddleware");
const { parseContentType } = require("./utils.js");

// Import du scheduler et des contrôleurs
const { cleanExpiredProducts } = require("./scheduler/cleanup");
const sellerController = require('./controllers/sellerController');
const orderController = require('./controllers/orderController'); // Vérifiez le chemin correct

const app = express();

// --- Configuration des Middlewares ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true
}));

// Middleware de log pour afficher le Content-Type, les headers et le corps de la requête
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

// --- Connexion à MongoDB ---
const mongoURI = 'mongodb+srv://senfood75:2tzzELuHlxge6eQ8@cluster1.te14d.mongodb.net/kolwazshop?retryWrites=true&w=majority&appName=Cluster1';
mongoose.connect(mongoURI, {
    connectTimeoutMS: 30000,
    serverSelectionTimeoutMS: 30000
}).then(() => {
    console.log('Connexion à MongoDB réussie !');
}).catch(err => {
    console.error('Erreur de connexion à MongoDB :', err);
});

// --- Définition des Routes pour les Pages Statique ---
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
app.get("/Accueil", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "Accueil.html"));
});

// Servir les fichiers statiques depuis le dossier 'public'
app.use(express.static(path.join(__dirname, 'public')));

// --- Déclaration des Routes d'API ---
app.use("/api/sellers", sellerRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);  // Utilisation correcte de orderRoutes, sans duplication

// Route pour servir les images du dossier 'uploads'
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- Gestion du Panier (en mémoire pour test) ---
let cart = [];

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
// Route POST pour la création d'une commande
app.post('/api/orders', orderController.confirmOrder);

// --- Configuration de Nodemailer ---
const transporter = nodemailer.createTransport({
  host: "mail.mailo.com",
  port: 465,
  secure: true,
  auth: {
    user: "kolwazshopp@mailo.com",
    pass: process.env.MAILO_PASSWORD,
  }
});

// --- Planification des Tâches ---
cron.schedule("0 0 * * *", () => {
  console.log("🧹 Exécution du nettoyage des annonces expirées...");
  cleanExpiredProducts();
});

// Nettoyage des comptes vendeurs non vérifiés toutes les 10 minutes
setInterval(() => {
  sellerController.deleteUnverifiedAccounts();
}, 10 * 60 * 1000); // Toutes les 10 minutes

// --- Fonction utilitaire pour supprimer un produit par nom et vendeur ---
// (Cette fonction est définie pour usage ultérieur et n'est pas appelée directement ici.)
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

// --- Route API pour Supprimer un Produit ---
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
// Configuration de Multer pour stocker les fichiers dans le dossier 'uploads'
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Dossier où les images seront stockées
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix);
  },
});

// Limiter à 4 images
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Max 5MB par image
}).array('photos', 4); // Ici, 'photos' est le nom du champ, et 4 est le max d'images autorisées

// Route pour recevoir le formulaire avec les images
app.post('/upload', (req, res) => {
  upload(req, res, (err) => {
    if (err) {
      return res.status(400).send('Erreur de téléchargement des images: ' + err.message);
    }

    // Si les images sont bien reçues
    res.send('Les images ont été téléchargées avec succès!');
  });
});

// --- Middleware de Gestion des Erreurs ---
// Ce middleware doit être déclaré après toutes les routes
app.use((err, req, res, next) => {
  console.error("❌ Erreur détectée :", err);
  res.status(500).json({
    error: "Une erreur est survenue",
    message: err.message,
  });
});

// Démarrage du serveur
const port = process.env.PORT || 3000;
app.listen(port, '0.0.0.0', () => {
  console.log(`Serveur en ligne sur le port ${port}`);
});