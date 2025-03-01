const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const Seller = require('../models/seller'); 
const moment = require('moment'); // Si tu n'as pas déjà installé Moment.js, utilise 'npm install moment'

// Fonction pour supprimer les comptes non vérifiés après expiration du token
exports.deleteUnverifiedAccounts = async () => {
  try {
    const expirationDate = new Date(Date.now() - 15 * 60 * 1000);  // Token expiré après 5 minutes
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
    pass:   process.env.MAILO_PASSWORD || "1O0C4HbGFMSw"
  }
});

/**
 * Inscription d'un vendeur avec envoi d'email de validation.
 * L'email est envoyé avec un token expirant en 5 minutes.
 * Seul un email envoyé avec succès permettra de créer le compte.
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
    
   // Générer un token de vérification avec une expiration de 24 heures
   const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '24h' });
   const verificationLink = `http://localhost:3000/api/sellers/verify?token=${token}`;
    
    // Essayer d'envoyer l'email de validation
  await transporter.sendMail({
  from: 'kolwazshopp@mailo.com',
  to: email,
  subject: "Validation de votre compte vendeur - Règles du site",
  text: `Bonjour ${name},

Merci de vous être inscrit sur Kolwaz Shop.

Pour valider votre compte, veuillez cliquer sur le lien suivant (lien valable 15 minutes) : ${verificationLink}

Règles du site :
- La livraison est effectuée par le vendeur gratuitement pour attirer les clients.
- Un produit reste actif pendant 45 jours sur notre plateforme.
- Vous recevrez vos commandes directement par email et vous serez responsable de leur gestion avec vos clients.
- Vous êtes autonome dans la gestion de votre compte vendeur.
- Il est impératif de publier des photos claires et de rédiger une description précise et complète de vos produits. En cas de manquement, l'équipe Kolwaz Shop se réserve le droit de supprimer votre annonce.
- Respectez vos engagements de livraison et offrez un service client de qualité.

Nous vous invitons à consulter nos Conditions Générales d'Utilisation pour plus de détails.

Cordialement,
L'équipe Kolwaz Shop`,
  html: `<p>Bonjour ${name},</p>
         <p>Merci de vous être inscrit sur Kolwaz Shop.</p>
         <p>Pour valider votre compte, veuillez cliquer sur le lien suivant (lien valable 24h) :</p>
         <a href="${verificationLink}">Valider mon compte</a>
         <h3>Règles du site</h3>
         <ul>
           <li>La livraison est effectuée par le vendeur gratuitement pour attirer les clients.</li>
           <li>Un produit reste actif pendant 45 jours sur notre plateforme.</li>
           <li>Vous recevrez vos commandes directement par email et vous serez responsable de leur gestion avec vos clients.</li>
           <li>Vous êtes autonome dans la gestion de votre compte vendeur.</li>
           <li>Il est impératif de publier des photos claires et de rédiger une description précise et complète. En cas de manquement, l'équipe Kolwaz Shop pourra supprimer votre annonce.</li>
           <li>Respectez vos engagements de livraison et offrez un service client de qualité.</li>
         </ul>
         <p>N'hésitez pas à consulter nos <a href="URL_conditions">Conditions Générales d'Utilisation</a> pour plus de détails.</p>
         <p>Cordialement,<br>L'équipe Kolwaz Shop</p>`
})
.then(() => {
  console.log("Email envoyé avec succès");
})
.catch(err => {
  console.error("Erreur lors de l'envoi de l'email :", err);
});
    // Si l'envoi de l'email est réussi, créer le compte vendeur dans la BDD
    const newSeller = new Seller({ name, email, password, storeName, verified: false });
    await newSeller.save();
    
    return res.status(200).json({ message: "Inscription réussie. Veuillez vérifier votre email pour valider votre compte." });
  } catch (error) {
    console.error("Erreur lors de l'inscription :", error);
    return res.status(500).json({ message: "Erreur lors de l'inscription. Veuillez réessayer." });
  }
};

/**
 * Validation du compte via le token envoyé par email.
 */
exports.verify = async (req, res) => {
  const { token } = req.query;
  if (!token) {
    return res.status(400).send("Token manquant.");
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
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
    // Pour plus de sécurité, utilisez un module comme bcrypt pour comparer le mot de passe haché
    if (seller.password !== password) {
      return res.status(400).json({ message: "Mot de passe incorrect." });
    }

    // Générer un token de session (valable 5 minutes)
    const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '59' });
    res.status(200).json({ message: "Connexion réussie.", token });
  } catch (error) {
    console.error("Erreur lors de la connexion :", error);
    return res.status(500).json({ message: "Erreur lors de la connexion." });
}
}; 
