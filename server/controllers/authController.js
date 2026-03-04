import ErrorHandler from "../middlewares/errorMiddleware.js";
import { catchAsyncErrors } from "../middlewares/catchAsyncError.js";
import database from "../database/db.js";
import bcrypt from "bcrypt";
import { sendToken } from "../utils/jwtToken.js";

// Register a new user
export const register = catchAsyncErrors(async (req, res, next) => {
    const { name, email, password } = req.body;

    // Validate input
    if (!name || !email || !password) {
        return next(new ErrorHandler("Please provide all required fields", 400));
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
