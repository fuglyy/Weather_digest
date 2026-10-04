import { app } from './app.js';
import { config } from './config.js';
import { connectDatabase, sequelize } from './db/index.js';
import { authService } from './services/authService.js';

async function startServer() {
  try {
    if (config.nodeEnv === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
      throw new Error('JWT_SECRET must contain at least 32 characters in production.');
    }
    authService.bootstrapAdmin({
      email: process.env.BOOTSTRAP_ADMIN_EMAIL,
      password: process.env.BOOTSTRAP_ADMIN_PASSWORD,
    });
    if (process.env.USE_POSTGRES === 'true') await connectDatabase();
    const server = app.listen(config.port, () => {
      console.log(`Weather maintenance API is listening on port ${config.port}${process.env.USE_POSTGRES === 'true' ? ' (PostgreSQL)' : ' (JSON storage)'}`);
    });

    let isShuttingDown = false;
    const shutdown = (signal) => {
      if (isShuttingDown) return;
      isShuttingDown = true;
      console.info(JSON.stringify({ level: 'info', event: 'shutdown_started', signal }));
      server.close(async (error) => {
        if (process.env.USE_POSTGRES === 'true') await sequelize.close();
        if (error) {
          console.error(JSON.stringify({ level: 'error', event: 'shutdown_failed', message: error.message }));
          process.exitCode = 1;
        }
      });
    };
    process.once('SIGTERM', () => shutdown('SIGTERM'));
    process.once('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    console.error('Failed to start application. Check PostgreSQL connection settings and Docker status.');
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

startServer();