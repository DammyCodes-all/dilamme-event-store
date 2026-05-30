This is a tiny HTTP service that treats a newline-delimited JSON file as the database. Every event is appended to `events.log` as a single JSON object on its own line. The server keeps a small in-memory index that maps event ids to byte offsets and lengths, so reads go straight to the exact bytes on disk.

I built this with Node.js, Express and TypeScript. The goal was to prove a simple, crash-safe write path and a fast read path that survives restarts.

## Quick setup

Requirements: Node.js (v18+ recommended) and pnpm.

Install dependencies:

```bash
pnpm install
```

Run in development with live reload:

```bash
pnpm dev
```

Start the server:

```bash
pnpm start
```

Run the tests (unit and integration):

```bash
pnpm test
```

Config note:

- Change the log file path with `EVENTS_LOG_PATH`. By default the server writes `events.log` in the current directory.

## API

- `POST /events` — Send any JSON body. The server adds `id` and `createdAt`, appends the event as one JSON line to the log file, updates the in-memory index, and returns the stored event with status 201.
- `GET /events/:id` — Look up the id in the index, seek to the recorded byte offset and length, parse that slice, and return the event. Returns 404 if the id is not present.
- `GET /stats` — Returns `{ total, bytes }` where `total` is the recovered or stored event count and `bytes` is the current tracked file size.

Examples

Write an event:

```bash
curl -s -X POST http://localhost:3000/events \
  -H "Content-Type: application/json" \
  -d '{"user":"alice","action":"signup"}' | jq .
```

Read an event (replace `<id>` with the id returned earlier):

```bash
curl -s http://localhost:3000/events/<id> | jq .
```

Check stats:

```bash
curl -s http://localhost:3000/stats | jq .
```

## How it works

There are three parts:

- a persistent append-only log file on disk where each line is a JSON object
- an in-memory `Map<id, { offset, length }>` rebuilt from the log on startup
- a small Express HTTP layer that writes to the file and reads by seeking to recorded offsets

On startup the server streams the log file line by line to rebuild the index. That lets the process die and restart without losing data because the log file is the source of truth.

## Recovery message

When the server starts it prints a recovery message like this:

```
Recovered N events from /path/to/events.log
```

Restart log screenshot:

<img width="616" height="242" alt="image" src="https://github.com/user-attachments/assets/2a945c81-d5e4-4ba3-a0fb-b1ba7b0f0d44" />

Append-only writes are simple and robust. Appending to a file either completes or it does not, and earlier data stays intact if the process crashes. That makes recovery straightforward: replay the log from the start and rebuild state.

Reading by scanning the whole file would be slow. The in-memory index records exactly where each event lives in the file so reads are fast. Look up in memory, then do a single small file read for the event bytes.

## What I struggled with

- Getting TypeScript types right for Node's file APIs and handling the possibility the append handle was not yet open
- Ensuring offsets are byte counts, not character counts. UTF-8 characters can be multiple bytes, so `Buffer.byteLength` is what matters when seeking

## What I learned

- How to append newline-delimited JSON safely and compute byte-accurate offsets
- How to stream a file with `readline` to rebuild an index without loading the entire file into memory
- Why separating the persistence layer from the HTTP layer makes restarting and testing easier

## Resources I used

- Node.js `fs` and `fs.promises` docs
- MDN pages on UTF-8 and byte lengths

## Demo checklist

1. Start the server with `pnpm start` and show the "Using log file" message
2. POST two or three events and show the returned ids
3. Stop the server (Ctrl+C)
4. Start it again and show the `Recovered N events` log line
5. `GET` one of the earlier ids to show it still resolves

## How this made me a better backend developer

- I now think in bytes when designing durable formats instead of characters
- I appreciate small, testable abstractions more, especially when proving restart safety
- I have more confidence using Node's low-level file APIs for production-like durability proofs

---

<div align="center">
  Built with 💜 by aluminate
</div>
