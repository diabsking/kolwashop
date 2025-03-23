const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken'); // Plus utilisé dans cette version, peut être retiré si inutile ailleurs.
const Seller = require('../models/seller'); 
const bcrypt = require('bcryptjs');

/**
 * Fonction pour supprimer les comptes non vérifiés après expiration du délai de validation.
 */
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

// Configuration du transporteur pour l'envoi d'e-mails
const transporter = nodemailer.createTransport({
  host: "mail.mailo.com",
  port: 465,
  secure: true,
  auth: {
    user: "kolwazshopp@mailo.com",
    pass: process.env.EMAIL_PASS, // Assurez-vous que cette variable d'environnement est définie
  }
});

/**
 * Inscription d'un vendeur avec envoi d'email contenant un code de validation à 6 chiffres.
 * Le compte est créé en tant que non vérifié et doit être activé en fournissant le code reçu par email.
 */
exports.signup = async (req, res) => {
  const { name, email, password, storeName, phone, address, website, logoUrl, description, socialLinks } = req.body;
  
  if (!name || !email || !password || !storeName) {
    return res.status(400).json({ message: "Tous les champs obligatoires sont requis." });
  }
  
  try {
    // Vérifier si le compte existe déjà dans la BDD
    const existingSeller = await Seller.findOne({ email });
    if (existingSeller) {
      return res.status(400).json({ message: "Ce compte existe déjà." });
    }
    
    // Hachage du mot de passe avant de créer le compte
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Génération d'un code de validation à 6 chiffres
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    // Définir la date d'expiration du code (5 minutes)
    const verificationExpires = new Date(Date.now() + 5 * 60 * 1000);
    
    // Création du compte vendeur dans la BDD en tant que non vérifié
    const newSeller = new Seller({
      name,
      email,
      password: hashedPassword,
      storeName,
      phone,
      address,
      website,
      logoUrl,
      description,
      socialLinks,
      verified: false,
      verificationCode,      // Stockage du code
      verificationExpires    // Stockage de la date d'expiration
    });
    
    await newSeller.save();

    // Envoi d'un email de notification
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Validation de votre compte vendeur sur Kolwaz Shop",
      text: `Bonjour ${name},

Votre compte vendeur sur Kolwaz Shop a été créé avec succès.
Voici votre code de validation : ${verificationCode}

Ce code est valable pendant 5 minutes.

Cordialement,
L'équipe Kolwaz Shop`,
      html: `<p>Bonjour ${name},</p>
             <p>Votre compte vendeur sur Kolwaz Shop a été créé avec succès.</p>
             <p>Voici votre code de validation : <strong>${verificationCode}</strong></p>
             <p>Ce code est valable pendant 5 minutes.</p>
             <p>Cordialement,<br>L'équipe Kolwaz Shop</p>`
    };

    await transporter.sendMail(mailOptions);

    return res.status(200).json({ 
      message: "Inscription réussie. Un email de confirmation vous a été envoyé avec un code de validation pour activer votre compte." 
    });

  } catch (error) {  // 🔹 Ajout du bloc catch pour éviter l'erreur de syntaxe
    console.error("Erreur lors de l'inscription :", error);
    return res.status(500).json({ message: "Erreur lors de l'inscription. Veuillez réessayer." });
  }
};
/**
 * Validation du compte via le code envoyé par email.
 * Le client doit fournir son email et le code reçu.
 */
exports.verify = async (req, res) => {
  const { email, code } = req.body;
  
  if (!email || !code) {
    return res.status(400).json({ message: "Email et code de validation sont requis." });
  }
  
  try {
    const seller = await Seller.findOne({ email });
    if (!seller) {
      return res.status(400).json({ message: "Compte introuvable." });
    }
    
    // Vérifier si le code est expiré
    if (seller.verificationExpires < new Date()) {
      return res.status(400).json({ message: "Le code de validation a expiré." });
    }
    
    // Vérifier si le code correspond
    if (seller.verificationCode !== code) {
      return res.status(400).json({ message: "Code de validation invalide." });
    }
    
    // Activer le compte
    seller.verified = true;
    seller.verificationCode = undefined; // Supprimer le code après validation
    seller.verificationExpires = undefined;
    await seller.save();
    
    return res.status(200).json({ message: "Votre compte a été validé avec succès. Vous pouvez maintenant vous connecter." });
  } catch (error) {
    console.error("Erreur lors de la validation du compte :", error);
    return res.status(500).json({ message: "Erreur lors de la validation. Veuillez réessayer." });
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
