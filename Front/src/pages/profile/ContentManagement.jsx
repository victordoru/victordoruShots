import React, { useCallback, useEffect, useMemo, useState } from "react";
import Cropper from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import api from "@/utils/axiosInstance";

const photoInitialForm = {
  title: "",
  description: "",
  price: "",
  tags: "",
  camera: "",
  location: "",
  shotAt: "",
};

const catalogInitialForm = {
  sku: "",
  name: "",
  description: "",
  basePrice: "",
  currency: "EUR",
  defaultSizing: "",
  availableColors: [],
  prodigiDescription: "",
  productWidth: "",
  productHeight: "",
  productUnits: "",
  printPixelsWidth: "",
  printPixelsHeight: "",
  attributes: {},
  shipsTo: [],
};

const variantInitialState = {
  catalogProductId: "",
  displayName: "",
  description: "",
  retailPrice: "",
  profitMargin: "",
  currency: "EUR",
  sizing: "",
  assetUrl: "",
  assetDetails: null,
  isActive: true,
  existingMockupImages: [],
  keepMockupImageIds: [],
  newMockups: [],
  colorOptions: [],
};

const createClientId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `id-${Math.random().toString(36).slice(2, 10)}`;
};

const createImageElement = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = (error) => reject(error);
    image.src = url;
  });

const getRadianAngle = (degreeValue) => (degreeValue * Math.PI) / 180;

const rotateSize = (width, height, rotation) => {
  const rotRad = getRadianAngle(rotation);

  return {
    width:
      Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
    height:
      Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
  };
};

const getCroppedBlob = async (
  imageSrc,
  croppedAreaPixels,
  outputWidth,
  outputHeight,
  rotation = 0
) => {
  const image = await createImageElement(imageSrc);

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  const rotateCanvas = document.createElement("canvas");
  const rotateCtx = rotateCanvas.getContext("2d");

  const rotationRad = getRadianAngle(rotation);
  const naturalWidth = image.naturalWidth || image.width;
  const naturalHeight = image.naturalHeight || image.height;
  const { width: rotatedWidth, height: rotatedHeight } = rotateSize(
    naturalWidth,
    naturalHeight,
    rotation
  );

  rotateCanvas.width = rotatedWidth;
  rotateCanvas.height = rotatedHeight;

  rotateCtx.translate(rotatedWidth / 2, rotatedHeight / 2);
  rotateCtx.rotate(rotationRad);
  rotateCtx.drawImage(image, -naturalWidth / 2, -naturalHeight / 2);

  const width = Math.max(1, Math.round(outputWidth || croppedAreaPixels.width));
  const height = Math.max(
    1,
    Math.round(outputHeight || croppedAreaPixels.height)
  );
  canvas.width = width;
  canvas.height = height;

  const scaleX = rotateCanvas.width / naturalWidth;
  const scaleY = rotateCanvas.height / naturalHeight;

  ctx.drawImage(
    rotateCanvas,
    croppedAreaPixels.x * scaleX,
    croppedAreaPixels.y * scaleY,
    croppedAreaPixels.width * scaleX,
    croppedAreaPixels.height * scaleY,
    0,
    0,
    width,
    height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("No se pudo generar el recorte"));
          return;
        }
        resolve(blob);
      },
      "image/jpeg",
      0.95
    );
  });
};

const getColorSwatchStyle = (code) => {
  if (!code) return {};
  const candidate = code.startsWith("#") ? code : `#${code}`;
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(candidate)) {
    return { backgroundColor: candidate };
  }
  return { backgroundColor: code };
};

