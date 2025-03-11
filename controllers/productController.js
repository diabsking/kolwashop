const Product = require("../models/Product");
const transporter = require("../config/mailer");
const SITE_OWNER_EMAIL = process.env.SITE_OWNER_EMAIL || "dieyediabal75@gmail.com";
const express = require('express');
const cloudinary = require('cloudinary').v2;
const nodemailer = require('nodemailer');

cloudinary.config({
  cloud_name: 'dw9stpq7f',
  api_key: '892817559812262',
  api_secret: 'wx0QCh5x2hm7pCq7q__DGeT6ZR4'
});

console.log("WAVE_PAYMENT_ENABLED:", process.env.WAVE_PAYMENT_ENABLED);
console.log("WAVE_PHONE_NUMBER:", process.env.WAVE_PHONE_NUMBER);
console.log("User:", process.env.EMAIL_USER);
console.log("Pass:", process.env.EMAIL_PASS ? "OK" : "NON RÉCUPÉRÉ");

// Fonction de validation pour s'assurer que l'URL de l'image ne contient pas de contenu inapproprié
function validateProductImage(imagePath) {
  console.log("Validation de l'image:", imagePath);
  if (imagePath.includes("porn") || imagePath.includes("adult")) {
    console.log("Image rejetée: contenu inapproprié");
    return false;
  }
  return true;
}

// Fonction pour simuler le traitement d'un paiement via Wave
async function processWavePayment(amount, phoneNumber) {
  console.log(`Paiement de ${amount} FCFA via Wave au ${phoneNumber}...`);
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const isPaymentSuccessful = Math.random() > 0.2;  // 80% de chances de succès
      if (isPaymentSuccessful) {
        console.log("Paiement réussi !");
        resolve({ success: true });
      } else {
        console.error("Échec du paiement via Wave.");
        reject({ success: false, message: "Le paiement a échoué." });
      }
    }, 1000);
  });
}

