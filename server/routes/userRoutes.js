const express = require("express");
const User = require("../models/User");
const { authenticate } = require("../middleware/auth");
const router = express.Router();

// 1. Obtener todos los usuarios
router.get("/", async (req, res) => {
    try {
        const users = await User.find();
        res.status(200).json(users);
    } catch (err) {
        res.status(500).json({ error: "Error fetching users" });
    }
});
router.get("/profile", authenticate, async (req, res) => {
    
    try {
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(401).json({ message: "User not found" });
        }

        res.status(200).json(user);
    } catch (err) {
        res.status(500).json({ message: "Error fetching profile", error: err.message });
    }
});

// 2. Crear un nuevo usuario
router.post("/", async (req, res) => {
    const { name, email, password } = req.body;

    try {
        const newUser = new User({ name, email, password });
        await newUser.save();
        res.status(201).json(newUser);
    } catch (err) {
        res.status(400).json({ error: "Error creating user" });
    }
});

// 3. Actualizar un usuario
router.put("/", authenticate, async (req, res) => {
    const id = req.user.userId;
    const { name, email, password, profilePicture } = req.body;

    try {
        const updateData = {};

        if (name !== undefined) updateData.name = name;
        if (email !== undefined) updateData.email = email;
        if (password !== undefined) updateData.password = password;
        if (profilePicture !== undefined) updateData.profilePicture = profilePicture;

        const updatedUser = await User.findByIdAndUpdate(id, updateData, {
            new: true,
        });

        res.status(200).json(updatedUser);
    } catch (err) {
        console.error("Error updating user:", err);
        res.status(400).json({ error: "Error updating user" });
    }
});

// Endpoint para actualizar los datos de facturación
router.put("/billing", authenticate, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { billingData } = req.body;
        
        if (!billingData) {
            return res.status(400).json({ message: "Billing data is required" });
        }
        
        // Verificamos que el usuario existe
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        
        // Actualizamos los datos de facturación
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { billingData },
            { new: true }
        );
        
        res.status(200).json(updatedUser);
    } catch (error) {
        console.error("Error updating billing data:", error);
        res.status(500).json({ message: "Error updating billing data", error: error.message });
    }
});

// 4. Eliminar un usuario
router.delete("/:id", async (req, res) => {
    const { id } = req.params;
    try {
        await User.findByIdAndDelete(id);
        res.status(200).json({ message: "User deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: "Error deleting user" });
    }
});
module.exports = router;
