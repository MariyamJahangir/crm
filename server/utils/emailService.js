const nodemailer = require('nodemailer');
const Admin = require('../models/Admin'); // Assuming you have an Admin model

// Create a single, reusable transporter for sending emails
const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});


async function sendEmail(to, subject, html) {
    try {
        await transporter.sendMail({
            from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_USER}>`,
            to: Array.isArray(to) ? to.join(', ') : to,
            subject,
            html,
        });
        console.log(`Email sent successfully to ${to}`);
    } catch (error) {
        console.error(`Failed to send email to ${to}:`, error);
        // In a production environment, you would add more robust logging here.
    }
}

// --- EMAIL TEMPLATES & NOTIFICATION FUNCTIONS ---

// 1. Send OTP for Password Reset (For Admins and Members)
async function sendOTPEmail(email, otp) {
    const subject = 'Your Password Reset Code';
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 20px auto; border: 1px solid #e0e0e0; padding: 30px; border-radius: 8px;">
            <h2 style="color: #333; text-align: center;">Password Reset Request</h2>
            <p>We received a request to reset your password. Use the code below to proceed. This code is valid for 10 minutes.</p>
            <div style="background-color: #f7f7f7; padding: 20px; text-align: center; margin: 20px 0; border-radius: 4px;">
                <h1 style="color: #0056b3; font-size: 36px; margin: 0; letter-spacing: 4px;">${otp}</h1>
            </div>
            <p style="text-align: center; font-size: 12px; color: #888;">If you did not request this, please ignore this email.</p>
        </div>`;
    await sendEmail(email, subject, html);
}

// 2. Welcome Email for New Members
async function notifyUserCreated(member, plainPassword) {
    const subject = 'Welcome to the Team!';
    const html = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
            <h2>Welcome, ${member.name}!</h2>
            <p>Your account has been successfully created in our CRM system.</p>
            <p>You can now log in using your email and the temporary password provided by your administrator:</p>
            <p><strong>Password:</strong> ${plainPassword}</p>
            <p>We strongly recommend changing your password after your first login.</p>
        </div>`;
    await sendEmail(member.email, subject, html);
}

// 3. Notification for New Assignments (Customer, Contact, Lead, Vendor)
async function notifyAssignment(member, entityType, entity) {
    const subject = `New Assignment: A ${entityType} has been assigned to you`;
    const html = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
            <p>Hi ${member.name},</p>
            <p>The ${entityType} '<strong>${entity.companyName || entity.vendorName || entity.name}</strong>' has been assigned to you by an administrator.</p>
            <ul>
                <li><strong>Name:</strong> ${entity.companyName || entity.vendorName || entity.name}</li>
                ${entity.contactPerson ? `<li><strong>Contact:</strong> ${entity.contactPerson}</li>` : ''}
                ${entity.email ? `<li><strong>Email:</strong> ${entity.email}</li>` : ''}
            </ul>
            <p>Please review the new assignment in your dashboard.</p>
        </div>`;
    await sendEmail(member.email, subject, html);
}

// 4. Notification for Lead Updates (Follow-up or Attachment added by Admin)
async function notifyLeadUpdate(member, lead, updateType) {
    const subject = `Update on Lead: ${lead.companyName}`;
    const html = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
            <p>Hi ${member.name},</p>
            <p>An admin has added a new <strong>${updateType}</strong> to your lead for '<strong>${lead.companyName}</strong>'.</p>
        </div>`;
    await sendEmail(member.email, subject, html);
}

// 5. Notification to Admins for a Quote Needing Approval
async function notifyAdminsOfApprovalRequest(quote, lead) {
    const admins = await Admin.findAll({ attributes: ['email'] });
    if (!admins.length) return;

    const subject = `Action Required: Quote #${quote.quoteNumber} Needs Approval`;
    const html = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
            <p>Hello Admin Team,</p>
            <p>A new quote for the lead '<strong>${lead.companyName}</strong>' requires your approval.</p>
            <ul>
                <li><strong>Quote Number:</strong> ${quote.quoteNumber}</li>
                <li><strong>Total Amount:</strong> ${quote.grandTotal}</li>
                <li><strong>Salesperson:</strong> ${quote.salesmanName}</li>
            </ul>
            <p>Please log in to the admin panel to review and take action.</p>
        </div>`;
    await sendEmail(admins.map(a => a.email), subject, html);
}

// 6. Notification to Member about Quote Decision (Approved/Rejected)
async function notifyMemberOfQuoteDecision(member, quote, isApproved) {
    const decision = isApproved ? 'Approved' : 'Rejected';
    const subject = `Update on Quote #${quote.quoteNumber}: It has been ${decision}`;
    const html = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
            <p>Hi ${member.name},</p>
            <p>Your quote '<strong>${quote.quoteNumber}</strong>' has been <strong>${decision}</strong> by an administrator.</p>
            ${!isApproved && quote.rejectNote ? `<p><strong>Reason for Rejection:</strong> ${quote.rejectNote}</p>` : ''}
        </div>`;
    await sendEmail(member.email, subject, html);
}

// 7. Notification to Admins about Success Events (Quote Accepted, Invoice Paid)
async function notifyAdminsOfSuccess(subject, message) {
    const admins = await Admin.findAll({ attributes: ['email'] });
    if (!admins.length) return;
    
    const html = `<div style="font-family: Arial, sans-serif; line-height: 1.6;"><p>${message}</p></div>`;
    await sendEmail(admins.map(a => a.email), subject, html);
}

module.exports = {
    sendOTPEmail,
    notifyUserCreated,
    notifyAssignment,
    notifyLeadUpdate,
    notifyAdminsOfApprovalRequest,
    notifyMemberOfQuoteDecision,
    notifyAdminsOfSuccess,
};
