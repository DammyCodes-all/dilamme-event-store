# Append-Only Event Store

Small HTTP event store that uses a newline-delimited JSON append-only log (`events.log`) as the single source of truth and an in-memory index (`Map<id, { offset, length }>`). Built with Node.js, Express and TypeScript.

## Quick setup

Requirements: Node.js (v18+ recommended) and pnpm.

Install:

```bash
pnpm install
```

Run in development (auto-reloads via `tsx`):

```bash
pnpm dev
```

Start normally:

```bash
pnpm start
```

Run tests (unit + integration):

```bash
pnpm test
```

Config:

- The log path can be overridden with `EVENTS_LOG_PATH`. By default the file is `events.log` in the project root.

## API

- `POST /events` — Accepts any JSON body. The server adds `{ id, createdAt }`, appends one JSON object per line to the log, updates the in-memory index, and returns `201` with the stored event.
- `GET /events/:id` — Uses the in-memory index to seek the file at `offset` and `length` and returns the parsed event. Returns `404` when missing.
- `GET /stats` — Returns `{ total, bytes }` describing number of events and total bytes in the log.

Examples:

Write an event:

```bash
curl -s -X POST http://localhost:3000/events \
  -H "Content-Type: application/json" \
  -d '{"user":"alice","action":"signup"}' | jq .
```

Read an event (replace `<id>` with an id returned by POST):

```bash
curl -s http://localhost:3000/events/<id> | jq .
```

Stats:

```bash
curl -s http://localhost:3000/stats | jq .
```

## Architecture

The store has three core components:

- Append-only log (on disk): newline-delimited JSON, `events.log`.
- In-memory index: `Map<id, { offset, length }>` rebuilt from the log on startup.
- HTTP layer (Express) that writes/reads via the in-memory index and file seeks.

## Recovery

On startup the server scans `events.log` line-by-line and rebuilds the in-memory index. You should see a log line like:

```

Recovered `N` events from /path/to/events.log

```

Place a screenshot of that log here (after you run the restart test):

<img width="616" height="242" alt="image" src="https://github.com/user-attachments/assets/2a945c81-d5e4-4ba3-a0fb-b1ba7b0f0d44" />

## Core concepts

- Append-only durability: writes are append-only and atomic at the file-append syscall level; if the process crashes while appending, previous writes remain intact and can be replayed. There are no in-place updates that can leave partial state or require expensive compaction for correctness.
- Index for fast reads: scanning the whole file for every read is O(N). An in-memory index maps IDs to file offsets and byte lengths so reads are O(1) to locate and O(length) to fetch the exact slice.

## What I struggled with

- Handling TypeScript types for Node's `FileHandle` I/O APIs and nullability around an append handle.
- Ensuring byte-accurate accounting for unicode characters i.e string length vs UTF-8 byte length matters when seeking by bytes.

## What I learned

- How to safely append newline-delimited JSON and compute precise byte offsets using `Buffer.byteLength`.
- Using `readline` to stream a log file and rebuild an index without loading the entire file to memory.
- Properly wiring a small Express app to an injected persistence layer for easier testing and restart proofs.

## Resources consulted

- Node.js `fs` / `fs.promises` documentation
- MDN: Character encodings and UTF-8 byte length
- StackOverflow threads about file offsets and Node `FileHandle` usage

## Demo checklist (one-take 30s video)

1. Start server: `pnpm start` (shows the `Using log file:` line).
2. POST 2–3 events with `curl` and show returned IDs.
3. Stop the server (Ctrl+C).
4. Start the server again: show the `Recovered N events` log line.
5. Use `curl` to `GET /events/<id>` for an earlier id and show the result.

## How this made me a better backend developer

- Practiced thinking in bytes (not characters) when designing durable formats.
- Re-enforced the value of simple, testable abstractions (store vs HTTP) for restart correctness and integration tests.
- Improved confidence with Node's low-level file APIs and strategies for safe recovery without external databases.
