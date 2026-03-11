import express from "express";
import * as paymentController from "../controllers/paymentController.js";
import { isAuthenticatedUser, authorizeRoles  } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/webhook", express.raw({ type: "application/json" }), paymentController.payment);

export default router;