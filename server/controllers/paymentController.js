import Stripe from "stripe";

import { catchAsyncErrors } from "../middlewares/catchAsyncError.js";
import database from "../database/db.js";

export const payment = catchAsyncErrors(async (req, res, next) => {
    const sig = req.headers["stripe-signature"];
    let event;
    try {
        console.log("Stripe webhook secret: ", process.env.STRIPE_WEBHOOK_SECRET)
        event = Stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (error) {
        return res.status(400).send(`Webhook Error: ${error.message || error}`);
    }

    if (event.type === "payment_intent_succeeded") {
        const paymentIntent_client_secret = event.data.object.client_secret;
        try {
            // FINDING AND UPDATED PAYMENT
            const updatedPaymentStatus = "Paid";
            const paymentTableUpdateResult = await database.query(
                `
                    UPDATE payments SET payment_status = $1 WHERE payment_intent_id = $2 RETURNING *
                `,
                [updatedPaymentStatus, paymentIntent_client_secret]
            );

            await database.query(
                `UPDATE orders SET paid_at = NOW() WHERE id = $1 RETURNING *`,
                [paymentTableUpdateResult.rows[0].order_id]
            );

            // Reduce Stock For Each Product
            const orderId = paymentTableUpdateResult.rows[0].order_id;

            const { rows: orderedItems } = await database.query(
                `
                    SELECT product_id, quantity FROM order_items WHERE order_id = $1
                `,
                [orderId]
            );

            // For each ordered item, reduce the product stock
            for (const item of orderedItems) {
                await database.query(
                    `UPDATE products SET stock = stock - $1 WHERE id = $2`,
                    [item.quantity, item.product_id]
                );
            }
        } catch (error) {
            return res.status(500).send(`Error updating paid_at timestamp in orders table.`);
        }
    }   
    
    res.status(200).send({ received: true });                                                                    
});