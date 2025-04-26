import express from 'express'
import { registerEmployee,applyLeave,listLeave,leaveBalance } from '../../controller/v1/employee/employee.controller.js'
import validateToken from '../../middleware/validateToken.js'
import { roleCheckEmployee } from '../../middleware/roleCheck.js'
const router = express.Router()


router.post("/register",registerEmployee)
router.post("/leave/apply",validateToken,roleCheckEmployee,applyLeave)
router.get("/list-of-leave",validateToken,roleCheckEmployee,listLeave)
router.get("/leave-balance",validateToken,roleCheckEmployee,leaveBalance)




router.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
      return res.status(400).json({ error: 'Invalid JSON' })
    }
    next()
  })

export default router 