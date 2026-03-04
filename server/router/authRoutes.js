import express from 'express';
import * as authController from '../controllers/authController.js';
import { isAuthenticatedUser } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/me', isAuthenticatedUser, authController.getUser);
router.get('/logout', isAuthenticatedUser, authController.logout);
router.post('/password/forgot', authController.forgotPassword);
router.put('/password/reset/:token', authController.resetPassword);

export default router;