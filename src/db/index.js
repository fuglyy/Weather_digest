import { Sequelize } from 'sequelize';

import { dbConfig } from './config.js';

const environment = process.env.NODE_ENV || 'development';
const config = dbConfig[environment] || dbConfig.development;

export const sequelize = new Sequelize(
  config.database,
  config.username,
  config.password,
  {
    host: config.host,
    port: config.port,
    dialect: config.dialect,
    logging: config.logging ?? false,
    pool: config.pool,
    define: {
      underscored: true,
      timestamps: false,
    },
  },
);

export async function connectDatabase() {
  try {
    await sequelize.authenticate();
    console.log('Database connection established.');
    return sequelize;
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    throw error;
  }
}

export default sequelize;
