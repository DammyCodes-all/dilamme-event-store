import express from 'express';
import { randomUUID } from 'node:crypto';
import type { EventLogStore, StoredEvent } from './store/event-log.js';

export function createApp(store?: EventLogStore) {
  const app = express();

  app.use(express.json());

  app.get('/health', (_request, response) => {
    response.status(200).json({ ok: true });
  });

  app.post('/events', async (req, res) => {
    if (!store) return res.status(500).json({ error: 'store not initialized' });

    const body = req.body ?? {};
    const event: StoredEvent = {
      ...body,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    } as StoredEvent;

    try {
      await store.appendEvent(event);
      res.status(201).json(event);
    } catch (err) {
      res.status(500).json({ error: 'failed to append event' });
    }
  });

  app.get('/events/:id', async (req, res) => {
    if (!store) return res.status(500).json({ error: 'store not initialized' });

    const id = req.params.id as string;
    const entry = store.getIndexEntry(id);

    if (!entry) return res.status(404).json({ error: 'not found' });

    try {
      const event = await store.readEvent(id);
      if (!event) return res.status(404).json({ error: 'not found' });
      res.json(event);
    } catch (err) {
      res.status(500).json({ error: 'failed to read event' });
    }
  });

  app.get('/stats', (_req, res) => {
    if (!store) return res.json({ total: 0, bytes: 0 });
    res.json(store.getStats());
  });

  return app;
}