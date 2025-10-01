const { randomUUID } = require("crypto");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const sharp = require("sharp");
const Photo = require("../models/Photo");
const ProdigiCatalogProduct = require("../models/ProdigiCatalogProduct");
const PhotoProdigiVariant = require("../models/PhotoProdigiVariant");
const ProdigiOrder = require("../models/ProdigiOrder");
const {
  isProdigiConfigured,
  prodigiRequest,
  uploadProdigiAsset,
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
  /* Si ya está normalizado (tiene la estructura con address como objeto), lo devolvemos tal cual */
  if (recipient.address && typeof recipient.address === 'object') {
    /* Validamos que tenga los campos mínimos requeridos de Prodigi */
    const requiredAddressFields = ['line1', 'townOrCity', 'postalOrZipCode', 'countryCode'];
    const missingAddress = requiredAddressFields.filter(field => !recipient.address[field]);
    
    if (missingAddress.length) {
      const error = new Error(
        `Faltan campos obligatorios en address: ${missingAddress.join(", ")}`
      );
      error.status = 400;
      throw error;
    }
    
    if (!recipient.name || !recipient.email) {
      const error = new Error("Faltan campos obligatorios: name, email");
      error.status = 400;
      throw error;
    }
    
    return recipient; // Ya está normalizado
  }

  /* Si tiene la estructura plana (addressLine1, city, etc.), lo normalizamos */
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

const parseJSON = (value, fallback) => {
  if (!value) return fallback;
  try {
    if (typeof value === "string") {
      return JSON.parse(value);
    }
    return value;
  } catch (error) {
    return fallback;
  }
};

const removeLeadingSlash = (value) => value.replace(/^\/+/, "");

const getMockupFiles = (req) => {
  if (!req.files) return [];
  if (Array.isArray(req.files)) return req.files;
  if (Array.isArray(req.files.mockups)) return req.files.mockups;
  return [];
};

const capitalizeWords = (value = "") =>
  value
    .toLowerCase()
    .replace(/(^|\s|[-_/])(\w)/g, (_, prefix, char) => `${prefix}${char.toUpperCase()}`)
    .trim();

const normalizeColorCode = (value = "") =>
  value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_");

const extractColorOptionsFromAttributes = (attributes = {}) => {
  if (!attributes || !Array.isArray(attributes.color)) {
    return [];
  }

  return attributes.color
    .map((color) => {
      if (!color) return null;
      const code = normalizeColorCode(String(color));
      return {
        code,
        name: capitalizeWords(String(color)),
      };
    })
    .filter(Boolean);
};

const normalizeSku = (value) => String(value || "").trim().toUpperCase();

const fetchProdigiProduct = async (sku) => {
  const normalizedSku = normalizeSku(sku);
  if (!normalizedSku) {
    const error = new Error("El SKU es obligatorio");
    error.status = 400;
    throw error;
  }

  let response;
  try {
    console.log("[Prodigi] Requesting product details", {
      sku: normalizedSku,
    });
    response = await prodigiRequest(`/Products/${encodeURIComponent(normalizedSku)}`);
    console.log("[Prodigi] Product details response received", {
      sku: normalizedSku,
      hasProduct: Boolean(response?.product),
    });
  } catch (requestError) {
    if (requestError.status === 404) {
      const notFoundError = new Error("Prodigi no encontró ese SKU");
      notFoundError.status = 404;
      if (requestError.data) {
        notFoundError.data = requestError.data;
      }
      console.warn("[Prodigi] Product details not found", {
        sku: normalizedSku,
      });
      throw notFoundError;
    }
    throw requestError;
  }

  const product = response?.product;
  if (!product) {
    const notFound = new Error("Prodigi no devolvió información del producto");
    notFound.status = 404;
    console.warn("[Prodigi] Product payload missing product field", {
      sku: normalizedSku,
    });
    throw notFound;
  }

  console.log("[Prodigi] Product details parsed", {
    sku: normalizedSku,
    variantCount: Array.isArray(product.variants) ? product.variants.length : 0,
  });

  return { normalizedSku, product };
};

const buildProdigiProductSummary = (product, normalizedSku) => {
  const attributes = product.attributes || {};
  const availableColors = extractColorOptionsFromAttributes(attributes);

  const variants = Array.isArray(product.variants) ? product.variants : [];
  const primaryVariant = variants[0] || null;

  const variantWithResolution =
    variants.find(
      (variant) =>
        variant?.printAreaSizes?.default?.horizontalResolution &&
        variant?.printAreaSizes?.default?.verticalResolution
    ) || primaryVariant;

  const printAreaPixels = variantWithResolution?.printAreaSizes?.default
    ? {
        width: Number(
          variantWithResolution.printAreaSizes.default.horizontalResolution
        ),
        height: Number(
          variantWithResolution.printAreaSizes.default.verticalResolution
        ),
      }
    : null;

  const shipsTo = Array.isArray(variantWithResolution?.shipsTo)
    ? variantWithResolution.shipsTo
    : [];

  const productDimensions = product.productDimensions
    ? {
        width: product.productDimensions.width,
        height: product.productDimensions.height,
        units: product.productDimensions.units,
      }
    : null;

  return {
    sku: product.sku || normalizedSku,
    prodigiName: product.name || product.description || normalizedSku,
    prodigiDescription: product.description || "",
    productDimensions,
    printAreaPixels,
    attributes,
    variantAttributes: primaryVariant?.attributes || {},
    variantCount: variants.length,
    primaryVariantSku: primaryVariant?.sku || null,
    primaryVariantDescription:
      primaryVariant?.description || primaryVariant?.name || null,
    availableColors,
    shipsTo,
  };
};

const toNumberOrUndefined = (value) => {
  if (value === undefined || value === null || value === "") return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
};

const parseDimensionsPayload = (payload) => {
  if (!payload) return undefined;
  const data = parseJSON(payload, payload);
  if (!data || typeof data !== "object") return undefined;

  const width = toNumberOrUndefined(data.width);
  const height = toNumberOrUndefined(data.height);
  const units = data.units ? String(data.units).trim() : undefined;

  if (width === undefined && height === undefined && !units) return undefined;

  return { width, height, units };
};

const parsePixelsPayload = (payload) => {
  if (!payload) return undefined;
  const data = parseJSON(payload, payload);
  if (!data || typeof data !== "object") return undefined;

  const width = toNumberOrUndefined(data.width);
  const height = toNumberOrUndefined(data.height);

  if (width === undefined && height === undefined) return undefined;

  return { width, height };
};

const parseStringArray = (payload) => {
  if (!payload) return [];
  if (Array.isArray(payload)) {
    return payload.map((item) => String(item).trim()).filter(Boolean);
  }
  try {
    const parsed = JSON.parse(payload);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item).trim()).filter(Boolean);
    }
  } catch (err) {
    // ignore
  }
  return String(payload)
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
};

