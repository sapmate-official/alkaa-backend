import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { corsOptions } from './src/util/corsOptions.js'
import { fileURLToPath } from "url";
import path from "path";
import { configDotenv } from 'dotenv';
import fs from 'fs'
import ServerlessHttp from 'serverless-http';
// import https from 'https'

configDotenv()
const app = express()
const port = process.env.PORT || 3000

app.use(cors(corsOptions))
app.use(express.json())

app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())
const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
app.use('/', express.static(path.join(dirname, 'public')))


app.use((req, res, next) => {
    console.log(`${req.method} ${req.originalUrl}`);
    next();
  });



  import manager from './src/router/v1/manager.router.js'
  import employee from './src/router/v1/employee.router.js'
  import general from './src/router/v1/general.router.js'
  import leave from './src/router/v1/leave.router.js'
  import attendance from './src/router/v1/attendance.router.js'
  import salary from './src/router/v1/salary.router.js'

app.use("/api/v1/manager/",manager)
app.use("/api/v1/employee/",employee)
app.use("/api/v1/general/",general)
app.use("/api/v1/leave/",leave)
app.use("/api/v1/attendance/",attendance)
app.use("/api/v1/salary/",salary)


import mainV2Router from './src/router/v2/main.router.js'
import mainv3Router from './src/router/v3/main.router.js'
app.use("/api/v2/",mainV2Router)
app.use("/api/v3/",mainv3Router)


app.get('/', (req, res) => {
    res.sendFile(path.join(dirname, 'public', 'interface.html'))
})
// const options = {
//     key: fs.readFileSync("localhost-key.pem"),
//     cert: fs.readFileSync("localhost.pem"),
//   };
app.listen(port,'0.0.0.0', () => {
    console.log(`Server is running on port ${port}`)
})
// https.createServer(options, app).listen(3001, () => {
//     console.log("Server running on https://192.168.0.193:3001");
//   });

// export const handler = ServerlessHttp(app);