const nodemailer = require("nodemailer");
const jwt = require("jsonwebtoken");

const createTransporter = () => {
  const port = Number(process.env.SMTP_PORT) || 587;
  const secure = process.env.SMTP_SECURE === "true" || port === 465;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

const sendConfirmationEmail = async (user, isOrg = false, redirectTo = null) => {
  // TEMPORALMENTE DESACTIVADO - Emails desactivados
  console.log("Emails desactivados - sendConfirmationEmail");
  return { message: "emails desactivados" };

  // WARN CÓDIGO ORIGINAL COMENTADO PARA MANTENER LAS UTILIDADES:
  /*
  const transporter = createTransporter();

  const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
    expiresIn: "24h",
  });

  const baseUrl = process.env.URL_FRONTEND || "http://localhost:5173";
  const confirmUrl = redirectTo
    ? `${baseUrl}/api/auth/confirm-email/user/${token}?redirect=${encodeURIComponent(redirectTo)}`
    : `${baseUrl}/confirm-email/${token}`;

  const mailOptions = {
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: user.email,
    subject: "Confirm your email address",
    html: `
      <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
        <h2 style="color: #333;">Welcome to Your App!</h2>
        <p>Hi ${user.name},</p>
        <p>Thank you for signing up! Please click the button below to confirm your email address:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${confirmUrl}"
             style="background-color: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Confirm Email
          </a>
        </div>
        <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #666;">${confirmUrl}</p>
        <p>This link will expire in 24 hours.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #666; font-size: 14px;">If you didn't create an account, you can safely ignore this email.</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
  console.log("Confirmation email sent successfully");
  */
};

const sendVerificationCodeEmail = async (user, code) => {
  // TEMPORALMENTE DESACTIVADO - Emails desactivados
  console.log("Emails desactivados - sendVerificationCodeEmail");
  return { message: "emails desactivados" };

  // WARN CÓDIGO ORIGINAL COMENTADO PARA MANTENER LAS UTILIDADES:
  /*
  const transporter = createTransporter();

  const mailOptions = {
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: user.email,
    subject: "Your verification code",
    html: `
      <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
        <h2 style="color: #333;">Email Verification</h2>
        <p>Hi ${user.name},</p>
        <p>Your verification code is:</p>
        <div style="text-align: center; margin: 30px 0;">
          <div style="background-color: #f8f9fa; border: 2px dashed #dee2e6; padding: 20px; border-radius: 8px; display: inline-block;">
            <span style="font-size: 32px; font-weight: bold; color: #495057; letter-spacing: 8px;">${code}</span>
          </div>
        </div>
        <p>This code will expire in 10 minutes.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #666; font-size: 14px;">If you didn't request this code, you can safely ignore this email.</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
  console.log("Verification code email sent successfully");
  */
};

const sendTemplateEmail = async (template, data, subject, email) => {
  // TEMPORALMENTE DESACTIVADO - Emails desactivados
  console.log("Emails desactivados - sendTemplateEmail");
  return { message: "emails desactivados" };

  // WARN  CÓDIGO ORIGINAL COMENTADO PARA MANTENER LAS UTILIDADES:
  /*
  const transporter = createTransporter();

  let htmlContent = "";

  if (template === "welcome") {
    htmlContent = `
      <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
        <h2 style="color: #333;">Welcome ${data.firstName}!</h2>
        <p>Welcome to Your App! We're excited to have you on board.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${data.actionUrl}"
             style="background-color: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Get Started
          </a>
        </div>
        <p>If you have any questions, feel free to contact us at ${data.supportEmail}</p>
      </div>
    `;
  } else if (template === "resetPassword") {
    htmlContent = `
      <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
        <h2 style="color: #333;">Reset Your Password</h2>
        <p>Hi ${data.firstName},</p>
        <p>You requested to reset your password. Click the button below to create a new password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${data.resetUrl}"
             style="background-color: #DC2626; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Reset Password
          </a>
        </div>
        <p>If you didn't request this, you can safely ignore this email.</p>
        <p>This link will expire in 1 hour.</p>
      </div>
    `;
  } else {
    htmlContent = data?.html || "";
  }

  const mailOptions = {
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject,
    html: htmlContent,
  };

  await transporter.sendMail(mailOptions);
  console.log(`${template} email sent successfully`);
  */
};

module.exports = {
  createTransporter,
  sendConfirmationEmail,
  sendVerificationCodeEmail,
  sendTemplateEmail,
};
