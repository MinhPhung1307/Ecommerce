import express from "express";
import * as productController from "../controllers/productController.js";
import { isAuthenticatedUser, authorizeRoles  } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/admin/create", isAuthenticatedUser, authorizeRoles("Admin"), productController.createProduct);
router.get("/", productController.getAllProducts);
router.put("/admin/update/:id", isAuthenticatedUser, authorizeRoles("Admin"), productController.updateProduct);
router.delete("/admin/delete/:id", isAuthenticatedUser, authorizeRoles("Admin"), productController.deleteProduct);

export default router;