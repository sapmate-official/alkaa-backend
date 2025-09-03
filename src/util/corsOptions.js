        export const allowedOrigins = [
    // Development origins
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5000',
    'http://192.168.0.193:5173',
    'http://127.0.0.1:5173',
    'http://192.168.0.158:5174',
    'https://192.168.0.193:5173',
    
    // Production origins - UPDATE THESE TO YOUR ACTUAL PRODUCTION DOMAINS
    "https://www.alkaa.sapmate.com",
    "https://www.alkaa.online",
    "https://api.alkaa.online",
    "https://alkaa.vercel.app",
    "https://alkaa-frontend-test.vercel.app",
    "https://alkaa-admin-test.vercel.app",
    
    // S3 and other services
    'http://sapmate-employee-bucket.s3-website.ap-south-1.amazonaws.com',
    "https://main.dy4iqzhph9mgs.amplifyapp.com",
    
    // Add your production frontend domain here
    process.env.FRONTEND_DOMAIN
].filter(Boolean); // Remove undefined values

export const corsOptions = {
    origin: (origin, callback) => {
        if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
            callback(null, true)
        } else {
            console.log(`CORS blocked origin: ${origin}`); // For debugging
            callback(new Error(`Not allowed by CORS: ${origin}`))
        }
    },
    credentials: true,
    optionsSuccessStatus: 200,
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
    allowedHeaders: "Content-Type,Authorization,X-Requested-With,Cache-Control,Pragma,Accept",
    exposedHeaders: "Content-Length,Content-Type,Authorization"
}