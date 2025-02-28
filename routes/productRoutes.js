const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const productController = require('../controllers/productController');
const { isAuthenticated } = require('../middlewares/authMiddleware');
const { getPopularProducts } = require('../controllers/productController');

// Configuration de multer pour gérer le téléchargement des images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Dossier où les fichiers seront stockés
  },
  filename: (req, file, cb) => {
    const uniqueFilename = Date.now() + path.extname(file.originalname);
    cb(null, uniqueFilename); // Nom du fichier avec un timestamp pour éviter les conflits
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png']; // Types de fichiers autorisés
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Format de fichier non autorisé!'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // Limite de taille de fichier à 5 Mo
});

router.get('/products/popular', getPopularProducts); // ✅ Route spécifique d'abord

router.get("/popular", productController.getPopularProducts);
// Route pour récupérer les produits du vendeur connecté
router.get('/my-products', isAuthenticated, productController.getSellerProducts);

// Route pour afficher tous les produits
router.get('/', productController.getAllProducts);

// Route pour afficher un produit spécifique par ID
router.get('/:id', productController.getProductById);

// Route pour publier un produit
router.post('/publish', isAuthenticated, upload.single('image'), productController.publishProduct);

// Route pour mettre à jour un produit
router.put('/update/:id', isAuthenticated, upload.single('image'), productController.updateProduct);

// Route pour supprimer un produit
router.delete('/delete/:id', isAuthenticated, productController.deleteProduct);

module.exports = router;