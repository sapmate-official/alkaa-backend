import e from 'express';
import permissionRouter from './child/permission.router.js';

const router = e.Router();

router.use("/permission/",permissionRouter)


export default router;