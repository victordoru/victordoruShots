const mongoose = require("mongoose");

const recipientSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true },
    phoneNumber: { type: String, trim: true },
    address: {
      line1: { type: String, required: true, trim: true },
      line2: { type: String, trim: true },
      townOrCity: { type: String, required: true, trim: true },
      stateOrCounty: { type: String, trim: true },
      postalOrZipCode: { type: String, required: true, trim: true },
      countryCode: { type: String, required: true, trim: true, uppercase: true },
    },
  },
  { _id: false }
);

const prodigiOrderSchema = new mongoose.Schema(
  {
    merchantReference: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    prodigiOrderId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    outcome: {
      type: String,
      trim: true,
    },
    prodigiStatus: {
      type: String,
      trim: true,
    },
    photo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Photo",
      required: true,
    },
    variant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PhotoProdigiVariant",
      required: true,
    },
    sku: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    colorCode: {
      type: String,
      trim: true,
      uppercase: true,
    },
    copies: {
      type: Number,
      min: 1,
      default: 1,
    },
    shippingMethod: {
      type: String,
      trim: true,
    },
    recipient: recipientSchema,
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },
    prodigiOrderSnapshot: {
      type: mongoose.Schema.Types.Mixed,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

prodigiOrderSchema.index({ photo: 1, createdAt: -1 });
prodigiOrderSchema.index({ variant: 1, createdAt: -1 });

module.exports = mongoose.model("ProdigiOrder", prodigiOrderSchema);
