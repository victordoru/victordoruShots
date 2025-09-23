const mongoose = require("mongoose");

const prodigiProductSchema = new mongoose.Schema(
  {
    sku: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
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
    retailPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    currency: {
      type: String,
      default: "EUR",
      trim: true,
      uppercase: true,
      minlength: 3,
      maxlength: 3,
    },
    sizing: {
      type: String,
      default: "fillPrintArea",
      trim: true,
    },
    mockupImages: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

prodigiProductSchema.index({ sku: 1 }, { unique: true });

module.exports = mongoose.model("ProdigiProduct", prodigiProductSchema);
