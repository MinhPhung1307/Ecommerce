import { v2 as cloudinary } from "cloudinary";

import { catchAsyncErrors } from "../middlewares/catchAsyncError.js";
import ErrorHandler from "../middlewares/errorMiddleware.js";
import database from "../database/db.js";

// Get all users with pagination (Admin only)
export const getAllUsers = catchAsyncErrors(async (req, res, next) => {
    const page = parseInt(req.query.page) || 1;

    // Count total users with role = "User"
    const totalUserResult = await database.query("SELECT COUNT(*) FROM users WHERE role = $1", ["User"]);

    // Convert count result from string to number
    const totalUsers = parseInt(totalUserResult.rows[0].count);
    
    // Calculate offset for pagination (10 users per page)
    const offset = (page - 1) * 10;

    // Query users from database with pagination
    const users = await database.query(
        "SELECT * FROM users WHERE role = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
        ["User", 10, offset]
    );

    // Send response with users data
    res.status(200).json({
        success: true,
        totalUsers,
        currentPage: page,
        users: users.rows,
    });
});

// Delete a user (Admin only)
export const deleteUser = catchAsyncErrors(async (req, res, next) => {
    const userId = req.params.id;

    // Delete user from database and return deleted record
    const deleteUser = await database.query("DELETE FROM users WHERE id = $1 RETURNING *", [userId]);

    // Check if user exists
    if (deleteUser.rows.length === 0) {
        return next(new ErrorHandler("User not found", 404));
    }

    // If avatar exists on Cloudinary, delete it
    const avatar = deleteUser.rows[0].avatar;
    if (avatar?.public_id) {
        await cloudinary.uploader.destroy(avatar.public_id);
    }

    // Send success response
    res.status(200).json({
        success: true,
        message: "User deleted successfully!",
    });
});