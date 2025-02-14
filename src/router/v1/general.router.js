import express from 'express'
import { setPassword,loginUser, validatetoken, refreshToken, logout,Profiledetails ,updateProfile } from '../../controller/v1/general/general.controller.js'
import validateToken from '../../middleware/validateToken.js'
const router = express.Router()

router.post("/set-password",setPassword)
router.post("/login",loginUser)
router.get("/validate-token",validateToken,validatetoken)
router.post("/refresh-token",refreshToken)
router.post("/logout",logout)
router.get("/profile/:id",Profiledetails)
router.put("/profile/:id",updateProfile)
export default router