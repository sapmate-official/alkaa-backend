import jwt from "jsonwebtoken";

export default function validateToken(req, res, next) {
    // Get token from Authorization header only
    const authHeader = req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ 
            message: "Access denied. No token provided.",
            expired: false
        });
    }
    
    const token = authHeader.split(" ")[1];
    
    try {
        // Add clock tolerance to handle slight time differences
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, {
            clockTolerance: 60 // 60 seconds tolerance
        });

        // Standardize the user ID format
        req.user = {
            id: decoded.id || decoded.userId,
            email: decoded.email
        };
        
        next();
    } catch (error) {
        console.error("Token verification error:", error);

        if (error.name === "TokenExpiredError") {
            return res.status(401).json({
                message: "Token expired",
                expired: true
            });
        }

        return res.status(401).json({ 
            message: "Invalid token.",
            expired: false 
        });
    }
}