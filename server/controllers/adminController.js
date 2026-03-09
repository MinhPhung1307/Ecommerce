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

// Get dashboard statistics for admin panel (Admin only)
export const dashboardStarts = catchAsyncErrors(async (req, res,) => {
    // Get today's date
    const today = new Date();
    const todayDate = today.toISOString().split("T")[0];

    // Get yesterday's date
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yesterdayDate = yesterday.toISOString().split("T")[0];

    // Get start and end of the current month
    const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const currentMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    // Get start and end of the previous month
    const previousMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const previousMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

    // Get total revenue of all time (only paid orders)
    const totalRevenueAllTimeQuery = await database.query("SELECT SUM(total_price) FROM orders WHERE paid_at IS NOT NULL");
    const totalRevenueAllTime = parseFloat(totalRevenueAllTimeQuery.rows[0].sum) || 0;

    // Count total users with role "User"
    const totalUsersCountQuery = await database.query("SELECT COUNT(*) FROM users WHERE role = $1", ["User"]);
    const totalUsersCount = parseInt(totalUsersCountQuery.rows[0].count) || 0;

    // Get number of orders by status
    const orderStatusCountsQuery = await database.query(
        `
        SELECT order_status, COUNT(*) FROM orders WHERE paid_at IS NOT NULL GROUP BY order_status
        `);

     // Initialize order status counts
    const orderStatusCounts = {
        Processing: 0,
        Shipped: 0,
        Delivered: 0,
        Cancelled: 0,
    };
    // Map query results to object
    orderStatusCountsQuery.rows.forEach((row) => {
        orderStatusCounts[row.order_status] = parseInt(row.count);
    });

    // Get today's revenue
    const todayRevenueQuery = await database.query(
        `
        SELECT SUM(total_price) FROM orders WHERE created_at::date = $1 AND paid_at IS NOT NULL
        `,
        [todayDate]
    );
    const todayRevenue = parseFloat(todayRevenueQuery.rows[0].sum) || 0;

    // Get yesterday's revenue
    const yesterdayRevenueQuery = await database.query(
        `
        SELECT SUM(total_price) FROM orders WHERE created_at::date = $1 AND paid_at IS NOT NULL  
        `,
        [yesterdayDate]
    );
    const yesterdayRevenue = parseFloat(yesterdayRevenueQuery.rows[0].sum) || 0;

    // Get monthly sales statistics
    const monthlySalesQuery = await database.query(`
        SELECT
        TO_CHAR(created_at, 'Mon YYYY') AS month,
        DATE_TRUNC('month', created_at) as date,
        SUM(total_price) as totalsales
        FROM orders WHERE paid_at IS NOT NULL
        GROUP BY month, date
        ORDER BY date ASC
        `);

    // Format monthly sales data
    const monthlySales = monthlySalesQuery.rows.map((row) => ({
        month: row.month,
        totalsales: parseFloat(row.totalsales) || 0,
    }));

    // Get top 5 best selling products
    const topSellingProductsQuery = await database.query(`
        SELECT p.name,
        p.images->0->>'url' AS image,
        p.category,
        p.ratings,
        SUM(oi.quantity) AS total_sold
        FROM order_items oi
        JOIN products p ON p.id = oi.product_id
        JOIN orders o ON o.id = oi.order_id
        WHERE o.paid_at IS NOT NULL
        GROUP BY p.name, p.images, p.category, p.ratings
        ORDER BY total_sold DESC
        LIMIT 5
    `);
    const topSellingProducts = topSellingProductsQuery.rows;

    // Get total sales of the current month
    const currentMonthSalesQuery = await database.query(
        `
        SELECT SUM(total_price) AS total 
        FROM orders 
        WHERE paid_at IS NOT NULL AND created_at BETWEEN $1 AND $2  
        `,
        [currentMonthStart, currentMonthEnd]
    );
    const currentMonthSales = parseFloat(currentMonthSalesQuery.rows[0].total) || 0;

    // Get products with low stock (<= 5 items)
    const lowStockProductsQuery = await database.query("SELECT name, stock FROM products WHERE stock <= 5");
    const lowStockProducts = lowStockProductsQuery.rows;

    // Get last month's revenue
    const lastMonthRevenueQuery = await database.query(
        `
        SELECT SUM(total_price) AS total 
        FROM orders
        WHERE paid_at IS NOT NULL AND created_at BETWEEN $1 AND $2
        `,
        [previousMonthStart, previousMonthEnd]
    );
    const lastMonthRevenue = parseFloat(lastMonthRevenueQuery.rows[0].total) || 0;

    // Calculate revenue growth percentage
    let revenueGrowth = "0%";
    if (lastMonthRevenue > 0) {
        const growthRate =
        ((currentMonthSales - lastMonthRevenue) / lastMonthRevenue) * 100;
        revenueGrowth = `${growthRate >= 0 ? "+" : ""}${growthRate.toFixed(2)}%`;
    }
    // Count new users registered this month
    const newUsersThisMonthQuery = await database.query(
        `
        SELECT COUNT(*) FROM users WHERE created_at >= $1 AND role = 'User'
        `,
        [currentMonthStart]
    );
    const newUsersThisMonth = parseInt(newUsersThisMonthQuery.rows[0].count) || 0;

    // Send dashboard statistics response
    res.status(200).json({
        success: true,
        message: "Dashboard Stats Fetched Successfully",
        totalRevenueAllTime,
        todayRevenue,
        yesterdayRevenue,
        totalUsersCount,
        orderStatusCounts,
        monthlySales,
        currentMonthSales,
        topSellingProducts,
        lowStockProducts,
        revenueGrowth,
        newUsersThisMonth,
    });
});