import { createReadStream } from "node:fs";
import { access, mkdir, open, type FileHandle } from "node:fs/promises";
import { dirname } from "node:path";
import { createInterface } from "node:readline/promises";

export interface EventIndexEntry {
  offset: number;
  length: number;
}

export interface StoredEvent extends Record<string, unknown> {
  id: string;
  createdAt: string;
}

export interface EventStoreStats {
  total: number;
  bytes: number;
}

export class EventLogStore {
  private readonly index = new Map<string, EventIndexEntry>();
  private appendHandle: FileHandle | null = null;
  private total = 0;
  private bytes = 0;

  private constructor(private readonly filePath: string) {}

  static async open(filePath: string) {
    const store = new EventLogStore(filePath);
    const recoveredCount = await store.initialize();

    return { store, recoveredCount };
  }

  getStats(): EventStoreStats {
    return {
      total: this.total,
      bytes: this.bytes,
    };
  }

  getIndexEntry(eventId: string): EventIndexEntry | undefined {
    return this.index.get(eventId);
  }

  async appendEvent(event: StoredEvent): Promise<EventIndexEntry> {
    this.ensureReady();

    const serializedEvent = `${JSON.stringify(event)}\n`;
    const payload = Buffer.from(serializedEvent, "utf8");
    const offset = this.bytes;
    const length = payload.byteLength;
    const { bytesWritten } = await this.appendHandle!.write(
      payload,
      0,
      length,
      null,
    );

    if (bytesWritten !== length) {
      throw new Error("Failed to append full event payload");
    }

    const entry = { offset, length };

    this.index.set(event.id, entry);
    this.total += 1;
    this.bytes += bytesWritten;

    return entry;
  }

  async readEvent(eventId: string): Promise<StoredEvent | null> {
    const entry = this.index.get(eventId);

    if (!entry) {
      return null;
    }

    const fileHandle = await open(this.filePath, "r");

    try {
      const buffer = Buffer.alloc(entry.length);
      const { bytesRead } = await fileHandle.read(
        buffer,
        0,
        entry.length,
        entry.offset,
      );

      if (bytesRead !== entry.length) {
        throw new Error(`Could not read full event at offset ${entry.offset}`);
      }

      return JSON.parse(buffer.toString("utf8")) as StoredEvent;
    } finally {
      await fileHandle.close();
    }
  }

  async close(): Promise<void> {
    if (!this.appendHandle) {
      return;
    }

    await this.appendHandle!.close();
    this.appendHandle = null;
  }

  private async initialize(): Promise<number> {
    const parentDir = dirname(this.filePath);

    if (parentDir && parentDir !== "/") {
      try {
        await mkdir(parentDir, { recursive: true });
      } catch (err: unknown) {
        const e = err as { code?: string; message?: string };
        if (e.code === "EACCES") {
          throw new Error(
            `Permission denied while creating directory ${parentDir}. Please choose a writable EVENTS_LOG_PATH or run with appropriate permissions.`,
          );
        }
        throw err;
      }
    }

    const recoveredCount = await this.rebuildIndexFromLog();
    this.appendHandle = await open(this.filePath, "a");

    return recoveredCount;
  }

  private async rebuildIndexFromLog(): Promise<number> {
    try {
      await access(this.filePath);
    } catch {
      this.index.clear();
      this.total = 0;
      this.bytes = 0;

      return 0;
    }

    this.index.clear();
    this.total = 0;
    this.bytes = 0;

    const fileStream = createReadStream(this.filePath, { encoding: "utf8" });
    const lineReader = createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });
    let offset = 0;

    for await (const line of lineReader) {
      if (line.length === 0) {
        continue;
      }

      const event = JSON.parse(line) as StoredEvent;
      const length = Buffer.byteLength(line, "utf8") + 1;

      this.index.set(event.id, { offset, length });
      offset += length;
      this.total += 1;
      this.bytes = offset;
    }

    return this.total;
  }

  private ensureReady(): void {
    if (!this.appendHandle) {
      throw new Error("Event log store is not initialized");
    }
  }
}
