const express = require("express");
const Stripe = require("stripe");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

const secretKey =
  process.env.ENVIRONMENT === "prod"
    ? process.env.SK_LIVE_STRIPE
    : process.env.SK_TEST_STRIPE;

if (!secretKey) {
  console.warn("Stripe secret key is not configured. Stripe routes are disabled.");
}

const stripe = secretKey ? Stripe(secretKey) : null;

router.get("/config", (req, res) => {
  const publishableKey =
    process.env.ENVIRONMENT === "prod"
      ? process.env.PK_LIVE_STRIPE
      : process.env.PK_TEST_STRIPE;

  if (!publishableKey) {
    return res.status(503).json({
      error: "Stripe publishable key is not configured",
    });
  }

  res.json({ publishableKey });
});

router.post("/create-payment-intent", authenticate, async (req, res) => {
  if (!stripe) {
    return res.status(503).json({ error: "Stripe is not configured" });
  }

  const { amount, currency = "eur", metadata = {} } = req.body || {};

  if (!amount || Number(amount) <= 0) {
    return res
      .status(400)
      .json({ error: "A valid amount is required to create a payment intent" });
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(Number(amount) * 100),
      currency,
      metadata: Object(metadata),
    });

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error("Error creating payment intent:", error.message);
    res.status(500).json({ error: "Unable to create payment intent" });
  }
});

module.exports = router;
