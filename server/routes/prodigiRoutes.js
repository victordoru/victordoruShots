const express = require("express");
const {
  listProducts,
  getQuote,
  createOrder,
  listCatalogProducts,
  fetchCatalogProductDetails,
  getCatalogProductDetailsPublic,
  createCatalogProduct,
  updateCatalogProduct,
  deleteCatalogProduct,
  getProdigiOrder,
  listProdigiOrders,
  getProdigiOrderActions,
  cancelProdigiOrder,
  updateProdigiShipping,
  updateProdigiRecipient,
  updateProdigiMetadata,
  listPhotoVariants,
  createPhotoVariant,
  updatePhotoVariant,
  deletePhotoVariant,
  updateVariantAsset,
} = require("../controllers/prodigiController");
const { authenticate } = require("../middleware/auth");
const upload = require("../middleware/upload");

const router = express.Router();

// Public endpoints
router.get("/products", listProducts);
router.get("/catalog/details/:sku", getCatalogProductDetailsPublic);
router.post("/quotes", getQuote);
router.post("/orders", createOrder);

// Catalog admin endpoints
router.get("/catalog", authenticate, listCatalogProducts);
router.post("/catalog/lookup", authenticate, fetchCatalogProductDetails);
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

// Order admin endpoints
router.get("/admin/orders", authenticate, listProdigiOrders);
router.get("/admin/orders/:orderId", authenticate, getProdigiOrder);
router.get(
  "/admin/orders/:orderId/actions",
  authenticate,
  getProdigiOrderActions
);
router.post(
  "/admin/orders/:orderId/actions/cancel",
  authenticate,
  cancelProdigiOrder
);
router.post(
  "/admin/orders/:orderId/actions/update-shipping",
  authenticate,
  updateProdigiShipping
);
router.post(
  "/admin/orders/:orderId/actions/update-recipient",
  authenticate,
  updateProdigiRecipient
);
router.post(
  "/admin/orders/:orderId/actions/update-metadata",
  authenticate,
  updateProdigiMetadata
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
router.post(
  "/admin/photos/:photoId/variants/:variantId/asset",
  authenticate,
  upload.single("asset"),
  updateVariantAsset
);

module.exports = router;
