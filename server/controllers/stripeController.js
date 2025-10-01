/* 
 * CONTROLADOR DE STRIPE - Gestión de pagos y webhooks
 * 
 * FLUJO PRINCIPAL:
 * 1. Frontend solicita crear un payment intent (createOrderPaymentIntent)
 * 2. Se obtiene cotización de Prodigi antes de crear el payment intent
 * 3. Se crea el payment intent en Stripe con el monto calculado
 * 4. Usuario completa el pago en el frontend
 * 5. Stripe envía webhook "payment_intent.succeeded" 
 * 6. handlePaymentIntentSucceeded procesa el webhook y crea la orden en Prodigi
 * 7. Se actualiza el payment intent con el ID de orden de Prodigi
 */

const Stripe = require("stripe");
const ProdigiOrder = require("../models/ProdigiOrder");
const {
  computeQuoteForVariant,
  summarizeProdigiQuote,
  placeProdigiOrder,
  normalizeRecipient,
} = require("./prodigiController");

/* Configuración del entorno (prod/test) para usar las claves correctas */
const environment = process.env.ENVIRONMENT;
const secretKey =
  environment === "prod"
    ? process.env.SK_LIVE_STRIPE
    : process.env.SK_TEST_STRIPE;
const publishableKey =
  environment === "prod"
    ? process.env.PK_LIVE_STRIPE
    : process.env.PK_TEST_STRIPE;
const webhookSecret =
  environment === "prod"
    ? process.env.STRIPE_WEBHOOK_SECRET
    : process.env.STRIPE_TEST_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;

/* Inicialización de Stripe con la clave secreta */
let stripeInstance = null;
if (secretKey) {
  stripeInstance = new Stripe(secretKey);
} else {
  console.warn("Stripe secret key is not configured. Stripe routes are disabled.");
}

/* Respuesta estándar cuando Stripe no está configurado */
const stripeNotConfiguredResponse = (res) =>
  res.status(503).json({ error: "Stripe is not configured" });

const getStripe = () => stripeInstance;

/* Función auxiliar: limita el número de copias entre 1 y 10 */
const sanitizeCopies = (value) => {
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return 1;
  }
  return Math.min(Math.round(parsed), 10);
};

/* Función auxiliar: convierte un valor a número seguro (0 si no es válido) */
const safeNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/* Función auxiliar: formatea un número para almacenarlo en metadata de Stripe */
const formatMetadataNumber = (value) => safeNumber(value).toFixed(2);

/* Función auxiliar: construye el objeto shipping en formato de Stripe */
const buildStripeShipping = (recipient) => ({
  name: recipient.name,
  address: {
    line1: recipient.address.line1,
    line2: recipient.address.line2 || undefined,
    city: recipient.address.townOrCity,
    state: recipient.address.stateOrCounty || undefined,
    postal_code: recipient.address.postalOrZipCode,
    country: recipient.address.countryCode,
  },
  phone: recipient.phoneNumber || undefined,
});

/* 
 * Endpoint: GET /payments/config
 * Devuelve la clave pública de Stripe para inicializar el cliente en el frontend
 */
const getStripeConfig = (req, res) => {
  if (!publishableKey) {
    return res.status(503).json({
      error: "Stripe publishable key is not configured",
    });
  }
  res.json({ publishableKey });
};

/* 
 * Endpoint: POST /payments/payment-intent
 * Crea un payment intent genérico en Stripe (para pagos simples sin orden de Prodigi)
 */
const createGenericPaymentIntent = async (req, res) => {
  const stripe = getStripe();
  if (!stripe) {
    return stripeNotConfiguredResponse(res);
  }

  const { amount, currency = "eur", metadata = {} } = req.body || {};
  const numericAmount = Number(amount);

  if (!numericAmount || numericAmount <= 0) {
    return res
      .status(400)
      .json({ error: "A valid amount is required to create a payment intent" });
  }

  try {
    /* API Stripe - Crear payment intent genérico */
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.max(1, Math.round(numericAmount * 100)),
      currency: currency.toLowerCase(),
      metadata: Object(metadata),
      automatic_payment_methods: { enabled: true },
    });

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error("Error creating payment intent:", error.message);
    res.status(500).json({ error: "Unable to create payment intent" });
  }
};

/* 
 * Endpoint: POST /payments/order/payment-intent
 * PASO 1 DEL FLUJO: Crea un payment intent en Stripe para una orden de impresión
 * 
 * Este endpoint:
 * 1. Obtiene una cotización de Prodigi para calcular el precio
 * 2. Crea el payment intent en Stripe con ese precio
 * 3. Devuelve el clientSecret al frontend para completar el pago
 * 
 * IMPORTANTE: Todavía NO se crea la orden en Prodigi aquí. 
 * La orden se crea cuando el pago es exitoso (ver handlePaymentIntentSucceeded).
 */
