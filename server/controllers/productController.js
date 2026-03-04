import { v2 as cloudinary } from "cloudinary";

import { catchAsyncErrors } from "../middlewares/catchAsyncError.js";
import ErrorHandler from "../middlewares/errorMiddleware.js";
import database from "../database/db.js";

export const createProduct = catchAsyncErrors(async (req, res, next) => {
    const { name, description, price, category, stock } = req.body;
    const created_by = req.user.id;

    // Validate input
    if (!name || !description || !price || !category || !stock) {
        return next(new ErrorHandler("Please provide complete product details", 400));
    }

    // Handle image uploads
    let uploadedImages = [];
    if (req.files && req.files.images) {
        // Ensure images is an array
        const images = Array.isArray(req.files.images) ? req.files.images : [req.files.images];
        // Upload each image to Cloudinary
        for (const image of images) {
            const result = await cloudinary.uploader.upload(image.tempFilePath, {
                folder: "ecommerce/products",
                width: 150,
                crop: "scale",
            });
            uploadedImages.push({
                public_id: result.public_id,
                url: result.secure_url,
            });
        }   
    }
    
    // Insert product into database
    const product = await database.query(
        "INSERT INTO products (name, description, price, category, stock, images, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
        [name, description, price / 26220, category, stock, JSON.stringify(uploadedImages), created_by]
    );

    // Send response with product data
    res.status(201).json({
        success: true,
        message: "Product created successfully",
        product: product.rows[0]
    });
});
