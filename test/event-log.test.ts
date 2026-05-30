import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { EventLogStore } from '../src/store/event-log.js';

let tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirectories.map(async (directory) => {
      await rm(directory, { recursive: true, force: true });
    }),
  );

  tempDirectories = [];
});

describe('EventLogStore', () => {
  it('rebuilds the index from an existing log file', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'event-log-'));
    tempDirectories.push(directory);
    const filePath = join(directory, 'events.log');
    const firstEvent = {
      id: randomUUID(),
      createdAt: '2026-05-30T00:00:00.000Z',
      message: 'hello',
    };
    const secondEvent = {
      id: randomUUID(),
      createdAt: '2026-05-30T00:01:00.000Z',
      message: 'unicode: café 🚀',
    };

    await Promise.all([
      import('node:fs/promises').then(({ writeFile }) =>
        writeFile(filePath, `${JSON.stringify(firstEvent)}\n${JSON.stringify(secondEvent)}\n`),
      ),
    ]);

    const { store, recoveredCount } = await EventLogStore.open(filePath);

    expect(recoveredCount).toBe(2);
    expect(store.getStats()).toEqual({ total: 2, bytes: expect.any(Number) });
    await expect(store.readEvent(firstEvent.id)).resolves.toMatchObject(firstEvent);
    await expect(store.readEvent(secondEvent.id)).resolves.toMatchObject(secondEvent);

    await store.close();
  });

  it('appends events and reads them back by id', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'event-log-'));
    tempDirectories.push(directory);
    const filePath = join(directory, 'events.log');
    const { store } = await EventLogStore.open(filePath);
    const event = {
      id: randomUUID(),
      createdAt: '2026-05-30T00:02:00.000Z',
      title: 'phase two',
      details: 'append-only works',
    };

    await store.appendEvent(event);

    expect(store.getIndexEntry(event.id)).toMatchObject({ offset: 0 });
    expect(store.getStats()).toEqual({ total: 1, bytes: expect.any(Number) });
    await expect(store.readEvent(event.id)).resolves.toEqual(event);

    const logFileContents = await readFile(filePath, 'utf8');

    expect(logFileContents).toBe(`${JSON.stringify(event)}\n`);

    await store.close();
  });
});