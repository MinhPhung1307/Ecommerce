import express from "express";
import * as adminController from "../controllers/adminController.js";
import { isAuthenticatedUser, authorizeRoles  } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.use(isAuthenticatedUser, authorizeRoles("Admin"));

router.get('/get-all-users', adminController.getAllUsers);
router.delete('/delete-user/:id', adminController.deleteUser);
router.get('/dashboard-starts', adminController.dashboardStarts)

export default router;