const createOrderPaymentIntent = async (req, res) => {
  const stripe = getStripe();
  if (!stripe) {
    return stripeNotConfiguredResponse(res);
  }

  const {
    photoId,
    variantId,
    colorCode,
    copies,
    recipient,
    shippingMethod,
    productAttributes,
    assetUrl,
  } = req.body || {};

  /* Validación: verificamos que los campos obligatorios estén presentes */
  if (!photoId || !variantId) {
    return res
      .status(400)
      .json({ error: "photoId y variantId son obligatorios" });
  }
  if (!recipient) {
    return res.status(400).json({ error: "recipient es obligatorio" });
  }

  /* Normalizamos y validamos los datos del destinatario */
  let normalizedRecipient;
  try {
    normalizedRecipient = normalizeRecipient(recipient);
  } catch (recipientError) {
    return res
      .status(recipientError.status || 400)
      .json({ error: recipientError.message });
  }

  try {
    /* PRODIGI - Obtener cotización de precio antes de crear el payment intent */
    /* Esta función llama internamente a la API de Prodigi para calcular costes de impresión, envío e impuestos */
    const quoteContext = await computeQuoteForVariant({
      photoId,
      variantId,
      colorCode,
      copies,
      destinationCountryCode: normalizedRecipient.address.countryCode,
      shippingMethod,
      productAttributes,
      assetOverrideUrl: assetUrl,
    });

    /* Extraemos el resumen de precios de la cotización de Prodigi */
    const summary = summarizeProdigiQuote(quoteContext.prodigiResponse);
    if (!summary || summary.prodigiTotal <= 0) {
      return res.status(502).json({
        error: "No se pudo calcular el coste de Prodigi para este pedido",
      });
    }

    /* Calculamos el precio final: coste de Prodigi + margen de la plataforma */
    const rawMargin = Number(quoteContext.variant.profitMargin || 0);
    const platformMargin = Number.isFinite(rawMargin) && rawMargin > 0 ? rawMargin : 0;
    const totalWithMargin = summary.prodigiTotal + platformMargin;

    if (totalWithMargin <= 0) {
      return res.status(400).json({
        error: "El importe total calculado no es válido",
      });
    }

    /* Convertimos el monto a centavos para Stripe (ej: 10.50 EUR = 1050 centavos) */
    const stripeAmount = Math.max(1, Math.round(totalWithMargin * 100));
    const currency = (quoteContext.variant.currency || summary.currency || "EUR").toLowerCase();
    const copiesToPrint = sanitizeCopies(copies);

    /* Preparamos toda la información en metadata para recuperarla en el webhook */
    const metadata = {
      photoId: String(photoId),
      variantId: String(variantId),
      colorCode: colorCode ? String(colorCode).trim().toUpperCase() : "",
      copies: String(copiesToPrint),
      shippingMethod: shippingMethod || "",
      prodigiQuoteId: summary.quoteId || "",
      prodigiCurrency: summary.currency,
      prodigiItemsAmount: formatMetadataNumber(summary.itemsAmount),
      prodigiShippingAmount: formatMetadataNumber(summary.shippingAmount),
      prodigiTaxAmount: formatMetadataNumber(summary.taxAmount),
      prodigiFeesAmount: formatMetadataNumber(summary.feesAmount),
      prodigiTotal: formatMetadataNumber(summary.prodigiTotal),
      platformMargin: formatMetadataNumber(platformMargin),
      totalWithMargin: formatMetadataNumber(totalWithMargin),
      recipient: JSON.stringify(normalizedRecipient),
      productAttributes: productAttributes ? JSON.stringify(productAttributes) : "",
      createdByUserId: req.user?.userId ? String(req.user.userId) : "",
      merchantReference: `stripe-${Date.now()}`,
    };

    /* API Stripe - Crear payment intent (reserva el monto pero NO lo cobra aún) */
    const paymentIntent = await stripe.paymentIntents.create({
      amount: stripeAmount,
      currency,
      automatic_payment_methods: { enabled: true },
      receipt_email: normalizedRecipient.email || req.user?.email || undefined,
      description:
        quoteContext.photo?.title
          ? `Compra impresión "${quoteContext.photo.title}"`
          : `Compra impresión ${quoteContext.photo?._id || ""}`,
      shipping: buildStripeShipping(normalizedRecipient),
      metadata,
    });

    /* Actualizamos el metadata con el ID del payment intent como merchant reference */
    const updatedMetadata = {
      ...metadata,
      merchantReference: paymentIntent.id,
    };

    /* API Stripe - Actualizar metadata del payment intent */
    await stripe.paymentIntents.update(paymentIntent.id, {
      metadata: updatedMetadata,
    });

    /* Devolvemos el clientSecret al frontend para que complete el pago */
    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: totalWithMargin,
      currency: currency.toUpperCase(),
      pricing: {
        prodigiItemsAmount: summary.itemsAmount,
        prodigiShippingAmount: summary.shippingAmount,
        prodigiTaxAmount: summary.taxAmount,
        prodigiFeesAmount: summary.feesAmount,
        prodigiTotal: summary.prodigiTotal,
        platformMargin,
        totalWithMargin,
        totalCharged: totalWithMargin,
        currency: summary.currency,
      },
    });
  } catch (error) {
    console.error("Error creating order payment intent", error);
    const status = error.status || 500;
    res.status(status).json({
      error: error.message || "No se pudo preparar el pago con Stripe",
      details: error.details || error.data || undefined,
    });
  }
};

