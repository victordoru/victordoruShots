const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");
const router = express.Router();
const { sendConfirmationEmail, sendVerificationCodeEmail, sendTemplateEmail } = require("../utils/emailService");

const EMAILS_ENABLED = String(process.env.EMAIL_ENABLED || "false").toLowerCase() === "true";

// Google OAuth
const { OAuth2Client } = require("google-auth-library");

router.post("/google/user", async (req, res) => {
    const { token } = req.body;

    try {
        const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        const { sub: googleId, email, name } = payload;

        // Buscar usuario por googleId o email
        let user = await User.findOne({ $or: [{ googleId }, { email }] });

        if (!user) {
            // Crear nuevo usuario si no existe
            user = new User({
                googleId,
                email,
                name,
                mail_confirmed: true, // Google confirma automáticamente el correo
            });
            await user.save();
        } else if (!user.googleId) {
            // Actualizar usuario existente si no tiene googleId
            user.googleId = googleId;
            await user.save();
        }

        // Generar Access Token
        const accessToken = jwt.sign(
            { userId: user._id, email: user.email, type: "user" },
            process.env.JWT_SECRET,
            { expiresIn: "1h" }
        );

        // Generar Refresh Token
        const refreshToken = jwt.sign(
            { userId: user._id, email: user.email, type: "user" },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: "1y" }
        );

        // Configurar cookie con el Refresh Token
        const cookieMaxAge = 365 * 24 * 60 * 60 * 1000; // 1 año
        res.cookie("refreshToken", refreshToken, {
            sameSite: "lax",
            secure: false, // Cambiar a true si usas HTTPS
            httpOnly: true,
            maxAge: cookieMaxAge,
        });

        // Enviar Access Token en la respuesta
        res.status(200).json({ accessToken });
    } catch (error) {
        console.error("Error en Google login:", error.message);
        res.status(500).json({ message: "Google login failed", error: error.message });
    }
});

router.post("/signup/user", async (req, res) => {
    const { name, email, password, redirectTo, signupMethod } = req.body;

    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: "User already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ 
            name, 
            email, 
            password: hashedPassword, 
            mail_confirmed: EMAILS_ENABLED ? false : true,
        });
        await newUser.save();

        if (EMAILS_ENABLED) {
            if (signupMethod === 'modal_code') {
                console.log(`[Auth] Modal signup for ${email}, waiting for verification code flow.`);
            } else {
                if (redirectTo) {
                    await sendConfirmationEmail(newUser, false, redirectTo);
                } else {
                    await sendConfirmationEmail(newUser);
                }
            }
        } else {
            console.log(`[Auth] Signup for ${email} completed without email confirmation (EMAIL_ENABLED=false).`);
        }

        const accessToken = jwt.sign(
            { userId: newUser._id, email: email, type: "user" },
            process.env.JWT_SECRET,
            { expiresIn: "1h" }
        );
        const refreshToken = jwt.sign(
            { userId: newUser._id, email: email, type: "user" },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: "1y" }
        );
        const cookieMaxAge = 365 * 24 * 60 * 60 * 1000;
        res.cookie("refreshToken", refreshToken, {
            sameSite: "lax",
            secure: false,
            httpOnly: true,
            maxAge: cookieMaxAge,
        });

        res.status(200).json({ 
            accessToken, 
            userId: newUser._id,
            email: newUser.email,
            requiresVerification: signupMethod === 'modal_code'
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error creating user", error: err.message });
    }
});

// Confirmar el correo electrónico
router.get("/confirm-email/user/:token", async (req, res) => {
    if (!EMAILS_ENABLED) {
        return res.status(404).json({ message: "Email confirmation is disabled" });
    }
    const { token } = req.params;
    const { redirect } = req.query;

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        user.mail_confirmed = true;
        await user.save();

        try {
            const firstName = user.name ? user.name.split(' ')[0] : '';
            const firstInitial = firstName ? firstName.charAt(0).toUpperCase() : '';
            await sendTemplateEmail(
                'welcome',
                {
                    name: user.name || '',
                    firstName: firstName,
                    firstInitial: firstInitial,
                    actionUrl: `${process.env.URL_FRONTEND}/profile`,
                    supportEmail: 'support@yourapp.com',
                    BASE_URL: process.env.URL_FRONTEND,
                    companySiteUrl: process.env.URL_FRONTEND,
                    unsubscribeUrl: `${process.env.URL_FRONTEND}/unsubscribe`,
                    email: user.email,
                },
                '¡Bienvenido a tu app!',
                user.email
            );
            console.log(`Email de bienvenida enviado a ${user.email}`);
        } catch (emailError) {
            console.error("Error al enviar email de bienvenida:", emailError);
        }
        
        // Si hay un 'redirect' query parameter, redirigir a esa URL
        if (redirect) {
            return res.redirect(redirect);
        }

        // Comportamiento original si no hay redirect
        const accessToken = jwt.sign(
            { userId: user._id, email: user.email, type: "user" },
            process.env.JWT_SECRET,
            { expiresIn: "1h" }
        );
        const refreshToken = jwt.sign(
            { userId: user._id, email: user.email, type: "user" },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: "1y" }
        );
        const cookieMaxAge = 365 * 24 * 60 * 60 * 1000;
        res.cookie("refreshToken", refreshToken, {
            sameSite: "lax",
            secure: false,
            httpOnly: true,
            maxAge: cookieMaxAge,
        });
        res.status(200).json({ accessToken, message: "Email confirmed successfully" });

    } catch (err) {
        console.error(err);
        // Si hay un 'redirect' query param y ocurre un error, redirigir a una página de error o al frontend
        if (redirect) {
            return res.redirect(`${process.env.URL_FRONTEND}/email-confirmation-error?message=${encodeURIComponent(err.message)}`);
        }
        res.status(400).json({ message: "Invalid or expired token", details: err.message });
    }
});

