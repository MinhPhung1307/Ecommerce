import { config } from "dotenv";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import fileUpload from "express-fileupload";

import { createTables } from "./utils/createTable.js";
import { errorMiddleware } from "./middlewares/errorMiddleware.js";
import authRoutes from "./router/authRoutes.js";
import productRoutes from "./router/productRoutes.js";
import adminRoutes from "./router/adminRoutes.js";
import paymentRoutes from "./router/paymentRoutes.js";

const app = express();

config({ path: './config/config.env' }); 

app.use(cors({
    origin: [process.env.FRONTEND_URL, process.env.DASHBOARD_URL],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));

app.use('/api/v1/payment', paymentRoutes);

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(fileUpload({
    tempFileDir: './uploads',
    useTempFiles: true,
}));

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/product', productRoutes);
app.use('/api/v1/admin', adminRoutes);

createTables();

app.use(errorMiddleware);

export default app;