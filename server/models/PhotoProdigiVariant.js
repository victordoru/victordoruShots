const mongoose = require("mongoose");

const mockupImageSchema = new mongoose.Schema(
  {
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      auto: true,
    },
    url: {
      type: String,
      required: true,
    },
    label: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

const colorOptionSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, trim: true },
    name: { type: String, trim: true },
    assetUrl: { type: String },
    mockupImageRefs: {
      type: [mongoose.Schema.Types.ObjectId],
      default: [],
    },
    assetDetails: {
      width: { type: Number },
      height: { type: Number },
      size: { type: Number },
      format: { type: String },
    },
  },
  { _id: false }
);

const photoProdigiVariantSchema = new mongoose.Schema(
  {
    photo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Photo",
      required: true,
    },
    catalogProduct: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProdigiCatalogProduct",
      required: true,
    },
    displayName: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    retailPrice: {
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
    sizing: {
      type: String,
      trim: true,
    },
    assetUrl: {
      type: String,
    },
    assetDetails: {
      width: { type: Number },
      height: { type: Number },
      size: { type: Number },
      format: { type: String },
    },
    mockupImages: {
      type: [mockupImageSchema],
      default: [],
    },
    profitMargin: {
      type: Number,
      min: 0,
      default: 0,
    },
    colorOptions: {
      type: [colorOptionSchema],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

photoProdigiVariantSchema.index({ photo: 1, catalogProduct: 1 });

module.exports = mongoose.model(
  "PhotoProdigiVariant",
  photoProdigiVariantSchema
);
