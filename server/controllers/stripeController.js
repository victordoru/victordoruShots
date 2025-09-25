const Stripe = require("stripe");
const ProdigiOrder = require("../models/ProdigiOrder");
const {
  computeQuoteForVariant,
  summarizeProdigiQuote,
  placeProdigiOrder,
  normalizeRecipient,
} = require("./prodigiController");

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

let stripeInstance = null;
if (secretKey) {
  stripeInstance = new Stripe(secretKey);
} else {
  console.warn("Stripe secret key is not configured. Stripe routes are disabled.");
}

const stripeNotConfiguredResponse = (res) =>
  res.status(503).json({ error: "Stripe is not configured" });

const getStripe = () => stripeInstance;

const sanitizeCopies = (value) => {
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return 1;
  }
  return Math.min(Math.round(parsed), 10);
};

const safeNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatMetadataNumber = (value) => safeNumber(value).toFixed(2);

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

const getStripeConfig = (req, res) => {
  if (!publishableKey) {
    return res.status(503).json({
      error: "Stripe publishable key is not configured",
    });
  }
  res.json({ publishableKey });
};

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

  if (!photoId || !variantId) {
    return res
      .status(400)
      .json({ error: "photoId y variantId son obligatorios" });
  }
  if (!recipient) {
    return res.status(400).json({ error: "recipient es obligatorio" });
  }

  let normalizedRecipient;
  try {
    normalizedRecipient = normalizeRecipient(recipient);
  } catch (recipientError) {
    return res
      .status(recipientError.status || 400)
      .json({ error: recipientError.message });
  }

  try {
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

    const summary = summarizeProdigiQuote(quoteContext.prodigiResponse);
    if (!summary || summary.prodigiTotal <= 0) {
      return res.status(502).json({
        error: "No se pudo calcular el coste de Prodigi para este pedido",
      });
    }

    const rawMargin = Number(quoteContext.variant.profitMargin || 0);
    const platformMargin = Number.isFinite(rawMargin) && rawMargin > 0 ? rawMargin : 0;
    const totalWithMargin = summary.prodigiTotal + platformMargin;

    if (totalWithMargin <= 0) {
      return res.status(400).json({
        error: "El importe total calculado no es válido",
      });
    }

    const stripeAmount = Math.max(1, Math.round(totalWithMargin * 100));
    const currency = (quoteContext.variant.currency || summary.currency || "EUR").toLowerCase();
    const copiesToPrint = sanitizeCopies(copies);

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
      createdByUserId: req.user?.userId ? String(req.user.userId) : "",
      merchantReference: `stripe-${Date.now()}`,
    };

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

    const updatedMetadata = {
      ...metadata,
      merchantReference: paymentIntent.id,
    };

    await stripe.paymentIntents.update(paymentIntent.id, {
      metadata: updatedMetadata,
    });

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

const handlePaymentIntentSucceeded = async (paymentIntent) => {
  const metadata = paymentIntent.metadata || {};
  if (!metadata.photoId || !metadata.variantId || !metadata.recipient) {
    console.warn("[Stripe] Payment intent missing metadata for fulfilment", paymentIntent.id);
    return;
  }

  const existingOrder = await ProdigiOrder.findOne({
    stripePaymentIntentId: paymentIntent.id,
  }).lean();

  if (existingOrder) {
    console.log("[Stripe] Prodigi order already exists for payment", paymentIntent.id);
    return;
  }

  let recipientPayload;
  try {
    recipientPayload = JSON.parse(metadata.recipient);
  } catch (parseError) {
    console.error("[Stripe] Cannot parse recipient metadata", parseError.message);
    throw parseError;
  }

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
  });

  if (result?.prodigiOrder?.id) {
    try {
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

const handlePaymentIntentFailed = async (paymentIntent) => {
  console.warn(
    "[Stripe] Payment intent failed",
    paymentIntent.id,
    paymentIntent.last_payment_error?.message
  );
};

const handleStripeWebhook = async (req, res) => {
  const stripe = getStripe();
  if (!stripe) {
    return stripeNotConfiguredResponse(res);
  }

  if (!webhookSecret) {
    console.error("Stripe webhook secret is not configured");
    return res.status(503).json({ error: "Stripe webhook not configured" });
  }

  const signature = req.headers["stripe-signature"];
  if (!signature) {
    return res.status(400).send("Missing Stripe signature header");
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
  } catch (err) {
    console.error("Stripe webhook signature verification failed", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(event.data.object);
        break;
      case "payment_intent.payment_failed":
        await handlePaymentIntentFailed(event.data.object);
        break;
      default:
        console.log(`[Stripe] Unhandled event type ${event.type}`);
    }
  } catch (handlerError) {
    console.error("Error processing Stripe webhook event", handlerError);
    return res.status(500).send("Webhook handler error");
  }

  res.json({ received: true });
};

module.exports = {
  getStripeConfig,
  createGenericPaymentIntent,
  createOrderPaymentIntent,
  handleStripeWebhook,
};
