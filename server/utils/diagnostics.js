const mongoose = require("mongoose");
const { maskMongoUri } = require("../config/db");

const REQUIRED_ENV_VARS = [
    "MONGO_URI",
    "JWT_SECRET",
    "JWT_REFRESH_SECRET",
    "URL_FRONTEND",
];

const OPTIONAL_ENV_VARS = [
    "GOOGLE_CLIENT_ID",
    "STRIPE_SECRET_KEY",
    "STRIPE_PUBLISHABLE_KEY",
    "PRODIGI_API_KEY",
    "PRODIGI_BASE_URL",
    "SMTP_HOST",
    "SMTP_USER",
];

const READY_STATE = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
    4: "unauthorized",
};

const collectEnvStatus = () => {
    const check = (keys) =>
        keys.map((key) => ({ key, present: Boolean(process.env[key]) }));

    return {
        required: check(REQUIRED_ENV_VARS),
        optional: check(OPTIONAL_ENV_VARS),
    };
};

const checkDatabase = async () => {
    const readyState = mongoose.connection.readyState;
    const stateText = READY_STATE[readyState] || "unknown";
    let canPing = false;
    let pingError;

    if (readyState === 1 && mongoose.connection?.db) {
        try {
            await mongoose.connection.db.admin().ping();
            canPing = true;
        } catch (err) {
            pingError = err.message;
        }
    }

    return {
        uri: maskMongoUri(process.env.MONGO_URI),
        readyState,
        stateText,
        canPing,
        ...(pingError ? { pingError } : {}),
    };
};

const buildHealthReport = async () => {
    const [db, env] = await Promise.all([
        checkDatabase(),
        Promise.resolve(collectEnvStatus()),
    ]);

    return {
        status: db.readyState === 1 && db.canPing ? "ok" : "degraded",
        timestamp: Date.now(),
        uptimeSeconds: process.uptime(),
        environment: {
            nodeEnv: process.env.NODE_ENV || "development",
            emailEnabled: String(process.env.EMAIL_ENABLED || "false").toLowerCase() === "true",
        },
        db,
        env,
    };
};

const logStartupDiagnostics = () => {
    const envStatus = collectEnvStatus();
    const missingRequired = envStatus.required
        .filter((item) => !item.present)
        .map((item) => item.key);

    console.log("[Env] NODE_ENV:", process.env.NODE_ENV || "development");
    console.log("[Env] EMAIL_ENABLED:", String(process.env.EMAIL_ENABLED || "false").toLowerCase());
    console.log("[Env] MONGO_URI:", maskMongoUri(process.env.MONGO_URI));

    if (missingRequired.length) {
        console.warn("[Env] Missing required environment variables:", missingRequired.join(", "));
    }

    const optionalMissing = envStatus.optional
        .filter((item) => !item.present)
        .map((item) => item.key);

    if (optionalMissing.length) {
        console.warn("[Env] Missing optional environment variables:", optionalMissing.join(", "));
    }
};

module.exports = {
    REQUIRED_ENV_VARS,
    collectEnvStatus,
    checkDatabase,
    buildHealthReport,
    logStartupDiagnostics,
};
