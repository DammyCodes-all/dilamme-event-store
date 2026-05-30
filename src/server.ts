import { createServer } from "node:http";
import { createApp } from "./app.js";
import { resolveLogFilePath } from "./config.js";
import { EventLogStore } from "./store/event-log.js";

const port = Number.parseInt(process.env.PORT ?? "3000", 10);

async function main() {
  const logFilePath = resolveLogFilePath();
  const { store, recoveredCount } = await EventLogStore.open(logFilePath);
  const app = createApp(store);
  const server = createServer(app);

  console.log(`Recovered ${recoveredCount} events from ${logFilePath}`);

  server.listen(port, () => {
    console.log(`Event store listening on port ${port}`);
    console.log(`Using log file: ${logFilePath}`);
  });

  function shutdown(signal: string) {
    console.log(`Received ${signal}, shutting down`);

    server.close(async () => {
      await store.close();
      process.exit(0);
    });
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error: unknown) => {
  console.error('Failed to start event store', error);
  process.exit(1);
});
