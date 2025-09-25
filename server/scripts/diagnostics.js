const path = require("path");
const mongoose = require("mongoose");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const { connectDB } = require("../config/db");
const { buildHealthReport, logStartupDiagnostics } = require("../utils/diagnostics");

(async () => {
    try {
        logStartupDiagnostics();
        await connectDB();
        const report = await buildHealthReport();
        console.log(JSON.stringify(report, null, 2));
        const isHealthy = report.status === "ok";
        await mongoose.connection.close();
        process.exit(isHealthy ? 0 : 2);
    } catch (error) {
        console.error("[Diagnostics] Failed to complete diagnostics:", error.message);
        if (mongoose.connection.readyState !== 0) {
            await mongoose.connection.close();
        }
        process.exit(1);
    }
})();
