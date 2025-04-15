export const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5000',
    'http://192.168.0.193:5173',
    'https://myapp.herokuapp.com',
    'http://127.0.0.1:5173',
    'https://192.168.0.193:5173',
    'http://sapmate-employee-bucket.s3-website.ap-south-1.amazonaws.com',
    "https://main.dy4iqzhph9mgs.amplifyapp.com",
    "https://www.alkaa.sapmate.com",
    "https://www.alkaa.online",
    "https://api.alkaa.online" ,
]

export const corsOptions = {
    origin: (origin, callback) => {
        if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
            callback(null, true)
        } else {
            console.log(`CORS blocked origin: ${origin}`); // Add logging for debugging
            callback(new Error(`Not allowed by CORS: ${origin}`))
        }
    },
    credentials: true,
    optionsSuccessStatus: 200,
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
    allowedHeaders: "Content-Type,Authorization,X-Requested-With,Cache-Control,Pragma,Accept",
    exposedHeaders: "Content-Length,Content-Type,Authorization"
}