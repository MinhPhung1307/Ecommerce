import express from "express";
import * as adminController from "../controllers/adminController.js";
import { isAuthenticatedUser, authorizeRoles  } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get('/get-all-users', isAuthenticatedUser, authorizeRoles("Admin"), adminController.getAllUsers);
router.delete('/delete-user/:id', isAuthenticatedUser, authorizeRoles("Admin"), adminController.deleteUser);

export default router;