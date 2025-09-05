// utils/notify.js
const Notification = require('../models/Notification');

async function createNotification(
  { toType, toId, event, entityType, entityId, title, message = '', meta = {} },
  io
) {
  const n = await Notification.create({ toType, toId, event, entityType, entityId, title, message, meta });
  if (io) {
    io.to(`user:${toType}:${String(toId)}`).emit('notification:new', {
      id: n.id,
      event,
      entityType,
      entityId,
      title,
      message,
      createdAt: n.createdAt,
      meta,
    });
  }
  return n;
}

module.exports = { createNotification };
