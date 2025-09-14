// utils/notify.js
const Notification = require('../models/Notification');

// Emit to a specific user room
function emitToUser(io, toType, toId, payload) {
  io?.to(`user:${toType}:${String(toId)}`).emit('notification:new', payload);
}

// Optional: broadcast channel for admins (make sure admin clients join this room on login)
function emitToAdmins(io, payload) {
  io?.to('admins').emit('notification:new', payload);
}

// Create and push a notification to a target user
async function createNotification({ toType, toId, event, entityType, entityId, title, message = '', meta = {} }, io) {
  const n = await Notification.create({ toType, toId, event, entityType, entityId, title, message, meta });
  emitToUser(io, toType, toId, {
    id: n.id,
    event,
    entityType,
    entityId: String(entityId),
    title,
    message,
    createdAt: n.createdAt,
    meta,
  });
  return n;
}

// Admin broadcast helper (no persistence per admin user by default)
function notifyAdmins(io, payload) {
  emitToAdmins(io, payload);
}

module.exports = { createNotification, notifyAdmins };
