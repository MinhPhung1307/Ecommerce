import crypto from 'crypto';

export const generateResetPasswordToken = () => {
    // Generate a random token and hash it before saving to the database
    const resetToken = crypto.randomBytes(20).toString('hex');

    // Hash the token and set it to resetPasswordToken field
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Set token expire time (e.g., 15 minutes from now)
    const resetPasswordExpireTime = Date.now() + 15 * 60 * 1000; // Token expires in 15 minutes

    // Return the plain reset token (to be sent to the user) and the hashed token (to be stored in the database)
    return { resetToken, hashedToken, resetPasswordExpireTime };
}