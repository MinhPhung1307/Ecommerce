import express from "express";
import * as productController from "../controllers/productController.js";
import { isAuthenticatedUser, authorizeRoles  } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/admin/create", isAuthenticatedUser, authorizeRoles("Admin"), productController.createProduct);

export default router;