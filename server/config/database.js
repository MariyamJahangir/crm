// config/database.js - Sequelize MySQL (Cloud-ready)
const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');

dotenv.config();

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    dialect: 'mysql',
    logging: false,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false, // required for Aiven SSL
      },
    },
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  }
);

async function connectDB() {
  try {
    await sequelize.authenticate();
    console.log('✅ MySQL Cloud DB connected');
  } catch (error) {
    console.error('❌ Unable to connect to the database:', error);
  }
}

module.exports = { sequelize, connectDB };
