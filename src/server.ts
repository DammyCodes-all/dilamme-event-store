import { createServer } from 'node:http';
import { createApp } from './app.js';
import { resolveLogFilePath } from './config.js';

const port = Number.parseInt(process.env.PORT ?? '3000', 10);
const app = createApp();
const server = createServer(app);

server.listen(port, () => {
  console.log(`Event store listening on port ${port}`);
  console.log(`Using log file: ${resolveLogFilePath()}`);
});

function shutdown(signal: string) {
  console.log(`Received ${signal}, shutting down`);

  server.close(() => {
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));