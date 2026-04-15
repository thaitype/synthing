import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { EnvConnector } from "./env-connector.js";

describe("EnvConnector", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore original env
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, originalEnv);
  });

  describe("with prefix", () => {
    it('reads env var using prefix + uppercase key', async () => {
      process.env["APP_PORT"] = "8080";
      const connector = new EnvConnector({ prefix: "APP_" });
      await connector.load(["port"]);
      expect(connector.get("port")).toBe("8080");
    });

    it('returns undefined when prefixed var is not set', async () => {
      delete process.env["APP_MISSING"];
      const connector = new EnvConnector({ prefix: "APP_" });
      await connector.load(["missing"]);
      expect(connector.get("missing")).toBeUndefined();
    });

    it('handles multiple keys at once', async () => {
      process.env["APP_HOST"] = "localhost";
      process.env["APP_PORT"] = "3000";
      const connector = new EnvConnector({ prefix: "APP_" });
      await connector.load(["host", "port"]);
      expect(connector.get("host")).toBe("localhost");
      expect(connector.get("port")).toBe("3000");
    });
  });

  describe("without prefix", () => {
    it('reads env var using uppercase key only', async () => {
      process.env["PORT"] = "5000";
      const connector = new EnvConnector();
      await connector.load(["port"]);
      expect(connector.get("port")).toBe("5000");
    });

    it('returns undefined when var is not set', async () => {
      delete process.env["MISSING"];
      const connector = new EnvConnector({});
      await connector.load(["missing"]);
      expect(connector.get("missing")).toBeUndefined();
    });
  });

  describe("get() before load()", () => {
    it('returns undefined for a key that was never loaded', () => {
      const connector = new EnvConnector({ prefix: "APP_" });
      expect(connector.get("port")).toBeUndefined();
    });
  });

  describe("key casing", () => {
    it('converts mixed-case key to uppercase env var', async () => {
      process.env["APP_MYKEY"] = "value";
      const connector = new EnvConnector({ prefix: "APP_" });
      await connector.load(["myKey"]);
      expect(connector.get("myKey")).toBe("value");
    });
  });
});
