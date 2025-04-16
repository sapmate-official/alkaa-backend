import jwt from "jsonwebtoken";

export default function validateToken(req, res, next) {
    try {
        // Get token from multiple sources (header or cookie)
        const authHeader = req.header("Authorization");
        const cookieToken = req.cookies?.accessToken;
        
        let token;
        
        if (authHeader && authHeader.startsWith("Bearer ")) {
            token = authHeader.split(" ")[1];
        } else if (cookieToken) {
            token = cookieToken;
        }
        
        if (!token) {
            return res.status(401).json({ 
                message: "Access denied. No token provided.",
                expired: false
            });
        }
        
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

export const validateSuperAdminTokenMiddleware = (req, res, next) => {
    try {
        let token = req.cookies.accessToken || req.headers["authorization"]?.split(" ")[1];
        
        if(!token) return res.status(401).json({message: "Token not found"});
        
        jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
            if(err) return res.status(403).json({message: "Invalid token"});
            req.user = decoded;
            next();
        });
    } catch (error) {
        console.error("Super admin token validation error:", error);
        return res.status(500).json({message: "Token validation error"});
    }
}