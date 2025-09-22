const jwt = require("jsonwebtoken");
const User = require("../models/User");

const authenticate = async (req, res, next) => {
    const authHeader = req.headers.authorization || req.query.token;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Authentication required" });
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET); // Verifica el token

        const user = await User.findById(decoded.userId).select("_id email role");
        if (!user) {
            return res.status(401).json({ message: "User not found" });
        }
        req.user = {
            userId: user._id,
            email: user.email,
            role: user.role,
        };
        next();
    } catch (err) {
        res.status(401).json({ message: "Invalid or expired token" });
    }
};


const sseauthenticate = async (req, res, next) => {
    const { refreshToken } = req.cookies;
    //console.log(refreshToken);
    if (!refreshToken) {
        return res.status(401).json({ message: "Authentication required" });
    }

    try {
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET); // Verifica el token
        const user = await User.findById(decoded.userId).select("_id email role");
        if (!user) {
        return res.status(401).json({ message: "User not found" });
        }
        // Agregar los datos a req.user
        req.user = {
            _id: user._id,
            email: user.email,
            role: user.role, 
        };
        next();
    } catch (err) {
        res.status(401).json({ message: "Invalid or expired token" });
    }
};


const authorize = (rolesArray) => (req, res, next) => {
    // Asume que authenticate ya corrió y sets req.user
    if (!req.user || !rolesArray.includes(req.user.role)) {
        return res.status(403).json({ message: "Forbidden: Insufficient role" });
      }
      next();
};

module.exports = {authenticate, authorize, sseauthenticate};
