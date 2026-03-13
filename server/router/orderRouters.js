import express from 'express';
import * as orderController from '../controllers/orderController.js';
import { isAuthenticatedUser, authorizeRoles  } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/new", isAuthenticatedUser, orderController.placeNewOrder);
router.get("/details/:id", isAuthenticatedUser, orderController.getOrder);
router.get("/my-order", isAuthenticatedUser, orderController.getMyOrders);
router.get("/admin/getall", isAuthenticatedUser, authorizeRoles("Admin"), orderController.getAllOrders);
router.put("/admin/update/:id", isAuthenticatedUser, authorizeRoles("Admin"), orderController.updateOrderStatus);

export default router;