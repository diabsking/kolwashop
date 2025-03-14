const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const productController = require('../controllers/productController');
const { isAuthenticated } = require('../middlewares/authMiddleware');

// Configuration du stockage pour Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Dossier où les fichiers seront stockés
  },
  filename: (req, file, cb) => {
    const uniqueFilename = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    cb(null, uniqueFilename);
  },
});

// Filtrage des types de fichiers (images et vidéos)
const fileFilter = (req, file, cb) => {
  const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif']; // Seulement ces images

  if (file.mimetype.startsWith("video/") || allowedImageTypes.includes(file.mimetype)) {
    cb(null, true); // Accepter le fichier
  } else {
    cb(new Error("Format de fichier non supporté"), false); // Rejeter le fichier
  }
};

// Initialisation de Multer avec une limite de 50 Mo
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }
});

// Déclaration des champs attendus dans le formulaire
const uploadFields = upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'photos', maxCount: 4 },
  { name: 'video', maxCount: 1 }
]);

// Recherche par nom et description
router.get('/search', productController.getProductsByNameDescription);

// Route pour récupérer les produits populaires
router.get('/products/popular', productController.getPopularProducts);

// Routes pour récupérer les produits similaires
router.get('/products/similar', (req, res) => {
  res.status(400).json({ message: "L'ID du produit est requis pour récupérer les produits similaires." });
});
router.get('/products/similar/:productId', productController.getSimilarProducts);

// Route pour récupérer les produits du vendeur connecté
router.get('/my-products', isAuthenticated, productController.getSellerProducts);

// Route pour afficher tous les produits
router.get('/', productController.getAllProducts);

// Route pour afficher un produit spécifique par ID (à définir en dernier pour éviter les conflits)
router.get('/:id', productController.getProductById);

// Route pour publier un produit (avec téléchargement d'image, photos et vidéo)
router.post('/publish', isAuthenticated, uploadFields, productController.publishProduct);

// Route pour mettre à jour un produit (avec téléchargement d'image, photos et vidéo)
router.put('/update/:id', isAuthenticated, uploadFields, productController.updateProduct);

// Route pour supprimer un produit
router.delete('/delete/:id', isAuthenticated, productController.deleteProduct);

module.exports = router;