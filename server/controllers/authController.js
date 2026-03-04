import bcrypt from "bcrypt";
import crypto from "crypto";

import ErrorHandler from "../middlewares/errorMiddleware.js";
import { catchAsyncErrors } from "../middlewares/catchAsyncError.js";
import database from "../database/db.js";
import { sendToken } from "../utils/jwtToken.js";
import { generateResetPasswordToken } from "../utils/generateResetPasswordToken.js";
import { generateForgotPasswordEmailTemplate } from "../utils/generateForgotPasswordEmailTemplate.js";
import { sendEmail } from '../utils/sendEmail.js';

// Register a new user
export const register = catchAsyncErrors(async (req, res, next) => {
    const { name, email, password } = req.body;

    // Validate input
    if (!name || !email || !password) {
        return next(new ErrorHandler("Please provide all required fields", 400));
    }

    // Validate password length
    if (password.length < 6 || password.length > 20) {
        return next(new ErrorHandler("Password must be between 6 and 20 characters", 400));
    }

    // Check if user already exists
    const isAlreadyRegistered = await database.query(
        "SELECT * FROM users WHERE email = $1", 
        [email]
    );
    if (isAlreadyRegistered.rows.length > 0) {
        return next(new ErrorHandler("User already registered with this email", 400));
    }

    // Hash the password and save the user
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user into database
    const user = await database.query(
        "INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING *", 
        [name, email, hashedPassword]
    );

    // Send response with user data (excluding password)
    res.status(201).json({
        success: true,
        user: user.rows[0]
    });

    // Send token to client
    sendToken(user.rows[0], 201, "User registered successfully", res);

});

// Login user
export const login = catchAsyncErrors(async (req, res, next) => {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
        return next(new ErrorHandler("Please provide email and password", 400));
    }
    
    // Check if user exists
    const user = await database.query(
        "SELECT * FROM users WHERE email = $1", 
        [email]
    );
    if (user.rows.length === 0) {
        return next(new ErrorHandler("Invalid email or password", 401));
    }

    // Compare password
    const isPasswordMatched = await bcrypt.compare(password, user.rows[0].password);
    if (!isPasswordMatched) {
        return next(new ErrorHandler("Invalid email or password", 401));
    }

    // Send token to client
    sendToken(user.rows[0], 200, "User logged in successfully", res);
});

// Get currently logged in user
export const getUser = catchAsyncErrors(async (req, res, next) => {
    const user = req.user;

    // Send user data to client
    res.status(200).json({
        success: true,
        user,
    });
});

// Logout user
export const logout = catchAsyncErrors(async (req, res, next) => {
    // Clear the token cookie and send response
    res.status(200).cookie("token", null, {
        expires: new Date(Date.now()),
        httpOnly: true,
    }).json({
        success: true,
        message: "User logged out successfully",
    });
});

// Forgot password - send reset password email to user
export const forgotPassword = catchAsyncErrors(async (req, res, next) => {
    const { email } = req.body;
    const { frontendUrl } = req.query;

    // Check if user exists
    let userResult = await database.query(
        "SELECT * FROM users WHERE email = $1", 
        [email]
    );
    if (userResult.rows.length === 0) {
        return next(new ErrorHandler("User not found with this email", 404));
    }

    // Get the user data
    const user = userResult.rows[0]; 

    // Generate reset password token and expiration time
    const { hashedToken, resetPasswordExpireTime, resetToken } = generateResetPasswordToken();

    // Update user with reset token and expiration time
    await database.query(
        "UPDATE users SET reset_password_token = $1, reset_password_expire = to_timestamp($2) WHERE email = $3",
        [hashedToken, resetPasswordExpireTime / 1000, email]
    );

    // Create reset password URL
    const resetPasswordUrl = `${frontendUrl}/password/reset/${resetToken}`;

    // Generate email template
    const message = generateForgotPasswordEmailTemplate(user.name, resetPasswordUrl);

    // Send email and handle potential errors
    try {
        // Send email to user with reset password link
        await sendEmail({
            email: user.email,
            subject: "Ecommerce Password Recovery",
            message,
        });
        res.status(200).json({
            success: true,            
            message: `Email sent to ${user.email} successfully`,
        })
    } catch (error) {
        // Clear reset token and expiration time from database if email sending fails
        await database.query(
            "UPDATE users SET reset_password_token = NULL, reset_password_expire = NULL WHERE email = $1",
            [email]
        );
        return next(new ErrorHandler("Failed to send email. Please try again later.", 500));
    }
});

// Reset password - update user's password using reset token
export const resetPassword = catchAsyncErrors(async (req, res, next) => {
    const { token } = req.params;
    const resetPasswordToken = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with matching reset token and valid expiration time
    const user = await database.query(
        "SELECT * FROM users WHERE reset_password_token = $1 AND reset_password_expire > NOW()",
        [resetPasswordToken]
    );
    if (user.rows.length === 0) {
        return next(new ErrorHandler("Invalid or expired password reset token", 400));
    }

    // Validate new password and confirm password
    if (req.body.password !== req.body.confirmPassword) {
        return next(new ErrorHandler("Password and confirm password do not match", 400));
    }

    // Validate password length
    if (
        req.body.password?.length < 6 || 
        req.body.password?.length > 20 || 
        req.body.confirmPassword?.length < 6 || 
        req.body.confirmPassword?.length > 20
    ) {
        return next(new ErrorHandler("Password must be between 6 and 20 characters", 400));
    }

    // Hash the new password and update user in database
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    const updatedUser = await database.query(
        "UPDATE users SET password = $1, reset_password_token = NULL, reset_password_expire = NULL WHERE id = $2 RETURNING *",
        [hashedPassword, user.rows[0].id]
    );

    // Send token to client
    sendToken(updatedUser.rows[0], 200, "Password reset successful", res);
});
