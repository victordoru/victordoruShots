const mongoose = require("mongoose");

const colorOptionSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, trim: true },
    name: { type: String, trim: true },
  },
  { _id: false }
);

const prodigiCatalogProductSchema = new mongoose.Schema(
  {
    sku: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    prodigiDescription: {
      type: String,
      trim: true,
    },
    basePrice: {
      type: Number,
      min: 0,
    },
    currency: {
      type: String,
      trim: true,
      uppercase: true,
      minlength: 3,
      maxlength: 3,
      default: "EUR",
    },
    defaultSizing: {
      type: String,
      trim: true,
    },
    availableColors: {
      type: [colorOptionSchema],
      default: [],
    },
    productDimensions: {
      width: { type: Number },
      height: { type: Number },
      units: { type: String, trim: true },
    },
    printAreaPixels: {
      width: { type: Number },
      height: { type: Number },
    },
    attributes: {
      type: mongoose.Schema.Types.Mixed,
    },
    shipsTo: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ProdigiCatalogProduct", prodigiCatalogProductSchema);
