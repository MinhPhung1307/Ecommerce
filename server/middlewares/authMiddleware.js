import jwt from "jsonwebtoken";
import { ErrorHandler } from "../utils/errorHandler.js";
import catchAsyncErrors from "./catchAsyncErrors.js";
import database from "../database/db.js";

export const isAuthenticatedUser = catchAsyncErrors(async (req, res, next) => {
    const { token } = req.cookies;

    // Check if token exists
    if (!token) {
        return next(new ErrorHandler("Please login to access this resource", 401));
    }

    // Verify token and get user info
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    const user = await database.query(
        "SELECT * FROM users WHERE id = $1", 
        [decoded.id]
    );
    if (!user.rows.length) {
        return next(new ErrorHandler("User not found", 404));
    }

    // Attach user info to request object
    req.user = user.rows[0];

    // Proceed to next middleware or route handler
    next();
});

export const authorizeRoles = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return next(new ErrorHandler(`Role (${req.user.role}) is not allowed to access this resource`, 403));
        }
        next();
    };
};