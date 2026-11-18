import dotenv from 'dotenv';

// Load environment variables FIRST before any other imports
dotenv.config();

import express from 'express';
import { createServer } from 'http';
import type { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import redisService from './config/redis';
import { SocketController } from './controllers/socket.controller';
import { TimerService } from './services/timer.service';
import { logger } from './utils/logger';

function parseCorsOrigins(raw?: string): string | string[] {
  const value = raw || 'http://localhost:3000';
  const origins = value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return origins.length <= 1 ? origins[0] || 'http://localhost:3000' : origins;
}

export function createAppServer(): { app: express.Express; httpServer: HttpServer; io: Server } {
  const corsOrigin = parseCorsOrigins(process.env.CORS_ORIGIN);

  const app = express();
  app.disable('x-powered-by');

  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: corsOrigin,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    upgradeTimeout: 30000,
    maxHttpBufferSize: 1e5, // 100 KB cap for card game messages
    transports: ['websocket', 'polling'],
  });

  app.use(
    cors({
      origin: corsOrigin,
      credentials: true,
    })
  );
  app.use(express.json({ limit: '100kb' }));

  app.get('/', (_req, res) => {
    res.json({ service: 'crazy-card-game-backend', status: 'running' });
  });

  // Liveness endpoint (process is alive)
  const livenessHandler = (_req: express.Request, res: express.Response) => {
    res.status(200).json({
      status: 'ok',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  };
  app.get('/health', livenessHandler);
  app.get('/health/live', livenessHandler);

  // Readiness endpoint (verifies backing store connectivity)
  app.get('/health/ready', async (_req, res) => {
    const storeHealthy = await redisService.ping();
    const mode = redisService.getMode();

    if (!storeHealthy) {
      res.status(503).json({
        status: 'not_ready',
        store: mode,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    res.status(200).json({
      status: 'ready',
      store: mode,
      timestamp: new Date().toISOString(),
    });
  });

  SocketController.setupSocketHandlers(io);

  return { app, httpServer, io };
}

async function startServer(): Promise<void> {
  const { httpServer, io } = createAppServer();
  const port = Number(process.env.PORT || 3001);

  try {
    await redisService.connect();

    httpServer.listen(port, () => {
      logger.info('Server started', {
        port,
        corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
        storeMode: redisService.getMode(),
      });
    });

    const shutdown = async (signal: string) => {
      logger.info('Shutdown signal received', { signal });
      TimerService.clearAllTimers();
      io.close();
      await redisService.disconnect();
      httpServer.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => {
      void shutdown('SIGTERM');
    });
    process.on('SIGINT', () => {
      void shutdown('SIGINT');
    });
  } catch (error) {
    logger.error('Failed to start server', {
      error: error instanceof Error ? error : String(error),
    });
    process.exit(1);
  }
}

if (require.main === module) {
  void startServer();
}
