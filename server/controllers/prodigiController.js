const { randomUUID } = require("crypto");
const Photo = require("../models/Photo");
const prodigiProducts = require("../utils/prodigiProducts");
const {
  isProdigiConfigured,
  prodigiRequest,
} = require("../utils/prodigiClient");

const PRODIGI_ASSET_BASE_URL = process.env.PRODIGI_ASSET_BASE_URL;
const DEFAULT_SHIPPING_METHOD =
  process.env.PRODIGI_DEFAULT_SHIPPING_METHOD || "Budget";

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

const sanitizeInt = (value, fallback = 1) => {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, 10); // Evitar pedidos masivos accidentales
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

const listProducts = (req, res) => {
  if (!isProdigiConfigured) {
    return res.status(503).json({
      error: "La integración con Prodigi no está configurada todavía.",
    });
  }

  res.json(prodigiProducts);
};

const getQuote = async (req, res) => {
  if (!isProdigiConfigured) {
    return res.status(503).json({
      error: "La integración con Prodigi no está configurada todavía.",
    });
  }

  const { productSku, copies, destinationCountryCode, shippingMethod } =
    req.body || {};

  if (!productSku) {
    return res.status(400).json({
      error: "productSku es obligatorio",
    });
  }

  const selectedProduct = prodigiProducts.find(
    (product) => product.sku === productSku
  );

  if (!selectedProduct) {
    return res.status(400).json({
      error: "El producto solicitado no está disponible",
    });
  }

  const copiesToPrint = sanitizeInt(copies, 1);

  const quotePayload = {
    shippingMethod: shippingMethod || DEFAULT_SHIPPING_METHOD,
    destinationCountryCode: (destinationCountryCode || "ES").toUpperCase(),
    items: [
      {
        sku: selectedProduct.sku,
        copies: copiesToPrint,
        assets: [
          {
            printArea: "default",
          },
        ],
      },
    ],
  };

  try {
    const prodigiResponse = await prodigiRequest("/Quotes", {
      method: "POST",
      body: quotePayload,
    });

    return res.status(200).json({
      outcome: prodigiResponse?.outcome,
      quotes: prodigiResponse?.quotes,
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

  const { photoId, productSku, copies, recipient, shippingMethod } = req.body || {};

  if (!photoId || !productSku) {
    return res.status(400).json({
      error: "photoId y productSku son obligatorios",
    });
  }

  const selectedProduct = prodigiProducts.find((product) => product.sku === productSku);

  if (!selectedProduct) {
    return res.status(400).json({
      error: "El producto solicitado no está disponible",
    });
  }

  let normalizedRecipient;
  try {
    normalizedRecipient = normalizeRecipient(recipient);
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({ error: error.message });
  }

  const photo = await Photo.findById(photoId).lean();
  if (!photo) {
    return res.status(404).json({ error: "Fotografía no encontrada" });
  }

  let assetUrl;
  try {
    assetUrl = buildAssetUrl(photo.imagePath);
  } catch (error) {
    return res.status(500).json({ error: error.message });
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
        sku: selectedProduct.sku,
        copies: copiesToPrint,
        sizing: selectedProduct.sizing || "fillPrintArea",
        assets: [
          {
            printArea: "default",
            url: assetUrl,
          },
        ],
        metadata: {
          photoId: String(photo._id),
          photoTitle: photo.title,
        },
      },
    ],
    metadata: {
      application: "Photography-web",
      photo: {
        id: String(photo._id),
        title: photo.title,
      },
    },
  };

  try {
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

module.exports = {
  listProducts,
  getQuote,
  createOrder,
};
