// models/User.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String },
  mail_confirmed: { type: Boolean, default: false },
  googleId: { type: String, unique: true, sparse: true },
  passwordResetToken: String,
  passwordResetExpires: Date,
  emailVerificationCode: { type: String },
  emailVerificationCodeExpires: { type: Date },
  role: {
    type: String,
    enum: ["admin", "user"],
    default: "user",
  },
  // Stripe fields (keeping for future use)
  stripeCustomerId: { type: String },
  
  // Profile image
  profilePicture: { type: String },
}, {
  timestamps: true
});

module.exports = mongoose.model("User", userSchema);