// Endpoint para enviar código de verificación por email
router.post("/send-verification-code/user", async (req, res) => {
    if (!EMAILS_ENABLED) {
        return res.status(503).json({ message: "Email verification codes are disabled" });
    }
    const { email } = req.body;

    try {
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Generar código de 6 dígitos
        const verificationCode = crypto.randomInt(100000, 999999).toString();
        user.emailVerificationCode = verificationCode;
        user.emailVerificationCodeExpires = Date.now() + 10 * 60 * 1000; // 10 minutos de expiración
        await user.save();

        await sendVerificationCodeEmail(user, verificationCode);

        res.status(200).json({ message: "Verification code sent to email." });
    } catch (err) {
        console.error("Error sending verification code:", err);
        res.status(500).json({ message: "Error sending verification code", error: err.message });
    }
});

// Endpoint para verificar el código de email
router.post("/verify-email-code/user", async (req, res) => {
    if (!EMAILS_ENABLED) {
        return res.status(503).json({ message: "Email verification is disabled" });
    }
    const { email, code } = req.body;

    try {
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        if (user.mail_confirmed) {
            return res.status(400).json({ message: "Email already confirmed" });
        }

        if (user.emailVerificationCode !== code || user.emailVerificationCodeExpires < Date.now()) {
            return res.status(400).json({ message: "Invalid or expired verification code" });
        }

        user.mail_confirmed = true;
        user.emailVerificationCode = undefined;
        user.emailVerificationCodeExpires = undefined;
        await user.save();

        // Generar tokens después de la verificación exitosa del código
        const accessToken = jwt.sign(
            { userId: user._id, email: user.email, type: "user" },
            process.env.JWT_SECRET,
            { expiresIn: "1h" }
        );
        const refreshToken = jwt.sign(
            { userId: user._id, email: user.email, type: "user" },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: "1y" }
        );
        const cookieMaxAge = 365 * 24 * 60 * 60 * 1000;
        res.cookie("refreshToken", refreshToken, {
            sameSite: "lax",
            secure: false,
            httpOnly: true,
            maxAge: cookieMaxAge,
        });

        res.status(200).json({ accessToken, message: "Email confirmed successfully" });

    } catch (err) {
        console.error("Error verifying email code:", err);
        res.status(500).json({ message: "Error verifying email code", error: err.message });
    }
});

