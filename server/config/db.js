const mongoose = require("mongoose");

const maskMongoUri = (uri) => {
    if (!uri) return "(not set)";
    return uri.replace(/\/\/([^/@]+)@/, "//****@");
};

mongoose.connection.on("connected", () => {
    console.log("[DB] Mongoose connection established");
});

mongoose.connection.on("error", (err) => {
    console.error("[DB] Connection error", err.message);
});

mongoose.connection.on("disconnected", () => {
    console.warn("[DB] Mongoose disconnected");
});

const connectDB = async () => {
    const mongoUri = process.env.MONGO_URI;

    if (!mongoUri) {
        console.error("[DB] Missing MONGO_URI environment variable");
        throw new Error("Missing MONGO_URI environment variable");
    }

    const sanitizedUri = maskMongoUri(mongoUri);

    try {
        console.log(`[DB] Connecting to MongoDB -> ${sanitizedUri}`);
        const conn = await mongoose.connect(mongoUri);
        console.log(`[DB] MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
    } catch (err) {
        console.error(`[DB] Connection failed for ${sanitizedUri}: ${err.message}`);
        throw err;
    }
};

module.exports = {
    connectDB,
    maskMongoUri,
};
