import { v2 as cloudinary } from "cloudinary";

import { catchAsyncErrors } from "../middlewares/catchAsyncError.js";
import ErrorHandler from "../middlewares/errorMiddleware.js";
import database from "../database/db.js";

// Create a new product
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

// Get all products with filtering, pagination, and search
export const getAllProducts = catchAsyncErrors(async (req, res, next) => {
    const { availability, price, category, ratings, search } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit; // number of products overlooked

    // Build dynamic query based on filters
    const conditions = [];
    const values = [];
    let index = 1;

    let paginationPlaceholders = {};

    // Filter by availability
    if (availability == "in-stock") {
        conditions.push(`stock > 5`);
    } else if (availability == "limited") {
        conditions.push(`stock > 0 AND stock <= 5`);
    } else if (availability == "out-of-stock") {
        conditions.push(`stock = 0`);
    } 

    // Filter by price range
    if (price) {
        const [minPrice, maxPrice] = price.split("-");
        if (minPrice && maxPrice) {
            conditions.push(`price BETWEEN $${index} AND $${index + 1}`);
            values.push(minPrice, maxPrice);
            index += 2;
        }
    }

    // Filter by category
    if (category) {
        conditions.push(`category LIKE $${index}`);
        values.push(`%${category}%`);
        index++;
    }

    // Filter by ratings
    if (ratings) {
        conditions.push(`ratings >= $${index}`);
        values.push(ratings);
        index++;
    }

    // Search by name or description
    if (search) {
        conditions.push(`(p.name ILIKE $${index} OR p.description ILIKE $${index})`);
        values.push(`%${search}%`);
        index++;
    }

    // Combine conditions into a single WHERE clause
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Get total count of products for pagination
    const totalProductsResult = await database.query(`SELECT COUNT(*) FROM products p ${whereClause}`, values);
    const totalProducts = parseInt(totalProductsResult.rows[0].count);

    // Add limit for pagination
    paginationPlaceholders.limit = `$${index}`;
    values.push(limit);
    index++;

    // Add offset for pagination
    paginationPlaceholders.offset = `$${index}`;
    values.push(offset);
    index++;

    // Main query to get products with review count
    const query = `
        SELECT p.*, 
        COUNT(r.id) AS review_count 
        FROM products p LEFT JOIN 
        reviews r ON p.id = r.product_id 
        ${whereClause} 
        GROUP BY p.id 
        ORDER BY p.created_at DESC 
        LIMIT ${paginationPlaceholders.limit} 
        OFFSET ${paginationPlaceholders.offset}
    `;
    const results = await database.query(query, values);

    // Get new products (added in the last 30 days)
    const newProductsQuery = `
        SELECT p.*,
        COUNT(r.id) AS review_count
        FROM products p 
        LEFT JOIN reviews r 
        ON p.id = r.product_id
        WHERE p.created_at >= NOW() - INTERVAL '30 days'
        GROUP BY p.id
        ORDER BY p.created_at DESC
        LIMIT 8
    `;
    const newProductsResult = await database.query(newProductsQuery);

    // Get top-rated products (ratings >= 4.5)
    const topRatedProductsQuery = `
        SELECT p.*,
        COUNT(r.id) AS review_count
        FROM products p 
        LEFT JOIN reviews r 
        ON p.id = r.product_id
        WHERE p.ratings >= 4.5
        GROUP BY p.id
        ORDER BY p.ratings DESC, p.created_at DESC
        LIMIT 8
    `;
    const topRatedProductsResult = await database.query(topRatedProductsQuery);

    res.status(200).json({
        success: true,
        products: results.rows,
        totalProducts,
        newProducts: newProductsResult.rows,
        topRatedProducts: topRatedProductsResult.rows
    });
});

// Update product details (Admin only)
export const updateProduct = catchAsyncErrors(async (req, res, next) => {
    const productId = req.params.id;
    const { name, description, price, category, stock } = req.body;

    // Validate input
    if (!name || !description || !price || !category || !stock) {
        return next(new ErrorHandler("Please provide complete product details", 400));
    }

    // Check if product exists
    const product = await database.query("SELECT * FROM products WHERE id = $1", [productId]);
    if (product.rows.length === 0) {
        return next(new ErrorHandler("Product not found", 404));
    }

    // Update product in database
    const updatedProduct = await database.query(
        "UPDATE products SET name = $1, description = $2, price = $3, category = $4, stock = $5 WHERE id = $6 RETURNING *",
        [name, description, price / 26220, category, stock, productId]
    );

    // Send response with updated product data
    res.status(200).json({
        success: true,
        message: "Product updated successfully",
        updatedProduct: updatedProduct.rows[0]
    });
});

// Delete a product (Admin only)
export const deleteProduct = catchAsyncErrors(async (req, res, next) => {
    const productId = req.params.id;
    
    // Check if product exists
    const product = await database.query("SELECT * FROM products WHERE id = $1", [productId]);
    if (product.rows.length === 0) {
        return next(new ErrorHandler("Product not found", 404));
    }

    const images = product.rows[0].images;

    // Delete product from database
    const deleteResult = await database.query("DELETE FROM products WHERE id = $1", [productId]);
    if (deleteResult.rowCount === 0) {
        return next(new ErrorHandler("Failed to delete product", 500));
    }

    // Delete images from Cloudinary
    if (images && images.length > 0) {
        for (const image of images) {
            await cloudinary.uploader.destroy(image.public_id);
        }
    } 

    res.status(200).json({
        success: true,
        message: "Product deleted successfully"
    });
});

// Get product details by ID
export const getProduct = catchAsyncErrors(async (req, res, next) => {
    const productId = req.params.id;

    // Check if product exists
    const product = await database.query("SELECT * FROM products WHERE id = $1", [productId]);
    if (product.rows.length === 0) {
        return next(new ErrorHandler("Product not found", 404));
    }

    // Fetch product details with reviews and reviewer information
    const result = await database.query(
        `
            SELECT p.*, 
            COALESCE(
            json_agg(
            json_build_object(
                'review_id', r.id,
                'rating', r.rating,
                'comment', r.comment,
                'reviewer', json_build_object(
                    'id', u.id,
                    'name', u.name,
                    'avatar', u.avatar
                )
            )) FILTER (WHERE r.id IS NOT NULL), '[]') AS reviews
            FROM products p
            LEFT JOIN reviews r ON p.id = r.product_id
            LEFT JOIN users u ON r.user_id = u.id
            WHERE p.id = $1
            GROUP BY p.id
        `, [productId]
    );

    res.status(200).json({
        success: true,
        message: "Product fetched successfully",
        product: result.rows[0]
    });
});
