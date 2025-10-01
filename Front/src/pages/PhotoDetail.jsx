import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "@/utils/axiosInstance";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";

/* Componente skeleton que se muestra mientras carga la página */
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

/* Función auxiliar para formatear cantidades monetarias según la localización */
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
  } catch {
    return `${numericAmount.toFixed(2)} ${currencyCode || ""}`.trim();
  }
};

/* Función auxiliar para parsear valores monetarios de forma segura */
const parseAmount = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

/* Campos obligatorios del destinatario que deben completarse antes del pago */
const REQUIRED_RECIPIENT_FIELDS = [
  { key: "name", label: "Nombre completo" },
  { key: "email", label: "Email" },
  { key: "addressLine1", label: "Dirección" },
  { key: "city", label: "Ciudad" },
  { key: "postalCode", label: "Código postal" },
  { key: "countryCode", label: "País" },
];

/* Estado inicial del payment intent de Stripe */
const getInitialPaymentState = () => ({
  loading: false,
  clientSecret: null,
  amount: null,
  currency: "EUR",
  pricing: null,
  error: null,
});

/* Función auxiliar para generar estilos CSS del preview de color */
const getColorPreviewStyle = (code) => {
  if (!code) return {};
  const candidate = code.startsWith("#") ? code : `#${code}`;
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(candidate)) {
    return { backgroundColor: candidate };
  }
  return { backgroundColor: code };
};

/* Componente del formulario de pago con Stripe Elements */
// eslint-disable-next-line react/prop-types
const CheckoutPaymentForm = ({
  amount,
  currency,
  onSuccess,
  onError,
  onProcessingChange,
  submitLabel,
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);

  /* Handler para confirmar el pago a través de Stripe */
  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      if (!stripe || !elements) {
        return;
      }

      try {
        setProcessing(true);
        onProcessingChange?.(true);

        /* API Stripe - Confirmar el pago con la información de la tarjeta ingresada */
        const result = await stripe.confirmPayment({
          elements,
          redirect: "if_required",
        });

        if (result.error) {
          console.error("Stripe payment confirmation failed", result.error);
          onError?.(result.error.message || "No pudimos confirmar el pago.");
        } else {
          onSuccess?.(result.paymentIntent);
        }
      } catch (error) {
        console.error("Stripe payment confirmation threw", error);
        onError?.(error.message || "No pudimos confirmar el pago.");
      } finally {
        setProcessing(false);
        onProcessingChange?.(false);
      }
    },
    [stripe, elements, onError, onProcessingChange, onSuccess]
  );

  const buttonLabel = submitLabel ||
    (processing
      ? "Procesando pago..."
      : `Pagar ${formatCurrency(amount, currency)}`);

  return (
    <div className="flex flex-col gap-4">
      <PaymentElement options={{ layout: "tabs" }} />
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!stripe || processing}
        className="rounded-full bg-white px-6 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {buttonLabel}
      </button>
    </div>
  );
};

/* 
 * Componente principal: PhotoDetail
 * Página de detalle de una fotografía que permite:
 * 1. Ver información de la foto (imagen, metadatos, precio)
 * 2. Seleccionar variantes de productos para impresión (tamaños, colores)
 * 3. Obtener cotizaciones en tiempo real desde Prodigi
 * 4. Realizar el pedido y pago a través de Stripe
 */
