import dotenv from 'dotenv';

// Load environment variables FIRST before any other imports
dotenv.config();

import crypto from 'node:crypto';
import express from 'express';
import { createServer } from 'http';
import type { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import redisService from './config/redis';
import { SocketController } from './controllers/socket.controller';
import { TimerService } from './services/timer.service';
import { BlunderService } from './services/blunder.service';
import { logger } from './utils/logger';
import { metrics } from './utils/metrics';

function parseCorsOrigins(raw?: string): string | string[] {
  const value = raw || 'http://localhost:3000';
  const origins = value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return origins.length <= 1 ? origins[0] || 'http://localhost:3000' : origins;
}

function isMetricsAuthorized(req: express.Request): boolean {
  const configuredToken = process.env.METRICS_TOKEN;
  if (!configuredToken) {
    return true;
  }
  const authHeader = req.header('authorization') || '';
  const prefix = 'Bearer ';
  if (!authHeader.startsWith(prefix)) {
    return false;
  }
  const provided = authHeader.slice(prefix.length);
  const expectedBuf = Buffer.from(configuredToken, 'utf8');
  const providedBuf = Buffer.from(provided, 'utf8');
  if (expectedBuf.length !== providedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

export function createAppServer(): { app: express.Express; httpServer: HttpServer; io: Server } {
  const corsOrigin = parseCorsOrigins(process.env.CORS_ORIGIN);

  const app = express();
  app.disable('x-powered-by');
  if (process.env.TRUST_PROXY === 'true') {
    app.set('trust proxy', 1);
  }

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

  // Readiness endpoint (verifies backing store connectivity and reports operational summary)
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

    const pendingBlunderTimers = await BlunderService.getPendingDeadlineCount();
    res.status(200).json({
      status: 'ready',
      store: mode,
      activeConnections: metrics.getActiveConnections(),
      pendingBlunderTimers,
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });

  // Operational metrics endpoint (Prometheus exposition format by default, JSON when requested)
  app.get('/metrics', (req, res) => {
    if (!isMetricsAuthorized(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (req.accepts(['text/plain', 'application/json']) === 'application/json') {
      res.status(200).json(metrics.snapshot());
      return;
    }

    res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.status(200).send(metrics.toPrometheusText());
  });

  SocketController.setupSocketHandlers(io);

  return { app, httpServer, io };
}

async function startServer(): Promise<void> {
  const { httpServer, io } = createAppServer();
  const port = Number(process.env.PORT || 3001);

  try {
    await redisService.connect();

    // Recover any durable blunder deadlines persisted before restart and keep sweeping
    BlunderService.startRecoverySweeper(io);

    httpServer.listen(port, () => {
      logger.info('Server started', {
        port,
        corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
        storeMode: redisService.getMode(),
        redisMandatory: redisService.isRedisMandatory(),
      });
    });

    const shutdown = async (signal: string) => {
      logger.info('Shutdown signal received', { signal });
      BlunderService.stopRecoverySweeper();
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
