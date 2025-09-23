const express = require("express");
const {
  listProducts,
  getQuote,
  createOrder,
  createProdigiProduct,
  updateProdigiProduct,
  deleteProdigiProduct,
  updatePhotoProducts,
} = require("../controllers/prodigiController");
const { authenticate } = require("../middleware/auth");
const upload = require("../middleware/upload");

const router = express.Router();

// Public endpoints
router.get("/products", listProducts);
router.post("/quotes", getQuote);
router.post("/orders", createOrder);

// Admin / CMS endpoints
router.get("/admin/products", authenticate, listProducts);
router.post(
  "/admin/products",
  authenticate,
  upload.array("images", 10),
  createProdigiProduct
);
router.put(
  "/admin/products/:productId",
  authenticate,
  upload.array("images", 10),
  updateProdigiProduct
);
router.delete("/admin/products/:productId", authenticate, deleteProdigiProduct);
router.put(
  "/admin/photos/:photoId/products",
  authenticate,
  updatePhotoProducts
);

module.exports = router;
