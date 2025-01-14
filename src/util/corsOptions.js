const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://192.168.0.193:5173',
    'https://myapp.herokuapp.com',
    'http://127.0.0.1:5173',
    'https://192.168.0.193:5173',
    "*"
]

export const corsOptions = {
    origin: (origin, callback) => {
        if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
            callback(null, true)
        } else {
            callback(new Error('Not allowed by CORS'))
        }
    },
    credentials: true,
    optionsSuccessStatus: 200
}