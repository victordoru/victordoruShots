const express = require("express");
const { listProducts, getQuote, createOrder } = require("../controllers/prodigiController");

const router = express.Router();

router.get("/products", listProducts);
router.post("/quotes", getQuote);
router.post("/orders", createOrder);

module.exports = router;
