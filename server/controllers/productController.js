import { v2 as cloudinary } from "cloudinary";

import { catchAsyncErrors } from "../middlewares/catchAsyncError.js";
import ErrorHandler from "../middlewares/errorMiddleware.js";
import database from "../database/db.js";
import { getAIRecommendation } from "../utils/getAIRecommendation.js";

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

// Post a review for a product (Only for users who have purchased the product)
export const postProductReview = catchAsyncErrors(async (req, res, next) => {
    const productId = req.params.id;
    const { rating, comment } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!rating || !comment) {
        return next(new ErrorHandler("Please provide rating and comment", 400));
    }

    // Query to check if user has purchased the product
    const purchaseCheckQuery = `
        SELECT oi.product_id 
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id 
        JOIN payments p ON o.id = p.order_id
        WHERE o.buyer_id = $1 
        AND oi.product_id = $2 
        AND p.payment_status = 'Paid'
        LIMIT 1
    `;

    // Check if user has purchased the product
    const { rows } = await database.query(purchaseCheckQuery, [userId, productId]);
    if (rows.length === 0) {
        return res.status(403).json({
            success: false,
            message: "You can only review products you have purchased"
        });
    }

    // Check if product exists
    const product = await database.query("SELECT * FROM products WHERE id = $1", [productId]);
    if (product.rows.length === 0) {
        return next(new ErrorHandler("Product not found", 404));
    }

    // Check if user has already reviewed the product
    const isAlreadyReviewed = await database.query(
        "SELECT * FROM reviews WHERE user_id = $1 AND product_id = $2",
        [userId, productId]
    );

    // If review exists, update it. Otherwise, create a new review
    let review;
    if (isAlreadyReviewed.rows.length > 0) {
        // Update existing review
        review = await database.query(
            "UPDATE reviews SET rating = $1, comment = $2 WHERE user_id = $3 AND product_id = $4 RETURNING *",
            [rating, comment, userId, productId]
        );
    } else {
        // Create new review
        review = await database.query(
            "INSERT INTO reviews (user_id, product_id, rating, comment) VALUES ($1, $2, $3, $4) RETURNING *",
            [userId, productId, rating, comment]
        );
    }

    // Update product's average rating
    const allReviews = await database.query("SELECT AVG(rating) as avg_rating FROM reviews WHERE product_id = $1", [productId]);
    const newAVGRating = allReviews.rows[0].avg_rating;
    const updateProductRating = await database.query(
        "UPDATE products SET ratings = $1 WHERE id = $2 RETURNING *",
        [newAVGRating, productId]
    );

    // Send response with review and updated product data
    res.status(200).json({
        success: true,
        message: "Review submitted successfully",
        review: review.rows[0],
        product: updateProductRating.rows[0]
    });
});

// Delete a review for a product (Only for the user who posted the review)
export const deleteProductReview = catchAsyncErrors(async (req, res, next) => {
    const productId = req.params.id;
    const userId = req.user.id;
    
    const review = await database.query(
        "DELETE FROM reviews WHERE user_id = $1 AND product_id = $2",
        [userId, productId]
    );
    if (review.rows.length === 0) {
        return next(new ErrorHandler("Review not found", 404));
    }

    // Update product's average rating
    const allReviews = await database.query("SELECT AVG(rating) as avg_rating FROM reviews WHERE product_id = $1", [productId]);
    const newAVGRating = allReviews.rows[0].avg_rating || 0; // If no reviews left, set to 0
    const updateProductRating = await database.query(
        "UPDATE products SET ratings = $1 WHERE id = $2",
        [newAVGRating, productId]
    );
    res.status(200).json({
        success: true,
        message: "Review deleted successfully",
        review: review.rows[0],
        product: updateProductRating.rows[0]
    });
});

// Get AI filtered product recommendations based on user prompt
export const getAIFilteredProducts = catchAsyncErrors(async (req, res, next) => {
    const { userPrompt } = req.body;

    // Validate input
    if (!userPrompt) {
        return next(new ErrorHandler("Please provide a prompt", 400));
    }

    // Function to remove stop words and extract meaningful keywords from the prompt
    const filterKeywords = (query) => {
        const stopWords = new Set([
            "the",
            "they",
            "them",
            "then",
            "I",
            "we",
            "you",
            "he",
            "she",
            "it",
            "is",
            "a",
            "an",
            "of",
            "and",
            "or",
            "to",
            "for",
            "from",
            "on",
            "who",
            "whom",
            "why",
            "when",
            "which",
            "with",
            "this",
            "that",
            "in",
            "at",
            "by",
            "be",
            "not",
            "was",
            "were",
            "has",
            "have",
            "had",
            "do",
            "does",
            "did",
            "so",
            "some",
            "any",
            "how",
            "can",
            "could",
            "should",
            "would",
            "there",
            "here",
            "just",
            "than",
            "because",
            "but",
            "its",
            "it's",
            "if",
            "tôi",
            "chúng tôi",
            "chúng ta",
            "bạn",
            "các bạn",
            "anh",
            "chị",
            "nó",
            "họ",
            "là",
            "một",
            "những",
            "các",
            "của",
            "và",
            "hoặc",
            "để",
            "cho",
            "từ",
            "trên",
            "ai",
            "tại sao",
            "khi",
            "cái nào",
            "với",
            "này",
            "kia",
            "đó",
            "trong",
            "tại",
            "bởi",
            "không",
            "đã",
            "đang",
            "sẽ",
            "có",
            "làm",
            "vì vậy",
            "một vài",
            "bất kỳ",
            "như thế nào",
            "có thể",
            "nên",
            "ở đó",
            "ở đây",
            "chỉ",
            "hơn",
            "bởi vì",
            "nhưng",
            "nếu",
            ".",
            ",",
            "!",
            "?",
            ">",
            "<",
            ";",
            "`",
            "1",
            "2",
            "3",
            "4",
            "5",
            "6",
            "7",
            "8",
            "9",
            "10",
        ]);

        return query
            .toLowerCase()
            .replace(/[^\w\s]/g, "")
            .split(/\s+/)
            .filter((word) => !stopWords.has(word))
            .map((word) => `%${word}%`);
    };

    // Extract keywords from user prompt
    const keyWords = filterKeywords(userPrompt);

    // Query database to find products matching extracted keywords
    const result = await database.query(`
        SELECT * FROM products 
        WHERE name ILIKE ANY($1)
        OR description ILIKE ANY($1)
        OR category ILIKE ANY ($1)
        LIMIT 200;
    `, [keyWords]);
    const filteredProducts = result.rows;
    
    // If no products found from database search
    if (filteredProducts.length === 0) {
        return res.status(200).json({
            success: true,
            message: 'No products found matching your prompt.',
            product: [],
        })
    } 
    
    // Send filtered products to AI to refine recommendations
    const { success, products } = await getAIRecommendation(req, res, userPrompt, filteredProducts);

    // Return AI recommended products to client
    res.status(200).json({
        success: success,
        message: 'AI filtered products.',
        products
    })
});