// Enviar correo para restablecer contraseña
router.post("/request-password-reset/user", async (req, res) => {
    if (!EMAILS_ENABLED) {
        return res.status(503).json({ message: "Password reset emails are disabled" });
    }
    const { email } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Generar un token de restablecimiento
        const resetToken = crypto.randomBytes(32).toString("hex");
        const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

        // Guardar el token en el usuario
        user.passwordResetToken = hashedToken;
        user.passwordResetExpires = Date.now() + 3600000; // 1 hora
        await user.save();

        // Construir el enlace de restablecimiento
        const resetUrl = `${process.env.URL_FRONTEND}/reset-password/${resetToken}`;

        // Obtener el primer nombre para personalización
        const firstName = user.name ? user.name.split(' ')[0] : 'Usuario';
        const firstInitial = firstName ? firstName.charAt(0).toUpperCase() : 'U';

        console.log("ENVIANDO EMAIL DE RESET DE CONTRASEÑA");

        // Enviar el correo usando plantilla
        await sendTemplateEmail(
            'resetPassword',
            {
                name: user.name || 'Usuario',
                firstName: firstName,
                firstInitial: firstInitial,
                resetUrl: resetUrl,
                supportEmail: 'support@yourapp.com',
                BASE_URL: process.env.URL_FRONTEND,
                companySiteUrl: process.env.URL_FRONTEND,
                unsubscribeUrl: `${process.env.URL_FRONTEND}/unsubscribe`,
                email: user.email,
            },
            'Restablece tu contraseña',
            email
        );

        res.status(200).json({ message: "Password reset email sent" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error sending password reset email" });
    }
});

// Restablecer la contraseña
router.post("/reset-password/user/:token", async (req, res) => {
    const { token } = req.params;
    const { newPassword } = req.body;

    try {
        const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
        const user = await User.findOne({
            passwordResetToken: hashedToken,
            passwordResetExpires: { $gt: Date.now() }, // El token no debe haber expirado
        });

        if (!user) {
            return res.status(400).json({ message: "Invalid or expired token" });
        }

        // Actualizar la contraseña
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        user.mail_confirmed = true;
        await user.save();

        res.status(200).json({ message: "Password reset successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error resetting password" });
    }
});

// Verificar si el token es válido
router.get("/validate-reset-token/user/:token", async (req, res) => {
    const { token } = req.params;

    try {
        const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

        const user = await User.findOne({
            passwordResetToken: hashedToken,
            passwordResetExpires: { $gt: Date.now() }, // El token no debe haber expirado
        });

        if (!user) {
            return res.status(400).json({ message: "Invalid or expired token" });
        }

        res.status(200).json({ message: "Token is valid" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error validating token" });
    }
});

router.post("/send-confirmation-email/user", async (req, res) => {
    if (!EMAILS_ENABLED) {
        return res.status(503).json({ message: "Email delivery is disabled" });
    }
    const { email } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        await sendConfirmationEmail(user, false);

        res.status(200).json({ message: "Confirmation email sent" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error sending confirmation email" });
    }
});

router.post("/login/user", async (req, res) => {
    const { email, password, remember, loginMethod } = req.body;
    
    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        if (EMAILS_ENABLED && !user.mail_confirmed) {
            if (loginMethod === 'modal_code') {
                return res.status(403).json({ 
                    message: "Email not confirmed. Please verify your email using the code.",
                    requiresEmailVerification: true, 
                    verificationType: 'code',
                    email: user.email 
                });
            }
            return res.status(403).json({ message: "Please confirm your email before logging in." });
        }

        // Email is confirmed, proceed with login
        const accessToken = jwt.sign(
            { userId: user._id, email: user.email, type: "user" },
            process.env.JWT_SECRET,
            { expiresIn: "1h" }
        );
        const refreshToken = jwt.sign(
            { userId: user._id, email: user.email, type: "user" },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: "1y" }
        );
        let cookieMaxAge = remember ? (365 * 24 * 60 * 60 * 1000) : (24 * 60 * 60 * 1000);
        res.cookie("refreshToken", refreshToken, {
            sameSite: "lax",
            secure: false, // Cambiar a true si usas HTTPS
            httpOnly: true,
            maxAge: cookieMaxAge,
        });
        res.status(200).json({ accessToken });
    } catch (err) {
        res.status(500).json({ message: "Error logging in", error: err.message });
    }
});

router.post("/logout", (req, res) => {
    console.log("hacemos logout");
    res.clearCookie("refreshToken", { httpOnly: true, sameSite: "strict" });
    res.status(200).json({ message: "Logged out successfully" });
});

router.post("/refresh", async (req, res) => {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
        return res.status(401).json({ message: "Authentication required" });
    }

    try {
        // Verificar el refresh token
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        console.log(decoded);
        const user = await User.findById(decoded.userId).select("_id");
        if (!user) {
            return res.status(401).json({ message: "No user" });
        }
        // Generar un nuevo Access Token
        const accessToken = jwt.sign(
            { userId: decoded.userId, email: decoded.email, type: decoded.type },
            process.env.JWT_SECRET,
            { expiresIn: "1h" }
        );

        return res.status(200).json({ accessToken });
    } catch (err) {
        return res.status(401).json({ message: "Invalid or expired refresh token" });
    }
});

// Endpoint para cambiar la contraseña de un usuario autenticado
router.post("/change-password", async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    
    // Extraer el token del header de autorización
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: "Authentication required" });
    }
    
    const token = authHeader.split(' ')[1];
    
    try {
        // Verificar y decodificar el token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const { userId } = decoded;
        
        const user = await User.findById(userId);
        
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        
        // Verificar la contraseña actual
        const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: "La contraseña actual es incorrecta" });
        }
        
        // Actualizar la contraseña
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();
        
        res.status(200).json({ message: "Contraseña actualizada correctamente" });
    } catch (err) {
        console.error("Error al cambiar contraseña:", err);
        if (err.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: "Token inválido" });
        }
        res.status(500).json({ message: "Error al cambiar la contraseña", error: err.message });
    }
});

module.exports = router;