// Publication d'un produit avec gestion de l'image principale, des photos complémentaires et de la vidéo
exports.publishProduct = async (req, res) => {
  try {
    console.log("Corps de la requête:", req.body);
    console.log("Fichiers de la requête:", req.files);

    const { productName, description, price, deliveryTime, category } = req.body;
    // Supposons que le middleware multer est configuré pour traiter plusieurs champs:
    // req.files.image (tableau avec 1 élément), req.files.photos (tableau), req.files.video (tableau avec 1 élément)
    const imageFile = req.files && req.files.image ? req.files.image[0] : null;

    if (!productName || !description || !price || !deliveryTime || !category || !imageFile) {
      return res.status(400).json({ message: "Tous les champs obligatoires sont requis !" });
    }

    // Upload de l'image principale sur Cloudinary
    const cloudinaryUpload = await cloudinary.uploader.upload(imageFile.path, {
      folder: 'kolwaz_shop_products',
    });
    const imageUrl = cloudinaryUpload.secure_url;

    // Validation de l'image principale
    if (!validateProductImage(imageFile.path)) {
      return res.status(400).json({ message: "Image principale non conforme." });
    }

    // Upload des photos complémentaires (si fournies)
    let photosUrls = [];
    if (req.files && req.files.photos) {
      for (let file of req.files.photos) {
        // Limiter à 4 photos (contrôle côté client mais aussi ici)
        if (photosUrls.length >= 4) break;
        const uploadPhoto = await cloudinary.uploader.upload(file.path, {
          folder: 'kolwaz_shop_products',
        });
        photosUrls.push(uploadPhoto.secure_url);
      }
    }

    // Upload de la vidéo (si fournie)
    let videoUrl = "";
    if (req.files && req.files.video && req.files.video[0]) {
      const videoFile = req.files.video[0];
      const uploadVideo = await cloudinary.uploader.upload(videoFile.path, {
        folder: 'kolwaz_shop_products',
        resource_type: "video",
      });
      videoUrl = uploadVideo.secure_url;
    }

    const priceNumber = parseFloat(price);
    const deliveryTimeNumber = parseInt(deliveryTime, 10);
    if (isNaN(priceNumber) || priceNumber <= 0 || isNaN(deliveryTimeNumber) || deliveryTimeNumber <= 0) {
      return res.status(400).json({ message: "Prix ou délai de livraison invalide." });
    }

    if (process.env.WAVE_PAYMENT_ENABLED === "true") {
      console.log("Traitement du paiement via Wave...");
      try {
        await processWavePayment(100, process.env.WAVE_PHONE_NUMBER || "789024121");
      } catch {
        return res.status(400).json({ message: "Échec du paiement, publication annulée." });
      }
    }

    const newProduct = new Product({
      productName,
      description,
      category,
      price: priceNumber,
      deliveryTime: deliveryTimeNumber,
      sellerEmail: req.user.email,
      imageUrl,
      photos: photosUrls,    // ajout des photos complémentaires
      videoUrl,             // ajout de la vidéo
      createdAt: new Date(),
    });

    await newProduct.save();
    console.log("Produit enregistré:", productName);

    // Partage sur Twitter (fonction à définir séparément)
    if (typeof shareOnTwitter === "function") {
      await shareOnTwitter(newProduct); 
    }

    // Envoi d'un email de notification
    const transporter = nodemailer.createTransport({
      host: 'mail.mailo.com',
      port: 465,
      secure: true,
      auth: {
        user: process.env.MAILO_USER,
        pass: process.env.MAILO_PASSWORD,
      },
    });

    const mailOptions = {
      from: process.env.MAILO_USER,
      to: SITE_OWNER_EMAIL,
      subject: "Nouvelle annonce publiée",
      text: `Produit : ${productName}\nDescription : ${description}\nCatégorie : ${category}\nPrix : ${priceNumber} FCFA\nDélai : ${deliveryTimeNumber} jours`,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.log("Erreur d'envoi :", error);
      } else {
        console.log("E-mail envoyé avec succès :", info.response);
      }
    });

    res.status(201).json({ message: "Produit publié avec succès!" });
  } catch (err) {
    console.error("Erreur lors de la publication du produit:", err.message);
    res.status(500).json({ error: err.message });
  }
};

// Récupération de tous les produits pour affichage sur la page d'accueil
exports.getAllProducts = async (req, res) => {
  try {
    console.log("Récupération des produits...");
    const products = await Product.find({}).sort({ createdAt: -1 });
    console.log("Produits récupérés:", products.length);
    res.status(200).json({ products });
  } catch (err) {
    console.error("Erreur lors de la récupération des produits:", err.message);
    res.status(500).json({ error: err.message });
  }
};

// Récupération des produits du vendeur connecté
exports.getSellerProducts = async (req, res) => {
  try {
    const sellerEmail = req.user.email;
    console.log("Récupération des produits pour le vendeur:", sellerEmail);
    const products = await Product.find({ sellerEmail }).sort({ createdAt: -1 });
    console.log("Produits du vendeur récupérés:", products.length);
    res.status(200).json({ products });
  } catch (err) {
    console.error("Erreur lors de la récupération des produits du vendeur:", err.message);
    res.status(500).json({ error: err.message });
  }
};

exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      console.error("Produit non trouvé:", req.params.id);
      return res.status(404).json({ message: "Produit non trouvé" });
    }
    console.log("Produit trouvé:", product);
    res.status(200).json({ product });
  } catch (err) {
    console.error("Erreur lors de la récupération du produit:", err.message);
    res.status(500).json({ error: err.message });
  }
};

