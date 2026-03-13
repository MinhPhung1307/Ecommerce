import express from 'express';
import * as orderController from '../controllers/orderController.js';
import { isAuthenticatedUser, authorizeRoles  } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/new", isAuthenticatedUser, orderController.placeNewOrder);
router.get("/details/:id", isAuthenticatedUser, orderController.getOrder);

export default router;