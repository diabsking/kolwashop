const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const productController = require('../controllers/productController');
const { isAuthenticated } = require('../middlewares/authMiddleware');
const { getPopularProducts } = require('../controllers/productController');

// Configuration du stockage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Dossier où les fichiers seront stockés
  },
  filename: (req, file, cb) => {
    const uniqueFilename = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    cb(null, uniqueFilename);
  },
});

// Filtrage des types de fichiers
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'image/jpeg', 'image/png', 'image/gif', // Images
    'video/mp4', 'video/mpeg', 'video/quicktime' // Vidéos
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Format de fichier non autorisé!'), false);
  }
};

// Initialisation de Multer
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // Limite de 50 Mo (peut être ajustée)
});

module.exports = {
  uploadSingle: upload.single('file'), // Pour un seul fichier
  uploadMultiple: upload.array('files', 10) // Pour plusieurs fichiers (max 10)
};

router.get('/products/popular', getPopularProducts); // ✅ Route spécifique d'abord

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