const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const Seller = require('../models/seller'); 
const bcrypt = require('bcryptjs');

// Fonction pour supprimer les comptes non vérifiés après expiration du token
// (Note : cette fonction n'est plus utilisée si tous les comptes sont créés comme vérifiés)
exports.deleteUnverifiedAccounts = async () => {
  try {
    const expirationDate = new Date(Date.now() - 5 * 60 * 1000);  // 5 minutes
    const unverifiedSellers = await Seller.find({ verified: false, createdAt: { $lt: expirationDate } });

    if (unverifiedSellers.length > 0) {
      await Seller.deleteMany({ _id: { $in: unverifiedSellers.map(seller => seller._id) } });
      console.log('Comptes non vérifiés supprimés avec succès.');
    } else {
      console.log('Aucun compte non vérifié à supprimer.');
    }
  } catch (error) {
    console.error('Erreur lors de la suppression des comptes non vérifiés :', error);
  }
};

// Configuration du transporteur SMTP pour Mailo
const transporter = nodemailer.createTransport({
  host: 'mail.mailo.com',
  port: 465,
  secure: true,
  auth: {
    user: 'kolwazshopp@mailo.com',   // Remplacez par votre identifiant Mailo
    pass: process.env.MAILO_PASSWORD || "1O0C4HbGFMSw"
  }
});

/**
 * Inscription d'un vendeur avec envoi d'email de confirmation.
 * Le compte est créé et marqué comme vérifié immédiatement.
 */
exports.signup = async (req, res) => {
  const { name, email, password, storeName } = req.body;
  
  if (!name || !email || !password || !storeName) {
    return res.status(400).json({ message: "Tous les champs sont requis." });
  }
  
  try {
    // Vérifier si le compte existe déjà dans la BDD
    const existingSeller = await Seller.findOne({ email });
    if (existingSeller) {
      return res.status(400).json({ message: "Ce compte existe déjà." });
    }
    
    // Hachage du mot de passe avant de créer le compte
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Création du compte vendeur dans la BDD et marquage immédiat comme vérifié
    const newSeller = new Seller({
      name,
      email,
      password: hashedPassword,
      storeName,
      verified: true
    });
    await newSeller.save();
    
    // Envoi de l'email de confirmation d'inscription
    await transporter.sendMail({
      from: 'kolwazshopp@mailo.com',
      to: email,
      subject: "Création de votre compte vendeur sur Kolwaz Shop",
      text: `Bonjour ${name},

Votre compte vendeur sur Kolwaz Shop a été créé avec succès.
Vous pouvez désormais vous connecter et commencer à utiliser la plateforme.

Cordialement,
L'équipe Kolwaz Shop`,
      html: `<p>Bonjour ${name},</p>
             <p>Votre compte vendeur sur Kolwaz Shop a été créé avec succès.</p>
             <p>Vous pouvez désormais vous connecter et commencer à utiliser la plateforme.</p>
             <p>Cordialement,<br>L'équipe Kolwaz Shop</p>`
    });
    
    return res.status(200).json({ message: "Inscription réussie. Un email de confirmation vous a été envoyé." });
  } catch (error) {
    console.error("Erreur lors de l'inscription :", error);
    return res.status(500).json({ message: "Erreur lors de l'inscription. Veuillez réessayer." });
  }
};

/**
 * Validation du compte via le token envoyé par email.
 * (Cette fonction reste disponible au cas où vous souhaiteriez revenir à une vérification par email ultérieurement)
 */
exports.verify = async (req, res) => {
  let { token } = req.query;
  if (!token) {
    return res.status(400).send("Token manquant.");
  }

  let actualToken = token;

  // Si le token commence par "http", c'est une URL imbriquée contenant le vrai token
  if (token.startsWith("http")) {
    try {
      const decodedUrl = decodeURIComponent(token);
      const nestedUrl = new URL(decodedUrl);
      actualToken = nestedUrl.searchParams.get('token');
      if (!actualToken) {
        throw new Error("Token non trouvé dans l'URL imbriquée.");
      }
    } catch (e) {
      console.error("Erreur d'extraction du token imbriqué :", e);
      return res.status(400).send("Token invalide ou expiré.");
    }
  }

  try {
    const decoded = jwt.verify(actualToken, process.env.JWT_SECRET);
    const email = decoded.email;

    const seller = await Seller.findOne({ email });
    if (!seller) {
      return res.status(400).send("Compte introuvable.");
    }

    seller.verified = true;
    await seller.save();
    res.send("Votre compte a été validé avec succès. Vous pouvez maintenant vous connecter.");
  } catch (error) {
    console.error("Erreur de vérification du token :", error);
    return res.status(400).send("Token invalide ou expiré.");
  }
};

/**
 * Connexion du vendeur après validation du compte.
 */
exports.login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const seller = await Seller.findOne({ email });
    if (!seller) {
      return res.status(400).json({ message: "Compte introuvable." });
    }
    if (!seller.verified) {
      return res.status(400).json({ message: "Votre compte n'est pas validé. Veuillez vérifier votre email." });
    }

    // Comparaison du mot de passe fourni avec le mot de passe haché stocké
    const isMatch = await bcrypt.compare(password, seller.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Mot de passe incorrect." });
    }

    // Génération d'un token de session (valable 24 heures)
    const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.status(200).json({ message: "Connexion réussie.", token });
  } catch (error) {
    console.error("Erreur lors de la connexion :", error);
    return res.status(500).json({ message: "Erreur lors de la connexion." });
  }
};