const ContentManagement = () => {
  const [photos, setPhotos] = useState([]);
  const [photoForm, setPhotoForm] = useState(photoInitialForm);
  const [photoImageFile, setPhotoImageFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoSubmitting, setPhotoSubmitting] = useState(false);
  const [photoMessage, setPhotoMessage] = useState({ success: null, error: null });

  const [catalogProducts, setCatalogProducts] = useState([]);
  const [catalogForm, setCatalogForm] = useState(catalogInitialForm);
  const [catalogEditingId, setCatalogEditingId] = useState(null);
  const [catalogSubmitting, setCatalogSubmitting] = useState(false);
  const [catalogFetching, setCatalogFetching] = useState(false);
  const [catalogMessage, setCatalogMessage] = useState({ success: null, error: null });

  const [selectedPhotoId, setSelectedPhotoId] = useState("");
  const [variantsByPhoto, setVariantsByPhoto] = useState({});
  const [variantForm, setVariantForm] = useState(variantInitialState);
  const [variantEditingId, setVariantEditingId] = useState(null);
  const [variantSubmitting, setVariantSubmitting] = useState(false);
  const [variantMessage, setVariantMessage] = useState({ success: null, error: null });
  const backendBase = import.meta.env.VITE_URL_BACKEND;
  const [assetEditor, setAssetEditor] = useState({
    open: false,
    variantId: "",
    colorCode: "",
    variantName: "",
    colorName: "",
    existingAsset: null,
    imageSrc: "",
    recommendedWidth: null,
    recommendedHeight: null,
    rotation: 0,
  });
  const [assetUploading, setAssetUploading] = useState(false);

  useEffect(() => {
    fetchPhotos();
    fetchCatalogProducts();
  }, []);

  useEffect(() => {
    return () => {
      if (photoPreview) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [photoPreview]);

  useEffect(() => {
    return () => {
      variantForm.newMockups.forEach((item) => {
        if (item.preview) {
          URL.revokeObjectURL(item.preview);
        }
      });
    };
  }, [variantForm.newMockups]);

  const fetchPhotos = async () => {
    try {
      const { data } = await api.get("/photos");
      const normalized = Array.isArray(data) ? data : [];
      setPhotos(normalized);
    } catch (err) {
      console.error("Error fetching photos", err);
      setPhotoMessage({ success: null, error: "No se pudieron cargar las fotos" });
    }
  };

  const fetchCatalogProducts = async () => {
    try {
      const { data } = await api.get("/prodigi/catalog");
      setCatalogProducts(Array.isArray(data) ? data : []);
      setCatalogMessage((prev) => ({ ...prev, error: null }));
    } catch (err) {
      console.error("Error fetching catalog products", err);
      setCatalogMessage({
        success: null,
        error:
          err.response?.data?.error ||
          "No se pudieron cargar los productos del catálogo",
      });
    }
  };

  const handleCatalogFetch = async () => {
    if (!catalogForm.sku.trim()) {
      setCatalogMessage({
        success: null,
        error: "Introduce un SKU antes de importar datos de Prodigi",
      });
      return;
    }

    try {
      setCatalogFetching(true);
      setCatalogMessage({ success: null, error: null });

      const { data } = await api.post("/prodigi/catalog/lookup", {
        sku: catalogForm.sku.trim(),
      });

      const mappedColors = (data.availableColors || []).map((color) => ({
        clientId: createClientId(),
        code: color.code || "",
        name: color.name || "",
      }));

      setCatalogForm((prev) => ({
        ...prev,
        name: data.prodigiName || prev.name,
        description: prev.description || data.prodigiDescription || prev.description,
        prodigiDescription: data.prodigiDescription || prev.prodigiDescription,
        defaultSizing: data.defaultSizing || prev.defaultSizing,
        availableColors:
          mappedColors.length > 0 ? mappedColors : prev.availableColors,
        productWidth:
          data.productDimensions?.width !== undefined &&
          data.productDimensions?.width !== null
            ? String(data.productDimensions.width)
            : prev.productWidth,
        productHeight:
          data.productDimensions?.height !== undefined &&
          data.productDimensions?.height !== null
            ? String(data.productDimensions.height)
            : prev.productHeight,
        productUnits:
          data.productDimensions?.units || prev.productUnits,
        printPixelsWidth:
          data.printAreaPixels?.width !== undefined &&
          data.printAreaPixels?.width !== null
            ? String(data.printAreaPixels.width)
            : prev.printPixelsWidth,
        printPixelsHeight:
          data.printAreaPixels?.height !== undefined &&
          data.printAreaPixels?.height !== null
            ? String(data.printAreaPixels.height)
            : prev.printPixelsHeight,
        attributes: data.attributes || prev.attributes,
        shipsTo: data.shipsTo || prev.shipsTo,
      }));

      setCatalogMessage({ success: "Metadatos importados desde Prodigi", error: null });
    } catch (err) {
      console.error("Error fetching Prodigi metadata", err);
      const message =
        err.response?.data?.error ||
        "No se pudieron obtener los datos del producto desde Prodigi";
      setCatalogMessage({ success: null, error: message });
    } finally {
      setCatalogFetching(false);
    }
  };

  const fetchPhotoVariants = async (photoId) => {
    if (!photoId) return;
    try {
      const { data } = await api.get(`/prodigi/admin/photos/${photoId}/variants`);
      setVariantsByPhoto((prev) => ({
        ...prev,
        [photoId]: Array.isArray(data) ? data : [],
      }));
    } catch (err) {
      console.error("Error fetching photo variants", err);
      setVariantMessage({
        success: null,
        error:
          err.response?.data?.error ||
          "No se pudieron cargar las variantes para esta fotografía",
      });
    }
  };

  const handlePhotoFormChange = (event) => {
    const { name, value } = event.target;
    setPhotoForm((prev) => ({ ...prev, [name]: value }));
  };

  const handlePhotoFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setPhotoImageFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPhotoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return objectUrl;
    });
  };

  const resetPhotoForm = () => {
    setPhotoForm(photoInitialForm);
    setPhotoImageFile(null);
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
      setPhotoPreview(null);
    }
  };

  const handlePhotoSubmit = async (event) => {
    event.preventDefault();
    setPhotoMessage({ success: null, error: null });

    if (!photoForm.title.trim()) {
      setPhotoMessage({ success: null, error: "El título es obligatorio" });
      return;
    }

    if (!photoImageFile) {
      setPhotoMessage({ success: null, error: "Selecciona una imagen antes de guardar" });
      return;
    }

    try {
      setPhotoSubmitting(true);
      const formData = new FormData();
      Object.entries(photoForm).forEach(([key, value]) => {
        if (value) formData.append(key, value);
      });
      formData.append("image", photoImageFile);

      await api.post("/photos", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setPhotoMessage({ success: "Imagen guardada correctamente", error: null });
      resetPhotoForm();
      await fetchPhotos();
    } catch (err) {
      console.error("Error creating photo", err);
      const message = err.response?.data?.message || "No se pudo guardar la imagen";
      setPhotoMessage({ success: null, error: message });
    } finally {
      setPhotoSubmitting(false);
    }
  };

  const catalogAvailableColors = useMemo(
    () => catalogForm.availableColors || [],
    [catalogForm.availableColors]
  );

  const handleCatalogFormChange = (event) => {
    const { name, value } = event.target;
    setCatalogForm((prev) => ({ ...prev, [name]: value }));
  };

  const addCatalogColor = () => {
    setCatalogForm((prev) => ({
      ...prev,
      availableColors: [
        ...prev.availableColors,
        { clientId: createClientId(), code: "", name: "" },
      ],
    }));
  };

  const updateCatalogColor = (clientId, field, value) => {
    setCatalogForm((prev) => ({
      ...prev,
      availableColors: prev.availableColors.map((color) =>
        color.clientId === clientId
          ? {
              ...color,
              [field]:
                field === "code" && value
                  ? value.toUpperCase()
                  : value,
            }
          : color
      ),
    }));
  };

  const removeCatalogColor = (clientId) => {
    setCatalogForm((prev) => ({
      ...prev,
      availableColors: prev.availableColors.filter(
        (color) => color.clientId !== clientId
      ),
    }));
  };

  const resetCatalogForm = () => {
    setCatalogForm(catalogInitialForm);
    setCatalogEditingId(null);
  };

  const handleCatalogSubmit = async (event) => {
    event.preventDefault();
    setCatalogMessage({ success: null, error: null });

    if (!catalogForm.sku.trim() || !catalogForm.name.trim()) {
      setCatalogMessage({ success: null, error: "El SKU y el nombre son obligatorios" });
      return;
    }

    try {
      setCatalogSubmitting(true);
      const payload = {
        sku: catalogForm.sku.trim(),
        name: catalogForm.name.trim(),
        description: catalogForm.description,
        basePrice: catalogForm.basePrice,
        currency: catalogForm.currency,
        defaultSizing: catalogForm.defaultSizing,
        availableColors: catalogForm.availableColors.map((color) => ({
          code: color.code?.trim().toUpperCase() || "",
          name: color.name?.trim() || "",
        })),
        prodigiDescription: catalogForm.prodigiDescription,
        productDimensions: {
          width: catalogForm.productWidth,
          height: catalogForm.productHeight,
          units: catalogForm.productUnits,
        },
        printAreaPixels: {
          width: catalogForm.printPixelsWidth,
          height: catalogForm.printPixelsHeight,
        },
        attributes: catalogForm.attributes,
        shipsTo: catalogForm.shipsTo,
      };

      if (catalogEditingId) {
        await api.put(`/prodigi/catalog/${catalogEditingId}`, payload);
        setCatalogMessage({ success: "Producto actualizado", error: null });
      } else {
        await api.post("/prodigi/catalog", payload);
        setCatalogMessage({ success: "Producto creado", error: null });
      }

      resetCatalogForm();
      await fetchCatalogProducts();
    } catch (err) {
      console.error("Error saving catalog product", err);
      const message =
        err.response?.data?.error || "No se pudo guardar el producto del catálogo";
      setCatalogMessage({ success: null, error: message });
    } finally {
      setCatalogSubmitting(false);
    }
  };

  const handleEditCatalogProduct = (product) => {
    setCatalogEditingId(product._id);
    setCatalogForm({
      sku: product.sku || "",
      name: product.name || "",
      description: product.description || "",
      basePrice:
        product.basePrice !== undefined && product.basePrice !== null
          ? String(product.basePrice)
          : "",
      currency: product.currency || "EUR",
      defaultSizing: product.defaultSizing || "",
      availableColors: (product.availableColors || []).map((color) => ({
        clientId: createClientId(),
        code: color.code || "",
        name: color.name || "",
      })),
      prodigiDescription: product.prodigiDescription || "",
      productWidth:
        product.productDimensions?.width !== undefined &&
        product.productDimensions?.width !== null
          ? String(product.productDimensions.width)
          : "",
      productHeight:
        product.productDimensions?.height !== undefined &&
        product.productDimensions?.height !== null
          ? String(product.productDimensions.height)
          : "",
      productUnits: product.productDimensions?.units || "",
      printPixelsWidth:
        product.printAreaPixels?.width !== undefined &&
        product.printAreaPixels?.width !== null
          ? String(product.printAreaPixels.width)
          : "",
      printPixelsHeight:
        product.printAreaPixels?.height !== undefined &&
        product.printAreaPixels?.height !== null
          ? String(product.printAreaPixels.height)
          : "",
      attributes: product.attributes || {},
      shipsTo: product.shipsTo || [],
    });
    setCatalogMessage({ success: null, error: null });
  };

  const handleDeleteCatalogProduct = async (productId) => {
    try {
      await api.delete(`/prodigi/catalog/${productId}`);
      setCatalogMessage({ success: "Producto eliminado", error: null });
      await fetchCatalogProducts();
    } catch (err) {
      console.error("Error deleting catalog product", err);
      const message =
        err.response?.data?.error || "No se pudo eliminar el producto del catálogo";
      setCatalogMessage({ success: null, error: message });
    }
  };

  const resetVariantForm = () => {
    setVariantForm(variantInitialState);
    setVariantEditingId(null);
  };

  const initializeVariantFormFromCatalog = (catalogProductId) => {
    const catalogProduct = catalogProducts.find(
      (item) => item._id === catalogProductId
    );
    if (!catalogProduct) return;

    if (!variantEditingId) {
      const colorOptions = (catalogProduct.availableColors || []).map((color) => ({
        clientId: createClientId(),
        code: color.code ? String(color.code).toUpperCase() : "",
        name: color.name || "",
        assetUrl: "",
        mockupImageRefs: [],
      }));

      setVariantForm((prev) => ({
        ...prev,
        colorOptions,
      }));
    }
  };

  const handleVariantFieldChange = (field, value) => {
    setVariantForm((prev) => ({ ...prev, [field]: value }));

    if (field === "catalogProductId") {
      initializeVariantFormFromCatalog(value);
    }
  };

  const addVariantColor = () => {
    setVariantForm((prev) => ({
      ...prev,
      colorOptions: [
        ...prev.colorOptions,
        {
          clientId: createClientId(),
          code: "",
          name: "",
          assetUrl: "",
          mockupImageRefs: [],
        },
      ],
    }));
  };

  const updateVariantColor = (clientId, field, value) => {
    setVariantForm((prev) => ({
      ...prev,
      colorOptions: prev.colorOptions.map((color) =>
        color.clientId === clientId
          ? {
              ...color,
              [field]:
                field === "code" && value
                  ? value.toUpperCase()
                  : value,
            }
          : color
      ),
    }));
  };

  const toggleVariantColorMockup = (clientId, imageRef) => {
    setVariantForm((prev) => ({
      ...prev,
      colorOptions: prev.colorOptions.map((color) => {
        if (color.clientId !== clientId) return color;
        const exists = color.mockupImageRefs.includes(imageRef);
        return {
          ...color,
          mockupImageRefs: exists
            ? color.mockupImageRefs.filter((ref) => ref !== imageRef)
            : [...color.mockupImageRefs, imageRef],
        };
      }),
    }));
  };

  const removeVariantColor = (clientId) => {
    setVariantForm((prev) => ({
      ...prev,
      colorOptions: prev.colorOptions.filter((color) => color.clientId !== clientId),
    }));
  };

  const handleVariantMockupUpload = (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    const mapped = files.map((file) => ({
      file,
      tempId: createClientId(),
      preview: URL.createObjectURL(file),
    }));

    setVariantForm((prev) => ({
      ...prev,
      newMockups: [...prev.newMockups, ...mapped],
    }));

    event.target.value = "";
  };

  const removeNewVariantMockup = (tempId) => {
    setVariantForm((prev) => {
      const target = prev.newMockups.find((item) => item.tempId === tempId);
      if (target?.preview) {
        URL.revokeObjectURL(target.preview);
      }
      return {
        ...prev,
        newMockups: prev.newMockups.filter((item) => item.tempId !== tempId),
        colorOptions: prev.colorOptions.map((color) => ({
          ...color,
          mockupImageRefs: color.mockupImageRefs.filter((ref) => ref !== tempId),
        })),
      };
    });
  };

  const removeExistingVariantMockup = (mockupId) => {
    setVariantForm((prev) => ({
      ...prev,
      existingMockupImages: prev.existingMockupImages.filter(
        (image) => image.id !== mockupId
      ),
      keepMockupImageIds: prev.keepMockupImageIds.filter((id) => id !== mockupId),
      colorOptions: prev.colorOptions.map((color) => ({
        ...color,
        mockupImageRefs: color.mockupImageRefs.filter((ref) => ref !== mockupId),
      })),
    }));
  };

  const loadVariantIntoForm = (variant) => {
    setVariantEditingId(variant.id);

    const existingMockups = (variant.mockupImages || []).map((image) => ({
      id: image.id,
      url: image.url,
      label: image.label,
    }));

    setVariantForm({
      catalogProductId: variant.catalogProduct?.id || "",
      displayName: variant.displayName || "",
      description: variant.description || "",
      retailPrice:
        variant.retailPrice !== undefined && variant.retailPrice !== null
          ? String(variant.retailPrice)
          : "",
      profitMargin:
        variant.profitMargin !== undefined && variant.profitMargin !== null
          ? String(variant.profitMargin)
          : "",
      currency: variant.currency || "EUR",
      sizing: variant.sizing || "",
      assetUrl: variant.assetUrl || "",
      assetDetails: variant.assetDetails || null,
      isActive: Boolean(variant.isActive),
      existingMockupImages: existingMockups,
      keepMockupImageIds: existingMockups.map((image) => image.id),
      newMockups: [],
      colorOptions: (variant.colorOptions || []).map((color) => ({
        clientId: createClientId(),
        code: color.code || "",
        name: color.name || "",
        assetUrl: color.assetUrl || "",
        assetDetails: color.assetDetails || null,
        mockupImageRefs: Array.isArray(color.mockupImageRefs)
          ? [...color.mockupImageRefs]
          : [],
      })),
    });

    setVariantMessage({ success: null, error: null });
  };

  const handleCancelVariantEdit = () => {
    resetVariantForm();
    setVariantMessage({ success: null, error: null });
  };

  const buildVariantFormData = () => {
    const formData = new FormData();

    formData.append("catalogProductId", variantForm.catalogProductId);
    formData.append("displayName", variantForm.displayName);
    formData.append("description", variantForm.description);
    formData.append("retailPrice", variantForm.retailPrice);
    formData.append("profitMargin", variantForm.profitMargin);
    formData.append("currency", variantForm.currency);
    formData.append("sizing", variantForm.sizing);
    formData.append("assetUrl", variantForm.assetUrl);
    formData.append("isActive", variantForm.isActive);

    formData.append(
      "keepMockupImageIds",
      JSON.stringify(variantForm.keepMockupImageIds)
    );

    const colorOptionsPayload = variantForm.colorOptions.map((color) => ({
      code: color.code?.trim().toUpperCase() || "",
      name: color.name?.trim() || "",
      assetUrl: color.assetUrl || "",
      mockupImageRefs: color.mockupImageRefs,
    }));
    formData.append("colorOptions", JSON.stringify(colorOptionsPayload));

    const newMockupMeta = variantForm.newMockups.map((item) => ({
      tempId: item.tempId,
    }));
    formData.append("newMockupMeta", JSON.stringify(newMockupMeta));

    variantForm.newMockups.forEach(({ file }) => {
      formData.append("mockups", file);
    });

    return formData;
  };

  const refreshVariantsForPhoto = async (photoId) => {
    await fetchPhotoVariants(photoId);
  };

  const handleVariantSubmit = async (event) => {
    event.preventDefault();
    setVariantMessage({ success: null, error: null });

    if (!selectedPhotoId) {
      setVariantMessage({ success: null, error: "Selecciona una fotografía" });
      return;
    }

    if (!variantForm.catalogProductId) {
      setVariantMessage({
        success: null,
        error: "Selecciona un producto del catálogo",
      });
      return;
    }

    try {
      setVariantSubmitting(true);
      const formData = buildVariantFormData();
      const config = { headers: { "Content-Type": "multipart/form-data" } };

      if (variantEditingId) {
        await api.put(
          `/prodigi/admin/photos/${selectedPhotoId}/variants/${variantEditingId}`,
          formData,
          config
        );
        setVariantMessage({ success: "Variante actualizada", error: null });
      } else {
        await api.post(
          `/prodigi/admin/photos/${selectedPhotoId}/variants`,
          formData,
          config
        );
        setVariantMessage({ success: "Variante creada", error: null });
      }

      resetVariantForm();
      await refreshVariantsForPhoto(selectedPhotoId);
    } catch (err) {
      console.error("Error saving variant", err);
      const message =
        err.response?.data?.error || "No se pudo guardar la variante";
      setVariantMessage({ success: null, error: message });
    } finally {
      setVariantSubmitting(false);
    }
  };

  const handleDeleteVariant = async (photoId, variantId) => {
    try {
      await api.delete(
        `/prodigi/admin/photos/${photoId}/variants/${variantId}`
      );
      setVariantMessage({ success: "Variante eliminada", error: null });
      await refreshVariantsForPhoto(photoId);

      if (variantEditingId === variantId) {
        resetVariantForm();
      }
    } catch (err) {
      console.error("Error deleting variant", err);
      const message =
        err.response?.data?.error || "No se pudo eliminar la variante";
      setVariantMessage({ success: null, error: message });
    }
  };

  const selectedPhoto = useMemo(
    () => photos.find((photo) => photo._id === selectedPhotoId) || null,
    [photos, selectedPhotoId]
  );

  const selectedPhotoVariants = useMemo(
    () => variantsByPhoto[selectedPhotoId] || [],
    [variantsByPhoto, selectedPhotoId]
  );

  const closeAssetEditor = useCallback(() => {
    setAssetEditor({
      open: false,
      variantId: "",
      colorCode: "",
      variantName: "",
      colorName: "",
      existingAsset: null,
      imageSrc: "",
      recommendedWidth: null,
      recommendedHeight: null,
      rotation: 0,
    });
  }, []);

  const openVariantAssetEditor = useCallback(
    (variant, colorCode = "") => {
      if (!selectedPhoto || !selectedPhotoId) {
        setVariantMessage({
          success: null,
          error: "Selecciona una fotografía antes de editar el asset.",
        });
        return;
      }

      const normalizedCode = colorCode ? String(colorCode).toUpperCase() : "";
      const colorOption = normalizedCode
        ? variant.colorOptions?.find((option) => option.code === normalizedCode)
        : null;

      const catalogPrintPixels =
        variant.catalogProduct?.printAreaPixels ||
        (() => {
          const catalogId = variant.catalogProduct?.id || variant.catalogProduct?._id;
          if (!catalogId) return null;
          const matched = catalogProducts.find((product) => product._id === catalogId);
          return matched?.printAreaPixels || null;
        })() || {};

      setAssetEditor({
        open: true,
        variantId: variant.id,
        colorCode: normalizedCode,
        variantName: variant.displayName || variant.catalogProduct?.name || "Variante",
        colorName: colorOption?.name || normalizedCode,
        existingAsset: colorOption?.assetDetails || variant.assetDetails || null,
        imageSrc: selectedPhoto.imagePath?.startsWith("http")
          ? selectedPhoto.imagePath
          : `${backendBase}${selectedPhoto.imagePath}`,
        recommendedWidth: catalogPrintPixels.width || null,
        recommendedHeight: catalogPrintPixels.height || null,
        rotation: 0,
      });
    },
    [backendBase, catalogProducts, selectedPhoto, selectedPhotoId]
  );

  const handleAssetEditorConfirm = useCallback(
    async (variantId, colorCode, { blob, width, height }) => {
      if (!selectedPhotoId) {
        setVariantMessage({
          success: null,
          error: "Selecciona una fotografía antes de guardar el asset.",
        });
        return;
      }

      try {
        setAssetUploading(true);
        const formData = new FormData();
        formData.append("asset", blob, `asset-${Date.now()}.jpg`);
        if (colorCode) {
          formData.append("colorCode", colorCode);
        }

        const { data } = await api.post(
          `/prodigi/admin/photos/${selectedPhotoId}/variants/${variantId}/asset`,
          formData
        );

        setVariantsByPhoto((prev) => {
          const current = prev[selectedPhotoId] || [];
          const hasVariant = current.some((variant) => variant.id === data.id);
          const updated = hasVariant
            ? current.map((variant) => (variant.id === data.id ? data : variant))
            : [...current, data];
          return {
            ...prev,
            [selectedPhotoId]: updated,
          };
        });

        if (variantEditingId === data.id) {
          loadVariantIntoForm(data);
        }

        setVariantMessage({
          success: "Asset actualizado correctamente",
          error: null,
        });
        closeAssetEditor();
      } catch (err) {
        const message =
          err.response?.data?.error || "No se pudo actualizar el asset";
        setVariantMessage({ success: null, error: message });
      } finally {
        setAssetUploading(false);
      }
    },
    [closeAssetEditor, loadVariantIntoForm, selectedPhotoId, variantEditingId]
  );

  const variantMockupSource = (mockup) =>
    mockup.url?.startsWith("http") ? mockup.url : `${import.meta.env.VITE_URL_BACKEND}${mockup.url}`;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-10 text-white">
      <VariantAssetEditor
        open={assetEditor.open}
        imageSrc={assetEditor.imageSrc}
        variantName={assetEditor.variantName}
        colorName={assetEditor.colorName}
        existingAsset={assetEditor.existingAsset}
        recommendedWidth={assetEditor.recommendedWidth}
        recommendedHeight={assetEditor.recommendedHeight}
        initialRotation={assetEditor.rotation}
        loading={assetUploading}
        onClose={closeAssetEditor}
        onConfirm={(payload) =>
          handleAssetEditorConfirm(
            assetEditor.variantId,
            assetEditor.colorCode,
            payload
          )
        }
      />
      <header className="flex flex-col gap-2">
        <h1 className="text-4xl font-semibold uppercase tracking-[0.4em] sm:text-5xl">
          Content Management
        </h1>
        <p className="text-sm text-white/60 sm:text-base">
          Gestiona tu biblioteca fotográfica y personaliza qué productos de impresión estarán disponibles en cada imagen.
        </p>
      </header>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur lg:p-8">
        <h2 className="mb-6 text-2xl font-semibold uppercase tracking-[0.3em] text-white">
          Nueva imagen
        </h2>
        <form onSubmit={handlePhotoSubmit} className="grid gap-6 md:grid-cols-[1fr_280px]">
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-widest text-white/60">Título*</span>
                <input
                  name="title"
                  value={photoForm.title}
                  onChange={handlePhotoFormChange}
                  className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white focus:outline-none"
                  placeholder="Nombre de la fotografía"
                  required
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-widest text-white/60">Precio (€)</span>
                <input
                  name="price"
                  value={photoForm.price}
                  onChange={handlePhotoFormChange}
                  type="number"
                  min="0"
                  step="0.01"
                  className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white focus:outline-none"
                  placeholder="0.00"
                />
              </label>
            </div>

            <label className="flex flex-col gap-2">
              <span className="text-xs uppercase tracking-widest text-white/60">Descripción</span>
              <textarea
                name="description"
                value={photoForm.description}
                onChange={handlePhotoFormChange}
                rows={4}
                className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white focus:outline-none"
                placeholder="Notas sobre la toma, inspiración, contexto..."
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-widest text-white/60">Etiquetas</span>
                <input
                  name="tags"
                  value={photoForm.tags}
                  onChange={handlePhotoFormChange}
                  className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white focus:outline-none"
                  placeholder="playa, analógico, verano"
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-widest text-white/60">Cámara</span>
                <input
                  name="camera"
                  value={photoForm.camera}
                  onChange={handlePhotoFormChange}
                  className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white focus:outline-none"
                  placeholder="Canon R6"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-widest text-white/60">Ubicación</span>
                <input
                  name="location"
                  value={photoForm.location}
                  onChange={handlePhotoFormChange}
                  className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white focus:outline-none"
                  placeholder="Tarifa, Cádiz"
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-widest text-white/60">Fecha de captura</span>
                <input
                  name="shotAt"
                  value={photoForm.shotAt}
                  onChange={handlePhotoFormChange}
                  type="date"
                  className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white focus:outline-none"
                />
              </label>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs uppercase tracking-widest text-white/60">Archivo</span>
              <label className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-black/30 px-4 py-10 text-center text-xs uppercase tracking-[0.3em] text-white/60 transition hover:border-white/40 hover:text-white">
                <span>Seleccionar imagen</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoFileChange}
                  className="hidden"
                />
              </label>
              {photoPreview && (
                <div className="relative h-48 overflow-hidden rounded-xl border border-white/10">
                  <img src={photoPreview} alt="Preview" className="h-full w-full object-cover" />
                </div>
              )}
            </div>

            {photoMessage.error && (
              <p className="text-sm text-red-400">{photoMessage.error}</p>
            )}
            {photoMessage.success && (
              <p className="text-sm text-emerald-300">{photoMessage.success}</p>
            )}

            <div className="flex flex-wrap gap-4">
              <button
                type="submit"
                disabled={photoSubmitting}
                className="rounded-full bg-white px-6 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-black transition hover:bg-white/80 disabled:cursor-not-allowed disabled:bg-white/40"
              >
                {photoSubmitting ? "Guardando..." : "Guardar"}
              </button>
              <button
                type="button"
                onClick={resetPhotoForm}
                className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-white transition hover:border-white/40 hover:text-white"
              >
                Limpiar
              </button>
            </div>
          </div>
        </form>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur lg:p-8">
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold uppercase tracking-[0.3em] text-white">
              Catálogo Prodigi
            </h2>
            <p className="mt-1 text-sm text-white/60">
              Define los productos base (SKU) disponibles. Luego podrás combinarlos con cada fotografía.
            </p>
          </div>
          {catalogEditingId && (
            <span className="rounded-full border border-white/20 px-3 py-1 text-xs uppercase tracking-[0.3em] text-white/60">
              Editando producto
            </span>
          )}
        </div>

        <div className="grid gap-8 lg:grid-cols-[360px_1fr]">
          <form onSubmit={handleCatalogSubmit} className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label className="text-xs uppercase tracking-widest text-white/60" htmlFor="catalog-sku">
                  SKU*
                </label>
                <input
                  id="catalog-sku"
                  name="sku"
                  value={catalogForm.sku}
                  onChange={handleCatalogFormChange}
                  className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm uppercase text-white placeholder:text-white/30 focus:border-white focus:outline-none"
                  placeholder="GLOBAL-CAN-10X10"
                  required
                />
                <button
                  type="button"
                  onClick={handleCatalogFetch}
                  disabled={catalogFetching}
                  className="self-start rounded-full border border-white/30 px-4 py-2 text-[0.6rem] uppercase tracking-[0.3em] text-white transition hover:border-white/60 hover:text-white disabled:cursor-not-allowed disabled:border-white/10 disabled:text-white/40"
                >
                  {catalogFetching ? "Consultando..." : "Importar Prodigi"}
                </button>
              </div>
              <label className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-widest text-white/60">Nombre*</span>
                <input
                  name="name"
                  value={catalogForm.name}
                  onChange={handleCatalogFormChange}
                  className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white focus:outline-none"
                  placeholder="Canvas 10×10"
                  required
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
              <label className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-widest text-white/60">Precio base</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  name="basePrice"
                  value={catalogForm.basePrice}
                  onChange={handleCatalogFormChange}
                  className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white focus:outline-none"
                  placeholder="0.00"
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-widest text-white/60">Moneda</span>
                <input
                  name="currency"
                  value={catalogForm.currency}
                  onChange={handleCatalogFormChange}
                  className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm uppercase text-white placeholder:text-white/30 focus:border-white focus:outline-none"
                  maxLength={3}
                  placeholder="EUR"
                />
              </label>
            </div>

            <label className="flex flex-col gap-2">
              <span className="text-xs uppercase tracking-widest text-white/60">Modo de ajuste</span>
              <input
                name="defaultSizing"
                value={catalogForm.defaultSizing}
                onChange={handleCatalogFormChange}
                className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white focus:outline-none"
                placeholder="fillPrintArea"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-xs uppercase tracking-widest text-white/60">Descripción</span>
              <textarea
                name="description"
                value={catalogForm.description}
                onChange={handleCatalogFormChange}
                rows={3}
                className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white focus:outline-none"
                placeholder="Detalles del producto, materiales, acabados..."
              />
            </label>

            {catalogForm.prodigiDescription && (
              <label className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-widest text-white/60">
                  Descripción de Prodigi
                </span>
                <textarea
                  value={catalogForm.prodigiDescription}
                  readOnly
                  rows={3}
                  className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/70"
                />
              </label>
            )}

            <div className="grid gap-4 sm:grid-cols-3">
              <label className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-widest text-white/60">
                  Dimensión ancho
                </span>
                <input
                  name="productWidth"
                  value={catalogForm.productWidth}
                  onChange={handleCatalogFormChange}
                  type="number"
                  min="0"
                  step="0.01"
                  className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white focus:outline-none"
                  placeholder="Ancho"
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-widest text-white/60">
                  Dimensión alto
                </span>
                <input
                  name="productHeight"
                  value={catalogForm.productHeight}
                  onChange={handleCatalogFormChange}
                  type="number"
                  min="0"
                  step="0.01"
                  className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white focus:outline-none"
                  placeholder="Alto"
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-widest text-white/60">
                  Unidades
                </span>
                <input
                  name="productUnits"
                  value={catalogForm.productUnits}
                  onChange={handleCatalogFormChange}
                  className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white focus:outline-none"
                  placeholder="in, cm, mm..."
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-widest text-white/60">
                  Resolución horizontal (px)
                </span>
                <input
                  name="printPixelsWidth"
                  value={catalogForm.printPixelsWidth}
                  onChange={handleCatalogFormChange}
                  type="number"
                  min="0"
                  step="1"
                  className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white focus:outline-none"
                  placeholder="0"
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-widest text-white/60">
                  Resolución vertical (px)
                </span>
                <input
                  name="printPixelsHeight"
                  value={catalogForm.printPixelsHeight}
                  onChange={handleCatalogFormChange}
                  type="number"
                  min="0"
                  step="1"
                  className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white focus:outline-none"
                  placeholder="0"
                />
              </label>
            </div>

            {catalogForm.shipsTo.length > 0 && (
              <p className="text-[0.6rem] text-white/40">
                Prodigi envía este producto a {catalogForm.shipsTo.length} países.
              </p>
            )}

            {catalogForm.attributes &&
              Object.keys(catalogForm.attributes).length > 0 && (
                <div className="flex flex-col gap-2">
                  <span className="text-xs uppercase tracking-widest text-white/60">
                    Atributos Prodigi
                  </span>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {Object.entries(catalogForm.attributes).map(([key, value]) => (
                      <div
                        key={key}
                        className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[0.6rem] text-white/70"
                      >
                        <p className="uppercase tracking-[0.3em] text-white/40">
                          {key}
                        </p>
                        <p className="mt-1 break-words text-white/70">
                          {Array.isArray(value) ? value.join(", ") : value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-widest text-white/60">
                  Colores disponibles
                </span>
                <button
                  type="button"
                  onClick={addCatalogColor}
                  className="text-xs uppercase tracking-[0.3em] text-white/60 transition hover:text-white"
                >
                  Añadir color
                </button>
              </div>
              {catalogAvailableColors.length === 0 ? (
                <p className="text-[0.65rem] text-white/40">
                  Añade códigos de color para reutilizarlos en las variantes por fotografía.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {catalogAvailableColors.map((color) => (
                    <div
                      key={color.clientId}
                      className="grid gap-2 rounded-xl border border-white/10 bg-black/30 p-3 sm:grid-cols-[120px_1fr_auto]"
                    >
                      <input
                        value={color.code}
                        onChange={(event) =>
                          updateCatalogColor(color.clientId, "code", event.target.value)
                        }
                        placeholder="HEX"
                        className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs uppercase text-white focus:border-white/30 focus:outline-none"
                      />
                      <input
                        value={color.name}
                        onChange={(event) =>
                          updateCatalogColor(color.clientId, "name", event.target.value)
                        }
                        placeholder="Descripción"
                        className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white focus:border-white/30 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => removeCatalogColor(color.clientId)}
                        className="rounded-full border border-red-400/40 px-3 py-2 text-[0.6rem] uppercase tracking-[0.3em] text-red-200 transition hover:border-red-200/80"
                      >
                        Quitar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {catalogMessage.error && (
              <p className="text-xs text-red-300">{catalogMessage.error}</p>
            )}
            {catalogMessage.success && (
              <p className="text-xs text-emerald-300">{catalogMessage.success}</p>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={catalogSubmitting}
                className="rounded-full bg-white px-6 py-3 text-xs font-semibold uppercase tracking-[0.35em] text-black transition hover:bg-white/80 disabled:cursor-not-allowed disabled:bg-white/40"
              >
                {catalogSubmitting
                  ? "Guardando..."
                  : catalogEditingId
                  ? "Guardar cambios"
                  : "Crear producto"}
              </button>
              {catalogEditingId && (
                <button
                  type="button"
                  onClick={resetCatalogForm}
                  className="rounded-full border border-white/30 px-6 py-3 text-xs font-semibold uppercase tracking-[0.35em] text-white transition hover:border-white/60 hover:text-white"
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>

          <div className="flex flex-col gap-4">
            {catalogProducts.length === 0 ? (
              <p className="text-sm text-white/50">
                Aún no has creado productos. Completa el formulario para dar de alta tus opciones de impresión.
              </p>
            ) : (
              catalogProducts.map((product) => (
                <article
                  key={product._id}
                  className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/40 p-4 shadow"
                >
                  <header className="flex flex-col gap-1">
                    <h3 className="text-base font-semibold uppercase tracking-[0.25em] text-white">
                      {product.name}
                    </h3>
                    <p className="text-[0.65rem] uppercase tracking-[0.3em] text-white/40">
                      SKU: {product.sku}
                    </p>
                  </header>
                  {product.description && (
                    <p className="text-sm text-white/70">{product.description}</p>
                  )}
                  {product.prodigiDescription && (
                    <p className="text-[0.65rem] text-white/40">
                      {product.prodigiDescription}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-white/60">
                    {product.basePrice !== undefined && product.basePrice !== null && (
                      <span>
                        Precio base: {Number(product.basePrice).toFixed(2)} {product.currency || "EUR"}
                      </span>
                    )}
                    {product.defaultSizing && <span>Modo: {product.defaultSizing}</span>}
                    {product.productDimensions?.width && product.productDimensions?.height && (
                      <span>
                        Dimensiones: {product.productDimensions.width} × {product.productDimensions.height} {product.productDimensions.units || ""}
                      </span>
                    )}
                    {product.printAreaPixels?.width && product.printAreaPixels?.height && (
                      <span>
                        Resolución: {product.printAreaPixels.width} × {product.printAreaPixels.height} px
                      </span>
                    )}
                  </div>
                  {product.availableColors?.length ? (
                    <div className="flex flex-wrap gap-2 text-[0.6rem] text-white/50">
                      {product.availableColors.map((color) => (
                        <span
                          key={`${product._id}-${color.code}`}
                          className="rounded-full border border-white/20 px-3 py-1 uppercase tracking-[0.25em]"
                        >
                          {color.name || color.code}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleEditCatalogProduct(product)}
                      className="rounded-full border border-white/30 px-4 py-2 text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-white transition hover:border-white/60 hover:text-white"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCatalogProduct(product._id)}
                      className="rounded-full border border-red-300/40 px-4 py-2 text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-red-200 transition hover:border-red-200/80"
                    >
                      Eliminar
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur lg:p-8">
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold uppercase tracking-[0.3em] text-white">
              Variantes por fotografía
            </h2>
            <p className="mt-1 text-sm text-white/60">
              Elige una fotografía y configura qué productos puede comprar el usuario final, con sus mockups y colores disponibles.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-[0.3em] text-white/50">
              Fotografía
            </span>
            <select
              value={selectedPhotoId}
              onChange={async (event) => {
                const value = event.target.value;
                setSelectedPhotoId(value);
                resetVariantForm();
                setVariantMessage({ success: null, error: null });
                if (value) {
                  await fetchPhotoVariants(value);
                }
              }}
              className="rounded-xl border border-white/20 bg-black/40 px-3 py-2 text-xs text-white focus:border-white/40 focus:outline-none"
            >
              <option value="">Selecciona una fotografía</option>
              {photos.map((photoItem) => (
                <option key={photoItem._id} value={photoItem._id}>
                  {photoItem.title || photoItem._id}
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedPhoto ? (
          <div className="grid gap-8 lg:grid-cols-[420px_1fr]">
            <form onSubmit={handleVariantSubmit} className="flex flex-col gap-4">
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-xs text-white/70">
                <p className="text-[0.65rem] uppercase tracking-[0.3em] text-white/40">
                  Fotografía seleccionada
                </p>
                <h3 className="mt-2 text-sm font-semibold uppercase tracking-[0.2em] text-white">
                  {selectedPhoto.title}
                </h3>
                <p className="mt-1 text-[0.7rem] text-white/50">
                  {new Date(selectedPhoto.createdAt || Date.now()).toLocaleDateString()}
                </p>
              </div>

              <label className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-widest text-white/60">Producto del catálogo*</span>
                <select
                  value={variantForm.catalogProductId}
                  onChange={(event) =>
                    handleVariantFieldChange("catalogProductId", event.target.value)
                  }
                  className="rounded-xl border border-white/20 bg-black/40 px-3 py-2 text-xs text-white focus:border-white/40 focus:outline-none"
                  required
                >
                  <option value="">Selecciona un SKU</option>
                  {catalogProducts.map((product) => (
                    <option key={product._id} value={product._id}>
                      {product.name} · {product.sku}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-4 sm:grid-cols-3">
                <label className="flex flex-col gap-2">
                  <span className="text-xs uppercase tracking-widest text-white/60">Nombre</span>
                  <input
                    value={variantForm.displayName}
                    onChange={(event) =>
                      handleVariantFieldChange("displayName", event.target.value)
                    }
                    placeholder="Canvas 10x10 Mate"
                    className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white focus:outline-none"
                  />
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-xs uppercase tracking-widest text-white/60">Margen (€)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={variantForm.profitMargin}
                    onChange={(event) =>
                      handleVariantFieldChange("profitMargin", event.target.value)
                    }
                    placeholder="0.00"
                    className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white focus:outline-none"
                  />
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-xs uppercase tracking-widest text-white/60">Precio manual (opcional)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={variantForm.retailPrice}
                    onChange={(event) =>
                      handleVariantFieldChange("retailPrice", event.target.value)
                    }
                    placeholder="0.00"
                    className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white focus:outline-none"
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-2">
                  <span className="text-xs uppercase tracking-widest text-white/60">Moneda</span>
                  <input
                    value={variantForm.currency}
                    onChange={(event) =>
                      handleVariantFieldChange("currency", event.target.value)
                    }
                    maxLength={3}
                    className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm uppercase text-white placeholder:text-white/30 focus:border-white focus:outline-none"
                  />
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-xs uppercase tracking-widest text-white/60">Modo de ajuste</span>
                  <input
                    value={variantForm.sizing}
                    onChange={(event) =>
                      handleVariantFieldChange("sizing", event.target.value)
                    }
                    placeholder="fillPrintArea"
                    className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white focus:outline-none"
                  />
                </label>
              </div>

              <label className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-widest text-white/60">Descripción</span>
                <textarea
                  value={variantForm.description}
                  onChange={(event) =>
                    handleVariantFieldChange("description", event.target.value)
                  }
                  rows={3}
                  className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white focus:outline-none"
                  placeholder="Notas específicas para esta fotografía"
                />
              </label>

              <label className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-white/60">
                <input
                  type="checkbox"
                  checked={variantForm.isActive}
                  onChange={(event) =>
                    handleVariantFieldChange("isActive", event.target.checked)
                  }
                  className="h-4 w-4 rounded border-white/30 bg-transparent text-white accent-white"
                />
                Variante activa
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-widest text-white/60">Asset URL personalizado</span>
                <input
                  value={variantForm.assetUrl}
                  onChange={(event) =>
                    handleVariantFieldChange("assetUrl", event.target.value)
                  }
                  placeholder="https://..."
                  className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white focus:outline-none"
                />
              </label>

              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-widest text-white/60">
                    Mockups
                  </span>
                  <label className="cursor-pointer text-[0.6rem] uppercase tracking-[0.3em] text-white/60 transition hover:text-white">
                    Añadir imágenes
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleVariantMockupUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="flex flex-col gap-2">
                  {variantForm.existingMockupImages.length === 0 &&
                  variantForm.newMockups.length === 0 ? (
                    <p className="text-[0.65rem] text-white/40">
                      Sube mockups para mostrar cómo se verá la impresión.
                    </p>
                  ) : null}

                  {variantForm.existingMockupImages.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <p className="text-[0.65rem] text-white/40">Imágenes guardadas</p>
                      <div className="flex gap-2 overflow-x-auto">
                        {variantForm.existingMockupImages.map((image) => (
                          <div
                            key={image.id}
                            className="group relative h-24 w-32 flex-none overflow-hidden rounded-xl border border-white/10"
                          >
                            <img
                              src={variantMockupSource(image)}
                              alt="Mockup guardado"
                              className="h-full w-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => removeExistingVariantMockup(image.id)}
                              className="absolute right-2 top-2 hidden rounded-full bg-black/70 px-2 py-1 text-[0.6rem] uppercase tracking-[0.2em] text-white shadow group-hover:block"
                            >
                              Quitar
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {variantForm.newMockups.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <p className="text-[0.65rem] text-white/40">Nuevos mockups</p>
                      <div className="flex gap-2 overflow-x-auto">
                        {variantForm.newMockups.map((item) => (
                          <div
                            key={item.tempId}
                            className="group relative h-24 w-32 flex-none overflow-hidden rounded-xl border border-dashed border-white/20"
                          >
                            <img
                              src={item.preview}
                              alt="Nuevo mockup"
                              className="h-full w-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => removeNewVariantMockup(item.tempId)}
                              className="absolute right-2 top-2 hidden rounded-full bg-black/70 px-2 py-1 text-[0.6rem] uppercase tracking-[0.2em] text-white shadow group-hover:block"
                            >
                              Quitar
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-widest text-white/60">
                    Colores de la variante
                  </span>
                  <button
                    type="button"
                    onClick={addVariantColor}
                    className="text-[0.6rem] uppercase tracking-[0.3em] text-white/60 transition hover:text-white"
                  >
                    Añadir color
                  </button>
                </div>

                {variantForm.colorOptions.length === 0 ? (
                  <p className="text-[0.65rem] text-white/40">
                    Selecciona un producto del catálogo para importar sus colores o añade colores personalizados.
                  </p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {variantForm.colorOptions.map((color) => (
                      <div
                        key={color.clientId}
                        className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/30 p-4"
                      >
                        <div className="grid gap-2 sm:grid-cols-[120px_1fr_auto]">
                          <input
                            value={color.code}
                            onChange={(event) =>
                              updateVariantColor(color.clientId, "code", event.target.value)
                            }
                            placeholder="Código"
                            className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs uppercase text-white focus:border-white/30 focus:outline-none"
                          />
                          <input
                            value={color.name}
                            onChange={(event) =>
                              updateVariantColor(color.clientId, "name", event.target.value)
                            }
                            placeholder="Nombre"
                            className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white focus:border-white/30 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => removeVariantColor(color.clientId)}
                            className="rounded-full border border-red-400/40 px-3 py-2 text-[0.6rem] uppercase tracking-[0.2em] text-red-200 transition hover:border-red-200/80"
                          >
                            Quitar
                          </button>
                        </div>

                        <input
                          value={color.assetUrl}
                          onChange={(event) =>
                            updateVariantColor(color.clientId, "assetUrl", event.target.value)
                          }
                          placeholder="Asset URL específico (opcional)"
                          className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none"
                        />

                        <div className="flex flex-col gap-2">
                          <p className="text-[0.6rem] uppercase tracking-[0.3em] text-white/40">
                            Mockups asociados
                          </p>
                          <div className="flex flex-wrap gap-2 text-[0.65rem] text-white/70">
                            {[...variantForm.existingMockupImages.map((image) => ({
                              ref: image.id,
                              label: image.label || image.id,
                              url: variantMockupSource(image),
                            })),
                              ...variantForm.newMockups.map((image) => ({
                                ref: image.tempId,
                                label: image.file.name,
                                url: image.preview,
                              }))].map((item) => {
                              const isChecked = color.mockupImageRefs.includes(item.ref);
                              return (
                                <button
                                  key={`${color.clientId}-${item.ref}`}
                                  type="button"
                                  onClick={() => toggleVariantColorMockup(color.clientId, item.ref)}
                                  className={`rounded-full border px-3 py-1 uppercase tracking-[0.25em] transition ${
                                    isChecked
                                      ? "border-white bg-white/20 text-white"
                                      : "border-white/30 text-white/60 hover:border-white/50 hover:text-white"
                                  }`}
                                >
                                  {item.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {variantMessage.error && (
                <p className="text-xs text-red-300">{variantMessage.error}</p>
              )}
              {variantMessage.success && (
                <p className="text-xs text-emerald-300">{variantMessage.success}</p>
              )}

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={variantSubmitting}
                  className="rounded-full bg-white px-6 py-3 text-xs font-semibold uppercase tracking-[0.35em] text-black transition hover:bg-white/80 disabled:cursor-not-allowed disabled:bg-white/40"
                >
                  {variantSubmitting
                    ? "Guardando..."
                    : variantEditingId
                    ? "Guardar cambios"
                    : "Crear variante"}
                </button>
                {variantEditingId && (
                  <button
                    type="button"
                    onClick={handleCancelVariantEdit}
                    className="rounded-full border border-white/30 px-6 py-3 text-xs font-semibold uppercase tracking-[0.35em] text-white transition hover:border-white/60 hover:text-white"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>

            <div className="flex flex-col gap-4">
              {selectedPhotoVariants.length === 0 ? (
                <p className="text-sm text-white/50">
                  No hay variantes configuradas para esta fotografía. Crea una para ofrecer productos específicos.
                </p>
              ) : (
                selectedPhotoVariants.map((variant) => (
                  <article
                    key={variant.id}
                    className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/40 p-4"
                  >
                    <header className="flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-base font-semibold uppercase tracking-[0.25em] text-white">
                          {variant.displayName || variant.catalogProduct?.name}
                        </h3>
                        <span
                          className={`rounded-full px-3 py-1 text-[0.6rem] uppercase tracking-[0.25em] ${
                            variant.isActive
                              ? "border border-emerald-300/40 text-emerald-200"
                              : "border border-white/20 text-white/50"
                          }`}
                        >
                          {variant.isActive ? "Activa" : "Inactiva"}
                        </span>
                      </div>
                      <p className="text-[0.65rem] uppercase tracking-[0.3em] text-white/40">
                        SKU: {variant.catalogProduct?.sku}
                      </p>
                    </header>
                    {variant.description && (
                      <p className="text-sm text-white/70">{variant.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-white/60">
                      {variant.retailPrice !== undefined && variant.retailPrice !== null && (
                        <span>
                          Precio: {Number(variant.retailPrice).toFixed(2)} {variant.currency || "EUR"}
                        </span>
                      )}
                      {variant.profitMargin !== undefined && variant.profitMargin !== null && (
                        <span>
                          Margen: {Number(variant.profitMargin).toFixed(2)} {variant.currency || "EUR"}
                        </span>
                      )}
                      {variant.sizing && <span>Modo: {variant.sizing}</span>}
                    </div>
                    {variant.assetUrl ? (
                      <div className="flex flex-col gap-2">
                        <p className="text-[0.6rem] uppercase tracking-[0.3em] text-white/40">
                          Asset principal
                        </p>
                        <img
                          src={variant.assetUrl.startsWith("http") ? variant.assetUrl : `${backendBase}${variant.assetUrl}`}
                          alt="Asset principal"
                          className="h-24 w-32 rounded-xl border border-white/10 object-cover"
                        />
                        {variant.assetDetails?.width && variant.assetDetails?.height && (
                          <p className="text-[0.6rem] text-white/40">
                            {variant.assetDetails.width} × {variant.assetDetails.height} px · {variant.assetDetails.format?.toUpperCase() || ""}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-[0.6rem] text-white/40">
                        Aún no has generado un asset específico para esta variante.
                      </p>
                    )}
                    {variant.mockupImages?.length ? (
                      <div className="flex flex-col gap-2">
                        <p className="text-[0.6rem] uppercase tracking-[0.3em] text-white/40">
                          Mockups asociados
                        </p>
                        <div className="flex gap-2 overflow-x-auto">
                          {variant.mockupImages.map((image) => (
                            <img
                              key={image.id}
                              src={variantMockupSource(image)}
                              alt="Mockup"
                              className="h-16 w-24 flex-none rounded-lg border border-white/10 object-cover"
                            />
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {variant.colorOptions?.length ? (
                      <div className="flex flex-col gap-2">
                        <p className="text-[0.6rem] uppercase tracking-[0.3em] text-white/40">
                          Colores configurados
                        </p>
                        <div className="flex flex-col gap-2">
                          {variant.colorOptions.map((color) => (
                            <div
                              key={`${variant.id}-${color.code}`}
                              className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/10 px-3 py-2"
                            >
                              <span
                                className="h-3 w-3 rounded-full border border-white/30"
                                style={getColorSwatchStyle(color.code)}
                              />
                              <span className="text-[0.6rem] uppercase tracking-[0.25em] text-white/70">
                                {color.name || color.code}
                              </span>
                              {color.assetUrl ? (
                                <img
                                  src={color.assetUrl.startsWith("http") ? color.assetUrl : `${backendBase}${color.assetUrl}`}
                                  alt={`Asset ${color.name || color.code}`}
                                  className="h-12 w-16 rounded-lg border border-white/10 object-cover"
                                />
                              ) : (
                                <span className="text-[0.55rem] uppercase tracking-[0.3em] text-white/30">
                                  Sin asset
                                </span>
                              )}
                              {color.assetDetails?.width && color.assetDetails?.height && (
                                <span className="text-[0.55rem] text-white/40">
                                  {color.assetDetails.width} × {color.assetDetails.height} px
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => openVariantAssetEditor(variant, color.code)}
                                className="ml-auto rounded-full border border-white/30 px-3 py-1 text-[0.55rem] uppercase tracking-[0.3em] text-white transition hover:border-white/60 hover:text-white"
                              >
                                Editar asset
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openVariantAssetEditor(variant)}
                        className="rounded-full border border-white/30 px-4 py-2 text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-white transition hover:border-white/60 hover:text-white"
                      >
                        Editar asset principal
                      </button>
                      <button
                        type="button"
                        onClick={() => loadVariantIntoForm(variant)}
                        className="rounded-full border border-white/30 px-4 py-2 text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-white transition hover:border-white/60 hover:text-white"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteVariant(selectedPhotoId, variant.id)}
                        className="rounded-full border border-red-300/40 px-4 py-2 text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-red-200 transition hover:border-red-200/80"
                      >
                        Eliminar
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-white/50">
            Selecciona una fotografía para configurar sus variantes de impresión.
          </p>
        )}
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur lg:p-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-semibold uppercase tracking-[0.3em] text-white">
            Biblioteca
          </h2>
          <span className="text-xs uppercase tracking-[0.3em] text-white/40">
            {photos.length} elementos
          </span>
        </div>

        {photos.length === 0 ? (
          <p className="text-sm text-white/50">
            Aún no has añadido fotografías. Cuando subas una imagen aparecerá aquí con sus metadatos.
          </p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {photos.map((photoItem) => (
              <article
                key={photoItem._id}
                className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/40 shadow-lg"
              >
                <div className="relative h-56 w-full overflow-hidden">
                  <img
                    src={`${import.meta.env.VITE_URL_BACKEND}${photoItem.imagePath}`}
                    alt={photoItem.title}
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute left-4 top-4 rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.3em] text-white/80 backdrop-blur">
                    {photoItem.price ? `${Number(photoItem.price).toFixed(2)} €` : "Sin precio"}
                  </span>
                </div>
                <div className="flex flex-col gap-3 p-5 text-sm text-white/80">
                  <header>
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold uppercase tracking-[0.2em] text-white">
                        {photoItem.title}
                      </h3>
                      <button
                        type="button"
                        onClick={async () => {
                          setSelectedPhotoId(photoItem._id);
                          resetVariantForm();
                          setVariantMessage({ success: null, error: null });
                          await fetchPhotoVariants(photoItem._id);
                        }}
                        className="rounded-full border border-white/30 px-3 py-1 text-[0.6rem] uppercase tracking-[0.3em] text-white transition hover:border-white/60 hover:text-white"
                      >
                        Configurar impresiones
                      </button>
                    </div>
                    <p className="mt-2 text-xs uppercase tracking-[0.3em] text-white/40">
                      {photoItem.createdAt ? new Date(photoItem.createdAt).toLocaleDateString() : ""}
                    </p>
                  </header>
                  {photoItem.description && (
                    <p className="text-sm text-white/70">{photoItem.description}</p>
                  )}
                  <dl className="grid grid-cols-1 gap-2 text-xs text-white/50 sm:grid-cols-2">
                    {photoItem.metadata?.camera && (
                      <div>
                        <dt className="uppercase tracking-[0.3em]">Cámara</dt>
                        <dd className="mt-1 text-white/70">{photoItem.metadata.camera}</dd>
                      </div>
                    )}
                    {photoItem.metadata?.location && (
                      <div>
                        <dt className="uppercase tracking-[0.3em]">Ubicación</dt>
                        <dd className="mt-1 text-white/70">{photoItem.metadata.location}</dd>
                      </div>
                    )}
                    {photoItem.metadata?.shotAt && (
                      <div>
                        <dt className="uppercase tracking-[0.3em]">Capturada</dt>
                        <dd className="mt-1 text-white/70">
                          {new Date(photoItem.metadata.shotAt).toLocaleDateString()}
                        </dd>
                      </div>
                    )}
                  </dl>
                  {photoItem.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {photoItem.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-white/10 px-3 py-1 text-[0.65rem] uppercase tracking-[0.3em] text-white/60"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

function VariantAssetEditor({
  open,
  imageSrc,
  variantName,
  colorName,
  existingAsset,
  recommendedWidth,
  recommendedHeight,
  initialRotation = 0,
  loading,
  onClose,
  onConfirm,
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [targetWidth, setTargetWidth] = useState(
    Number(existingAsset?.width || recommendedWidth || 3000) || 3000
  );
  const [targetHeight, setTargetHeight] = useState(
    Number(existingAsset?.height || recommendedHeight || 3000) || 3000
  );
  const [rotation, setRotation] = useState(initialRotation);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
      setError(null);
      const widthDefault =
        existingAsset?.width || recommendedWidth || 3000;
      const heightDefault =
        existingAsset?.height || recommendedHeight || 3000;
      setTargetWidth(Number(widthDefault) || 3000);
      setTargetHeight(Number(heightDefault) || 3000);
      setRotation(initialRotation || 0);
    }
  }, [open, existingAsset, recommendedWidth, recommendedHeight, initialRotation]);

  const handleCropComplete = useCallback((_, areaPixels) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const handleConfirm = async () => {
    if (!croppedAreaPixels) {
      setError("Selecciona un recorte válido antes de guardar");
      return;
    }

    try {
      const blob = await getCroppedBlob(
        imageSrc,
        croppedAreaPixels,
        targetWidth,
        targetHeight,
        rotation
      );
      await onConfirm({ blob, width: targetWidth, height: targetHeight });
    } catch (err) {
      setError(err.message || "No se pudo generar el recorte");
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-6">
      <div className="relative w-full max-w-4xl rounded-3xl bg-neutral-900 p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full border border-white/20 px-3 py-1 text-[0.6rem] uppercase tracking-[0.3em] text-white/60 transition hover:border-white/50 hover:text-white"
        >
          Cerrar
        </button>
        <header className="mb-4 space-y-1 pr-16">
          <h3 className="text-lg font-semibold uppercase tracking-[0.3em] text-white">
            Recortar asset
          </h3>
          <p className="text-xs text-white/60">
            {variantName}
            {colorName ? ` · ${colorName}` : ""}
          </p>
        </header>
        <div className="relative h-[55vh] overflow-hidden rounded-2xl bg-black">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={
              targetWidth && targetHeight
                ? Math.max(targetWidth, 1) / Math.max(targetHeight, 1)
                : 1
            }
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onRotationChange={setRotation}
            onCropComplete={handleCropComplete}
            objectFit="contain"
            zoomWithScroll
          />
        </div>
        <div className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.3em] text-white/60">
            Zoom
            <input
              type="range"
              min="1"
              max="5"
              step="0.01"
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.3em] text-white/60">
            Rotación ({Math.round(rotation)}°)
            <input
              type="range"
              min="-180"
              max="180"
              step="1"
              value={rotation}
              onChange={(event) => setRotation(Number(event.target.value))}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.3em] text-white/60">
              Ancho final (px)
              <input
                type="number"
                min={1}
                value={targetWidth}
                onChange={(event) =>
                  setTargetWidth(Math.max(1, Number(event.target.value)))
                }
                className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-white/40 focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.3em] text-white/60">
              Alto final (px)
              <input
                type="number"
                min={1}
                value={targetHeight}
                onChange={(event) =>
                  setTargetHeight(Math.max(1, Number(event.target.value)))
                }
                className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-white/40 focus:outline-none"
              />
            </label>
          </div>
          {recommendedWidth && recommendedHeight && (
            <p className="text-[0.65rem] text-white/40">
              Resolución recomendada Prodigi: {recommendedWidth} × {recommendedHeight} px
            </p>
          )}
          {existingAsset ? (
            <p className="text-[0.65rem] text-white/40">
              Asset actual: {existingAsset.width || "?"} × {existingAsset.height || "?"} px ·
              {" "}
              {existingAsset.format?.toUpperCase() || ""}
            </p>
          ) : (
            <p className="text-[0.65rem] text-white/40">
              Define un recorte con las dimensiones recomendadas por Prodigi para este SKU.
            </p>
          )}
          {error && <p className="text-xs text-red-300">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/30 px-4 py-2 text-[0.6rem] uppercase tracking-[0.3em] text-white transition hover:border-white/60 hover:text-white"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="rounded-full bg-white px-4 py-2 text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-black transition hover:bg-white/80 disabled:cursor-not-allowed disabled:bg-white/40"
              disabled={loading}
            >
              {loading ? "Guardando..." : "Guardar recorte"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ContentManagement;
