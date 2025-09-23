const { randomUUID } = require("crypto");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const Photo = require("../models/Photo");
const ProdigiProduct = require("../models/ProdigiProduct");
const {
  isProdigiConfigured,
  prodigiRequest,
} = require("../utils/prodigiClient");

const PRODIGI_ASSET_BASE_URL = process.env.PRODIGI_ASSET_BASE_URL;
const DEFAULT_SHIPPING_METHOD =
  process.env.PRODIGI_DEFAULT_SHIPPING_METHOD || "Budget";

const sanitizeInt = (value, fallback = 1) => {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, 10);
};

const normalizeRecipient = (recipient = {}) => {
  const requiredFields = [
    "name",
    "email",
    "addressLine1",
    "city",
    "postalCode",
    "countryCode",
  ];

  const missing = requiredFields.filter((field) => !recipient[field]);
  if (missing.length) {
    const error = new Error(
      `Faltan campos obligatorios del destinatario: ${missing.join(", ")}`
    );
    error.status = 400;
    throw error;
  }

  const address = {
    line1: recipient.addressLine1.trim(),
    townOrCity: recipient.city.trim(),
    postalOrZipCode: recipient.postalCode.trim(),
    countryCode: recipient.countryCode.trim().toUpperCase(),
  };

  if (recipient.addressLine2) {
    address.line2 = recipient.addressLine2.trim();
  }

  if (recipient.stateOrCounty || recipient.state) {
    address.stateOrCounty = (recipient.stateOrCounty || recipient.state).trim();
  }

  return {
    name: recipient.name.trim(),
    email: recipient.email.trim(),
    phoneNumber: recipient.phoneNumber?.trim() || undefined,
    address,
  };
};

const buildAssetUrl = (imagePath) => {
  if (/^https?:\/\//i.test(imagePath)) {
    return imagePath;
  }

  if (!PRODIGI_ASSET_BASE_URL) {
    throw new Error(
      "Prodigi asset base URL is not configured and image path is relative"
    );
  }

  return `${PRODIGI_ASSET_BASE_URL.replace(/\/$/, "")}/${imagePath.replace(/^\//, "")}`;
};

const removeLocalFile = (relativePath) => {
  if (!relativePath || typeof relativePath !== "string") return;
  const normalized = relativePath.replace(/^\/+/, "");
  if (!normalized.startsWith("uploads/")) return;

  const filePath = path.join(__dirname, "..", normalized);
  fs.unlink(filePath, (err) => {
    if (err && err.code !== "ENOENT") {
      console.warn("No se pudo eliminar el archivo", filePath, err.message);
    }
  });
};

const parseArrayFromBody = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
};

const toCurrencyCode = (value, fallback = "EUR") => {
  if (!value) return fallback;
  return String(value).trim().toUpperCase().slice(0, 3) || fallback;
};

const toSizingValue = (value, fallback = "fillPrintArea") => {
  if (!value) return fallback;
  return String(value).trim() || fallback;
};

