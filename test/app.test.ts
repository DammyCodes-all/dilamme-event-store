import request from "supertest";
import { createApp } from "../src/app.js";
import { describe, expect, it } from "vitest";

describe("app foundation", () => {
  it("exposes a health endpoint", async () => {
    const app = createApp();

    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });
});
