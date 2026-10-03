import { app } from './app.js';
import { config } from './config.js';
import { connectDatabase } from './db/index.js';

async function startServer() {
  try {
    if (process.env.USE_POSTGRES === 'true') await connectDatabase();
    app.listen(config.port, () => {
      console.log(`Weather maintenance API is listening on port ${config.port}${process.env.USE_POSTGRES === 'true' ? ' (PostgreSQL)' : ' (JSON storage)'}`);
    });
  } catch (error) {
    console.error('Failed to start application. Check PostgreSQL connection settings and Docker status.');
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

startServer();