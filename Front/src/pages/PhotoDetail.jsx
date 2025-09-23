import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "@/utils/axiosInstance";

const DetailSkeleton = () => (
  <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pb-24 pt-24 text-white">
    <div className="h-[60vh] w-full animate-pulse rounded-3xl bg-white/10" />
    <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
      <div className="space-y-4">
        <div className="h-10 w-2/3 animate-pulse rounded-full bg-white/10" />
        <div className="h-3 w-full animate-pulse rounded-full bg-white/10" />
        <div className="h-3 w-4/5 animate-pulse rounded-full bg-white/10" />
      </div>
      <div className="h-48 animate-pulse rounded-3xl bg-white/10" />
    </div>
  </div>
);

const formatCurrency = (amount, currencyCode = "EUR") => {
  const numericAmount = Number(amount);
  if (Number.isNaN(numericAmount)) {
    return amount ?? "";
  }

  try {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: currencyCode || "EUR",
      minimumFractionDigits: 2,
    }).format(numericAmount);
  } catch (error) {
    return `${numericAmount.toFixed(2)} ${currencyCode || ""}`.trim();
  }
};

const getColorPreviewStyle = (code) => {
  if (!code) return {};
  const candidate = code.startsWith("#") ? code : `#${code}`;
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(candidate)) {
    return { backgroundColor: candidate };
  }
  return { backgroundColor: code };
};

