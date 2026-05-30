import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { EventLogStore } from '../src/store/event-log.js';
import { createApp } from '../src/app.js';

describe('restart integration', () => {
  it('persists events to the log and recovers them after restart', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ev-'));
    const filePath = join(dir, 'events.log');

    const { store } = await EventLogStore.open(filePath);
    const app1 = createApp(store);

    const ids: string[] = [];

    for (let i = 0; i < 3; i++) {
      const res = await request(app1).post('/events').send({ seq: i, msg: `event ${i}` });
      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      ids.push(res.body.id as string);
    }

    await store.close();

    const { store: reopened, recoveredCount } = await EventLogStore.open(filePath);
    expect(recoveredCount).toBe(3);

    const app2 = createApp(reopened);

    for (const id of ids) {
      const res = await request(app2).get(`/events/${id}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(id);
    }

    await reopened.close();
    await rm(dir, { recursive: true, force: true });
  }, 20000);
});