const normalizeAvailableColorsPayload = (payload) => {
  const colorsArray = Array.isArray(payload)
    ? payload
    : parseJSON(payload, []);

  if (!Array.isArray(colorsArray)) return [];

  const output = colorsArray
    .map((color) => {
      if (!color) return null;
      if (typeof color === "string") {
        const code = normalizeColorCode(color);
        return {
          code,
          name: capitalizeWords(color),
        };
      }
      const codeValue = color.code || color.name || "";
      const code = normalizeColorCode(String(codeValue));
      return {
        code,
        name: color.name ? String(color.name).trim() : capitalizeWords(codeValue),
      };
    })
    .filter(Boolean);

  const unique = new Map();
  output.forEach((color) => {
    if (!unique.has(color.code)) {
      unique.set(color.code, color);
    }
  });

  return Array.from(unique.values());
};

const removeLocalFile = (relativePath) => {
  if (!relativePath) return;
  const normalized = removeLeadingSlash(relativePath);
  if (!normalized.startsWith("uploads/")) return;

  const filePath = path.join(__dirname, "..", normalized);
  fs.unlink(filePath, (err) => {
    if (err && err.code !== "ENOENT") {
      console.warn("No se pudo eliminar el archivo", filePath, err.message);
    }
  });
};

const buildAssetUrl = (imagePath) => {
  if (!imagePath) {
    return null;
  }

  if (/^https?:\/\//i.test(imagePath)) {
    return imagePath;
  }

  if (!PRODIGI_ASSET_BASE_URL) {
    if (!imagePath.startsWith("/")) {
      return `/${imagePath}`;
    }
    return imagePath;
  }

  const base = PRODIGI_ASSET_BASE_URL.replace(/\/$/, "");
  const cleanedPath = imagePath.startsWith("/") ? imagePath : `/${imagePath}`;
  return `${base}${cleanedPath}`;
};

const summarizeProdigiQuote = (prodigiResponse) => {
  const quotes = Array.isArray(prodigiResponse?.quotes)
    ? prodigiResponse.quotes
    : [];
  if (!quotes.length) {
    return null;
  }

  const primaryQuote = quotes[0];
  const costSummary = primaryQuote?.costSummary || {};

  const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const itemsAmount = toNumber(costSummary.items?.amount);
  const shippingAmount = toNumber(costSummary.shipping?.amount);
  const taxAmount = toNumber(costSummary.totalTax?.amount); // ← Cambiado de tax a totalTax
  const feesAmount = toNumber(costSummary.fees?.amount);
  const brandingAmount = toNumber(costSummary.branding?.amount);

  const currency =
    costSummary.totalCost?.currency ||
    costSummary.items?.currency ||
    costSummary.shipping?.currency ||
    primaryQuote?.currency ||
    "EUR";

  /* Usamos totalCost de Prodigi si está disponible, sino lo calculamos */
  const prodigiTotal = costSummary.totalCost?.amount
    ? toNumber(costSummary.totalCost.amount)
    : itemsAmount + shippingAmount + brandingAmount + taxAmount + feesAmount;

  console.log("[Prodigi] Quote pricing breakdown:", {
    items: itemsAmount,
    shipping: shippingAmount,
    branding: brandingAmount,
    tax: taxAmount,
    fees: feesAmount,
    calculatedTotal: itemsAmount + shippingAmount + brandingAmount + taxAmount + feesAmount,
    prodigiTotalCost: costSummary.totalCost?.amount,
    finalTotal: prodigiTotal,
    currency
  });

  return {
    quoteId: primaryQuote?.id || primaryQuote?.quoteId || null,
    currency,
    itemsAmount,
    shippingAmount,
    taxAmount,
    feesAmount,
    prodigiTotal,
  };
};

const ensurePhotoAccessible = async (photoId) => {
  if (!mongoose.Types.ObjectId.isValid(photoId)) {
    return { error: { status: 400, message: "photoId inválido" } };
  }

  const photo = await Photo.findById(photoId).lean();
  if (!photo) {
    return { error: { status: 404, message: "Fotografía no encontrada" } };
  }

  return { photo };
};

const mapMockupImages = (mockupImages = []) => {
  const mapping = new Map();
  mockupImages.forEach((image) => {
    const id = image._id.toString();
    mapping.set(id, {
      id,
      url: image.url,
      label: image.label || null,
    });
  });
  return mapping;
};

const buildVariantResponse = (variantDoc, { includeInactive = false } = {}) => {
  if (!variantDoc) return null;
  const variant = variantDoc.toObject({ virtuals: false });

  if (!includeInactive && !variant.isActive) {
    return null;
  }

  const catalogProduct = variant.catalogProduct
    ? {
        id: variant.catalogProduct._id.toString(),
        sku: variant.catalogProduct.sku,
        name: variant.catalogProduct.name,
        description: variant.catalogProduct.description,
        prodigiDescription: variant.catalogProduct.prodigiDescription,
        availableColors: variant.catalogProduct.availableColors || [],
        defaultSizing: variant.catalogProduct.defaultSizing,
        productDimensions: variant.catalogProduct.productDimensions || null,
        printAreaPixels: variant.catalogProduct.printAreaPixels || null,
        attributes: variant.catalogProduct.attributes || null,
        shipsTo: variant.catalogProduct.shipsTo || [],
      }
    : null;

  const mockupImageMap = mapMockupImages(variant.mockupImages);
  const mockupImages = Array.from(mockupImageMap.values());

  const colorOptions = (variant.colorOptions || []).map((option) => {
    const normalizedCode = option.code
      ? String(option.code).trim().toUpperCase()
      : "";

    const images = (option.mockupImageRefs || [])
      .map((ref) => mockupImageMap.get(ref.toString()))
      .filter(Boolean);

    return {
      code: normalizedCode,
      name: option.name || normalizedCode,
      assetUrl: option.assetUrl || null,
      assetDetails: option.assetDetails || null,
      mockupImageRefs: (option.mockupImageRefs || []).map((id) => id.toString()),
      mockupImages: images,
    };
  });

  return {
    id: variant._id.toString(),
    photoId: variant.photo.toString(),
    catalogProduct,
    displayName: variant.displayName || catalogProduct?.name || null,
    description: variant.description || catalogProduct?.description || null,
    retailPrice:
      variant.retailPrice !== undefined ? variant.retailPrice : catalogProduct?.basePrice,
    currency: variant.currency || catalogProduct?.currency || "EUR",
    profitMargin:
      Number.isFinite(variant.profitMargin) && variant.profitMargin > 0
        ? variant.profitMargin
        : 0,
    sizing: variant.sizing || catalogProduct?.defaultSizing || null,
    assetUrl: variant.assetUrl || null,
    assetDetails: variant.assetDetails || null,
    mockupImages,
    colorOptions,
    isActive: variant.isActive,
    createdAt: variant.createdAt,
    updatedAt: variant.updatedAt,
  };
};

const processVariantFiles = (variant, files = [], meta = []) => {
  if (!files.length) return { newImages: [], tempIdMap: new Map() };

  if (meta.length && meta.length !== files.length) {
    throw Object.assign(new Error("Los metadatos de mockups no coinciden"), {
      status: 400,
    });
  }

  const tempIdMap = new Map();
  const newImages = files.map((file, index) => {
    const tempId = meta[index]?.tempId;
    const record = {
      _id: new mongoose.Types.ObjectId(),
      url: `/uploads/${file.filename}`,
      label: file.originalname,
    };
    if (tempId) {
      tempIdMap.set(tempId, record._id);
    }
    return record;
  });

  variant.mockupImages.push(...newImages);

  return { newImages, tempIdMap };
};

