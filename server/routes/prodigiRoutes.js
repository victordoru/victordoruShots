const express = require("express");
const {
  listProducts,
  getProductDetails,
  getQuote,
  createOrder,
  listCatalogProducts,
  createCatalogProduct,
  updateCatalogProduct,
  deleteCatalogProduct,
  listPhotoVariants,
  createPhotoVariant,
  updatePhotoVariant,
  deletePhotoVariant,
} = require("../controllers/prodigiController");
const { authenticate } = require("../middleware/auth");
const upload = require("../middleware/upload");

const router = express.Router();

// Public endpoints
router.get("/products", listProducts);
router.get("/products/:sku", getProductDetails);
router.post("/quotes", getQuote);
router.post("/orders", createOrder);

// Catalog admin endpoints
router.get("/catalog", authenticate, listCatalogProducts);
router.post("/catalog", authenticate, createCatalogProduct);
router.put(
  "/catalog/:catalogProductId",
  authenticate,
  updateCatalogProduct
);
router.delete(
  "/catalog/:catalogProductId",
  authenticate,
  deleteCatalogProduct
);

// Photo variant admin endpoints
router.get(
  "/admin/photos/:photoId/variants",
  authenticate,
  listPhotoVariants
);
router.post(
  "/admin/photos/:photoId/variants",
  authenticate,
  upload.array("mockups", 20),
  createPhotoVariant
);
router.put(
  "/admin/photos/:photoId/variants/:variantId",
  authenticate,
  upload.array("mockups", 20),
  updatePhotoVariant
);
router.delete(
  "/admin/photos/:photoId/variants/:variantId",
  authenticate,
  deletePhotoVariant
);

module.exports = router;
