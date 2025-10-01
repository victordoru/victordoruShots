const express = require("express");
const { authenticate } = require("../middleware/auth");
const {
  getStripeConfig,
  createGenericPaymentIntent,
  createOrderPaymentIntent,
} = require("../controllers/stripeController");

const router = express.Router();

router.get("/config", getStripeConfig);
router.post("/create-payment-intent", authenticate, createGenericPaymentIntent);
router.post("/order/payment-intent", createOrderPaymentIntent); // Permitir pedidos sin autenticación

module.exports = router;
