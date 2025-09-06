// // config/database.js - Sequelize MySQL (Cloud-ready)
// const { Sequelize } = require('sequelize');
// const dotenv = require('dotenv');

// dotenv.config();

// const sequelize = new Sequelize(
//   process.env.DB_NAME,
//   process.env.DB_USER,
//   process.env.DB_PASS,
//   {
//     host: process.env.DB_HOST,
//     port: Number(process.env.DB_PORT || 3306),
//     dialect: 'mysql',
//     logging: false,
//     dialectOptions: {
//       ssl: {
//         require: true,
//         rejectUnauthorized: false, // required for Aiven SSL
//       },
//     },
//     pool: {
//       max: 10,
//       min: 0,
//       acquire: 30000,
//       idle: 10000,
//     },
//   }
// );

// async function connectDB() {
//   try {
//     await sequelize.authenticate();
//     console.log('✅ MySQL Cloud DB connected');
//   } catch (error) {
//     console.error('❌ Unable to connect to the database:', error);
//   }
// }

// module.exports = { sequelize, connectDB };
// server/config/database.js
const fs = require('fs');
const path = require('path');
const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');

// Force-load the .env located at the repo root (adjust ../.. if your structure differs)
const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

// Log where env was loaded from and show sanitized values (helps diagnose CWD issues)
console.log('ENV file:', envPath);
console.log('📦 DB CONFIG:', {
  env: process.env.NODE_ENV,
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  pass: process.env.DB_PASS ? '********' : 'EMPTY',
  name: process.env.DB_NAME,
  port: process.env.DB_PORT,
});

// Fail fast if required values are missing (prevents "using password: NO")
const required = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASS'];
for (const k of required) {
  if (!process.env[k] || String(process.env[k]).trim() === '') {
    throw new Error(`Missing env ${k} for database connection`);
  }
}

// SSL: Prefer CA for Aiven; fallback to rejectUnauthorized:false if CA not provided
let sslOption = undefined;
const useSSL = (process.env.DB_SSL || 'true').toLowerCase() !== 'false';
const caPath = process.env.DB_SSL_CA_PATH; // absolute path to aiven CA PEM file
if (useSSL) {
  if (caPath && fs.existsSync(caPath)) {
    sslOption = { ca: fs.readFileSync(caPath, 'utf8') }; // secure, verified TLS
  } else {
    sslOption = { require: true, rejectUnauthorized: false }; // temporary fallback
  }
}

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    dialect: 'mysql',
    logging: false,
    dialectOptions: sslOption ? { ssl: sslOption } : {},
    pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
  }
);

async function connectDB() {
  try {
    await sequelize.authenticate();
    console.log('✅ Cloud MySQL DB connected successfully');
  } catch (error) {
    console.error('❌ Unable to connect to the database:', error.message);
  }
}

module.exports = { sequelize, connectDB };