const PhotoDetail = () => {
  const { photoId } = useParams();
  const navigate = useNavigate();

  const [photo, setPhoto] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [variants, setVariants] = useState([]);
  const [variantsLoading, setVariantsLoading] = useState(false);
  const [variantsError, setVariantsError] = useState(null);

  const [orderState, setOrderState] = useState({
    variantId: "",
    colorCode: "",
    copies: 1,
    recipient: {
      name: "",
      email: "",
      phoneNumber: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      stateOrCounty: "",
      postalCode: "",
      countryCode: "ES",
    },
  });

  const [orderFeedback, setOrderFeedback] = useState({
    submitting: false,
    success: null,
    error: null,
  });

  const [quoteState, setQuoteState] = useState({
    loading: false,
    quote: null,
    error: null,
  });

  const imageBase = import.meta.env.VITE_URL_BACKEND;

  useEffect(() => {
    const fetchPhoto = async () => {
      try {
        setLoading(true);
        const { data } = await api.get(`/photos/public/${photoId}`);
        setPhoto(data);
      } catch (err) {
        console.error("Error fetching photo", err);
        setError("No encontramos esta fotografía.");
      } finally {
        setLoading(false);
      }
    };

    fetchPhoto();
  }, [photoId]);

  useEffect(() => {
    const fetchVariants = async () => {
      if (!photoId) return;
      try {
        setVariantsLoading(true);
        const { data } = await api.get("/prodigi/products", {
          params: { photoId },
        });
        const payload = Array.isArray(data) ? data : [];
        setVariants(payload);
        setVariantsError(null);

        if (payload.length > 0) {
          setOrderState((prev) => {
            const currentVariantId = String(prev.variantId || "");
            const exists = payload.some((item) => item.id === currentVariantId);
            const nextVariantId = exists ? currentVariantId : payload[0].id;
            return {
              ...prev,
              variantId: nextVariantId,
            };
          });
        } else {
          setOrderState((prev) => ({ ...prev, variantId: "", colorCode: "" }));
        }
      } catch (err) {
        console.error("Error fetching Prodigi variants", err);
        const message =
          err.response?.data?.error ||
          "No pudimos cargar las opciones de impresión en este momento.";
        setVariantsError(message);
        setVariants([]);
      } finally {
        setVariantsLoading(false);
      }
    };

    fetchVariants();
  }, [photoId]);

  const selectedVariant = useMemo(() => {
    if (!orderState.variantId) return null;
    return (
      variants.find((variant) => variant.id === orderState.variantId) || null
    );
  }, [variants, orderState.variantId]);

  useEffect(() => {
    if (!selectedVariant) {
      if (orderState.colorCode) {
        setOrderState((prev) => ({ ...prev, colorCode: "" }));
      }
      return;
    }

    const colors = Array.isArray(selectedVariant.colorOptions)
      ? selectedVariant.colorOptions
      : [];

    if (colors.length === 0) {
      if (orderState.colorCode) {
        setOrderState((prev) => ({ ...prev, colorCode: "" }));
      }
      return;
    }

    const normalizedFirstCode = colors[0].code
      ? String(colors[0].code).toUpperCase()
      : "";
    const exists = colors.some((color) => color.code === orderState.colorCode);
    if (!exists) {
      setOrderState((prev) => ({ ...prev, colorCode: normalizedFirstCode }));
    }
  }, [selectedVariant, orderState.colorCode]);

  const selectedColorData = useMemo(() => {
    if (!selectedVariant || !orderState.colorCode) return null;
    return (
      selectedVariant.colorOptions?.find(
        (option) => option.code === orderState.colorCode
      ) || null
    );
  }, [selectedVariant, orderState.colorCode]);

  const displayedMockups = useMemo(() => {
    if (!selectedVariant) return [];

    if (selectedColorData?.mockupImages?.length) {
      return selectedColorData.mockupImages;
    }

    return selectedVariant.mockupImages || [];
  }, [selectedVariant, selectedColorData]);

  const handleSelectVariant = (variantId) => {
    setOrderState((prev) => ({ ...prev, variantId, colorCode: "" }));
    setOrderFeedback({ submitting: false, success: null, error: null });
  };

  const handleSelectColor = (colorCode) => {
    const normalized = colorCode ? String(colorCode).toUpperCase() : "";
    setOrderState((prev) => ({ ...prev, colorCode: normalized }));
    setOrderFeedback({ submitting: false, success: null, error: null });
  };

  const handleOrderFieldChange = (field, value) => {
    setOrderState((prev) => {
      if (field === "copies") {
        const parsedValue = Number(value);
        const sanitized = Number.isNaN(parsedValue)
          ? 1
          : Math.min(Math.max(parsedValue, 1), 10);
        return { ...prev, copies: sanitized };
      }

      return { ...prev, [field]: value };
    });
  };

  const handleRecipientChange = (field, value) => {
    setOrderState((prev) => ({
      ...prev,
      recipient: {
        ...prev.recipient,
        [field]:
          field === "countryCode"
            ? value.toUpperCase().slice(0, 2)
            : value,
      },
    }));
  };

  const handleOrderSubmit = async (event) => {
    event.preventDefault();

    if (!photo?._id || !orderState.variantId) {
      return;
    }

    setOrderFeedback({ submitting: true, success: null, error: null });

    try {
      const colorCodePayload = selectedVariant?.colorOptions?.length
        ? orderState.colorCode || selectedVariant.colorOptions[0]?.code
        : undefined;

      const { data } = await api.post("/prodigi/orders", {
        photoId: photo._id,
        variantId: orderState.variantId,
        colorCode: colorCodePayload,
        copies: orderState.copies,
        recipient: orderState.recipient,
      });

      setOrderFeedback({
        submitting: false,
        success: data?.order?.id
          ? `Pedido creado correctamente. ID: ${data.order.id}`
          : "Pedido creado correctamente.",
        error: null,
      });
    } catch (err) {
      console.error("Error creating Prodigi order", err);
      const message =
        err.response?.data?.error ||
        "No pudimos procesar tu pedido. Inténtalo nuevamente.";
      setOrderFeedback({ submitting: false, success: null, error: message });
    }
  };

  useEffect(() => {
    if (!photo?._id || !orderState.variantId) {
      setQuoteState({ loading: false, quote: null, error: null });
      return;
    }

    const controller = new AbortController();

    const fetchQuote = async () => {
      setQuoteState({ loading: true, quote: null, error: null });
      try {
        const colorCodePayload = selectedVariant?.colorOptions?.length
          ? orderState.colorCode || selectedVariant.colorOptions[0]?.code
          : undefined;

        const { data } = await api.post(
          "/prodigi/quotes",
          {
            photoId: photo._id,
            variantId: orderState.variantId,
            colorCode: colorCodePayload,
            copies: orderState.copies,
            destinationCountryCode:
              orderState.recipient.countryCode || "ES",
          },
          { signal: controller.signal }
        );

        const quotesArray = Array.isArray(data?.quotes) ? data.quotes : [];
        const selectedQuote = quotesArray[0] || null;

        setQuoteState({ loading: false, quote: selectedQuote, error: null });
      } catch (err) {
        if (controller.signal.aborted || err.code === "ERR_CANCELED") {
          return;
        }

        const message =
          err.response?.data?.error ||
          "No pudimos calcular la cotización en este momento.";
        setQuoteState({ loading: false, quote: null, error: message });
      }
    };

    fetchQuote();

    return () => controller.abort();
  }, [
    photo?._id,
    orderState.variantId,
    selectedVariant,
    orderState.colorCode,
    orderState.copies,
    orderState.recipient.countryCode,
  ]);

  if (loading) return <DetailSkeleton />;

  if (error || !photo) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4 px-4 pb-24 pt-24 text-center text-white">
        <p className="text-lg uppercase tracking-[0.3em]">{error || "No encontramos esta fotografía"}</p>
        <button
          onClick={() => navigate(-1)}
          className="rounded-full border border-white/30 px-6 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-white transition hover:border-white/60"
        >
          Volver
        </button>
      </div>
    );
  }

  const {
    title,
    description,
    price,
    tags = [],
    metadata = {},
    createdAt,
  } = photo;

  const quoteCostItems = quoteState.quote?.costSummary?.items;
  const quoteCostShipping = quoteState.quote?.costSummary?.shipping;
  const parsedItemsAmount = Number(quoteCostItems?.amount ?? 0);
  const parsedShippingAmount = Number(quoteCostShipping?.amount ?? 0);
  const validItemsAmount = Number.isFinite(parsedItemsAmount)
    ? parsedItemsAmount
    : 0;
  const validShippingAmount = Number.isFinite(parsedShippingAmount)
    ? parsedShippingAmount
    : 0;
  const quoteTotalAmount = validItemsAmount + validShippingAmount;
  const quoteCurrency =
    quoteCostItems?.currency || quoteCostShipping?.currency || "EUR";

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 pb-24 pt-24 text-white">
      <button
        onClick={() => navigate(-1)}
        className="self-start rounded-full border border-white/20 px-4 py-2 text-xs uppercase tracking-[0.3em] text-white/70 transition hover:border-white/40 hover:text-white"
      >
        ← Volver
      </button>

      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/40 shadow-2xl">
        <img
          src={`${imageBase}${photo.imagePath}`}
          alt={title}
          className="h-full w-full max-h-[70vh] object-contain"
        />
      </div>

      <section className="grid gap-8 md:grid-cols-[2fr_1fr]">
        <article className="flex flex-col gap-4">
          <header className="space-y-2">
            <h1 className="text-3xl font-semibold uppercase tracking-[0.3em] md:text-4xl">
              {title}
            </h1>
            {createdAt && (
              <p className="text-xs uppercase tracking-[0.3em] text-white/40">
                Publicada el {new Date(createdAt).toLocaleDateString()}
              </p>
            )}
          </header>
          {description && <p className="text-sm text-white/70">{description}</p>}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-white/10 px-3 py-1 text-[0.6rem] uppercase tracking-[0.3em] text-white/60"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </article>

        <aside className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-white/60">Precio referencia</p>
            <p className="mt-2 text-2xl font-semibold">
              {price ? `${Number(price).toFixed(2)} €` : "Consultar"}
            </p>
          </div>

          <dl className="space-y-3 text-xs text-white/60">
            {metadata.camera && (
              <div>
                <dt className="uppercase tracking-[0.3em]">Cámara</dt>
                <dd className="mt-1 text-white/80">{metadata.camera}</dd>
              </div>
            )}
            {metadata.location && (
              <div>
                <dt className="uppercase tracking-[0.3em]">Ubicación</dt>
                <dd className="mt-1 text-white/80">{metadata.location}</dd>
              </div>
            )}
            {metadata.shotAt && (
              <div>
                <dt className="uppercase tracking-[0.3em]">Capturada</dt>
                <dd className="mt-1 text-white/80">
                  {new Date(metadata.shotAt).toLocaleDateString()}
                </dd>
              </div>
            )}
          </dl>

          <div className="h-px w-full bg-white/10" />

          <section className="flex flex-col gap-3 text-xs text-white/70">
            <h2 className="text-[0.65rem] uppercase tracking-[0.3em] text-white/60">
              Compra una impresión
            </h2>

            {variantsLoading ? (
              <p className="text-white/60">Cargando opciones de impresión...</p>
            ) : variantsError ? (
              <p className="text-red-300">{variantsError}</p>
            ) : variants.length === 0 ? (
              <p className="text-white/60">
                Pronto habilitaremos la compra de impresiones para esta foto.
              </p>
            ) : (
              <form onSubmit={handleOrderSubmit} className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[0.6rem] uppercase tracking-[0.3em] text-white/50">
                    Producto
                  </label>
                  <select
                    className="w-full rounded-xl border border-white/20 bg-black/30 px-3 py-2 text-xs text-white focus:border-white/40 focus:outline-none"
                    value={orderState.variantId}
                    onChange={(event) => handleSelectVariant(event.target.value)}
                  >
                    {variants.map((variant) => (
                      <option key={variant.id} value={variant.id}>
                        {variant.displayName || variant.catalogProduct?.name}
                      </option>
                    ))}
                  </select>
                  {selectedVariant?.description && (
                    <p className="text-[0.6rem] text-white/50">
                      {selectedVariant.description}
                    </p>
                  )}
                  {selectedVariant?.retailPrice !== undefined && (
                    <p className="text-[0.6rem] text-white/50">
                      Precio sugerido:
                      <span className="ml-1 text-white">
                        {formatCurrency(
                          selectedVariant.retailPrice,
                          selectedVariant.currency
                        )}
                      </span>
                    </p>
                  )}
                </div>

                {selectedVariant?.colorOptions?.length ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-[0.6rem] uppercase tracking-[0.3em] text-white/50">
                      Colores disponibles
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {selectedVariant.colorOptions.map((color) => {
                        const isSelected = color.code === orderState.colorCode;
                        return (
                          <button
                            type="button"
                            key={color.code}
                            onClick={() => handleSelectColor(color.code)}
                            className={`flex items-center gap-2 rounded-full border px-4 py-2 text-[0.6rem] uppercase tracking-[0.3em] transition ${
                              isSelected
                                ? "border-white bg-white/20 text-white"
                                : "border-white/30 text-white/70 hover:border-white/50 hover:text-white"
                            }`}
                            aria-pressed={isSelected}
                          >
                            <span
                              className="h-3 w-3 rounded-full border border-white/30"
                              style={getColorPreviewStyle(color.code)}
                            />
                            <span>{color.name || color.code}</span>
                          </button>
                        );
                      })}
                    </div>
                    {selectedColorData?.assetUrl && (
                      <p className="text-[0.6rem] text-white/40">
                        Esta combinación usa un asset específico para {selectedColorData.name || selectedColorData.code}.
                      </p>
                    )}
                  </div>
                ) : null}

                {displayedMockups.length > 0 ? (
                  <div className="flex gap-2 overflow-x-auto">
                    {displayedMockups.map((image) => (
                      <img
                        key={image.id}
                        src={`${image.url.startsWith("http") ? "" : imageBase}${image.url}`}
                        alt={selectedVariant?.displayName || "Mockup"}
                        className="h-16 w-24 flex-none rounded-lg border border-white/10 object-cover"
                        loading="lazy"
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-[0.6rem] text-white/40">
                    Aún no hay mockups para esta selección.
                  </p>
                )}

                {quoteState.loading ? (
                  <p className="text-[0.6rem] text-white/50">Calculando precio...</p>
                ) : quoteState.error ? (
                  <p className="text-[0.6rem] text-red-300">{quoteState.error}</p>
                ) : quoteState.quote ? (
                  <div className="text-[0.6rem] text-white/60">
                    <p>
                      Total estimado:
                      <span className="ml-1 text-white">
                        {formatCurrency(quoteTotalAmount, quoteCurrency)}
                      </span>
                    </p>
                    <p className="text-white/40">
                      Productos: {formatCurrency(quoteCostItems?.amount, quoteCostItems?.currency)} · Envío:{" "}
                      {formatCurrency(
                        quoteCostShipping?.amount,
                        quoteCostShipping?.currency
                      )}
                    </p>
                  </div>
                ) : null}

                <div className="flex flex-col gap-1">
                  <label className="text-[0.6rem] uppercase tracking-[0.3em] text-white/50">
                    Copias
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={orderState.copies}
                    onChange={(event) =>
                      handleOrderFieldChange("copies", event.target.value)
                    }
                    className="w-full rounded-xl border border-white/20 bg-black/30 px-3 py-2 text-xs text-white focus:border-white/40 focus:outline-none"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[0.6rem] uppercase tracking-[0.3em] text-white/50">
                      Nombre completo
                    </label>
                    <input
                      type="text"
                      required
                      value={orderState.recipient.name}
                      onChange={(event) =>
                        handleRecipientChange("name", event.target.value)
                      }
                      className="w-full rounded-xl border border-white/20 bg-black/30 px-3 py-2 text-xs text-white focus:border-white/40 focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[0.6rem] uppercase tracking-[0.3em] text-white/50">
                      Email
                    </label>
                    <input
                      type="email"
                      required
                      value={orderState.recipient.email}
                      onChange={(event) =>
                        handleRecipientChange("email", event.target.value)
                      }
                      className="w-full rounded-xl border border-white/20 bg-black/30 px-3 py-2 text-xs text-white focus:border-white/40 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[0.6rem] uppercase tracking-[0.3em] text-white/50">
                    Teléfono (opcional)
                  </label>
                  <input
                    type="tel"
                    value={orderState.recipient.phoneNumber}
                    onChange={(event) =>
                        handleRecipientChange("phoneNumber", event.target.value)
                      }
                    className="w-full rounded-xl border border-white/20 bg-black/30 px-3 py-2 text-xs text-white focus:border-white/40 focus:outline-none"
                    placeholder="Incluye prefijo internacional si es necesario"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[0.6rem] uppercase tracking-[0.3em] text-white/50">
                    Dirección
                  </label>
                  <input
                    type="text"
                    required
                    value={orderState.recipient.addressLine1}
                    onChange={(event) =>
                        handleRecipientChange("addressLine1", event.target.value)
                      }
                    className="w-full rounded-xl border border-white/20 bg-black/30 px-3 py-2 text-xs text-white focus:border-white/40 focus:outline-none"
                    placeholder="Calle y número"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[0.6rem] uppercase tracking-[0.3em] text-white/50">
                    Complemento dirección
                  </label>
                  <input
                    type="text"
                    value={orderState.recipient.addressLine2}
                    onChange={(event) =>
                        handleRecipientChange("addressLine2", event.target.value)
                      }
                    className="w-full rounded-xl border border-white/20 bg-black/30 px-3 py-2 text-xs text-white focus:border-white/40 focus:outline-none"
                    placeholder="Apartamento, piso, etc."
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[0.6rem] uppercase tracking-[0.3em] text-white/50">
                      Ciudad
                    </label>
                    <input
                      type="text"
                      required
                      value={orderState.recipient.city}
                      onChange={(event) =>
                        handleRecipientChange("city", event.target.value)
                      }
                      className="w-full rounded-xl border border-white/20 bg-black/30 px-3 py-2 text-xs text-white focus:border-white/40 focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[0.6rem] uppercase tracking-[0.3em] text-white/50">
                      Provincia / Estado
                    </label>
                    <input
                      type="text"
                      value={orderState.recipient.stateOrCounty}
                      onChange={(event) =>
                        handleRecipientChange("stateOrCounty", event.target.value)
                      }
                      className="w-full rounded-xl border border-white/20 bg-black/30 px-3 py-2 text-xs text-white focus:border-white/40 focus:outline-none"
                      placeholder="Opcional"
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
                  <div className="flex flex-col gap-1">
                    <label className="text-[0.6rem] uppercase tracking-[0.3em] text-white/50">
                      Código postal
                    </label>
                    <input
                      type="text"
                      required
                      value={orderState.recipient.postalCode}
                      onChange={(event) =>
                        handleRecipientChange("postalCode", event.target.value)
                      }
                      className="w-full rounded-xl border border-white/20 bg-black/30 px-3 py-2 text-xs text-white focus:border-white/40 focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[0.6rem] uppercase tracking-[0.3em] text-white/50">
                      País
                    </label>
                    <input
                      type="text"
                      required
                      value={orderState.recipient.countryCode}
                      onChange={(event) =>
                        handleRecipientChange("countryCode", event.target.value)
                      }
                      className="w-full rounded-xl border border-white/20 bg-black/30 px-3 py-2 text-xs text-white focus:border-white/40 focus:outline-none"
                      maxLength={2}
                      placeholder="ES"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={orderFeedback.submitting}
                  className="mt-1 rounded-full border border-white/30 px-4 py-3 text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-white transition hover:border-white/60 disabled:cursor-not-allowed disabled:border-white/10 disabled:text-white/40"
                >
                  {orderFeedback.submitting
                    ? "Creando pedido..."
                    : "Comprar impresión"}
                </button>

                {orderFeedback.success && (
                  <p className="rounded-xl border border-emerald-400/40 bg-emerald-400/10 px-3 py-2 text-[0.65rem] text-emerald-200">
                    {orderFeedback.success}
                  </p>
                )}
                {orderFeedback.error && (
                  <p className="rounded-xl border border-red-400/40 bg-red-400/10 px-3 py-2 text-[0.65rem] text-red-200">
                    {orderFeedback.error}
                  </p>
                )}
              </form>
            )}
          </section>
        </aside>
      </section>
    </div>
  );
};

export default PhotoDetail;
