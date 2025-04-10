import jwt from "jsonwebtoken";

export default function validateToken(req, res, next) {
    
    let token = req.header("Authorization")?.split(" ")[1];
    console.log("this is the token",token);
    
    if (!token) {
        token = req.cookies.accessToken;
        if (!token) {
            console.log("Access denied. No token provided.");
            return res.status(401).json({ message: "Access denied. No token provided." });
        }
    }

    try {
        console.log(token);
        
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        console.log(decoded);
        
        // Ensure decoded has the required structure
        if (!decoded.id && decoded.userId) {
            decoded.id = decoded.userId; // Map userId to id if that's what's in the token
        }
        
        // Verify that the user ID exists in some form
        if (!decoded.id) {
            console.log("Invalid token: No user ID found in token");
            return res.status(400).json({ message: "Invalid token: Missing user identification." });
        }
        
        req.user = decoded; 
        next(); 
    } catch (error) {
        console.error("Token verification error:", error); // Add this line for error logging
        return res.status(400).json({ message: "Invalid token." });
    }
}
