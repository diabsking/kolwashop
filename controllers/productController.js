// controllers/productController.js

const Product = require("../models/Product");
const transporter = require("../config/mailer");
const SITE_OWNER_EMAIL = process.env.SITE_OWNER_EMAIL || "dieyediabal75@gmail.com";
const cloudinary = require("cloudinary").v2;
const nodemailer = require("nodemailer");

// Configuration de Cloudinary
cloudinary.config({
  cloud_name: "dw9stpq7f",
  api_key: "892817559812262",
  api_secret: "wx0QCh5x2hm7pCq7q__DGeT6ZR4",
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

console.log("WAVE_PAYMENT_ENABLED:", process.env.WAVE_PAYMENT_ENABLED);
console.log("WAVE_PHONE_NUMBER:", process.env.WAVE_PHONE_NUMBER);
console.log("User:", process.env.EMAIL_USER);
console.log("Pass:", process.env.EMAIL_PASS ? "OK" : "NON RÉCUPÉRÉ");

// *********************************************
// IMPORTANT : Vérifiez que votre configuration Multer
// dans vos routes correspond aux champs suivants :
// { name: 'image', maxCount: 1 },
// { name: 'photos', maxCount: 4 },
// { name: 'video', maxCount: 1 }
// *********************************************

// Fonction de validation pour l'image du produit
function validateProductImage(imagePath) {
  console.log("Validation de l'image:", imagePath);
  // Vérification simple pour éviter certains contenus inappropriés
  if (imagePath.toLowerCase().includes("porn") || imagePath.toLowerCase().includes("adult")) {
    console.log("Image rejetée: contenu inapproprié");
    return false;
  }
  return true;
}

// Fonction pour simuler un paiement via Wave
async function processWavePayment(amount, phoneNumber) {
  console.log(`Paiement de ${amount} FCFA via Wave au ${phoneNumber}...`);
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const isPaymentSuccessful = Math.random() > 0.2; // 80% de chances de succès
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

// Publication d'un produit
const publishProduct = async (req, res) => {
  try {
    // Pour faciliter le debug, on logue les données reçues
    console.log("req.body:", req.body);
    console.log("req.files:", req.files);

    // Vérifier que l'utilisateur est authentifié
    if (!req.user || !req.user.email) {
      console.error("Utilisateur non authentifié");
      return res.status(401).json({ message: "Utilisateur non authentifié" });
    }

    // Extraction des champs obligatoires
    const { productName, description, price, deliveryTime, category } = req.body;
    // Champs optionnels
    const discount = req.body.discount ? parseFloat(req.body.discount) : 0;
    const discountType = req.body.discountType || "";
    const brand = req.body.brand || "";
    const stock = req.body.stock ? parseInt(req.body.stock, 10) : 0;
    const sku = req.body.sku || "";
    const weight = req.body.weight ? parseFloat(req.body.weight) : 0;
    const length = req.body.length ? parseFloat(req.body.length) : 0;
    const width = req.body.width ? parseFloat(req.body.width) : 0;
    const height = req.body.height ? parseFloat(req.body.height) : 0;
    const shippingCost = req.body.shippingCost ? parseFloat(req.body.shippingCost) : 0;
    const estimatedDelivery = req.body.estimatedDelivery ? parseInt(req.body.estimatedDelivery, 10) : 0;
    const returnPolicy = req.body.returnPolicy || "";
    const warranty = req.body.warranty || "";

    // Vérification des champs obligatoires
    if (!productName || !description || !price || !deliveryTime || !category) {
      console.error("Champs obligatoires manquants");
      return res.status(400).json({ message: "Tous les champs obligatoires sont requis !" });
    }

    // Vérifier la présence du fichier image principal
    const imageFile = req.files && req.files.image ? req.files.image[0] : null;
    if (!imageFile) {
      console.error("Image principale manquante");
      return res.status(400).json({ message: "L'image principale est requise." });
    }

    // Validation de l'image principale avant upload
    if (!validateProductImage(imageFile.path)) {
      console.error("Image principale non conforme:", imageFile.path);
      return res.status(400).json({ message: "Image principale non conforme." });
    }

    // Upload de l'image principale sur Cloudinary
    const cloudinaryUpload = await cloudinary.uploader.upload(imageFile.path, {
      folder: "kolwaz_shop_products",
    });
    if (!cloudinaryUpload || !cloudinaryUpload.secure_url) {
      console.error("Erreur lors de l'upload de l'image principale");
      return res.status(500).json({ message: "Erreur lors de l'upload de l'image principale" });
    }
    const imageUrl = cloudinaryUpload.secure_url;

    // Upload des photos complémentaires (max. 4)
    let photosUrls = [];
    if (req.files && req.files.photos && Array.isArray(req.files.photos)) {
      for (let file of req.files.photos) {
        // Limiter à 4 photos
        if (photosUrls.length >= 4) break;
        const uploadPhoto = await cloudinary.uploader.upload(file.path, {
          folder: "kolwaz_shop_products",
        });
        if (uploadPhoto && uploadPhoto.secure_url) {
          photosUrls.push(uploadPhoto.secure_url);
        } else {
          console.error("Erreur lors de l'upload d'une photo complémentaire");
        }
      }
    }

    // Upload de la vidéo si elle est fournie
    let videoUrl = "";
    if (req.files && req.files.video && Array.isArray(req.files.video) && req.files.video[0]) {
      const videoFile = req.files.video[0];
      const uploadVideo = await cloudinary.uploader.upload(videoFile.path, {
        folder: "kolwaz_shop_products",
        resource_type: "video",
      });
      if (uploadVideo && uploadVideo.secure_url) {
        videoUrl = uploadVideo.secure_url;
      } else {
        console.error("Erreur lors de l'upload de la vidéo");
      }
    }

    // Vérifier la validité du prix et du délai
    const priceNumber = parseFloat(price);
    const deliveryTimeNumber = parseInt(deliveryTime, 10);
    if (isNaN(priceNumber) || priceNumber <= 0 || isNaN(deliveryTimeNumber) || deliveryTimeNumber <= 0) {
      console.error("Prix ou délai de livraison invalide");
      return res.status(400).json({ message: "Prix ou délai de livraison invalide." });
    }

    // Traitement du paiement via Wave si activé
    if (process.env.WAVE_PAYMENT_ENABLED === "true") {
      console.log("Traitement du paiement via Wave...");
      try {
        await processWavePayment(100, process.env.WAVE_PHONE_NUMBER || "789024121");
      } catch (paymentError) {
        console.error("Paiement Wave échoué:", paymentError);
        return res.status(400).json({ message: "Échec du paiement, publication annulée." });
      }
    }

    // Création du produit
    const newProduct = new Product({
      productName,
      description,
      category,
      price: priceNumber,
      deliveryTime: deliveryTimeNumber,
      sellerEmail: req.user.email,
      imageUrl,
      photos: photosUrls,
      videoUrl,
      discount,
      discountType,
      brand,
      stock,
      sku,
      weight,
      dimensions: { length, width, height },
      shippingCost,
      estimatedDelivery,
      returnPolicy,
      warranty,
      createdAt: new Date(),
    });

    await newProduct.save();
    console.log("Produit enregistré:", productName);

    // Optionnel : partage sur Twitter si la fonction shareOnTwitter existe
    if (typeof shareOnTwitter === "function") {
      await shareOnTwitter(newProduct);
    }

    // Envoi d'un email de notification
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: SITE_OWNER_EMAIL,
      subject: "Nouvelle annonce publiée",
      text: `Produit : ${productName}\nDescription : ${description}\nCatégorie : ${category}\nPrix : ${priceNumber} FCFA\nDélai : ${deliveryTimeNumber} jours`,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("Erreur d'envoi d'email:", error);
      } else {
        console.log("E-mail envoyé avec succès:", info.response);
      }
    });

    res.status(201).json({ message: "Produit publié avec succès!" });
  } catch (err) {
    console.error("Erreur lors de la publication du produit:", err.message);
    res.status(500).json({ error: err.message });
  }
};

