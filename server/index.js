const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const {connectDB} = require("./config/db");
const cookieParser = require("cookie-parser");
const stripeWebhookRouter = require("./routes/stripeWebhook");
const { logStartupDiagnostics, buildHealthReport } = require("./utils/diagnostics");

const app = express();
const PORT = process.env.PORT || 5001;

logStartupDiagnostics();

// Conectar a MongoDB
connectDB().catch((err) => {
    console.error("[DB] Unable to establish initial connection", err.message);
    process.exit(1);
});

// Middlewares
app.use(cors({
    origin: [process.env.URL_FRONTEND || "http://localhost:5173"],
    credentials: true,
}));

app.options("*", cors());

app.use(cookieParser());
app.use("/api/payments/webhook", stripeWebhookRouter);
app.use(bodyParser.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get('/health', async (req, res) => {
    try {
        const report = await buildHealthReport();
        const statusCode = report.status === 'ok' ? 200 : 503;
        res.status(statusCode).json({ status: report.status, timestamp: report.timestamp });
    } catch (error) {
        console.error('[Health] Error building health report', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.get('/health/full', async (req, res) => {
    try {
        const report = await buildHealthReport();
        const statusCode = report.status === 'ok' ? 200 : 503;
        res.status(statusCode).json(report);
    } catch (error) {
        console.error('[Health] Error building detailed health report', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Rutas básicas
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/user", require("./routes/userRoutes"));
app.use("/api/payments", require("./routes/stripeRoutes"));
app.use("/api/photos", require("./routes/photoRoutes"));
app.use("/api/prodigi", require("./routes/prodigiRoutes"));


// Iniciar servidor
//const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));





// Iniciar servidor
const server = app.listen(PORT, () => { // Modificado: Usar server.listen en lugar de app.listen para Socket
    console.log(`Server running on port ${PORT}`);
});

// Manejo de señal para apagado controlado
const gracefulShutdown = () => {
    console.log('Recibida señal para finalizar. Cerrando servidor...');
    server.close(() => {
      console.log('Servidor cerrado correctamente.');
      process.exit(0);
    });
  
    // Si hay conexiones que se cuelgan, fuerza el cierre tras X segundos
    setTimeout(() => {
      console.error('Fuerza el cierre del servidor');
      process.exit(1);
    }, 10000); // 10 segundos, ajustable según tus necesidades
  };
  
  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