const PhotoDetail = () => {
  const { photoId } = useParams();
  const navigate = useNavigate();

  /* Estado para la información de la fotografía */
  const [photo, setPhoto] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /* Estado para las variantes de productos disponibles en Prodigi */
  const [variants, setVariants] = useState([]);
  const [variantsLoading, setVariantsLoading] = useState(false);
  const [variantsError, setVariantsError] = useState(null);

  /* Estado del pedido: producto seleccionado, cantidad, destinatario, etc. */
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

  /* Estado de feedback del proceso de pedido */
  const [orderFeedback, setOrderFeedback] = useState({
    submitting: false,
    success: null,
    error: null,
  });

  /* Estado de la cotización actual de Prodigi */
  const [quoteState, setQuoteState] = useState({
    loading: false,
    quote: null,
    pricing: null,
    error: null,
  });
  const [lastQuoteContext, setLastQuoteContext] = useState(null);

  /* Estado para la integración con Stripe (pasarela de pago) */
  const [stripePromise, setStripePromise] = useState(null);
  const [stripeConfigError, setStripeConfigError] = useState(null);
  const [paymentIntentState, setPaymentIntentState] = useState(() =>
    getInitialPaymentState()
  );
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(null);

  /* Callback para resetear el flujo de pago y volver al estado inicial */
  const resetPaymentFlow = useCallback(() => {
    setPaymentIntentState(getInitialPaymentState());
    setPaymentProcessing(false);
    setPaymentSuccess(null);
  }, []);

  /* Callback cuando el pago se confirma exitosamente en Stripe */
  const handlePaymentSuccess = useCallback((paymentIntent) => {
    setPaymentProcessing(false);
    setPaymentSuccess(paymentIntent?.id || null);
    setPaymentIntentState((prev) => ({
      ...prev,
      error: null,
    }));
    setOrderFeedback({
      submitting: false,
      success:
        "Pago confirmado correctamente. Estamos procesando tu pedido en Prodigi.",
      error: null,
    });
  }, []);

  /* Callback cuando ocurre un error en el proceso de pago */
  const handlePaymentError = useCallback((message) => {
    const fallback =
      message ||
      "No pudimos confirmar el pago con la tarjeta. Revisa los datos e inténtalo otra vez.";
    setPaymentProcessing(false);
    setPaymentIntentState((prev) => ({
      ...prev,
      error: fallback,
    }));
    setOrderFeedback({ submitting: false, success: null, error: fallback });
  }, []);

  /* Callback para actualizar el estado de procesamiento del pago */
  const handleProcessingChange = useCallback((status) => {
    setPaymentProcessing(Boolean(status));
  }, []);

  /* Caché local para almacenar detalles de productos ya consultados (evita peticiones repetidas) */
  const [productDetailsCache, setProductDetailsCache] = useState({});

  const imageBase = import.meta.env.VITE_URL_BACKEND;

  /* Efecto para cargar los datos iniciales de la fotografía */
  useEffect(() => {
    const fetchPhoto = async () => {
      try {
        setLoading(true);
        /* API - Obtener información pública de la fotografía por su ID */
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

  /* Efecto para inicializar la configuración de Stripe (pasarela de pago) */
  useEffect(() => {
    let cancelled = false;

    const fetchStripeConfig = async () => {
      try {
        /* API - Obtener la clave pública de Stripe para inicializar el cliente de pagos */
        const { data } = await api.get("/payments/config");
        const publishableKey = data?.publishableKey;
        if (!publishableKey) {
          throw new Error("No publishable key returned");
        }
        if (!cancelled) {
          setStripePromise(loadStripe(publishableKey));
          setStripeConfigError(null);
        }
      } catch (err) {
        console.error("Error fetching Stripe config", err);
        if (!cancelled) {
          setStripeConfigError(
            "No se pudo inicializar el pago seguro. Inténtalo más tarde."
          );
        }
      }
    };

    fetchStripeConfig();

    return () => {
      cancelled = true;
    };
  }, []);

  /* Efecto para resetear el flujo de pago cuando cambian los datos del pedido */
  useEffect(() => {
    if (
      !paymentIntentState.clientSecret &&
      !paymentIntentState.loading &&
      !paymentSuccess
    ) {
      return;
    }

    /* Si ya existe un intento de pago y el usuario modifica el pedido, reiniciamos el flujo */
    console.log("🔄 [DEBUG] Resetting payment flow due to order change");
    resetPaymentFlow();
    setOrderFeedback({ submitting: false, success: null, error: null });
  }, [
    orderState.variantId,
    orderState.copies,
    orderState.colorCode,
    orderState.recipient.countryCode,
    // NO incluimos paymentIntentState.clientSecret, paymentIntentState.loading ni paymentSuccess
    // porque queremos que el efecto SOLO se dispare cuando el usuario cambia los datos del pedido,
    // no cuando se crea o actualiza el payment intent
    resetPaymentFlow,
  ]);

  /* Efecto para cargar las variantes de productos disponibles para esta fotografía desde Prodigi */
  useEffect(() => {
    const fetchVariants = async () => {
      if (!photoId) return;
      try {
        setVariantsLoading(true);
        /* API - Obtener lista de productos/variantes de Prodigi vinculados a esta fotografía */
        const { data } = await api.get("/prodigi/products", {
          params: { photoId },
        });
        const payload = Array.isArray(data) ? data : [];
        setVariants(payload);
        setVariantsError(null);

        /* Si hay variantes disponibles, seleccionamos la primera por defecto o mantenemos la actual si existe */
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

  /* Memo para obtener la variante de producto seleccionada actualmente */
  const selectedVariant = useMemo(() => {
    if (!orderState.variantId) return null;
    return (
      variants.find((variant) => variant.id === orderState.variantId) || null
    );
  }, [variants, orderState.variantId]);

  /* Efecto para gestionar la selección automática de colores cuando cambia la variante */
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

    /* Si la variante no tiene opciones de color, limpiamos el código de color */
    if (colors.length === 0) {
      if (orderState.colorCode) {
        setOrderState((prev) => ({ ...prev, colorCode: "" }));
      }
      return;
    }

    /* Si el color actual no existe en las opciones de esta variante, seleccionamos el primero */
    const normalizedFirstCode = colors[0].code
      ? String(colors[0].code).toUpperCase()
      : "";
    const exists = colors.some((color) => color.code === orderState.colorCode);
    if (!exists) {
      setOrderState((prev) => ({ ...prev, colorCode: normalizedFirstCode }));
    }
  }, [selectedVariant, orderState.colorCode]);

  /* Memo para obtener los datos del color seleccionado actualmente */
  const selectedColorData = useMemo(() => {
    if (!selectedVariant || !orderState.colorCode) return null;
    return (
      selectedVariant.colorOptions?.find(
        (option) => option.code === orderState.colorCode
      ) || null
    );
  }, [selectedVariant, orderState.colorCode]);

  /* Memo para determinar qué imágenes mockup mostrar según la variante y color seleccionados */
  const displayedMockups = useMemo(() => {
    if (!selectedVariant) return [];

    /* Si el color tiene mockups específicos, los usamos; si no, usamos los de la variante */
    if (selectedColorData?.mockupImages?.length) {
      return selectedColorData.mockupImages;
    }

    return selectedVariant.mockupImages || [];
  }, [selectedVariant, selectedColorData]);

  /* Extraemos el SKU de la variante seleccionada para obtener detalles del catálogo */
  const selectedVariantSku = selectedVariant?.catalogProduct?.sku || null;
  const selectedProductDetailsEntry = selectedVariantSku
    ? productDetailsCache[selectedVariantSku]
    : null;
  const photoIdValue = photo?._id;

  /* Efecto para obtener detalles completos del producto desde el catálogo de Prodigi */
  useEffect(() => {
    if (!selectedVariantSku) return;

    const cachedEntry = selectedProductDetailsEntry;

    /* Si ya tenemos los detalles en caché, no volvemos a pedirlos */
    if (cachedEntry?.status === "loading" || cachedEntry?.status === "loaded") {
      console.log("[Prodigi] product details already cached", {
        sku: selectedVariantSku,
        status: cachedEntry.status,
      });
      return;
    }

    let cancelled = false;

    console.log("[Prodigi] fetching product details", {
      sku: selectedVariantSku,
      cachedStatus: cachedEntry?.status,
    });

    setProductDetailsCache((prev) => ({
      ...prev,
      [selectedVariantSku]: {
        status: "loading",
        data: cachedEntry?.data || null,
        error: null,
      },
    }));

    const fetchProductDetails = async () => {
      try {
        /* API - Obtener detalles completos del producto (atributos, especificaciones) desde el catálogo de Prodigi */
        const { data } = await api.get(
          `/prodigi/catalog/details/${encodeURIComponent(selectedVariantSku)}`
        );
        if (cancelled) {
          console.log("[Prodigi] product details request cancelled", {
            sku: selectedVariantSku,
          });
          return;
        }
        console.log("[Prodigi] product details loaded", {
          sku: selectedVariantSku,
          variantAttributes: data?.variantAttributes,
        });
        setProductDetailsCache((prev) => ({
          ...prev,
          [selectedVariantSku]: {
            status: "loaded",
            data,
            error: null,
          },
        }));
      } catch (err) {
        if (cancelled) return;
        const message =
          err.response?.data?.error ||
          "No se pudieron obtener los detalles del producto para cotizar.";
        console.error("[Prodigi] product details failed", {
          sku: selectedVariantSku,
          error: message,
          details: err.response?.data,
        });
        setProductDetailsCache((prev) => ({
          ...prev,
          [selectedVariantSku]: {
            status: "error",
            data: null,
            error: message,
          },
        }));
      }
    };

    fetchProductDetails();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVariantSku]);

  /* Handler para cambiar la variante de producto seleccionada */
  const handleSelectVariant = (variantId) => {
    setOrderState((prev) => ({ ...prev, variantId, colorCode: "" }));
    setOrderFeedback({ submitting: false, success: null, error: null });
  };

  /* Handler para cambiar el color seleccionado */
  const handleSelectColor = (colorCode) => {
    const normalized = colorCode ? String(colorCode).toUpperCase() : "";
    setOrderState((prev) => ({ ...prev, colorCode: normalized }));
    setOrderFeedback({ submitting: false, success: null, error: null });
  };

  /* Handler para cambiar campos del pedido (ej: número de copias) */
  const handleOrderFieldChange = (field, value) => {
    setOrderState((prev) => {
      if (field === "copies") {
        const parsedValue = Number(value);
        /* Limitamos las copias entre 1 y 10 */
        const sanitized = Number.isNaN(parsedValue)
          ? 1
          : Math.min(Math.max(parsedValue, 1), 10);
        return { ...prev, copies: sanitized };
      }

      return { ...prev, [field]: value };
    });
  };

  /* Handler para cambiar datos del destinatario (nombre, dirección, etc.) */
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

  /* Debug: loguear el estado del botón de pago */
  useEffect(() => {
    const isButtonDisabled = orderFeedback.submitting || paymentIntentState.loading || !stripePromise;
    console.log("🔘 [DEBUG] Submit button state:", {
      disabled: isButtonDisabled,
      submitting: orderFeedback.submitting,
      loading: paymentIntentState.loading,
      hasStripePromise: !!stripePromise,
      hasClientSecret: !!paymentIntentState.clientSecret
    });
  }, [orderFeedback.submitting, paymentIntentState.loading, paymentIntentState.clientSecret, stripePromise]);

  /* Handler principal para el envío del formulario de pedido - crea el payment intent en Stripe */
  const handleOrderSubmit = async (event) => {
    event.preventDefault();
    console.log("🔥 [DEBUG] handleOrderSubmit triggered", { 
      hasClientSecret: !!paymentIntentState.clientSecret,
      photoIdValue, 
      variantId: orderState.variantId,
      recipient: orderState.recipient,
      lastQuoteContext
    });

    if (paymentIntentState.clientSecret) {
      // El formulario de Stripe se encarga del paso final.
      console.log("🔥 [DEBUG] ClientSecret already exists, skipping");
      return;
    }

    /* Validaciones: verificamos que haya producto seleccionado */
    if (!photoIdValue || !orderState.variantId || !selectedVariant) {
      console.log("❌ [DEBUG] Validation failed: Missing product");
      setOrderFeedback({
        submitting: false,
        success: null,
        error: "Selecciona un producto para continuar.",
      });
      return;
    }
    console.log("✅ [DEBUG] Product validation passed");

    /* Validación: verificamos que todos los campos obligatorios del destinatario estén completos */
    const missingFields = REQUIRED_RECIPIENT_FIELDS.filter(({ key }) => {
      const value = orderState.recipient[key];
      return !value || !String(value).trim();
    });

    if (missingFields.length) {
      console.log("❌ [DEBUG] Validation failed: Missing fields", missingFields);
      setOrderFeedback({
        submitting: false,
        success: null,
        error: `Completa los campos obligatorios: ${missingFields
          .map((field) => field.label)
          .join(", ")}.`,
      });
      return;
    }
    console.log("✅ [DEBUG] Recipient validation passed");

    /* Validación: verificamos que Stripe esté inicializado */
    if (!stripePromise) {
      console.log("❌ [DEBUG] Validation failed: Stripe not ready", stripeConfigError);
      setOrderFeedback({
        submitting: false,
        success: null,
        error:
          stripeConfigError ||
          "La pasarela de pago no está lista. Inténtalo de nuevo más tarde.",
      });
      return;
    }
    console.log("✅ [DEBUG] Stripe validation passed");

    /* Validación: verificamos que tengamos una cotización válida */
    if (!lastQuoteContext || lastQuoteContext.variantId !== orderState.variantId) {
      console.log("❌ [DEBUG] Validation failed: Quote mismatch", { 
        hasQuote: !!lastQuoteContext,
        quoteVariant: lastQuoteContext?.variantId,
        orderVariant: orderState.variantId
      });
      setOrderFeedback({
        submitting: false,
        success: null,
        error:
          "Estamos terminando de calcular el precio. Inténtalo nuevamente en unos segundos.",
      });
      return;
    }
    console.log("✅ [DEBUG] Quote context validation passed");

    const colorCodePayload = selectedVariant?.colorOptions?.length
      ? orderState.colorCode || selectedVariant.colorOptions[0]?.code
      : undefined;
    const normalizedColorCode = colorCodePayload
      ? String(colorCodePayload).toUpperCase()
      : undefined;
    const normalizedCountry = (orderState.recipient.countryCode || "ES").toUpperCase();

    /* Verificamos que la cotización actual coincida con los datos del pedido */
    const matchesQuote =
      lastQuoteContext &&
      lastQuoteContext.variantId === orderState.variantId &&
      lastQuoteContext.copies === orderState.copies &&
      (lastQuoteContext.colorCode || undefined) === normalizedColorCode &&
      lastQuoteContext.destinationCountryCode === normalizedCountry;

    if (!matchesQuote) {
      console.log("❌ [DEBUG] Validation failed: Quote doesn't match order", {
        lastQuoteContext,
        orderData: {
          variantId: orderState.variantId,
          copies: orderState.copies,
          colorCode: normalizedColorCode,
          country: normalizedCountry
        }
      });
      setOrderFeedback({
        submitting: false,
        success: null,
        error:
          "Estamos actualizando la cotización con los últimos datos. Inténtalo nuevamente en unos segundos.",
      });
      return;
    }
    console.log("✅ [DEBUG] Quote match validation passed");

    console.log("🚀 [DEBUG] All validations passed, creating PaymentIntent...");
    setOrderFeedback({ submitting: true, success: null, error: null });
    setPaymentIntentState((prev) => ({
      ...prev,
      loading: true,
      error: null,
    }));

    try {
      /* Preparamos el payload con toda la información del pedido */
      const payload = {
        photoId: photoIdValue,
        variantId: orderState.variantId,
        colorCode: normalizedColorCode,
        copies: orderState.copies,
        recipient: {
          ...orderState.recipient,
          countryCode: normalizedCountry,
        },
        shippingMethod: undefined,
        productAttributes: lastQuoteContext.productAttributes,
        assetUrl: selectedColorData?.assetUrl || selectedVariant.assetUrl || undefined,
      };

      /* API - Crear payment intent en Stripe para este pedido (reserva el monto pero no lo cobra aún) */
      console.log("📡 [DEBUG] Calling /payments/order/payment-intent with payload:", payload);
      const { data } = await api.post(
        "/payments/order/payment-intent",
        payload
      );
      console.log("✅ [DEBUG] PaymentIntent created successfully:", data);

      const pricing = data?.pricing || null;

      setPaymentIntentState({
        loading: false,
        clientSecret: data?.clientSecret || null,
        amount: data?.amount || pricing?.totalWithMargin || null,
        currency: data?.currency || pricing?.currency || quoteCurrency,
        pricing,
        error: null,
      });

      if (pricing) {
        setQuoteState((prev) => ({
          ...prev,
          pricing,
        }));
      }

      setOrderFeedback({
        submitting: false,
        success: "Pago listo. Completa los datos de tu tarjeta para finalizar.",
        error: null,
      });
    } catch (err) {
      console.error("Error preparing payment intent", err);
      const message =
        err.response?.data?.error ||
        "No pudimos preparar el pago. Revisa los datos e inténtalo nuevamente.";
      setPaymentIntentState((prev) => ({
        ...prev,
        loading: false,
        clientSecret: null,
        error: message,
      }));
      setOrderFeedback({ submitting: false, success: null, error: message });
    }
  };

  /* Efecto principal para solicitar cotización de precio a Prodigi basada en la configuración actual */
  useEffect(() => {
    /* Validaciones previas: necesitamos al menos la foto y la variante */
    if (!photoIdValue || !orderState.variantId) {
      setQuoteState({ loading: false, quote: null, pricing: null, error: null });
      return;
    }

    /* Esperamos a que la variante esté completamente cargada */
    if (!selectedVariant) {
      setQuoteState((prev) =>
        prev.loading && !prev.quote && !prev.error
          ? prev
          : { loading: true, quote: null, pricing: prev.pricing || null, error: null }
      );
      console.log("[Prodigi] waiting for variant before quote", {
        photoId: photoIdValue,
        variantId: orderState.variantId,
      });
      return;
    }

    /* Validamos que tengamos el SKU del producto */
    if (!selectedVariantSku) {
      setQuoteState({
        loading: false,
        quote: null,
        pricing: null,
        error: "No se encontró el SKU del producto para cotizar.",
      });
      console.warn("[Prodigi] missing SKU for variant", {
        variantId: orderState.variantId,
      });
      return;
    }

    /* Esperamos a que se carguen los detalles del producto antes de cotizar */
    if (!selectedProductDetailsEntry || selectedProductDetailsEntry.status === "loading") {
      setQuoteState((prev) =>
        prev.loading && !prev.quote && !prev.error
          ? prev
          : { loading: true, quote: null, pricing: prev.pricing || null, error: null }
      );
      console.log("[Prodigi] awaiting product details before quote", {
        sku: selectedVariantSku,
        status: selectedProductDetailsEntry?.status || "missing",
      });
      return;
    }

    /* Si hubo error al cargar detalles del producto, no podemos cotizar */
    if (selectedProductDetailsEntry.status === "error") {
      setQuoteState({
        loading: false,
        quote: null,
        pricing: null,
        error: selectedProductDetailsEntry.error,
      });
      console.warn("[Prodigi] product details error prevents quote", {
        sku: selectedVariantSku,
        error: selectedProductDetailsEntry.error,
      });
      return;
    }

    const controller = new AbortController();

    const fetchQuote = async () => {
      setQuoteState({
        loading: true,
        quote: null,
        pricing: null,
        error: null,
      });
      try {
        /* Normalizamos el código de color si existe */
        const colorCodePayload = selectedVariant?.colorOptions?.length
          ? orderState.colorCode || selectedVariant.colorOptions[0]?.code
          : undefined;
        const normalizedColorForQuote = colorCodePayload
          ? String(colorCodePayload).toUpperCase()
          : undefined;

        /* Extraemos los atributos del producto desde los detalles cargados previamente */
        const detailsData = selectedProductDetailsEntry.data || {};
        const variantAttributesCandidate =
          detailsData.variantAttributes &&
          typeof detailsData.variantAttributes === "object"
            ? detailsData.variantAttributes
            : null;
        const attributesPayload =
          variantAttributesCandidate ||
          (detailsData.attributes && typeof detailsData.attributes === "object"
            ? detailsData.attributes
            : {});

        console.log("[Prodigi] requesting quote", {
          photoId: photoIdValue,
          variantId: orderState.variantId,
          sku: selectedVariantSku,
          copies: orderState.copies,
          colorCode: colorCodePayload,
          destination: orderState.recipient.countryCode || "ES",
          attributes: attributesPayload,
        });

        /* API - Solicitar cotización de precio a Prodigi con la configuración actual del pedido */
        const { data } = await api.post(
          "/prodigi/quotes",
          {
            photoId: photoIdValue,
            variantId: orderState.variantId,
            colorCode: normalizedColorForQuote,
            copies: orderState.copies,
            destinationCountryCode:
              orderState.recipient.countryCode || "ES",
            productAttributes: attributesPayload,
          },
          { signal: controller.signal }
        );

        const quotesArray = Array.isArray(data?.quotes) ? data.quotes : [];
        const selectedQuote = quotesArray[0] || null;

        console.log("[Prodigi] quote received", {
          sku: selectedVariantSku,
          copies: orderState.copies,
          quote: selectedQuote,
        });

        /* Guardamos la cotización y su contexto para validar que coincida al momento del pago */
        setQuoteState({
          loading: false,
          quote: selectedQuote,
          pricing: data?.pricing || null,
          error: null,
        });
        setLastQuoteContext({
          photoId: photoIdValue,
          variantId: orderState.variantId,
          colorCode: normalizedColorForQuote,
          copies: orderState.copies,
          destinationCountryCode: orderState.recipient.countryCode || "ES",
          productAttributes: attributesPayload,
        });
      } catch (err) {
        if (controller.signal.aborted || err.code === "ERR_CANCELED") {
          return;
        }

        const message =
          err.response?.data?.error ||
          "No pudimos calcular la cotización en este momento.";
        console.error("[Prodigi] quote failed", {
          sku: selectedVariantSku,
          error: message,
          details: err.response?.data,
        });
        setQuoteState({
          loading: false,
          quote: null,
          pricing: null,
          error: message,
        });
      }
    };

    fetchQuote();

    return () => controller.abort();
  }, [
    photoIdValue,
    orderState.variantId,
    selectedVariantSku,
    selectedVariant,
    orderState.colorCode,
    orderState.copies,
    orderState.recipient.countryCode,
    selectedProductDetailsEntry,
  ]);

  /* Renderizar skeleton mientras se cargan los datos iniciales */
  if (loading) return <DetailSkeleton />;

  /* Renderizar pantalla de error si no se encuentra la foto */
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

  /* Extraemos los datos de la fotografía */
  const {
    title,
    description,
    price,
    tags = [],
    metadata = {},
    createdAt,
  } = photo;

  /* Calculamos los precios finales basados en la cotización más reciente */
  const resolvedPricing =
    paymentIntentState.pricing || quoteState.pricing || null;
  const prodigiItemsAmount = parseAmount(
    resolvedPricing?.prodigiItemsAmount || quoteState.quote?.costSummary?.items?.amount
  );
  const prodigiShippingAmount = parseAmount(
    resolvedPricing?.prodigiShippingAmount || quoteState.quote?.costSummary?.shipping?.amount
  );
  const prodigiTaxAmount = parseAmount(
    resolvedPricing?.prodigiTaxAmount || quoteState.quote?.costSummary?.tax?.amount
  );
  const prodigiFeesAmount = parseAmount(
    resolvedPricing?.prodigiFeesAmount || quoteState.quote?.costSummary?.fees?.amount
  );
  const platformMarginAmount = parseAmount(
    resolvedPricing?.platformMargin ?? selectedVariant?.profitMargin
  );
  /* Precio total de Prodigi (sin margen de la plataforma) */
  const prodigiTotal = parseAmount(
    resolvedPricing?.prodigiTotal ||
      prodigiItemsAmount + prodigiShippingAmount + prodigiTaxAmount + prodigiFeesAmount
  );
  /* Precio total final que paga el cliente (Prodigi + margen) */
  const quoteTotalAmount = parseAmount(
    resolvedPricing?.totalWithMargin || prodigiTotal + platformMarginAmount
  );
  const quoteCurrency =
    resolvedPricing?.currency ||
    selectedVariant?.currency ||
    quoteState.quote?.currency ||
    "EUR";
  const productDetailsStatus = selectedProductDetailsEntry?.status || null;
  const productDetailsError = selectedProductDetailsEntry?.error || null;

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
                  {selectedVariant?.profitMargin !== undefined && (
                    <p className="text-[0.6rem] text-white/50">
                      Margen configurado:
                      <span className="ml-1 text-white">
                        {formatCurrency(
                          selectedVariant.profitMargin,
                          selectedVariant.currency || quoteCurrency
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

                {productDetailsStatus === "loading" ? (
                  <p className="text-[0.6rem] text-white/50">
                    Consultando especificaciones del producto...
                  </p>
                ) : productDetailsStatus === "error" ? (
                  <p className="text-[0.6rem] text-red-300">
                    {productDetailsError}
                  </p>
                ) : quoteState.loading ? (
                  <p className="text-[0.6rem] text-white/50">Calculando precio...</p>
                ) : quoteState.error ? (
                  <p className="text-[0.6rem] text-red-300">{quoteState.error}</p>
                ) : resolvedPricing ? (
                  <div className="space-y-1 text-[0.6rem] text-white/60">
                    <p>
                      Total estimado:
                      <span className="ml-1 text-white">
                        {formatCurrency(quoteTotalAmount, quoteCurrency)}
                      </span>
                    </p>
                    <p className="text-white/40">
                      Prodigi: {formatCurrency(prodigiTotal, quoteCurrency)} · Productos {formatCurrency(prodigiItemsAmount, quoteCurrency)} · Envío {formatCurrency(prodigiShippingAmount, quoteCurrency)}
                      {prodigiTaxAmount > 0
                        ? ` · Impuestos ${formatCurrency(prodigiTaxAmount, quoteCurrency)}`
                        : ""}
                      {prodigiFeesAmount > 0
                        ? ` · Tasas ${formatCurrency(prodigiFeesAmount, quoteCurrency)}`
                        : ""}
                    </p>
                    <p className="text-white/40">
                      Tu margen: {formatCurrency(platformMarginAmount, quoteCurrency)}
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

                {paymentIntentState.clientSecret ? (
                  <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/40 p-4">
                    {paymentSuccess ? (
                      <p className="rounded-xl border border-emerald-400/40 bg-emerald-400/10 px-3 py-2 text-[0.65rem] text-emerald-200">
                        Pago confirmado. ID Stripe: {paymentSuccess}
                      </p>
                    ) : stripePromise ? (
                      <Elements
                        key={paymentIntentState.clientSecret}
                        stripe={stripePromise}
                        options={{ clientSecret: paymentIntentState.clientSecret }}
                      >
                        <CheckoutPaymentForm
                          amount={paymentIntentState.amount || quoteTotalAmount}
                          currency={
                            paymentIntentState.currency || quoteCurrency || "EUR"
                          }
                          onSuccess={handlePaymentSuccess}
                          onError={handlePaymentError}
                          onProcessingChange={handleProcessingChange}
                        />
                      </Elements>
                    ) : (
                      <p className="text-[0.6rem] text-red-300">
                        No pudimos cargar la pasarela de pago segura.
                      </p>
                    )}

                    {paymentIntentState.error && !paymentProcessing && (
                      <p className="rounded-xl border border-red-400/40 bg-red-400/10 px-3 py-2 text-[0.65rem] text-red-200">
                        {paymentIntentState.error}
                      </p>
                    )}

                    {!paymentSuccess && (
                      <button
                        type="button"
                        onClick={() => {
                          resetPaymentFlow();
                          setOrderFeedback({
                            submitting: false,
                            success: null,
                            error: null,
                          });
                        }}
                        className="rounded-full border border-white/20 px-4 py-2 text-[0.6rem] uppercase tracking-[0.3em] text-white/70 transition hover:border-white/40 hover:text-white"
                        disabled={paymentProcessing}
                      >
                        Modificar datos
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    type="submit"
                    disabled={
                      orderFeedback.submitting ||
                      paymentIntentState.loading ||
                      !stripePromise
                    }
                    className="mt-1 rounded-full border border-white/30 px-4 py-3 text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-white transition hover:border-white/60 disabled:cursor-not-allowed disabled:border-white/10 disabled:text-white/40"
                  >
                    {orderFeedback.submitting || paymentIntentState.loading
                      ? "Preparando pago..."
                      : "Ir al pago seguro"}
                  </button>
                )}

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
                {stripeConfigError && !stripePromise && (
                  <p className="rounded-xl border border-red-400/40 bg-red-400/10 px-3 py-2 text-[0.65rem] text-red-200">
                    {stripeConfigError}
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
