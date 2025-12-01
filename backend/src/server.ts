import dotenv from 'dotenv';

// IMPORTANT: Load environment variables FIRST before any other imports
dotenv.config();

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import redisService from './config/redis';
import { SocketController } from './controllers/socket.controller';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 60000, // 60 seconds
  pingInterval: 25000, // 25 seconds
  upgradeTimeout: 30000, // 30 seconds
  maxHttpBufferSize: 1e8, // 100 MB
  transports: ['websocket', 'polling'],
  allowEIO3: true, // compatibility
});

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
}));
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Welcome to the Card Game Server!');
});
// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Setup Socket.IO handlers
SocketController.setupSocketHandlers(io);

const PORT = process.env.PORT || 3001;

// Start server
async function startServer() {
  try {
    // Connect to Redis
    await redisService.connect();
    
    // Start HTTP server
    httpServer.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌐 CORS enabled for: ${process.env.CORS_ORIGIN || 'http://localhost:3000'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await redisService.disconnect();
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

startServer();
