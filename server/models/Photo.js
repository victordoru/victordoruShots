const mongoose = require("mongoose");

const photoSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    price: { type: Number, default: 0 },
    tags: { type: [String], default: [] },
    imagePath: { type: String, required: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    metadata: {
      camera: { type: String },
      location: { type: String },
      shotAt: { type: Date },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Photo", photoSchema);
