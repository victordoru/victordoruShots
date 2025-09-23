const { randomUUID } = require("crypto");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const Photo = require("../models/Photo");
const ProdigiCatalogProduct = require("../models/ProdigiCatalogProduct");
const PhotoProdigiVariant = require("../models/PhotoProdigiVariant");
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
        availableColors: variant.catalogProduct.availableColors || [],
        defaultSizing: variant.catalogProduct.defaultSizing,
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
    sizing: variant.sizing || catalogProduct?.defaultSizing || null,
    assetUrl: variant.assetUrl || null,
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

  variant.colorOptions = normalized
    .map((option) => {
      if (!option || !option.code) return null;

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

      return {
        code: String(option.code).trim().toUpperCase(),
        name: option.name ? String(option.name).trim() : undefined,
        assetUrl: option.assetUrl || undefined,
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
    } = req.body || {};

    if (!sku || !name) {
      return res.status(400).json({ error: "SKU y nombre son obligatorios" });
    }

    const product = new ProdigiCatalogProduct({
      sku: String(sku).trim().toUpperCase(),
      name: String(name).trim(),
      description: description ? String(description).trim() : undefined,
      basePrice: basePrice === undefined ? undefined : Number(basePrice),
      currency: currency ? String(currency).trim().toUpperCase() : undefined,
      defaultSizing: defaultSizing ? String(defaultSizing).trim() : undefined,
      availableColors: parseJSON(availableColors, []),
      attributes: parseJSON(attributes, undefined),
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
      product.availableColors = parseJSON(availableColors, []);
    }
    if (attributes !== undefined) {
      product.attributes = parseJSON(attributes, undefined);
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
    if (currency !== undefined) {
      variant.currency = currency ? String(currency).trim().toUpperCase() : "";
    }
    if (sizing !== undefined) {
      variant.sizing = sizing ? String(sizing).trim() : "";
    }
    if (assetUrl !== undefined) {
      variant.assetUrl = assetUrl ? String(assetUrl).trim() : "";
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
    await variant.deleteOne();
    mockups.forEach((image) => removeLocalFile(image.url));

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

const getQuote = async (req, res) => {
  if (!isProdigiConfigured) {
    return res.status(503).json({
      error: "La integración con Prodigi no está configurada todavía.",
    });
  }

  try {
    const {
      photoId,
      variantId,
      colorCode,
      copies,
      destinationCountryCode,
      shippingMethod,
    } = req.body || {};

    const { photo, variant, selectedColor, error } = await loadVariantForPhoto({
      photoId,
      variantId,
      colorCode,
    });

    if (error) {
      return res.status(error.status).json({ error: error.message });
    }

    const copiesToPrint = sanitizeInt(copies, 1);
    const sku = variant.catalogProduct?.sku;

    if (!sku) {
      return res
        .status(500)
        .json({ error: "El producto de catálogo no tiene un SKU configurado" });
    }

    const assetUrl =
      selectedColor?.assetUrl ||
      variant.assetUrl ||
      buildAssetUrl(photo.imagePath);

    if (!assetUrl) {
      return res.status(400).json({
        error:
          "No hay un assetUrl disponible para esta variante. Configura uno en Content Management.",
      });
    }

    const quotePayload = {
      shippingMethod: shippingMethod || DEFAULT_SHIPPING_METHOD,
      destinationCountryCode: (destinationCountryCode || "ES").toUpperCase(),
      items: [
        {
          sku,
          copies: copiesToPrint,
          sizing:
            variant.sizing || variant.catalogProduct?.defaultSizing || "fillPrintArea",
          assets: [
            {
              printArea: "default",
              url: assetUrl,
            },
          ],
        },
      ],
    };

    const prodigiResponse = await prodigiRequest("/Quotes", {
      method: "POST",
      body: quotePayload,
    });

    res.status(200).json({
      outcome: prodigiResponse?.outcome,
      quotes: prodigiResponse?.quotes,
      variant: {
        id: variant._id.toString(),
        sku,
      },
      color: selectedColor
        ? {
            code: selectedColor.code,
            name: selectedColor.name,
          }
        : null,
    });
  } catch (error) {
    console.error("Error getting Prodigi quote", error);
    const status = error.status || 500;
    res.status(status).json({
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
    const {
      photoId,
      variantId,
      colorCode,
      copies,
      recipient,
      shippingMethod,
    } = req.body || {};

    const { photo, variant, selectedColor, error } = await loadVariantForPhoto({
      photoId,
      variantId,
      colorCode,
    });

    if (error) {
      return res.status(error.status).json({ error: error.message });
    }

    if (!variant.catalogProduct?.sku) {
      return res
        .status(500)
        .json({ error: "El producto de catálogo no tiene un SKU configurado" });
    }

    const assetUrl =
      selectedColor?.assetUrl ||
      variant.assetUrl ||
      buildAssetUrl(photo.imagePath);

    if (!assetUrl) {
      return res.status(400).json({
        error:
          "No hay un assetUrl disponible para esta variante. Configura uno en Content Management.",
      });
    }

    let normalizedRecipient;
    try {
      normalizedRecipient = normalizeRecipient(recipient);
    } catch (recipientError) {
      const status = recipientError.status || 500;
      return res.status(status).json({ error: recipientError.message });
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
          sku: variant.catalogProduct.sku,
          copies: copiesToPrint,
          sizing:
            variant.sizing || variant.catalogProduct?.defaultSizing || "fillPrintArea",
          assets: [
            {
              printArea: "default",
              url: assetUrl,
            },
          ],
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

    const prodigiResponse = await prodigiRequest("/Orders", {
      method: "POST",
      body: orderPayload,
    });

    res.status(201).json({
      outcome: prodigiResponse?.outcome,
      order: prodigiResponse?.order,
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

const getProductDetails = async (req, res) => {
  if (!isProdigiConfigured) {
    return res.status(503).json({
      error: "La integración con Prodigi no está configurada todavía.",
    });
  }

  const rawSku = req.params?.sku;
  const sku = rawSku ? String(rawSku).trim() : "";
  if (!sku) {
    return res.status(400).json({ error: "SKU es obligatorio" });
  }

  try {
    const product = await prodigiRequest(`/products/${encodeURIComponent(sku)}`);
    return res.status(200).json(product);
  } catch (error) {
    console.error("Error fetching Prodigi product details", error);
    const status = error.status || 500;
    return res.status(status).json({
      error: "No se pudo obtener la información del producto",
      details: error.data || error.message,
    });
  }
};

module.exports = {
  listProducts,
  getQuote,
  createOrder,
  getProductDetails,
  listCatalogProducts,
  createCatalogProduct,
  updateCatalogProduct,
  deleteCatalogProduct,
  listPhotoVariants,
  createPhotoVariant,
  updatePhotoVariant,
  deletePhotoVariant,
};