const toNumeric = (value, fallback = 0) => {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const loadPhotoAndProduct = async ({ photoId, productId, productSku }) => {
  if (!photoId) {
    return {
      error: {
        status: 400,
        message: "photoId es obligatorio",
      },
    };
  }

  const photo = await Photo.findById(photoId).lean();
  if (!photo) {
    return {
      error: {
        status: 404,
        message: "Fotografía no encontrada",
      },
    };
  }

  let product = null;

  if (productId && mongoose.Types.ObjectId.isValid(productId)) {
    product = await ProdigiProduct.findById(productId).lean();
  } else if (productSku) {
    product = await ProdigiProduct.findOne({ sku: String(productSku).trim().toUpperCase() }).lean();
  }

  if (!product) {
    return {
      error: {
        status: 400,
        message: "El producto solicitado no está disponible",
      },
    };
  }

  const assignedProductIds = (photo.prodigiProducts || []).map((id) => id.toString());
  if (!assignedProductIds.includes(product._id.toString())) {
    return {
      error: {
        status: 400,
        message: "El producto no está asignado a esta fotografía",
      },
    };
  }

  return { photo, product };
};

const listProducts = async (req, res) => {
  try {
    const { photoId } = req.query;

    if (photoId) {
      const photo = await Photo.findById(photoId)
        .populate("prodigiProducts")
        .lean();

      if (!photo) {
        return res.status(404).json({ error: "Fotografía no encontrada" });
      }

      return res.json(photo.prodigiProducts || []);
    }

    const products = await ProdigiProduct.find()
      .sort({ createdAt: -1 })
      .lean();

    return res.json(products);
  } catch (error) {
    console.error("Error listing Prodigi products", error);
    return res
      .status(500)
      .json({ error: "No se pudieron obtener los productos de Prodigi" });
  }
};

const getQuote = async (req, res) => {
  if (!isProdigiConfigured) {
    return res.status(503).json({
      error: "La integración con Prodigi no está configurada todavía.",
    });
  }

  try {
    const {
      photoId,
      productId,
      productSku,
      copies,
      destinationCountryCode,
      shippingMethod,
    } = req.body || {};

    const { photo, product, error } = await loadPhotoAndProduct({
      photoId,
      productId,
      productSku,
    });

    if (error) {
      return res.status(error.status).json({ error: error.message });
    }

    const copiesToPrint = sanitizeInt(copies, 1);

    const quotePayload = {
      shippingMethod: shippingMethod || DEFAULT_SHIPPING_METHOD,
      destinationCountryCode: (destinationCountryCode || "ES").toUpperCase(),
      items: [
        {
          sku: product.sku,
          copies: copiesToPrint,
          sizing: product.sizing || "fillPrintArea",
          assets: [
            {
              printArea: "default",
            },
          ],
        },
      ],
    };

    const prodigiResponse = await prodigiRequest("/Quotes", {
      method: "POST",
      body: quotePayload,
    });

    return res.status(200).json({
      outcome: prodigiResponse?.outcome,
      quotes: prodigiResponse?.quotes,
      photo: { id: photo._id, title: photo.title },
      product: { id: product._id, sku: product.sku },
    });
  } catch (error) {
    console.error("Error getting Prodigi quote", error);
    const status = error.status || 500;
    return res.status(status).json({
      error: "No se pudo obtener la cotización de Prodigi",
      details: error.data || error.message,
    });
  }
};

const createOrder = async (req, res) => {
  if (!isProdigiConfigured) {
    return res.status(503).json({
      error: "La integración con Prodigi no está configurada todavía.",
    });
  }

  try {
    const { photoId, productId, productSku, copies, recipient, shippingMethod } =
      req.body || {};

    const { photo, product, error } = await loadPhotoAndProduct({
      photoId,
      productId,
      productSku,
    });

    if (error) {
      return res.status(error.status).json({ error: error.message });
    }

    let normalizedRecipient;
    try {
      normalizedRecipient = normalizeRecipient(recipient);
    } catch (recipientError) {
      const status = recipientError.status || 500;
      return res.status(status).json({ error: recipientError.message });
    }

    let assetUrl;
    try {
      assetUrl = buildAssetUrl(photo.imagePath);
    } catch (assetError) {
      return res.status(500).json({ error: assetError.message });
    }

    const copiesToPrint = sanitizeInt(copies, 1);
    const merchantReference = `photo-${photo._id}-${randomUUID()}`;

    const orderPayload = {
      merchantReference,
      shippingMethod: shippingMethod || DEFAULT_SHIPPING_METHOD,
      recipient: normalizedRecipient,
      items: [
        {
          merchantReference: `item-${merchantReference}`,
          sku: product.sku,
          copies: copiesToPrint,
          sizing: product.sizing || "fillPrintArea",
          assets: [
            {
              printArea: "default",
              url: assetUrl,
            },
          ],
          metadata: {
            productId: String(product._id),
            productName: product.name,
          },
        },
      ],
      metadata: {
        application: "Photography-web",
        photo: {
          id: String(photo._id),
          title: photo.title,
        },
        product: {
          id: String(product._id),
          sku: product.sku,
        },
      },
    };

    const prodigiResponse = await prodigiRequest("/Orders", {
      method: "POST",
      body: orderPayload,
    });

    return res.status(201).json({
      outcome: prodigiResponse?.outcome,
      order: prodigiResponse?.order,
    });
  } catch (error) {
    console.error("Error creating Prodigi order", error);
    const status = error.status || 500;
    return res.status(status).json({
      error: "No se pudo crear el pedido en Prodigi",
      details: error.data || error.message,
    });
  }
};

const createProdigiProduct = async (req, res) => {
  try {
    const {
      sku,
      name,
      description,
      retailPrice,
      currency,
      sizing,
    } = req.body || {};

    if (!sku || !name) {
      return res.status(400).json({
        error: "sku y name son obligatorios",
      });
    }

    const mockupImages = (req.files || []).map(
      (file) => `/uploads/${file.filename}`
    );

    const product = new ProdigiProduct({
      sku: String(sku).trim().toUpperCase(),
      name: String(name).trim(),
      description: description ? String(description).trim() : undefined,
      retailPrice: toNumeric(retailPrice, 0),
      currency: toCurrencyCode(currency),
      sizing: toSizingValue(sizing),
      mockupImages,
    });

    await product.save();

    return res.status(201).json(product.toObject());
  } catch (error) {
    console.error("Error creating Prodigi product", error);
    if (error.code === 11000) {
      return res.status(409).json({
        error: "Ya existe un producto con ese SKU",
      });
    }

    return res
      .status(500)
      .json({ error: "No se pudo crear el producto de Prodigi" });
  }
};

const updateProdigiProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ error: "productId inválido" });
    }

    const product = await ProdigiProduct.findById(productId);
    if (!product) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    const {
      sku,
      name,
      description,
      retailPrice,
      currency,
      sizing,
      imagesToRemove,
    } = req.body || {};

    if (sku) {
      product.sku = String(sku).trim().toUpperCase();
    }
    if (name) {
      product.name = String(name).trim();
    }
    if (description !== undefined) {
      product.description = description ? String(description).trim() : "";
    }
    if (retailPrice !== undefined) {
      product.retailPrice = toNumeric(retailPrice, product.retailPrice || 0);
    }
    if (currency) {
      product.currency = toCurrencyCode(currency, product.currency);
    }
    if (sizing) {
      product.sizing = toSizingValue(sizing, product.sizing);
    }

    const imagesToRemoveArray = parseArrayFromBody(imagesToRemove);
    if (imagesToRemoveArray.length) {
      product.mockupImages = product.mockupImages.filter((imagePath) => {
        if (imagesToRemoveArray.includes(imagePath)) {
          removeLocalFile(imagePath);
          return false;
        }
        return true;
      });
    }

    const newImages = (req.files || []).map(
      (file) => `/uploads/${file.filename}`
    );
    if (newImages.length) {
      product.mockupImages.push(...newImages);
    }

    await product.save();

    return res.json(product.toObject());
  } catch (error) {
    console.error("Error updating Prodigi product", error);
    if (error.code === 11000) {
      return res.status(409).json({
        error: "Ya existe un producto con ese SKU",
      });
    }

    return res
      .status(500)
      .json({ error: "No se pudo actualizar el producto de Prodigi" });
  }
};

const deleteProdigiProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ error: "productId inválido" });
    }

    const product = await ProdigiProduct.findById(productId);
    if (!product) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    const images = [...(product.mockupImages || [])];

    await Photo.updateMany(
      { prodigiProducts: product._id },
      { $pull: { prodigiProducts: product._id } }
    );

    await product.deleteOne();

    images.forEach(removeLocalFile);

    return res.status(204).send();
  } catch (error) {
    console.error("Error deleting Prodigi product", error);
    return res
      .status(500)
      .json({ error: "No se pudo eliminar el producto de Prodigi" });
  }
};

const updatePhotoProducts = async (req, res) => {
  try {
    const { photoId } = req.params;
    let { productIds } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(photoId)) {
      return res.status(400).json({ error: "photoId inválido" });
    }

    if (typeof productIds === "string") {
      productIds = [productIds];
    }
    const sanitizedIds = Array.isArray(productIds)
      ? productIds.filter((id) => mongoose.Types.ObjectId.isValid(id))
      : [];

    const products = await ProdigiProduct.find({
      _id: { $in: sanitizedIds },
    })
      .select("_id")
      .lean();

    if (products.length !== sanitizedIds.length) {
      return res.status(400).json({
        error: "Algunos productos no existen",
      });
    }

    const photo = await Photo.findOneAndUpdate(
      { _id: photoId, createdBy: req.user.userId },
      { prodigiProducts: sanitizedIds },
      { new: true }
    )
      .populate("prodigiProducts")
      .lean();

    if (!photo) {
      return res
        .status(404)
        .json({ error: "Fotografía no encontrada o sin permisos" });
    }

    return res.json(photo.prodigiProducts || []);
  } catch (error) {
    console.error("Error updating photo products", error);
    return res
      .status(500)
      .json({ error: "No se pudieron actualizar los productos" });
  }
};

module.exports = {
  listProducts,
  getQuote,
  createOrder,
  createProdigiProduct,
  updateProdigiProduct,
  deleteProdigiProduct,
  updatePhotoProducts,
};
