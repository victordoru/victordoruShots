const express = require("express");
const Photo = require("../models/Photo");
const upload = require("../middleware/upload");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

// Public gallery endpoint (no auth required)
router.get("/public", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 12, 60);
    const photos = await Photo.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.status(200).json(photos);
  } catch (error) {
    console.error("Error fetching public photos", error);
    res.status(500).json({ message: "Error fetching photos" });
  }
});

router.get("/public/:photoId", async (req, res) => {
  try {
    const { photoId } = req.params;

    const photo = await Photo.findById(photoId).lean();
    if (!photo) {
      return res.status(404).json({ message: "Photo not found" });
    }

    res.status(200).json(photo);
  } catch (error) {
    console.error("Error fetching photo", error);
    res.status(500).json({ message: "Error fetching photo" });
  }
});

// List photos created by current user (protected)
router.get("/", authenticate, async (req, res) => {
  try {
    const filter = { createdBy: req.user.userId };
    const photos = await Photo.find(filter)
      .sort({ createdAt: -1 })
      .lean();
    res.status(200).json(photos);
  } catch (error) {
    console.error("Error fetching photos", error);
    res.status(500).json({ message: "Error fetching photos" });
  }
});

router.post("/", authenticate, upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Image file is required" });
    }

    const {
      title,
      description = "",
      price = 0,
      tags = "",
      camera,
      location,
      shotAt,
    } = req.body;

    if (!title) {
      return res.status(400).json({ message: "Title is required" });
    }

    const normalizedTags = Array.isArray(tags)
      ? tags
      : tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean);

    const photo = new Photo({
      title,
      description,
      price: Number(price) || 0,
      tags: normalizedTags,
      imagePath: `/uploads/${req.file.filename}`,
      createdBy: req.user.userId,
      metadata: {
        camera: camera || undefined,
        location: location || undefined,
        shotAt: shotAt ? new Date(shotAt) : undefined,
      },
    });

    const saved = await photo.save();
    res.status(201).json(saved);
  } catch (error) {
    console.error("Error saving photo", error);
    res.status(500).json({ message: "Error creating photo" });
  }
});

module.exports = router;
