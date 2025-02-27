const express = require('express');
const router = express.Router();
const sellerController = require('../controllers/sellerController');

router.post('/signup', sellerController.signup);
router.get('/verify', sellerController.verify);
router.post('/login', sellerController.login);

module.exports = router;