exports.getPopularProducts = async (req, res) => {
  try {
    const produits = await Product.find();
    const produitsPopulaires = produits.map((produit) => {
      const { productName, imageUrl, price } = produit;
      const score = (produit.views * 0.2) + (produit.addToCart * 0.5) + (produit.orders * 1) - ((Date.now() - new Date(produit.publicationDate)) / (1000 * 60 * 60 * 24 * 7));
      return { productName, imageUrl, price, score };
    });
    produitsPopulaires.sort((a, b) => b.score - a.score);
    res.json(produitsPopulaires.slice(0, 10));
  } catch (error) {
    res.status(500).json({ message: "Erreur serveur", error });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const sellerEmail = req.user.email;
    console.log("Mise à jour du produit:", id);

    const product = await Product.findOne({ _id: id, sellerEmail });
    if (!product) {
      console.error("Produit non trouvé pour mise à jour ou non autorisé:", id);
      return res.status(404).json({ message: "Produit non trouvé ou modification non autorisée." });
    }

    const { productName, description, price, deliveryTime } = req.body;

    if (!productName && !description && !price && !deliveryTime && (!req.files || (!req.files.image && !req.files.photos && !req.files.video))) {
      console.error("Aucune donnée à mettre à jour.");
      return res.status(400).json({ message: "Aucune donnée à mettre à jour." });
    }

    if (productName) product.productName = productName;
    if (description) product.description = description;
    if (price) {
      const priceNumber = parseFloat(price);
      if (isNaN(priceNumber) || priceNumber <= 0) {
        return res.status(400).json({ message: "Prix invalide." });
      }
      product.price = priceNumber;
    }
    if (deliveryTime) {
      const deliveryTimeNumber = parseInt(deliveryTime, 10);
      if (isNaN(deliveryTimeNumber) || deliveryTimeNumber <= 0) {
        return res.status(400).json({ message: "Délai de livraison invalide." });
      }
      product.deliveryTime = deliveryTimeNumber;
    }

    // Si une nouvelle image principale est fournie
    if (req.files && req.files.image) {
      const imageFile = req.files.image[0];
      if (!validateProductImage(imageFile.path)) {
        console.error("Image non conforme:", imageFile.path);
        return res.status(400).json({ message: "Mise à jour refusée : image non conforme." });
      }
      const cloudinaryUpload = await cloudinary.uploader.upload(imageFile.path, {
        folder: 'kolwaz_shop_products',
      });
      if (cloudinaryUpload && cloudinaryUpload.secure_url) {
        product.imageUrl = cloudinaryUpload.secure_url;
      } else {
        console.error("Erreur lors de l'upload sur Cloudinary");
        return res.status(500).json({ message: "Erreur lors de l'upload sur Cloudinary" });
      }
    }

    // Mise à jour des photos complémentaires
    if (req.files && req.files.photos) {
      let photosUrls = [];
      for (let file of req.files.photos) {
        if (photosUrls.length >= 4) break;
        const uploadPhoto = await cloudinary.uploader.upload(file.path, {
          folder: 'kolwaz_shop_products',
        });
        photosUrls.push(uploadPhoto.secure_url);
      }
      product.photos = photosUrls;
    }

    // Mise à jour de la vidéo
    if (req.files && req.files.video) {
      const videoFile = req.files.video[0];
      const uploadVideo = await cloudinary.uploader.upload(videoFile.path, {
        folder: 'kolwaz_shop_products',
        resource_type: "video",
      });
      product.videoUrl = uploadVideo.secure_url;
    }

    await product.save();
    console.log("Produit mis à jour:", product);
    res.status(200).json({ message: "Produit mis à jour", product });
  } catch (err) {
    console.error("Erreur lors de la mise à jour du produit:", err.message);
    res.status(500).json({ error: err.message });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    let product;
    if (req.user.role === "admin") {
      product = await Product.findByIdAndDelete(id);
    } else {
      product = await Product.findOneAndDelete({ _id: id, sellerEmail: req.user.email });
    }
    if (!product) {
      return res.status(404).json({ message: "Produit non trouvé ou suppression non autorisée." });
    }
    res.status(200).json({ message: "Produit supprimé avec succès" });
  } catch (err) {
    res.status(500).json({ error: "Erreur lors de la suppression du produit" });
  }
};