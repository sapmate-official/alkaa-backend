import jwt from "jsonwebtoken";

export default function validateToken(req, res, next) {
    let token = req.header("Authorization")?.split(" ")[1];

    if (!token) {
        token = req.cookies.accessToken;
        if (!token) {
            console.log("Access denied. No token provided.");
            return res.status(401).json({ message: "Access denied. No token provided." });
        }
    }

    try {
        // Add clock tolerance to handle slight time differences
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, {
            clockTolerance: 60 // 60 seconds tolerance
        });

        // Ensure decoded has the required structure
        if (!decoded.id && decoded.userId) {
            decoded.id = decoded.userId;
        }

        if (!decoded.id) {
            console.log("Invalid token: No user ID found in token");
            return res.status(400).json({ message: "Invalid token: Missing user identification." });
        }

        req.user = decoded;
        next();
    } catch (error) {
        console.error("Token verification error:", error);

        // If token is expired, try to refresh it automatically
        if (error.name === "TokenExpiredError") {
            return res.status(401).json({
                message: "Token expired",
                expired: true
            });
        }

        return res.status(400).json({ message: "Invalid token." });
    }
}