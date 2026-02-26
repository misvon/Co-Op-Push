import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { handler } from './build/handler.js';
import { webSocketServer } from './src/lib/server/webSocketServer.js';

const app = express();
const server = createServer(app);

// Use the same logic as dev
webSocketServer.configureServer({ httpServer: server });

// SvelteKit handler
app.use(handler);

const port = process.env.PORT || 3000;
server.listen(port, () => {
    console.log(`Production server running on port ${port}`);
});
