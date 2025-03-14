require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const session = require("express-session");
const nodemailer = require("nodemailer");
const path = require("path");
const cron = require("node-cron");
const sellerController = require('./controllers/sellerController');
const Order = require("./models/Order");
const Product = require("./models/Product");

const app = express();

// ---------- CONFIGURATION DES MIDDLEWARES ----------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Sessions sécurisées
app.use(session({
  secret: process.env.SESSION_SECRET || 'secretKey', // Mettre une valeur sécurisée dans .env
  resave: false,
  saveUninitialized: true
}));

// ---------- CONFIGURATION DE LA BASE DE DONNÉES ----------
const mongoURI = process.env.MONGO_URI || "mongodb://localhost:27017/kolwazshop";
mongoose.connect(mongoURI, {
  connectTimeoutMS: 30000,
  serverSelectionTimeoutMS: 30000
}).then(() => {
  console.log('✅ Connexion à MongoDB réussie !');
}).catch(err => {
  console.error('❌ Erreur de connexion à MongoDB :', err);
});

// ---------- IMPORTATION DES ROUTES ----------
const sellerRoutes = require("./routes/sellerRoutes");
const productRoutes = require("./routes/productRoutes");
const orderRoutes = require("./routes/orderRoutes");

// ---------- ROUTES PRINCIPALES ----------
app.use("/api/sellers", sellerRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);

// Route d'accès aux fichiers statiques
app.use(express.static(path.join(__dirname, 'public')));

// Servir les pages HTML
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/espace-vendeur", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "espace-vendeur.html"));
});

app.get("/panier", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "panier.html"));
});

// ---------- ROUTES D'API SUPPLÉMENTAIRES ----------
// Gestion en mémoire du panier (pour tests ou démos)
let cart = [];

app.post('/api/add-to-cart', (req, res) => {
  const productData = req.body;
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

// ---------- CONFIGURATION DE L'ENVOI D'E-MAILS ----------
const transporter = nodemailer.createTransport({
  host: "mail.mailo.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// ---------- PLANIFICATION DES TÂCHES ----------
cron.schedule("0 0 * * *", () => {
  console.log("🧹 Nettoyage des annonces expirées...");
  sellerController.deleteExpiredProducts();
});

// Nettoyage périodique des comptes non vérifiés
setInterval(() => {
  sellerController.deleteUnverifiedAccounts();
}, 10 * 60 * 1000); // Toutes les 10 minutes

// ---------- ROUTE D'EXEMPLE POUR LES COMMANDES ----------
app.post("/api/orders", async (req, res) => {
  try {
    const { courriel, adresse, phoneNumber, panierObjets } = req.body;

    if (!courriel || !adresse || !phoneNumber || !Array.isArray(panierObjets) || panierObjets.length === 0) {
      return res.status(400).json({ message: "Tous les champs sont requis et le panier ne peut pas être vide !" });
    }

    panierObjets.forEach(item => {
      if (!item.sellerEmail) {
        console.warn(`⚠️ Produit "${item.name}" sans email vendeur.`);
      }
    });

    // Simuler une sauvegarde en base
    console.log("Commande reçue :", panierObjets);
    res.status(200).json({ message: "Commande confirmée." });
  } catch (err) {
    console.error("Erreur lors de la commande :", err);
    res.status(500).json({ message: "Une erreur est survenue.", error: err.message });
  }
});

// ---------- MIDDLEWARES DE GESTION D'ERREURS ----------
app.use((req, res) => {
  res.status(404).json({ error: "Ressource non trouvée" });
});

app.use((err, req, res, next) => {
  console.error("Erreur serveur :", err);
  res.status(500).json({ message: "Une erreur interne est survenue." });
});

// ---------- DÉMARRAGE DU SERVEUR ----------
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${port}`);
});