/* 
 * WEBHOOK HANDLER - Payment Intent Succeeded
 * PASO 2 DEL FLUJO: Se ejecuta cuando el pago es confirmado exitosamente
 * 
 * TRIGGER: Stripe envía este evento automáticamente cuando:
 * - El usuario completa el pago en el frontend con su tarjeta
 * - Stripe procesa y confirma el cargo exitosamente
 * 
 * FLUJO:
 * 1. Stripe detecta pago exitoso
 * 2. Stripe envía webhook "payment_intent.succeeded" a nuestra API
 * 3. Esta función se ejecuta automáticamente
 * 4. Recupera la información del metadata del payment intent
 * 5. CREA LA ORDEN EN PRODIGI (aquí es donde se hace la llamada a Prodigi)
 * 6. Actualiza el payment intent con el ID de orden de Prodigi
 * 
 * IMPORTANTE: Este es el momento en que realmente se crea la orden de impresión en Prodigi.
 */
const handlePaymentIntentSucceeded = async (paymentIntent) => {
  const metadata = paymentIntent.metadata || {};
  
  /* Validamos que el payment intent tenga toda la información necesaria */
  if (!metadata.photoId || !metadata.variantId || !metadata.recipient) {
    console.warn("[Stripe] Payment intent missing metadata for fulfilment", paymentIntent.id);
    return;
  }

  /* Verificamos si ya existe una orden de Prodigi para este pago (evita duplicados) */
  const existingOrder = await ProdigiOrder.findOne({
    stripePaymentIntentId: paymentIntent.id,
  }).lean();

  if (existingOrder) {
    console.log("[Stripe] Prodigi order already exists for payment", paymentIntent.id);
    return;
  }

  /* Parseamos el destinatario desde el metadata */
  let recipientPayload;
  try {
    recipientPayload = JSON.parse(metadata.recipient);
  } catch (parseError) {
    console.error("[Stripe] Cannot parse recipient metadata", parseError.message);
    throw parseError;
  }

  /* Reconstruimos el objeto de pricing desde el metadata */
  const pricing = {
    currency: metadata.prodigiCurrency || paymentIntent.currency?.toUpperCase(),
    prodigiItemsAmount: safeNumber(metadata.prodigiItemsAmount),
    prodigiShippingAmount: safeNumber(metadata.prodigiShippingAmount),
    prodigiTaxAmount: safeNumber(metadata.prodigiTaxAmount),
    prodigiFeesAmount: safeNumber(metadata.prodigiFeesAmount),
    prodigiTotal: safeNumber(metadata.prodigiTotal),
    platformMargin: safeNumber(metadata.platformMargin),
    totalWithMargin:
      paymentIntent.amount_received !== null && paymentIntent.amount_received !== undefined
        ? paymentIntent.amount_received / 100
        : safeNumber(metadata.totalWithMargin),
    totalCharged:
      paymentIntent.amount_received !== null && paymentIntent.amount_received !== undefined
        ? paymentIntent.amount_received / 100
        : safeNumber(metadata.totalWithMargin),
  };

  /* Parseamos productAttributes si están presentes en el metadata */
  let productAttributesPayload = null;
  if (metadata.productAttributes) {
    try {
      productAttributesPayload = JSON.parse(metadata.productAttributes);
    } catch (parseError) {
      console.warn("[Stripe] Cannot parse productAttributes metadata", parseError.message);
    }
  }

  /* PRODIGI - Crear la orden de impresión en Prodigi */
  /* Esta es la llamada CRÍTICA que envía la orden a Prodigi para que impriman y envíen el producto */
  const result = await placeProdigiOrder({
    photoId: metadata.photoId,
    variantId: metadata.variantId,
    colorCode: metadata.colorCode || null,
    copies: metadata.copies || 1,
    recipient: recipientPayload,
    shippingMethod: metadata.shippingMethod || undefined,
    createdBy: metadata.createdByUserId || null,
    paymentIntentId: paymentIntent.id,
    paymentStatus: paymentIntent.status,
    pricing,
    merchantReference: metadata.merchantReference || paymentIntent.id,
    productAttributes: productAttributesPayload,
  });

  /* Si la orden se creó exitosamente en Prodigi, actualizamos el payment intent con el ID de Prodigi */
  if (result?.prodigiOrder?.id) {
    try {
      /* API Stripe - Actualizar metadata del payment intent con información de Prodigi */
      await stripeInstance.paymentIntents.update(paymentIntent.id, {
        metadata: {
          ...metadata,
          prodigiOrderId: result.prodigiOrder.id,
          prodigiMerchantReference: result.merchantReference,
        },
      });
    } catch (updateError) {
      console.warn(
        "[Stripe] Could not update payment intent metadata with Prodigi order",
        updateError.message
      );
    }
  }
};