const applyKeepMockupImages = (variant, keepIds = []) => {
  if (!Array.isArray(keepIds) || keepIds.length === 0) {
    const removed = [...variant.mockupImages];
    variant.mockupImages = [];
    removed.forEach((image) => removeLocalFile(image.url));
    return;
  }

  const keepSet = new Set(keepIds.map((id) => id.toString()));
  const removed = variant.mockupImages.filter(
    (image) => !keepSet.has(image._id.toString())
  );
  removed.forEach((image) => removeLocalFile(image.url));
  variant.mockupImages = variant.mockupImages.filter((image) =>
    keepSet.has(image._id.toString())
  );
};

const applyColorOptions = (variant, colorOptionsPayload, tempIdMap) => {
  const imageIdSet = new Set(
    variant.mockupImages.map((image) => image._id.toString())
  );

  const normalized = Array.isArray(colorOptionsPayload)
    ? colorOptionsPayload
    : [];

  const existingMap = new Map(
    (variant.colorOptions || []).map((option) => [
      String(option.code || "").trim().toUpperCase(),
      option,
    ])
  );

  variant.colorOptions = normalized
    .map((option) => {
      if (!option || !option.code) return null;

      const normalizedCode = String(option.code).trim().toUpperCase();

      const refs = Array.isArray(option.mockupImageRefs)
        ? option.mockupImageRefs
        : [];

      const resolvedRefs = refs
        .map((ref) => {
          if (!ref) return null;
          if (tempIdMap.has(ref)) {
            return tempIdMap.get(ref);
          }
          if (mongoose.Types.ObjectId.isValid(ref)) {
            return new mongoose.Types.ObjectId(ref);
          }
          return null;
        })
        .filter((ref) => ref && imageIdSet.has(ref.toString()));

      const existing = existingMap.get(normalizedCode);
      const assetUrlProvided = option.assetUrl !== undefined;
      const assetUrl = assetUrlProvided
        ? option.assetUrl || undefined
        : existing?.assetUrl;

      let assetDetails;
      if (option.assetDetails !== undefined) {
        assetDetails = option.assetDetails || undefined;
      } else {
        assetDetails = existing?.assetDetails;
      }

      if (!assetUrl) {
        assetDetails = undefined;
      }

      return {
        code: normalizedCode,
        name: option.name ? String(option.name).trim() : undefined,
        assetUrl,
        assetDetails,
        mockupImageRefs: resolvedRefs,
      };
    })
    .filter(Boolean);
};

const listCatalogProducts = async (req, res) => {
  try {
    const products = await ProdigiCatalogProduct.find()
      .sort({ createdAt: -1 })
      .lean();
    res.json(products);
  } catch (error) {
    console.error("Error listing catalog products", error);
    res
      .status(500)
      .json({ error: "No se pudieron obtener los productos del catálogo" });
  }
};



const createCatalogProduct = async (req, res) => {
  try {
    const {
      sku,
      name,
      description,
      basePrice,
      currency,
      defaultSizing,
      availableColors,
      attributes,
      prodigiDescription,
      productDimensions,
      printAreaPixels,
      shipsTo,
    } = req.body || {};

    if (!sku || !name) {
      return res.status(400).json({ error: "SKU y nombre son obligatorios" });
    }

    const product = new ProdigiCatalogProduct({
      sku: String(sku).trim().toUpperCase(),
      name: String(name).trim(),
      description: description ? String(description).trim() : undefined,
      prodigiDescription: prodigiDescription
        ? String(prodigiDescription).trim()
        : undefined,
      basePrice: basePrice === undefined ? undefined : Number(basePrice),
      currency: currency ? String(currency).trim().toUpperCase() : undefined,
      defaultSizing: defaultSizing ? String(defaultSizing).trim() : undefined,
      availableColors: normalizeAvailableColorsPayload(availableColors),
      attributes: parseJSON(attributes, undefined),
      productDimensions: parseDimensionsPayload(productDimensions),
      printAreaPixels: parsePixelsPayload(printAreaPixels),
      shipsTo: parseStringArray(shipsTo),
    });

    await product.save();

    res.status(201).json(product.toObject());
  } catch (error) {
    console.error("Error creating catalog product", error);
    if (error.code === 11000) {
      return res.status(409).json({ error: "Ya existe un producto con ese SKU" });
    }
    res
      .status(500)
      .json({ error: "No se pudo crear el producto del catálogo" });
  }
};

