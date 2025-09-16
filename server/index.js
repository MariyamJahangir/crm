// server.js
const express = require('express');
const http = require('http');
const cors = require('cors');
const dotenv = require('dotenv');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const path = require('path');
dotenv.config();
const contactsRouter = require('./routes/contacts');
const { connectDB, sequelize } = require('./config/database');
const { applyAssociations } = require('./models/associations');
const followupRoutes=require('./routes/followups.sql')
const authRoutes = require('./routes/auth.sql');
const leadsRoutes = require('./routes/leads.sql');
const teamRoutes = require('./routes/team.sql');
const customersRoutes = require('./routes/customers.sql');
const notificationsRoutes = require('./routes/notifications.sql');
const quoteRoutes = require('./routes/quote.sql');
const quotePdf = require('./routes/quotes.pdf');
const chatRoutes = require('./routes/chat.sql');
const vendorsRoutes = require('./routes/vendors.sql');
const Admin = require('./models/Admin');
const leadsSearch = require('./routes/leads.search.sql');
const invoiceRoutes= require('./routes/invoices.sql')
const app = express();
const server = http.createServer(app);
const dealsRouter = require('./routes/deals.sql');
const reportRouter = require('./routes/reports')


// CORS for API
const allowedOrigins = [
  process.env.FRONTEND_ORIGIN,      
  process.env.FRONTEND_ORIGIN_PROD,  
  'http://127.0.0.1:5173',
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

async function seedAdmins() {
  const bcrypt = require('bcryptjs');
  const seedJson = process.env.ADMIN_SEED_JSON;
  if (!seedJson) return;
  let items = [];
  try { items = JSON.parse(seedJson); } catch { console.warn('Invalid ADMIN_SEED_JSON'); return; }
  for (const it of items) {
    if (!it?.email || !it?.name || !it?.password) continue;
    const exists = await Admin.findOne({ where: { email: it.email }, attributes: ['id'] });
    if (!exists) {
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(it.password, salt);
      await Admin.create({ name: it.name, email: it.email, password: hash, isVerified: true });
      console.log('Seeded admin', it.email);
    }
  }
}

(async () => {
  try {
    applyAssociations();
    await connectDB();
    if (process.env.DB_SYNC === 'true') {
      await sequelize.sync({ alter: true });
      console.log('Sequelize synced');
    }
    await seedAdmins();

    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

    // Socket.IO with CORS matching the frontend and auth via handshake.auth
    const io = new Server(server, {
      cors: { origin: allowedOrigins, credentials: true },
      path: '/socket.io',
    });
    app.set('io', io);

    // Recommended: authenticate with io.use reading socket.handshake.auth
    io.use((socket, next) => {
      const token = socket.handshake?.auth?.token;
      if (!token) return next(new Error('no token'));
      jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return next(new Error('invalid token'));
        socket.request.user = decoded;
        next();
      });
    });


    io.on('connection', (socket) => {
     
      socket.conn.on('upgrade', () => {
        console.log('upgraded to:', socket.conn.transport.name);
      });

      const user = socket.request?.user;
      if (!user) {
        socket.disconnect(true);
        return;
      }
      const room = `user:${user.subjectType}:${user.subjectId}`;
      socket.join(room);
      if (user.subjectType === 'ADMIN') socket.join('admins');

      socket.on('lead:join', async (leadId) => {
        try {
          const Lead = require('./models/Lead');
          const lead = await Lead.findByPk(leadId);
          if (!lead) return;
          const can = user.subjectType === 'ADMIN' || String(lead.salesmanId) === String(user.subjectId);
          if (can) socket.join(`lead:${leadId}`);
        } catch {}
      });

      socket.on('disconnect', () => {});
    });

    // Routes
    app.use('/api/auth', authRoutes);
    app.use('/api/leads', leadsRoutes);
    app.use('/api/quotes', quoteRoutes);
    app.use('/api/followups', followupRoutes);
    app.use('/api', leadsSearch);
    app.use('/api/quotes', quotePdf);
    app.use('/api/invoices', invoiceRoutes)
    app.use('/api/team', teamRoutes);
    app.use('/api/reports', reportRouter)
    app.use('/api/vendors', vendorsRoutes);
    app.use('/api/customers', customersRoutes);
    app.use('/api/notifications', notificationsRoutes);
    app.use('/api', chatRoutes);
    app.use('/api/deals', dealsRouter);
    app.use('/api/contacts', contactsRouter);
    app.get('/api/health', (req, res) => res.json({ message: 'Server is up and running!' }));

    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => { console.log(`Server running on port ${PORT}`); });
  } catch (e) {
    console.error('Startup error:', e);
    process.exit(1);
  }
})();