// Récupération de tous les produits
const getAllProducts = async (req, res) => {
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
const getSellerProducts = async (req, res) => {
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

// Récupération d'un produit par son ID
const getProductById = async (req, res) => {
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

// Récupération des produits populaires
const getPopularProducts = async (req, res) => {
  try {
    const produits = await Product.find();
    const produitsPopulaires = produits.map((produit) => {
      const { productName, imageUrl, price } = produit;
      // Calcul d'un score simple en fonction de certains critères et de l'ancienneté
      const score =
        (produit.views * 0.2) +
        (produit.addToCart * 0.5) +
        (produit.orders * 1) -
        ((Date.now() - new Date(produit.createdAt)) / (1000 * 60 * 60 * 24 * 7));
      return { productName, imageUrl, price, score };
    });
    produitsPopulaires.sort((a, b) => b.score - a.score);
    res.status(200).json(produitsPopulaires.slice(0, 10));
  } catch (error) {
    res.status(500).json({ message: "Erreur serveur", error });
  }
};

// Récupération des produits similaires à partir d'un produit de référence
const getSimilarProducts = async (req, res) => {
  try {
    const { productId } = req.params;
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Produit de référence non trouvé" });
    }
    const similarProducts = await Product.find({
      category: product.category,
      _id: { $ne: productId },
      $or: [
        { productName: { $regex: new RegExp(product.productName, "i") } },
        { description: { $regex: new RegExp(product.description, "i") } },
      ],
    }).limit(10);
    res.status(200).json(similarProducts);
  } catch (error) {
    console.error("Erreur lors de la récupération des produits similaires:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// Mise à jour d'un produit
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const sellerEmail = req.user.email;
    console.log("Mise à jour du produit:", id);
    const product = await Product.findOne({ _id: id, sellerEmail });
    if (!product) {
      console.error("Produit non trouvé ou non autorisé pour mise à jour:", id);
      return res.status(404).json({ message: "Produit non trouvé ou modification non autorisée." });
    }
    
    // Vérifier qu'au moins une donnée (body ou fichier) est envoyée
    if (
      !Object.keys(req.body).length &&
      (!req.files || (!req.files.image && !req.files.photos && !req.files.video))
    ) {
      console.error("Aucune donnée à mettre à jour.");
      return res.status(400).json({ message: "Aucune donnée à mettre à jour." });
    }

    const { productName, description, price, deliveryTime } = req.body;
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
    if (req.body.discount !== undefined) product.discount = parseFloat(req.body.discount);
    if (req.body.discountType) product.discountType = req.body.discountType;
    if (req.body.brand) product.brand = req.body.brand;
    if (req.body.stock !== undefined) product.stock = parseInt(req.body.stock, 10);
    if (req.body.sku) product.sku = req.body.sku;
    if (req.body.weight !== undefined) product.weight = parseFloat(req.body.weight);
    if (req.body.length !== undefined || req.body.width !== undefined || req.body.height !== undefined) {
      product.dimensions = {
        length: req.body.length ? parseFloat(req.body.length) : (product.dimensions ? product.dimensions.length : 0),
        width: req.body.width ? parseFloat(req.body.width) : (product.dimensions ? product.dimensions.width : 0),
        height: req.body.height ? parseFloat(req.body.height) : (product.dimensions ? product.dimensions.height : 0),
      };
    }
    if (req.body.shippingCost !== undefined) product.shippingCost = parseFloat(req.body.shippingCost);
    if (req.body.estimatedDelivery !== undefined) product.estimatedDelivery = parseInt(req.body.estimatedDelivery, 10);
    if (req.body.returnPolicy) product.returnPolicy = req.body.returnPolicy;
    if (req.body.warranty) product.warranty = req.body.warranty;

    // Mise à jour de l'image principale si un fichier est fourni
    if (req.files && req.files.image) {
      const imageFile = req.files.image[0];
      if (!validateProductImage(imageFile.path)) {
        console.error("Image non conforme:", imageFile.path);
        return res.status(400).json({ message: "Mise à jour refusée : image non conforme." });
      }
      const cloudinaryUpload = await cloudinary.uploader.upload(imageFile.path, { folder: "kolwaz_shop_products" });
      if (cloudinaryUpload && cloudinaryUpload.secure_url) {
        product.imageUrl = cloudinaryUpload.secure_url;
      } else {
        console.error("Erreur lors de l'upload sur Cloudinary");
        return res.status(500).json({ message: "Erreur lors de l'upload sur Cloudinary" });
      }
    }

    // Mise à jour des photos complémentaires
    if (req.files && req.files.photos && Array.isArray(req.files.photos)) {
      let photosUrls = [];
      for (let file of req.files.photos) {
        if (photosUrls.length >= 4) break;
        const uploadPhoto = await cloudinary.uploader.upload(file.path, { folder: "kolwaz_shop_products" });
        if (uploadPhoto && uploadPhoto.secure_url) {
          photosUrls.push(uploadPhoto.secure_url);
        }
      }
      // Remplacer l'ensemble des photos existantes par les nouvelles
      product.photos = photosUrls;
    }

    // Mise à jour de la vidéo si fournie
    if (req.files && req.files.video && Array.isArray(req.files.video) && req.files.video[0]) {
      const videoFile = req.files.video[0];
      const uploadVideo = await cloudinary.uploader.upload(videoFile.path, { folder: "kolwaz_shop_products", resource_type: "video" });
      if (uploadVideo && uploadVideo.secure_url) {
        product.videoUrl = uploadVideo.secure_url;
      }
    }

    await product.save();
    console.log("Produit mis à jour:", product);
    res.status(200).json({ message: "Produit mis à jour", product });
  } catch (err) {
    console.error("Erreur lors de la mise à jour du produit:", err.message);
    res.status(500).json({ error: err.message });
  }
};

// Suppression d'un produit
const deleteProduct = async (req, res) => {
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
    console.error("Erreur lors de la suppression du produit:", err.message);
    res.status(500).json({ error: "Erreur lors de la suppression du produit" });
  }
};

// Récupération des produits par nom et description (filtrage)
const getProductsByNameDescription = async (req, res) => {
  try {
    const { name, description } = req.query;
    const filter = {};
    if (name) {
      filter.productName = { $regex: name, $options: 'i' };
    }
    if (description) {
      filter.description = { $regex: description, $options: 'i' };
    }
    const products = await Product.find(filter);
    res.status(200).json({ products });
  } catch (err) {
    console.error("Erreur lors de la récupération des produits par nom et description:", err);
    res.status(500).json({ error: err.message });
  }
};

module.exports = { 
  publishProduct, 
  getAllProducts, 
  getSellerProducts, 
  getProductById, 
  getPopularProducts, 
  getSimilarProducts, 
  updateProduct, 
  deleteProduct,
  getProductsByNameDescription 
};