const updateCatalogProduct = async (req, res) => {
  try {
    const { catalogProductId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(catalogProductId)) {
      return res.status(400).json({ error: "catalogProductId inválido" });
    }

    const product = await ProdigiCatalogProduct.findById(catalogProductId);
    if (!product) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    const {
      sku,
      name,
      description,
      basePrice,
      currency,
      defaultSizing,
      availableColors,
      attributes,
      prodigiDescription,
      productDimensions,
      printAreaPixels,
      shipsTo,
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
    if (prodigiDescription !== undefined) {
      product.prodigiDescription = prodigiDescription
        ? String(prodigiDescription).trim()
        : "";
    }
    if (basePrice !== undefined) {
      const value = Number(basePrice);
      if (!Number.isNaN(value)) {
        product.basePrice = value;
      }
    }
    if (currency) {
      product.currency = String(currency).trim().toUpperCase();
    }
    if (defaultSizing !== undefined) {
      product.defaultSizing = defaultSizing ? String(defaultSizing).trim() : "";
    }
    if (availableColors !== undefined) {
      product.availableColors = normalizeAvailableColorsPayload(availableColors);
    }
    if (attributes !== undefined) {
      product.attributes = parseJSON(attributes, undefined);
    }
    if (productDimensions !== undefined) {
      product.productDimensions = parseDimensionsPayload(productDimensions);
    }
    if (printAreaPixels !== undefined) {
      product.printAreaPixels = parsePixelsPayload(printAreaPixels);
    }
    if (shipsTo !== undefined) {
      product.shipsTo = parseStringArray(shipsTo);
    }

    await product.save();

    res.json(product.toObject());
  } catch (error) {
    console.error("Error updating catalog product", error);
    if (error.code === 11000) {
      return res.status(409).json({ error: "Ya existe un producto con ese SKU" });
    }
    res
      .status(500)
      .json({ error: "No se pudo actualizar el producto del catálogo" });
  }
};

const deleteCatalogProduct = async (req, res) => {
  try {
    const { catalogProductId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(catalogProductId)) {
      return res.status(400).json({ error: "catalogProductId inválido" });
    }

    const variantsCount = await PhotoProdigiVariant.countDocuments({
      catalogProduct: catalogProductId,
    });

    if (variantsCount > 0) {
      return res.status(409).json({
        error:
          "No puedes eliminar este producto porque está asociado a una o más fotografías",
      });
    }

    await ProdigiCatalogProduct.findByIdAndDelete(catalogProductId);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting catalog product", error);
    res
      .status(500)
      .json({ error: "No se pudo eliminar el producto del catálogo" });
  }
};

const listPhotoVariants = async (req, res) => {
  try {
    const { photoId } = req.params;
    const { photo, error } = await ensurePhotoAccessible(photoId);
    if (error) {
      return res.status(error.status).json({ error: error.message });
    }

    const variants = await PhotoProdigiVariant.find({ photo: photo._id })
      .populate("catalogProduct")
      .sort({ createdAt: -1 });

    const payload = variants
      .map((variant) => buildVariantResponse(variant, { includeInactive: true }))
      .filter(Boolean);

    res.json(payload);
  } catch (error) {
    console.error("Error listing photo variants", error);
    res
      .status(500)
      .json({ error: "No se pudieron obtener las variantes de esta fotografía" });
  }
};

const createPhotoVariant = async (req, res) => {
  try {
    const { photoId } = req.params;
    const { photo, error } = await ensurePhotoAccessible(photoId);
    if (error) {
      return res.status(error.status).json({ error: error.message });
    }

    const {
      catalogProductId,
      displayName,
      description,
      retailPrice,
      profitMargin,
      currency,
      sizing,
      assetUrl,
      isActive,
      colorOptions,
      keepMockupImageIds,
      newMockupMeta,
    } = req.body || {};

    if (!catalogProductId || !mongoose.Types.ObjectId.isValid(catalogProductId)) {
      return res.status(400).json({ error: "catalogProductId es obligatorio" });
    }

    const catalogProduct = await ProdigiCatalogProduct.findById(
      catalogProductId
    );

    if (!catalogProduct) {
      return res.status(404).json({ error: "Producto de catálogo no encontrado" });
    }

    const variant = new PhotoProdigiVariant({
      photo: photo._id,
      catalogProduct: catalogProduct._id,
    });

    variant.displayName = displayName ? String(displayName).trim() : undefined;
    variant.description = description ? String(description).trim() : undefined;
    if (retailPrice !== undefined && retailPrice !== "") {
      const value = Number(retailPrice);
      if (!Number.isNaN(value)) variant.retailPrice = value;
    }
    if (profitMargin !== undefined && profitMargin !== "") {
      const value = Number(profitMargin);
      if (!Number.isNaN(value) && value >= 0) {
        variant.profitMargin = value;
      }
    }
    variant.currency = currency ? String(currency).trim().toUpperCase() : variant.currency;
    variant.sizing = sizing ? String(sizing).trim() : undefined;
    variant.assetUrl = assetUrl ? String(assetUrl).trim() : undefined;
    variant.isActive = isActive !== undefined ? isActive === "true" || isActive === true : true;

    const keepIds = parseJSON(keepMockupImageIds, []);
    applyKeepMockupImages(variant, keepIds);

    const mockupFiles = getMockupFiles(req);
    const { newImages, tempIdMap } = processVariantFiles(
      variant,
      mockupFiles,
      parseJSON(newMockupMeta, [])
    );

    const colorOptionsPayload = parseJSON(colorOptions, []);
    applyColorOptions(variant, colorOptionsPayload, tempIdMap);

    await variant.save();

    const populated = await variant.populate("catalogProduct");
    res.status(201).json(
      buildVariantResponse(populated, { includeInactive: true })
    );
  } catch (error) {
    console.error("Error creating photo variant", error);
    const status = error.status || 500;
    res
      .status(status)
      .json({ error: "No se pudo crear la variante para esta fotografía" });
  }
};

const updatePhotoVariant = async (req, res) => {
  try {
    const { photoId, variantId } = req.params;
    const { photo, error } = await ensurePhotoAccessible(photoId);
    if (error) {
      return res.status(error.status).json({ error: error.message });
    }

    if (!mongoose.Types.ObjectId.isValid(variantId)) {
      return res.status(400).json({ error: "variantId inválido" });
    }

    const variant = await PhotoProdigiVariant.findOne({
      _id: variantId,
      photo: photo._id,
    });

    if (!variant) {
      return res.status(404).json({ error: "Variante no encontrada" });
    }

    const {
      catalogProductId,
      displayName,
      description,
      retailPrice,
      profitMargin,
      currency,
      sizing,
      assetUrl,
      isActive,
      colorOptions,
      keepMockupImageIds,
      newMockupMeta,
    } = req.body || {};

    if (catalogProductId && mongoose.Types.ObjectId.isValid(catalogProductId)) {
      const catalogProduct = await ProdigiCatalogProduct.findById(
        catalogProductId
      );
      if (!catalogProduct) {
        return res.status(404).json({ error: "Producto de catálogo no encontrado" });
      }
      variant.catalogProduct = catalogProduct._id;
    }

    if (displayName !== undefined) {
      variant.displayName = displayName ? String(displayName).trim() : "";
    }
    if (description !== undefined) {
      variant.description = description ? String(description).trim() : "";
    }
    if (retailPrice !== undefined) {
      if (retailPrice === "" || retailPrice === null) {
        variant.retailPrice = undefined;
      } else {
        const value = Number(retailPrice);
        if (!Number.isNaN(value)) variant.retailPrice = value;
      }
    }
    if (profitMargin !== undefined) {
      if (profitMargin === "" || profitMargin === null) {
        variant.profitMargin = 0;
      } else {
        const value = Number(profitMargin);
        if (!Number.isNaN(value) && value >= 0) {
          variant.profitMargin = value;
        }
      }
    }
    if (currency !== undefined) {
      variant.currency = currency ? String(currency).trim().toUpperCase() : "";
    }
    if (sizing !== undefined) {
      variant.sizing = sizing ? String(sizing).trim() : "";
    }
    if (assetUrl !== undefined) {
      const normalizedAssetUrl = assetUrl ? String(assetUrl).trim() : "";
      if (!normalizedAssetUrl && variant.assetUrl) {
        removeLocalFile(variant.assetUrl);
      }
      variant.assetUrl = normalizedAssetUrl;
      if (!normalizedAssetUrl) {
        variant.assetDetails = undefined;
      }
    }
    if (isActive !== undefined) {
      variant.isActive = isActive === "true" || isActive === true;
    }

    const keepIds = parseJSON(keepMockupImageIds, []);
    applyKeepMockupImages(variant, keepIds);

    const mockupFiles = getMockupFiles(req);
    const { tempIdMap } = processVariantFiles(
      variant,
      mockupFiles,
      parseJSON(newMockupMeta, [])
    );

    const colorOptionsPayload = parseJSON(colorOptions, []);
    applyColorOptions(variant, colorOptionsPayload, tempIdMap);

    await variant.save();
    const populated = await variant.populate("catalogProduct");

    res.json(buildVariantResponse(populated, { includeInactive: true }));
  } catch (error) {
    console.error("Error updating photo variant", error);
    const status = error.status || 500;
    res
      .status(status)
      .json({ error: "No se pudo actualizar la variante" });
  }
};

const deletePhotoVariant = async (req, res) => {
  try {
    const { photoId, variantId } = req.params;
    const { photo, error } = await ensurePhotoAccessible(photoId);
    if (error) {
      return res.status(error.status).json({ error: error.message });
    }

    if (!mongoose.Types.ObjectId.isValid(variantId)) {
      return res.status(400).json({ error: "variantId inválido" });
    }

    const variant = await PhotoProdigiVariant.findOne({
      _id: variantId,
      photo: photo._id,
    });

    if (!variant) {
      return res.status(404).json({ error: "Variante no encontrada" });
    }

    const mockups = [...variant.mockupImages];
    const assetUrlsToRemove = [];
    if (variant.assetUrl) {
      assetUrlsToRemove.push(variant.assetUrl);
    }
    (variant.colorOptions || []).forEach((option) => {
      if (option.assetUrl) {
        assetUrlsToRemove.push(option.assetUrl);
      }
    });
    await variant.deleteOne();
    mockups.forEach((image) => removeLocalFile(image.url));
    assetUrlsToRemove.forEach((url) => removeLocalFile(url));

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting photo variant", error);
    res
      .status(500)
      .json({ error: "No se pudo eliminar la variante" });
  }
};

const listProducts = async (req, res) => {
  try {
    const { photoId } = req.query;
    if (!photoId || !mongoose.Types.ObjectId.isValid(photoId)) {
      return res.status(400).json({ error: "photoId es obligatorio" });
    }

    const variants = await PhotoProdigiVariant.find({
      photo: photoId,
      isActive: true,
    })
      .populate("catalogProduct")
      .sort({ createdAt: -1 });

    const payload = variants
      .map((variant) => buildVariantResponse(variant))
      .filter(Boolean);

    res.json(payload);
  } catch (error) {
    console.error("Error listing Prodigi products", error);
    res
      .status(500)
      .json({ error: "No se pudieron obtener los productos disponibles" });
  }
};

const loadVariantForPhoto = async ({ photoId, variantId, colorCode }) => {
  if (!mongoose.Types.ObjectId.isValid(photoId)) {
    return { error: { status: 400, message: "photoId inválido" } };
  }
  if (!mongoose.Types.ObjectId.isValid(variantId)) {
    return { error: { status: 400, message: "variantId inválido" } };
  }

  const [photo, variant] = await Promise.all([
    Photo.findById(photoId).lean(),
    PhotoProdigiVariant.findOne({
      _id: variantId,
      photo: photoId,
      isActive: true,
    }).populate("catalogProduct"),
  ]);

  if (!photo) {
    return { error: { status: 404, message: "Fotografía no encontrada" } };
  }
  if (!variant) {
    return { error: { status: 404, message: "Variante no disponible" } };
  }

  const colorOptions = Array.isArray(variant.colorOptions)
    ? variant.colorOptions
    : [];

  let selectedColor = null;
  if (colorOptions.length > 0) {
    const normalizedCode = colorCode
      ? String(colorCode).trim().toUpperCase()
      : null;

    if (normalizedCode) {
      selectedColor = colorOptions.find(
        (option) => option.code === normalizedCode
      );
      if (!selectedColor) {
        return {
          error: {
            status: 400,
            message: "El color seleccionado no está disponible",
          },
        };
      }
    } else {
      selectedColor = colorOptions[0];
    }
  }

  return { photo, variant, selectedColor };
};

const buildAssetDetails = (metadata, file) => {
  if (!metadata) return undefined;
  return {
    width: metadata.width,
    height: metadata.height,
    size: file?.size || metadata.size || undefined,
    format: metadata.format,
  };
};

/* NOTE CONSULTAS A LA API DE PRODIGI */

const fetchCatalogProductDetails = async (req, res) => {
  if (!isProdigiConfigured) {
    return res.status(503).json({
      error: "La integración con Prodigi no está configurada todavía.",
    });
  }

  try {
    const { sku } = req.body || {};
    if (!sku || !String(sku).trim()) {
      return res.status(400).json({ error: "El SKU es obligatorio" });
    }

    const { normalizedSku, product } = await fetchProdigiProduct(sku);
    const summary = buildProdigiProductSummary(product, normalizedSku);
    res.json(summary);
  } catch (error) {
    console.error("Error fetching catalog product details", error);
    const status = error.status || 500;
    res.status(status).json({
      error:
        status === 404
          ? error.message || "Prodigi no encontró ese SKU"
          : "No se pudieron obtener los detalles del producto",
      details: error.data || error.message,
    });
  }
};

const getCatalogProductDetailsPublic = async (req, res) => {
  if (!isProdigiConfigured) {
    return res.status(503).json({
      error: "La integración con Prodigi no está configurada todavía.",
    });
  }

  try {
    const { sku } = req.params || {};
    const { normalizedSku, product } = await fetchProdigiProduct(sku);
    const summary = buildProdigiProductSummary(product, normalizedSku);
    res.json(summary);
  } catch (error) {
    console.error("Error fetching public catalog product details", error);
    const status = error.status || 500;
    res.status(status).json({
      error:
        status === 404
          ? error.message || "Prodigi no encontró ese SKU"
          : "No se pudieron obtener los detalles del producto",
      details: error.data || error.message,
    });
  }
};

const computeQuoteForVariant = async ({
  photoId,
  variantId,
  colorCode,
  copies,
  destinationCountryCode,
  shippingMethod,
  productAttributes,
  assetOverrideUrl,
}) => {
  const { photo, variant, selectedColor, error } = await loadVariantForPhoto({
    photoId,
    variantId,
    colorCode,
  });

  if (error) {
    const err = new Error(error.message);
    err.status = error.status;
    throw err;
  }

  const copiesToPrint = sanitizeInt(copies, 1);
  const sku = variant.catalogProduct?.sku;

  if (!sku) {
    const err = new Error("El producto de catálogo no tiene un SKU configurado");
    err.status = 500;
    throw err;
  }

  const resolvedAssetUrl =
    assetOverrideUrl ||
    selectedColor?.assetUrl ||
    variant.assetUrl ||
    buildAssetUrl(photo.imagePath);

  const assetsPayload = [
    {
      printArea: "default",
    },
  ];

  if (resolvedAssetUrl && /^https?:\/\//i.test(resolvedAssetUrl)) {
    try {
      const uploaded = await uploadProdigiAsset(resolvedAssetUrl);
      if (uploaded?.assetId) {
        assetsPayload[0].assetId = uploaded.assetId;
      } else {
        console.warn("[Prodigi] Asset upload returned no id, quoting without assetId", {
          resolvedAssetUrl,
        });
      }
    } catch (assetError) {
      console.warn("[Prodigi] Asset upload failed, quoting without assetId", {
        resolvedAssetUrl,
        error: assetError.message,
      });
    }
  }

  const attributesFromRequest =
    productAttributes &&
    typeof productAttributes === "object" &&
    !Array.isArray(productAttributes)
      ? productAttributes
      : null;

  const storedAttributes =
    variant.catalogProduct?.attributes &&
    typeof variant.catalogProduct.attributes === "object" &&
    !Array.isArray(variant.catalogProduct.attributes)
      ? variant.catalogProduct.attributes
      : null;

  let attributesForQuote = attributesFromRequest || storedAttributes;

  if (!attributesForQuote) {
    try {
      const { normalizedSku: refreshedSku, product } = await fetchProdigiProduct(sku);
      const summary = buildProdigiProductSummary(product, refreshedSku);
      attributesForQuote =
        (summary.variantAttributes && Object.keys(summary.variantAttributes).length
          ? summary.variantAttributes
          : null) || summary.attributes || {};
      console.log("[Prodigi] Attributes refreshed from catalog", {
        sku,
        attributeKeys: Object.keys(attributesForQuote || {}),
      });
    } catch (productError) {
      const status = productError.status || 500;
      const err = new Error(
        status === 404
          ? "No se encontraron atributos para la cotización de este SKU."
          : "No se pudieron obtener los atributos necesarios para cotizar."
      );
      err.status = status;
      err.details = productError.data || productError.message;
      throw err;
    }
  }

  const itemPayload = {
    sku,
    copies: copiesToPrint,
    attributes:
      attributesForQuote && typeof attributesForQuote === "object"
        ? attributesForQuote
        : {},
    assets: assetsPayload,
  };

  const normalizedDestination = (destinationCountryCode || "ES").toUpperCase();
  const normalizedShippingMethod = shippingMethod || DEFAULT_SHIPPING_METHOD;

  const quotePayload = {
    shippingMethod: normalizedShippingMethod,
    destinationCountryCode: normalizedDestination,
    items: [itemPayload],
  };

  console.log("[Prodigi] Quote payload", {
    sku,
    assetPayload: assetsPayload,
    quotePayload,
  });
  console.log("[Prodigi] Quote payload item details", quotePayload.items?.[0]);

  const prodigiResponse = await prodigiRequest("/Quotes", {
    method: "POST",
    body: quotePayload,
  });

  console.log("[Prodigi] Quote response received:", {
    sku,
    outcome: prodigiResponse?.outcome,
    quotesCount: Array.isArray(prodigiResponse?.quotes) ? prodigiResponse.quotes.length : 0,
    response: JSON.stringify(prodigiResponse, null, 2),
  });

  return {
    photo,
    variant,
    selectedColor,
    sku,
    copies: copiesToPrint,
    assetUrl: resolvedAssetUrl,
    quotePayload,
    prodigiResponse,
  };
};

const getQuote = async (req, res) => {
  if (!isProdigiConfigured) {
    return res.status(503).json({
      error: "La integración con Prodigi no está configurada todavía.",
    });
  }

  try {
    const params = {
      photoId: req.body?.photoId,
      variantId: req.body?.variantId,
      colorCode: req.body?.colorCode,
      copies: req.body?.copies,
      destinationCountryCode: req.body?.destinationCountryCode,
      shippingMethod: req.body?.shippingMethod,
      productAttributes: req.body?.productAttributes,
      assetOverrideUrl: req.body?.assetUrl,
    };

    const quoteContext = await computeQuoteForVariant(params);

    const summary = summarizeProdigiQuote(quoteContext.prodigiResponse);
    const rawMargin = Number(quoteContext.variant.profitMargin || 0);
    const marginAmount = Number.isFinite(rawMargin) && rawMargin > 0 ? rawMargin : 0;

    const pricing = summary
      ? {
          currency: summary.currency,
          prodigiItemsAmount: summary.itemsAmount,
          prodigiShippingAmount: summary.shippingAmount,
          prodigiTaxAmount: summary.taxAmount,
          prodigiFeesAmount: summary.feesAmount,
          prodigiTotal: summary.prodigiTotal,
          platformMargin: marginAmount,
          totalWithMargin: summary.prodigiTotal + marginAmount,
        }
      : null;

    res.status(200).json({
      outcome: quoteContext.prodigiResponse?.outcome,
      quotes: quoteContext.prodigiResponse?.quotes,
      variant: {
        id: quoteContext.variant._id.toString(),
        sku: quoteContext.sku,
        currency:
          quoteContext.variant.currency || pricing?.currency || "EUR",
        profitMargin: marginAmount,
      },
      color: quoteContext.selectedColor
        ? {
            code: quoteContext.selectedColor.code,
            name: quoteContext.selectedColor.name,
          }
        : null,
      pricing,
    });
  } catch (error) {
    console.error("[Prodigi] Error getting quote - DETAILED:", {
      message: error.message,
      status: error.status,
      data: error.data,
      details: error.details,
      stack: error.stack,
      fullError: JSON.stringify(error, Object.getOwnPropertyNames(error), 2),
    });
    const status = error.status || 500;
    res.status(status).json({
      error: error.message || "No se pudo obtener la cotización de Prodigi",
      details: error.details || error.data || error.message,
    });
  }
};

const placeProdigiOrder = async ({
  photoId,
  variantId,
  colorCode,
  copies,
  recipient,
  shippingMethod,
  createdBy,
  paymentIntentId,
  paymentStatus,
  pricing,
  merchantReference: providedMerchantReference,
  productAttributes,
}) => {
  if (!isProdigiConfigured) {
    const err = new Error("La integración con Prodigi no está configurada todavía.");
    err.status = 503;
    throw err;
  }

  const { photo, variant, selectedColor, error } = await loadVariantForPhoto({
    photoId,
    variantId,
    colorCode,
  });

  if (error) {
    const err = new Error(error.message);
    err.status = error.status;
    throw err;
  }

  if (!variant.catalogProduct?.sku) {
    const err = new Error("El producto de catálogo no tiene un SKU configurado");
    err.status = 500;
    throw err;
  }

  const assetUrl =
    selectedColor?.assetUrl ||
    variant.assetUrl ||
    buildAssetUrl(photo.imagePath);

  if (!assetUrl) {
    const err = new Error(
      "No hay un assetUrl disponible para esta variante. Configura uno en Content Management."
    );
    err.status = 400;
    throw err;
  }

  const orderAsset = {
    printArea: "default",
  };

  if (assetUrl && /^https?:\/\//i.test(assetUrl)) {
    try {
      const uploaded = await uploadProdigiAsset(assetUrl);
      if (uploaded?.assetId) {
        orderAsset.assetId = uploaded.assetId;
      } else {
        orderAsset.url = assetUrl;
      }
    } catch (assetError) {
      console.warn("[Prodigi] Asset upload for order failed, falling back to url", {
        assetUrl,
        error: assetError.message,
      });
      orderAsset.url = assetUrl;
    }
  } else {
    orderAsset.url = assetUrl;
  }

  let normalizedRecipient;
  try {
    normalizedRecipient = normalizeRecipient(recipient);
  } catch (recipientError) {
    const err = new Error(recipientError.message);
    err.status = recipientError.status || 400;
    throw err;
  }

  const copiesToPrint = sanitizeInt(copies, 1);
  const merchantReference =
    providedMerchantReference || `photo-${photo._id}-${randomUUID()}`;

  /* Construir attributes para el item */
  const itemAttributes = {};
  
  /* Si tenemos productAttributes del quote, los usamos */
  if (productAttributes && typeof productAttributes === 'object') {
    Object.assign(itemAttributes, productAttributes);
  }
  
  /* Si tenemos atributos almacenados en el variant, los mezclamos */
  if (variant.productAttributes && typeof variant.productAttributes === 'object') {
    Object.assign(itemAttributes, variant.productAttributes);
  }

  /* Si el usuario seleccionó un color específico, sobrescribimos el atributo 'color' */
  if (selectedColor?.code) {
    /* Normalizamos el código de color a minúsculas para Prodigi */
    itemAttributes.color = selectedColor.code.toLowerCase();
    console.log("[Prodigi] Overriding color attribute:", {
      selectedColorCode: selectedColor.code,
      normalizedColor: itemAttributes.color,
      previousColor: productAttributes?.color || variant.productAttributes?.color
    });
  }

  const orderPayload = {
    merchantReference,
    shippingMethod: shippingMethod || DEFAULT_SHIPPING_METHOD,
    recipient: normalizedRecipient,
    items: [
      {
        merchantReference: `item-${merchantReference}`,
        sku: variant.catalogProduct.sku,
        copies: copiesToPrint,
        sizing:
          variant.sizing || variant.catalogProduct?.defaultSizing || "fillPrintArea",
        ...(Object.keys(itemAttributes).length > 0 && { attributes: itemAttributes }),
        assets: [orderAsset],
        metadata: {
          variantId: String(variant._id),
          variantName: variant.displayName || variant.catalogProduct.name,
          colorCode: selectedColor?.code || null,
        },
      },
    ],
    metadata: {
      application: "Photography-web",
      photo: {
        id: String(photo._id),
        title: photo.title,
      },
      variant: {
        id: String(variant._id),
        sku: variant.catalogProduct.sku,
        name: variant.displayName || variant.catalogProduct.name,
      },
      color: selectedColor
        ? {
            code: selectedColor.code,
            name: selectedColor.name,
          }
        : null,
    },
  };

  console.log("[Prodigi] Creating order with payload:", JSON.stringify(orderPayload, null, 2));
  
  const prodigiResponse = await prodigiRequest("/Orders", {
    method: "POST",
    body: orderPayload,
  });

  const prodigiOrderData = prodigiResponse?.order || null;
  const prodigiOrderId = prodigiOrderData?.id || prodigiOrderData?.orderId;

  if (!prodigiOrderId) {
    console.warn(
      "[Prodigi] Order response did not include an id",
      prodigiResponse
    );
  }

  let storedOrder = null;
  try {
    storedOrder = await ProdigiOrder.create({
      merchantReference,
      prodigiOrderId: prodigiOrderId || merchantReference,
      outcome: prodigiResponse?.outcome || null,
      prodigiStatus: prodigiOrderData?.status || null,
      photo: photo._id,
      variant: variant._id,
      sku: variant.catalogProduct.sku,
      colorCode: selectedColor?.code || null,
      copies: copiesToPrint,
      shippingMethod: orderPayload.shippingMethod,
      recipient: normalizedRecipient,
      metadata: orderPayload.metadata,
      prodigiOrderSnapshot: prodigiOrderData,
      createdBy: createdBy || null,
      pricing: pricing
        ? {
            currency: pricing.currency || variant.currency || "EUR",
            prodigiItemsAmount: pricing.prodigiItemsAmount || null,
            prodigiShippingAmount: pricing.prodigiShippingAmount || null,
            prodigiTaxAmount: pricing.prodigiTaxAmount || null,
            prodigiFeesAmount: pricing.prodigiFeesAmount || null,
            prodigiTotal: pricing.prodigiTotal || null,
            platformMargin: pricing.platformMargin || 0,
            totalCharged: pricing.totalCharged || null,
          }
        : undefined,
      stripePaymentIntentId: paymentIntentId || null,
      stripePaymentStatus: paymentStatus || null,
    });
  } catch (persistenceError) {
    console.error("Error storing Prodigi order in database", persistenceError);
  }

  return {
    prodigiResponse,
    prodigiOrder: prodigiOrderData,
    storedOrder,
    merchantReference,
  };
};

const createOrder = async (req, res) => {
  try {
    const {
      photoId,
      variantId,
      colorCode,
      copies,
      recipient,
      shippingMethod,
    } = req.body || {};

    const quoteContext = await computeQuoteForVariant({
      photoId,
      variantId,
      colorCode,
      copies,
      destinationCountryCode: recipient?.countryCode,
      shippingMethod,
    }).catch((error) => {
      const err = new Error(error.message || "No se pudo preparar la orden");
      err.status = error.status || 400;
      err.details = error.details;
      throw err;
    });

    const summary = summarizeProdigiQuote(quoteContext.prodigiResponse);
    const rawMargin = Number(quoteContext.variant.profitMargin || 0);
    const marginAmount = Number.isFinite(rawMargin) && rawMargin > 0 ? rawMargin : 0;

    const pricing = summary
      ? {
          currency: summary.currency,
          prodigiItemsAmount: summary.itemsAmount,
          prodigiShippingAmount: summary.shippingAmount,
          prodigiTaxAmount: summary.taxAmount,
          prodigiFeesAmount: summary.feesAmount,
          prodigiTotal: summary.prodigiTotal,
          platformMargin: marginAmount,
          totalCharged: summary.prodigiTotal + marginAmount,
        }
      : undefined;

    const result = await placeProdigiOrder({
      photoId,
      variantId,
      colorCode,
      copies,
      recipient,
      shippingMethod,
      createdBy: req.user?.userId,
      pricing,
    });

    res.status(201).json({
      outcome: result.prodigiResponse?.outcome,
      order: result.prodigiOrder,
      record: result.storedOrder
        ? {
            id: result.storedOrder._id,
            prodigiOrderId: result.storedOrder.prodigiOrderId,
          }
        : null,
    });
  } catch (error) {
    console.error("Error creating Prodigi order", error);
    const status = error.status || 500;
    res.status(status).json({
      error: "No se pudo crear el pedido en Prodigi",
      details: error.data || error.message,
    });
  }
};

const updateVariantAsset = async (req, res) => {
  try {
    const { photoId, variantId } = req.params;
    const colorCode = req.body?.colorCode
      ? String(req.body.colorCode).trim().toUpperCase()
      : null;

    const { photo, error } = await ensurePhotoAccessible(photoId);
    if (error) {
      return res.status(error.status).json({ error: error.message });
    }

    if (!mongoose.Types.ObjectId.isValid(variantId)) {
      return res.status(400).json({ error: "variantId inválido" });
    }

    const variant = await PhotoProdigiVariant.findOne({
      _id: variantId,
      photo: photo._id,
    });

    if (!variant) {
      return res.status(404).json({ error: "Variante no encontrada" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "El archivo de asset es obligatorio" });
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    let metadata = null;
    try {
      metadata = await sharp(req.file.path).metadata();
    } catch (metaError) {
      console.warn("No se pudo obtener metadata del asset", metaError.message);
    }

    const assetDetails = buildAssetDetails(metadata, req.file);

    if (colorCode) {
      const colorOption = (variant.colorOptions || []).find(
        (option) => option.code === colorCode
      );

      if (!colorOption) {
        removeLocalFile(fileUrl);
        return res.status(400).json({ error: "El color indicado no existe en la variante" });
      }

      if (colorOption.assetUrl) {
        removeLocalFile(colorOption.assetUrl);
      }

      colorOption.assetUrl = fileUrl;
      colorOption.assetDetails = assetDetails;
    } else {
      if (variant.assetUrl) {
        removeLocalFile(variant.assetUrl);
      }

      variant.assetUrl = fileUrl;
      variant.assetDetails = assetDetails;
    }

    await variant.save();
    const populated = await variant.populate("catalogProduct");

    res.json(buildVariantResponse(populated, { includeInactive: true }));
  } catch (error) {
    console.error("Error updating variant asset", error);
    res
      .status(500)
      .json({ error: "No se pudo actualizar el asset de la variante" });
  }
};

// Prodigi order management helpers

const buildOrderQuery = (query = {}) => {
  const params = new URLSearchParams();

  if (query.top !== undefined) {
    const value = Number(query.top);
    if (!Number.isNaN(value)) {
      params.set("top", Math.min(Math.max(value, 1), 100));
    }
  }

  if (query.skip !== undefined) {
    const value = Number(query.skip);
    if (!Number.isNaN(value) && value >= 0) {
      params.set("skip", value);
    }
  }

  if (query.createdFrom) {
    params.set("createdFrom", String(query.createdFrom));
  }

  if (query.createdTo) {
    params.set("createdTo", String(query.createdTo));
  }

  if (query.status) {
    params.set("status", String(query.status));
  }

  if (query.orderIds) {
    const list = Array.isArray(query.orderIds)
      ? query.orderIds
      : parseJSON(query.orderIds, []);
    if (Array.isArray(list) && list.length) {
      list.forEach((id) => params.append("orderIds", String(id)));
    }
  }

  if (query.merchantReferences) {
    const list = Array.isArray(query.merchantReferences)
      ? query.merchantReferences
      : parseJSON(query.merchantReferences, []);
    if (Array.isArray(list) && list.length) {
      list.forEach((ref) => params.append("merchantReferences", String(ref)));
    }
  }

  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
};

const getProdigiOrder = async (req, res) => {
  if (!isProdigiConfigured) {
    return res.status(503).json({
      error: "La integración con Prodigi no está configurada todavía.",
    });
  }

  const orderId = req.params?.orderId;
  if (!orderId) {
    return res.status(400).json({ error: "orderId es obligatorio" });
  }

  try {
    const response = await prodigiRequest(
      `/Orders/${encodeURIComponent(orderId)}`
    );
    res.json(response);
  } catch (error) {
    console.error("Error fetching Prodigi order", error);
    const status = error.status || 500;
    res.status(status).json({
      error: "No se pudo obtener la orden",
      details: error.data || error.message,
    });
  }
};

const listProdigiOrders = async (req, res) => {
  if (!isProdigiConfigured) {
    return res.status(503).json({
      error: "La integración con Prodigi no está configurada todavía.",
    });
  }

  try {
    const queryString = buildOrderQuery(req.query);
    const response = await prodigiRequest(`/Orders${queryString}`);
    res.json(response);
  } catch (error) {
    console.error("Error listing Prodigi orders", error);
    const status = error.status || 500;
    res.status(status).json({
      error: "No se pudieron obtener las órdenes",
      details: error.data || error.message,
    });
  }
};

const getProdigiOrderActions = async (req, res) => {
  if (!isProdigiConfigured) {
    return res.status(503).json({
      error: "La integración con Prodigi no está configurada todavía.",
    });
  }

  const orderId = req.params?.orderId;
  if (!orderId) {
    return res.status(400).json({ error: "orderId es obligatorio" });
  }

  try {
    const response = await prodigiRequest(
      `/Orders/${encodeURIComponent(orderId)}/actions`
    );
    res.json(response);
  } catch (error) {
    console.error("Error fetching Prodigi order actions", error);
    const status = error.status || 500;
    res.status(status).json({
      error: "No se pudieron obtener las acciones disponibles",
      details: error.data || error.message,
    });
  }
};

const postProdigiOrderAction = async (orderId, action, body = undefined) =>
  prodigiRequest(`/Orders/${encodeURIComponent(orderId)}/actions/${action}`, {
    method: "POST",
    body,
  });

const cancelProdigiOrder = async (req, res) => {
  if (!isProdigiConfigured) {
    return res.status(503).json({
      error: "La integración con Prodigi no está configurada todavía.",
    });
  }

  const orderId = req.params?.orderId;
  if (!orderId) {
    return res.status(400).json({ error: "orderId es obligatorio" });
  }

  try {
    const response = await postProdigiOrderAction(orderId, "cancel");
    res.json(response);
  } catch (error) {
    console.error("Error cancelling Prodigi order", error);
    const status = error.status || 500;
    res.status(status).json({
      error: "No se pudo cancelar la orden",
      details: error.data || error.message,
    });
  }
};

const updateProdigiShipping = async (req, res) => {
  if (!isProdigiConfigured) {
    return res.status(503).json({
      error: "La integración con Prodigi no está configurada todavía.",
    });
  }

  const orderId = req.params?.orderId;
  const { shippingMethod } = req.body || {};

  if (!orderId || !shippingMethod) {
    return res
      .status(400)
      .json({ error: "orderId y shippingMethod son obligatorios" });
  }

  try {
    const response = await postProdigiOrderAction(orderId, "updateShippingMethod", {
      shippingMethod,
    });
    res.json(response);
  } catch (error) {
    console.error("Error updating shipping method", error);
    const status = error.status || 500;
    res.status(status).json({
      error: "No se pudo actualizar el método de envío",
      details: error.data || error.message,
    });
  }
};

const updateProdigiRecipient = async (req, res) => {
  if (!isProdigiConfigured) {
    return res.status(503).json({
      error: "La integración con Prodigi no está configurada todavía.",
    });
  }

  const orderId = req.params?.orderId;
  const { recipient } = req.body || {};
  if (!orderId || !recipient) {
    return res
      .status(400)
      .json({ error: "orderId y recipient son obligatorios" });
  }

  try {
    const response = await postProdigiOrderAction(orderId, "updateRecipient", {
      ...recipient,
    });
    res.json(response);
  } catch (error) {
    console.error("Error updating recipient", error);
    const status = error.status || 500;
    res.status(status).json({
      error: "No se pudo actualizar el destinatario",
      details: error.data || error.message,
    });
  }
};

const updateProdigiMetadata = async (req, res) => {
  if (!isProdigiConfigured) {
    return res.status(503).json({
      error: "La integración con Prodigi no está configurada todavía.",
    });
  }

  const orderId = req.params?.orderId;
  const { metadata } = req.body || {};
  if (!orderId || metadata === undefined) {
    return res
      .status(400)
      .json({ error: "orderId y metadata son obligatorios" });
  }

  try {
    const response = await postProdigiOrderAction(orderId, "updateMetadata", {
      metadata: metadata && typeof metadata === "object" ? metadata : {},
    });
    res.json(response);
  } catch (error) {
    console.error("Error updating metadata", error);
    const status = error.status || 500;
    res.status(status).json({
      error: "No se pudo actualizar los metadatos",
      details: error.data || error.message,
    });
  }
};

module.exports = {
  listProducts,
  getQuote,
  createOrder,
  computeQuoteForVariant,
  placeProdigiOrder,
  summarizeProdigiQuote,
  normalizeRecipient,
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
};
