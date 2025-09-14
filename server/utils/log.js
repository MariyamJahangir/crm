function pushLog(doc, action, message, byType, byId, meta = {}) {
  doc.logs.push({ action, message, byType, byId, meta });
}
module.exports = { pushLog };
