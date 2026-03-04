import nodemailer from 'nodemailer';

export const sendEmail = async ({ email, subject, message }) => {

    // Create a transporter using SMTP configuration from environment variables
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        service: process.env.SMTP_SERVICE,
        port: process.env.SMTP_PORT,
        auth: {
            user: process.env.SMTP_MAIL,
            pass: process.env.SMTP_PASSWORD
        },
    });

    // Define the email options
    const mailOptions = {
        from: process.env.SMTP_MAIL,
        to: email,
        subject: subject,
        html: message,
    };

    // Send the email
    await transporter.sendMail(mailOptions);
};