/* 
 * WEBHOOK HANDLER - Payment Intent Failed
 * Se ejecuta cuando el pago falla (tarjeta rechazada, fondos insuficientes, etc.)
 * 
 * TRIGGER: Stripe envía este evento automáticamente cuando:
 * - La tarjeta es rechazada
 * - No hay fondos suficientes
 * - Cualquier otro error en el procesamiento del pago
 * 
 * IMPORTANTE: NO se crea ninguna orden en Prodigi si el pago falla.
 */
const handlePaymentIntentFailed = async (paymentIntent) => {
  console.warn(
    "[Stripe] Payment intent failed",
    paymentIntent.id,
    paymentIntent.last_payment_error?.message
  );
  /* Aquí podríamos agregar lógica adicional como:
   * - Enviar email al usuario notificando el fallo
   * - Registrar estadísticas de pagos fallidos
   * - Alertar al administrador si hay muchos fallos
   */
};

/* 
 * Endpoint: POST /payments/webhook
 * RECEPTOR DE WEBHOOKS DE STRIPE
 * 
 * Este endpoint recibe notificaciones automáticas de Stripe cuando ocurren eventos:
 * - "payment_intent.succeeded": Pago exitoso → crea orden en Prodigi
 * - "payment_intent.payment_failed": Pago fallido → solo registra el error
 * 
 * SEGURIDAD:
 * - Verifica la firma del webhook con webhookSecret para asegurar que viene de Stripe
 * - Solo procesa eventos autenticados
 * 
 * CONFIGURACIÓN:
 * - Este webhook debe estar configurado en el dashboard de Stripe
 * - URL del webhook: https://tu-dominio.com/api/payments/webhook
 */
const handleStripeWebhook = async (req, res) => {
  const stripe = getStripe();
  if (!stripe) {
    return stripeNotConfiguredResponse(res);
  }

  if (!webhookSecret) {
    console.error("Stripe webhook secret is not configured");
    return res.status(503).json({ error: "Stripe webhook not configured" });
  }

  /* Obtenemos la firma del header para verificar autenticidad */
  const signature = req.headers["stripe-signature"];
  if (!signature) {
    return res.status(400).send("Missing Stripe signature header");
  }

  /* Verificamos que el webhook realmente viene de Stripe usando la firma */
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
  } catch (err) {
    console.error("Stripe webhook signature verification failed", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  /* Procesamos el evento según su tipo */
  try {
    switch (event.type) {
      case "payment_intent.succeeded":
        /* TRIGGER: Pago exitoso - aquí se crea la orden en Prodigi */
        await handlePaymentIntentSucceeded(event.data.object);
        break;
      case "payment_intent.payment_failed":
        /* TRIGGER: Pago fallido - solo se registra el error */
        await handlePaymentIntentFailed(event.data.object);
        break;
      default:
        console.log(`[Stripe] Unhandled event type ${event.type}`);
    }
  } catch (handlerError) {
    console.error("Error processing Stripe webhook event", handlerError);
    /* Si es un error de Prodigi con detalles de validación, los mostramos */
    if (handlerError.data) {
      console.error("[Stripe] Prodigi validation error details:", JSON.stringify(handlerError.data, null, 2));
    }
    return res.status(500).send("Webhook handler error");
  }

  /* Confirmamos a Stripe que recibimos el webhook correctamente */
  res.json({ received: true });
};

module.exports = {
  getStripeConfig,
  createGenericPaymentIntent,
  createOrderPaymentIntent,
  handleStripeWebhook,
};
