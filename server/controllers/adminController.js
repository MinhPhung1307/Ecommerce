import { catchAsyncErrors } from "../middlewares/catchAsyncError.js";
import ErrorHandler from "../middlewares/errorMiddleware.js";
import database from "../database/db.js";

// Get all users with pagination
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