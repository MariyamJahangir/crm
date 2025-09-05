const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

dotenv.config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendOTPEmail(email, otp, subject = 'Password Reset') {
  try {
    const mailOptions = {
      from: `"Your App" <${process.env.EMAIL_USER}>`,
      to: email,
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; padding: 20px; border-radius: 8px;">
          <h2 style="color: #3B82F6; text-align: center;">Your One-Time Password</h2>
          <p>Please use the following code to complete your action. This code is valid for 10 minutes.</p>
          <div style="background: #f3f4f6; padding: 20px; text-align: center; margin: 20px 0; border-radius: 4px;">
            <h1 style="color: #3B82F6; font-size: 36px; margin: 0; letter-spacing: 4px;">${otp}</h1>
          </div>
          <p>If you didn't request this, please ignore this email.</p>
        </div>
      `,
    };
    await transporter.sendMail(mailOptions);
    return true;
  } catch (err) {
    console.error('Email sending failed:', err);
    return false;
  }
}

async function sendLeadAssigned(email, leadUniqueNumber, customerName) {
  try {
    await transporter.sendMail({
      from: `"Your App" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `New Lead Assigned #${leadUniqueNumber}`,
      html: `<p>You have been assigned a new lead #${leadUniqueNumber} for ${customerName}.</p>`
    });
  } catch (err) {
    console.error('Lead assignment email failed:', err);
  }
}

module.exports = { sendOTPEmail, sendLeadAssigned };
