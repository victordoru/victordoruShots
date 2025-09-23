import React, { useEffect, useMemo, useState } from "react";
import api from "@/utils/axiosInstance";

const initialForm = {
  title: "",
  description: "",
  price: "",
  tags: "",
  camera: "",
  location: "",
  shotAt: "",
};

const productInitialForm = {
  sku: "",
  name: "",
  description: "",
  retailPrice: "",
  currency: "EUR",
  sizing: "fillPrintArea",
  mockupImages: [],
};

const ContentManagement = () => {
  const [form, setForm] = useState(initialForm);
  const [imageFile, setImageFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [prodigiProducts, setProdigiProducts] = useState([]);
  const [productForm, setProductForm] = useState(productInitialForm);
  const [editingProductId, setEditingProductId] = useState(null);
  const [productImageFiles, setProductImageFiles] = useState([]);
  const [productImagesToRemove, setProductImagesToRemove] = useState([]);
  const [productSubmitting, setProductSubmitting] = useState(false);
  const [productError, setProductError] = useState("");
  const [productSuccess, setProductSuccess] = useState("");
  const backendBase = import.meta.env.VITE_URL_BACKEND;

  useEffect(() => {
    fetchPhotos();
    fetchProdigiProducts();
  }, []);

  useEffect(() => {
    return () => {
      productImageFiles.forEach(({ preview }) => {
        if (preview) {
          URL.revokeObjectURL(preview);
        }
      });
    };
  }, [productImageFiles]);

  const fetchPhotos = async () => {
    try {
      const { data } = await api.get("/photos");
      const normalized = Array.isArray(data)
        ? data.map((photo) => ({
            ...photo,
            prodigiProducts: Array.isArray(photo.prodigiProducts)
              ? photo.prodigiProducts.map((id) => String(id))
              : [],
          }))
        : [];
      setPhotos(normalized);
    } catch (err) {
      console.error("Error fetching photos", err);
      setError("No se pudieron cargar las fotos");
    }
  };

  const fetchProdigiProducts = async () => {
    try {
      const { data } = await api.get("/prodigi/admin/products");
      setProdigiProducts(Array.isArray(data) ? data : []);
      setProductError("");
    } catch (err) {
      console.error("Error fetching Prodigi products", err);
      setProductError(
        err.response?.data?.error ||
          "No se pudieron cargar los productos de impresión"
      );
    }
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImageFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
  };

  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  const resetForm = () => {
    setForm(initialForm);
    setImageFile(null);
    setPreview(null);
  };

  const clearNewProductImages = () => {
    setProductImageFiles((prev) => {
      prev.forEach(({ preview }) => {
        if (preview) {
          URL.revokeObjectURL(preview);
        }
      });
      return [];
    });
  };

  const resetProductFormState = () => {
    setProductForm(productInitialForm);
    setEditingProductId(null);
    clearNewProductImages();
    setProductImagesToRemove([]);
  };

  const handleProductFormChange = (event) => {
    const { name, value } = event.target;
    setProductForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleProductImageChange = (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const mapped = files.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));

    setProductImageFiles((prev) => [...prev, ...mapped]);
    event.target.value = "";
  };

  const handleRemoveNewProductImage = (previewUrl) => {
    setProductImageFiles((prev) => {
      const removed = prev.find((item) => item.preview === previewUrl);
      if (removed?.preview) {
        URL.revokeObjectURL(removed.preview);
      }
      return prev.filter((item) => item.preview !== previewUrl);
    });
  };

  const handleRemoveExistingProductImage = (imagePath) => {
    setProductForm((prev) => ({
      ...prev,
      mockupImages: prev.mockupImages.filter((image) => image !== imagePath),
    }));
    setProductImagesToRemove((prev) =>
      prev.includes(imagePath) ? prev : [...prev, imagePath]
    );
  };

  const handleProductSubmit = async (event) => {
    event.preventDefault();
    setProductError("");
    setProductSuccess("");

    if (!productForm.sku.trim() || !productForm.name.trim()) {
      setProductError("El SKU y el nombre son obligatorios");
      return;
    }

    try {
      setProductSubmitting(true);

      const formData = new FormData();
      formData.append("sku", productForm.sku.trim());
      formData.append("name", productForm.name.trim());
      if (productForm.description) {
        formData.append("description", productForm.description);
      }
      if (productForm.retailPrice !== "") {
        formData.append("retailPrice", productForm.retailPrice);
      }
      if (productForm.currency) {
        formData.append("currency", productForm.currency);
      }
      if (productForm.sizing) {
        formData.append("sizing", productForm.sizing);
      }

      productImageFiles.forEach(({ file }) => {
        formData.append("images", file);
      });

      if (productImagesToRemove.length) {
        formData.append(
          "imagesToRemove",
          JSON.stringify(productImagesToRemove)
        );
      }

      const config = { headers: { "Content-Type": "multipart/form-data" } };

      if (editingProductId) {
        await api.put(
          `/prodigi/admin/products/${editingProductId}`,
          formData,
          config
        );
        setProductSuccess("Producto actualizado correctamente");
      } else {
        await api.post("/prodigi/admin/products", formData, config);
        setProductSuccess("Producto creado correctamente");
      }

      resetProductFormState();
      await fetchProdigiProducts();
      await fetchPhotos();
    } catch (err) {
      console.error("Error saving Prodigi product", err);
      const message =
        err.response?.data?.error || "No se pudo guardar el producto";
      setProductError(message);
    } finally {
      setProductSubmitting(false);
    }
  };

  const handleEditProduct = (product) => {
    setProductError("");
    setProductSuccess("");
    clearNewProductImages();
    setProductImagesToRemove([]);
    setEditingProductId(product._id);
    setProductForm({
      sku: product.sku || "",
      name: product.name || "",
      description: product.description || "",
      retailPrice:
        product.retailPrice !== undefined && product.retailPrice !== null
          ? String(product.retailPrice)
          : "",
      currency: product.currency || "EUR",
      sizing: product.sizing || "fillPrintArea",
      mockupImages: product.mockupImages || [],
    });
  };

  const handleCancelProductEdit = () => {
    resetProductFormState();
    setProductError("");
    setProductSuccess("");
  };

  const handleDeleteProduct = async (productId) => {
    setProductError("");
    setProductSuccess("");
    try {
      await api.delete(`/prodigi/admin/products/${productId}`);
      if (editingProductId === productId) {
        resetProductFormState();
      }
      setProductSuccess("Producto eliminado correctamente");
      await fetchProdigiProducts();
      await fetchPhotos();
    } catch (err) {
      console.error("Error deleting Prodigi product", err);
      const message =
        err.response?.data?.error || "No se pudo eliminar el producto";
      setProductError(message);
    }
  };

  const handlePhotoProductToggle = async (photoId, productId, checked) => {
    const targetPhoto = photos.find((item) => item._id === photoId);
    if (!targetPhoto) return;

    const currentIds = Array.isArray(targetPhoto.prodigiProducts)
      ? targetPhoto.prodigiProducts.map((id) => String(id))
      : [];

    const nextIds = checked
      ? Array.from(new Set([...currentIds, productId]))
      : currentIds.filter((id) => id !== productId);

    setPhotos((prev) =>
      prev.map((photo) =>
        photo._id === photoId
          ? { ...photo, prodigiProducts: nextIds }
          : photo
      )
    );

    try {
      const { data } = await api.put(
        `/prodigi/admin/photos/${photoId}/products`,
        {
          productIds: nextIds,
        }
      );

      const assignedIds = Array.isArray(data)
        ? data.map((item) => String(item._id))
        : [];

      setPhotos((prev) =>
        prev.map((photo) =>
          photo._id === photoId
            ? { ...photo, prodigiProducts: assignedIds }
            : photo
        )
      );
      setSuccess("Productos actualizados para la fotografía");
    } catch (err) {
      console.error("Error updating photo products", err);
      const message =
        err.response?.data?.error ||
        "No se pudieron actualizar los productos para la fotografía";
      setError(message);
      setPhotos((prev) =>
        prev.map((photo) =>
          photo._id === photoId
            ? { ...photo, prodigiProducts: currentIds }
            : photo
        )
      );
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!form.title.trim()) {
      setError("El título es obligatorio");
      return;
    }

    if (!imageFile) {
      setError("Selecciona una imagen antes de guardar");
      return;
    }

    try {
      setIsSubmitting(true);
      const formData = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        if (value) formData.append(key, value);
      });
      formData.append("image", imageFile);

      await api.post("/photos", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setSuccess("Imagen guardada correctamente");
      resetForm();
      await fetchPhotos();
    } catch (err) {
      console.error("Error creating photo", err);
      const message = err.response?.data?.message || "No se pudo guardar la imagen";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const sortedPhotos = useMemo(
    () =>
      [...photos].sort(
        (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      ),
    [photos]
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-4 py-10 text-white">
      <header className="flex flex-col gap-2">
        <h1 className="text-4xl font-semibold uppercase tracking-[0.4em] sm:text-5xl">
          Content Management
        </h1>
        <p className="text-sm text-white/60 sm:text-base">
          Sube imágenes para tu catálogo. Los archivos se almacenan en el servidor y aquí guardamos la referencia con los datos clave.
        </p>
      </header>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur lg:p-8">
        <h2 className="mb-6 text-2xl font-semibold uppercase tracking-[0.3em] text-white">
          Nueva imagen
        </h2>
        <form onSubmit={handleSubmit} className="grid gap-6 md:grid-cols-[1fr_280px]">
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-widest text-white/60">Título*</span>
                <input
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white focus:outline-none"
                  placeholder="Nombre de la fotografía"
                  required
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-widest text-white/60">Precio (€)</span>
                <input
                  name="price"
                  value={form.price}
                  onChange={handleChange}
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
                value={form.description}
                onChange={handleChange}
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
                  value={form.tags}
                  onChange={handleChange}
                  className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white focus:outline-none"
                  placeholder="playa, analógico, verano"
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-widest text-white/60">Cámara</span>
                <input
                  name="camera"
                  value={form.camera}
                  onChange={handleChange}
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
                  value={form.location}
                  onChange={handleChange}
                  className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white focus:outline-none"
                  placeholder="Tarifa, Cádiz"
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-widest text-white/60">Fecha de captura</span>
                <input
                  name="shotAt"
                  value={form.shotAt}
                  onChange={handleChange}
                  type="date"
                  className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white focus:outline-none"
                />
              </label>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
              <label className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 bg-black/30 px-4 py-8 text-center text-white/70 transition hover:border-white/40 hover:text-white">
                <span className="text-xs uppercase tracking-[0.3em]">Selecciona una imagen</span>
                <span className="text-[0.7rem] text-white/40">JPEG, PNG o WebP</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              </label>
              {preview && (
                <div className="h-32 w-full overflow-hidden rounded-2xl border border-white/10 sm:w-48">
                  <img src={preview} alt="Preview" className="h-full w-full object-cover" />
                </div>
              )}
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}
            {success && <p className="text-sm text-emerald-300">{success}</p>}

            <div className="flex flex-wrap gap-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-full bg-white px-6 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-black transition hover:bg-white/80 disabled:cursor-not-allowed disabled:bg-white/40"
              >
                {isSubmitting ? "Guardando..." : "Guardar"}
              </button>
              <button
                type="button"
                onClick={resetForm}
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
              Productos de impresión
            </h2>
            <p className="mt-1 text-sm text-white/60">
              Crea productos vinculados a Prodigi, sube imágenes mockup y asócialos a tus fotografías.
            </p>
          </div>
          {editingProductId && (
            <span className="rounded-full border border-white/20 px-3 py-1 text-xs uppercase tracking-[0.3em] text-white/60">
              Editando producto
            </span>
          )}
        </div>

        <div className="grid gap-8 lg:grid-cols-[360px_1fr]">
          <form onSubmit={handleProductSubmit} className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-widest text-white/60">SKU*</span>
                <input
                  name="sku"
                  value={productForm.sku}
                  onChange={handleProductFormChange}
                  className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm uppercase text-white placeholder:text-white/30 focus:border-white focus:outline-none"
                  placeholder="GLOBAL-CAN-10X10"
                  required
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-widest text-white/60">Nombre*</span>
                <input
                  name="name"
                  value={productForm.name}
                  onChange={handleProductFormChange}
                  className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white focus:outline-none"
                  placeholder="Canvas 10×10"
                  required
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
              <label className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-widest text-white/60">Precio recomendado</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  name="retailPrice"
                  value={productForm.retailPrice}
                  onChange={handleProductFormChange}
                  className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white focus:outline-none"
                  placeholder="0.00"
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-widest text-white/60">Moneda</span>
                <input
                  name="currency"
                  value={productForm.currency}
                  onChange={handleProductFormChange}
                  className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm uppercase text-white placeholder:text-white/30 focus:border-white focus:outline-none"
                  maxLength={3}
                  placeholder="EUR"
                />
              </label>
            </div>

            <label className="flex flex-col gap-2">
              <span className="text-xs uppercase tracking-widest text-white/60">Modo de ajuste</span>
              <select
                name="sizing"
                value={productForm.sizing}
                onChange={handleProductFormChange}
                className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white focus:border-white focus:outline-none"
              >
                <option value="fillPrintArea">fillPrintArea</option>
                <option value="fitPrintArea">fitPrintArea</option>
                <option value="stretchToPrintArea">stretchToPrintArea</option>
              </select>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-xs uppercase tracking-widest text-white/60">Descripción</span>
              <textarea
                name="description"
                value={productForm.description}
                onChange={handleProductFormChange}
                rows={3}
                className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white focus:outline-none"
                placeholder="Detalles del producto, materiales, acabados..."
              />
            </label>

            <div className="flex flex-col gap-2">
              <span className="text-xs uppercase tracking-widest text-white/60">Mockups</span>
              {productForm.mockupImages?.length ? (
                <div className="flex gap-2 overflow-x-auto">
                  {productForm.mockupImages.map((imagePath) => (
                    <div
                      key={imagePath}
                      className="group relative h-24 w-32 flex-none overflow-hidden rounded-xl border border-white/10"
                    >
                      <img
                        src={`${backendBase}${imagePath}`}
                        alt="Mockup guardado"
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveExistingProductImage(imagePath)}
                        className="absolute right-2 top-2 hidden rounded-full bg-black/70 px-2 py-1 text-[0.6rem] uppercase tracking-[0.2em] text-white shadow group-hover:block"
                      >
                        Quitar
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              {productImageFiles.length ? (
                <div className="flex gap-2 overflow-x-auto">
                  {productImageFiles.map((item) => (
                    <div
                      key={item.preview}
                      className="group relative h-24 w-32 flex-none overflow-hidden rounded-xl border border-dashed border-white/20"
                    >
                      <img
                        src={item.preview}
                        alt="Nuevo mockup"
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveNewProductImage(item.preview)}
                        className="absolute right-2 top-2 hidden rounded-full bg-black/70 px-2 py-1 text-[0.6rem] uppercase tracking-[0.2em] text-white shadow group-hover:block"
                      >
                        Quitar
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              <label className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-black/30 px-4 py-6 text-center text-xs uppercase tracking-[0.3em] text-white/60 transition hover:border-white/40 hover:text-white">
                <span>Subir mockups</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleProductImageChange}
                  className="hidden"
                />
              </label>
            </div>

            {productError && (
              <p className="text-xs text-red-300">{productError}</p>
            )}
            {productSuccess && (
              <p className="text-xs text-emerald-300">{productSuccess}</p>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={productSubmitting}
                className="rounded-full bg-white px-6 py-3 text-xs font-semibold uppercase tracking-[0.35em] text-black transition hover:bg-white/80 disabled:cursor-not-allowed disabled:bg-white/40"
              >
                {productSubmitting
                  ? "Guardando..."
                  : editingProductId
                  ? "Guardar cambios"
                  : "Crear producto"}
              </button>
              {editingProductId && (
                <button
                  type="button"
                  onClick={handleCancelProductEdit}
                  className="rounded-full border border-white/30 px-6 py-3 text-xs font-semibold uppercase tracking-[0.35em] text-white transition hover:border-white/60 hover:text-white"
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>

          <div className="flex flex-col gap-4">
            {prodigiProducts.length === 0 ? (
              <p className="text-sm text-white/50">
                Aún no has creado productos. Completa el formulario para dar de alta tus opciones de impresión.
              </p>
            ) : (
              prodigiProducts.map((product) => (
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
                  <div className="flex flex-wrap items-center gap-3 text-xs text-white/60">
                    {product.retailPrice !== undefined && product.retailPrice !== null && (
                      <span>
                        Precio: {Number(product.retailPrice).toFixed(2)} {product.currency || "EUR"}
                      </span>
                    )}
                    <span>Modo: {product.sizing}</span>
                  </div>
                  {product.mockupImages?.length ? (
                    <div className="flex gap-2 overflow-x-auto">
                      {product.mockupImages.map((imagePath) => (
                        <img
                          key={imagePath}
                          src={`${backendBase}${imagePath}`}
                          alt={`Mockup ${product.name}`}
                          className="h-16 w-24 flex-none rounded-lg border border-white/10 object-cover"
                        />
                      ))}
                    </div>
                  ) : null}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleEditProduct(product)}
                      className="rounded-full border border-white/30 px-4 py-2 text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-white transition hover:border-white/60 hover:text-white"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteProduct(product._id)}
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
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-semibold uppercase tracking-[0.3em] text-white">
            Biblioteca
          </h2>
          <span className="text-xs uppercase tracking-[0.3em] text-white/40">
            {sortedPhotos.length} elementos
          </span>
        </div>

        {sortedPhotos.length === 0 ? (
          <p className="text-sm text-white/50">
            Aún no has añadido fotografías. Cuando subas una imagen aparecerá aquí con sus metadatos.
          </p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {sortedPhotos.map((photo) => (
              <article
                key={photo._id}
                className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/40 shadow-lg"
              >
                <div className="relative h-56 w-full overflow-hidden">
                  <img
                    src={`${import.meta.env.VITE_URL_BACKEND}${photo.imagePath}`}
                    alt={photo.title}
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute left-4 top-4 rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.3em] text-white/80 backdrop-blur">
                    {photo.price ? `${Number(photo.price).toFixed(2)} €` : "Sin precio"}
                  </span>
                </div>
                <div className="flex flex-col gap-3 p-5 text-sm text-white/80">
                  <header>
                    <h3 className="text-lg font-semibold uppercase tracking-[0.2em] text-white">
                      {photo.title}
                    </h3>
                    <p className="mt-2 text-xs uppercase tracking-[0.3em] text-white/40">
                      {photo.createdAt ? new Date(photo.createdAt).toLocaleDateString() : ""}
                    </p>
                  </header>
                  {photo.description && (
                    <p className="text-sm text-white/70">{photo.description}</p>
                  )}
                  <dl className="grid grid-cols-1 gap-2 text-xs text-white/50 sm:grid-cols-2">
                    {photo.metadata?.camera && (
                      <div>
                        <dt className="uppercase tracking-[0.3em]">Cámara</dt>
                        <dd className="mt-1 text-white/70">{photo.metadata.camera}</dd>
                      </div>
                    )}
                    {photo.metadata?.location && (
                      <div>
                        <dt className="uppercase tracking-[0.3em]">Ubicación</dt>
                        <dd className="mt-1 text-white/70">{photo.metadata.location}</dd>
                      </div>
                    )}
                    {photo.metadata?.shotAt && (
                      <div>
                        <dt className="uppercase tracking-[0.3em]">Capturada</dt>
                        <dd className="mt-1 text-white/70">
                          {new Date(photo.metadata.shotAt).toLocaleDateString()}
                        </dd>
                      </div>
                    )}
                  </dl>
                  {photo.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {photo.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-white/10 px-3 py-1 text-[0.65rem] uppercase tracking-[0.3em] text-white/60"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-4 border-t border-white/10 pt-4">
                    <h4 className="text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
                      Productos asociados
                    </h4>
                    {prodigiProducts.length === 0 ? (
                      <p className="mt-2 text-xs text-white/40">
                        Crea productos en la sección superior para asignarlos a esta fotografía.
                      </p>
                    ) : (
                      <div className="mt-2 flex flex-col gap-2">
                        {prodigiProducts.map((product) => {
                          const productId = String(product._id);
                          const isChecked = Array.isArray(photo.prodigiProducts)
                            ? photo.prodigiProducts.includes(productId)
                            : false;
                          return (
                            <label
                              key={product._id}
                              className="flex items-center gap-3 text-xs text-white/70"
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(event) =>
                                  handlePhotoProductToggle(
                                    photo._id,
                                    productId,
                                    event.target.checked
                                  )
                                }
                                className="h-4 w-4 rounded border-white/40 bg-transparent text-white accent-white"
                              />
                              <span className="flex-1">
                                {product.name}
                                <span className="ml-2 text-white/30">{product.sku}</span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default ContentManagement;
