import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EnvConnector } from "./env-connector.js";

describe("EnvConnector", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, originalEnv);
  });

  describe("with prefix", () => {
    it("reads env var using prefix + key as-is", async () => {
      process.env["APP_port"] = "8080";
      const connector = new EnvConnector({ prefix: "APP_" });
      await connector.load(["port"]);
      expect(connector.get("port")).toBe("8080");
    });

    it("throws when prefixed var is not set", async () => {
      delete process.env["APP_missing"];
      const connector = new EnvConnector({ prefix: "APP_" });
      await expect(connector.load(["missing"])).rejects.toThrow(
        "Missing environment variable: APP_missing"
      );
    });

    it("handles multiple keys at once", async () => {
      process.env["APP_host"] = "localhost";
      process.env["APP_port"] = "3000";
      const connector = new EnvConnector({ prefix: "APP_" });
      await connector.load(["host", "port"]);
      expect(connector.get("host")).toBe("localhost");
      expect(connector.get("port")).toBe("3000");
    });
  });

  describe("without prefix", () => {
    it("reads env var using key as-is", async () => {
      process.env["port"] = "5000";
      const connector = new EnvConnector();
      await connector.load(["port"]);
      expect(connector.get("port")).toBe("5000");
    });

    it("throws when var is not set", async () => {
      delete process.env["missing"];
      const connector = new EnvConnector({});
      await expect(connector.load(["missing"])).rejects.toThrow(
        "Missing environment variable: missing"
      );
    });
  });

  describe("get() before load()", () => {
    it("throws for a key that was never loaded", () => {
      const connector = new EnvConnector({ prefix: "APP_" });
      expect(() => connector.get("port")).toThrow(
        "Secret 'port' not loaded. Did you call load()?"
      );
    });
  });

  describe("case-insensitive matching (default)", () => {
    it("matches an uppercase env var against a lowercase-declared key by default", async () => {
      process.env["APP_PORT"] = "9090";
      const connector = new EnvConnector({ prefix: "APP_" });
      await connector.load(["port"]);
      expect(connector.get("port")).toBe("9090");
    });

    it("stores the key normalized by default", async () => {
      process.env["APP_MYKEY"] = "hello";
      const connector = new EnvConnector({ prefix: "APP_" });
      await connector.load(["myKey"]);
      expect(connector.get("myKey")).toBe("hello");
    });

    it("can be disabled via caseInsensitive: false, requiring exact case", async () => {
      process.env["APP_port"] = "8080";
      const connector = new EnvConnector({
        prefix: "APP_",
        caseInsensitive: false,
      });
      await expect(connector.load(["PORT"])).rejects.toThrow(
        "Missing environment variable: APP_PORT"
      );
    });
  });

  describe("workingDir", () => {
    it("setWorkingDir / getWorkingDir roundtrip", () => {
      const connector = new EnvConnector();
      connector.setWorkingDir("/tmp/my-app");
      expect(connector.getWorkingDir()).toBe("/tmp/my-app");
    });

    it("getEnvFilePath includes working dir", () => {
      const connector = new EnvConnector({ workingDir: "/tmp/my-app" });
      expect(connector.getEnvFilePath()).toBe("/tmp/my-app/.env");
    });
  });

  describe("config exposure", () => {
    it("exposes public config", () => {
      const config = { prefix: "MY_", caseInsensitive: true };
      const connector = new EnvConnector(config);
      expect(connector.config).toEqual(config);
    });
  });

  describe("raw value passthrough (no coercion)", () => {
    it("returns a flat-JSON-looking value as the raw, unparsed string", async () => {
      process.env["APP_config"] = '{"user":"admin","port":5432}';
      const connector = new EnvConnector({ prefix: "APP_" });
      await connector.load(["config"]);
      expect(connector.get("config")).toBe('{"user":"admin","port":5432}');
    });

    it("returns any string untouched, regardless of shape", async () => {
      process.env["APP_raw"] = "[1,2,3]";
      const connector = new EnvConnector({ prefix: "APP_" });
      await connector.load(["raw"]);
      expect(connector.get("raw")).toBe("[1,2,3]");
    });
  });

  describe("allowDotEnv option", () => {
    it("default allowDotEnv is true (dotenv is called without error even if .env absent)", async () => {
      process.env["MY_KEY"] = "abc";
      // Should not throw even when no .env file exists
      const connector = new EnvConnector();
      await connector.load(["MY_KEY"]);
      expect(connector.get("MY_KEY")).toBe("abc");
    });

    it("skips dotenv loading when allowDotEnv is false", async () => {
      process.env["SKIP_KEY"] = "xyz";
      const connector = new EnvConnector({ allowDotEnv: false });
      await connector.load(["SKIP_KEY"]);
      expect(connector.get("SKIP_KEY")).toBe("xyz");
    });
  });

  describe("maskValues logging", () => {
    it("masks the logged value by default", async () => {
      process.env["APP_secret"] = "supersecretvalue";
      const infoSpy = vi.fn();
      const connector = new EnvConnector({ prefix: "APP_" });
      connector.logger = { info: infoSpy, warn: vi.fn(), error: vi.fn() };
      await connector.load(["secret"]);

      const loggedValueCall = infoSpy.mock.calls.find((call) =>
        String(call[0]).startsWith("Value:")
      );
      expect(loggedValueCall?.[0]).toBe("Value: supe************");
      expect(loggedValueCall?.[0]).not.toContain("supersecretvalue");
    });

    it("logs the raw value when maskValues is false", async () => {
      process.env["APP_secret"] = "supersecretvalue";
      const infoSpy = vi.fn();
      const connector = new EnvConnector({ prefix: "APP_", maskValues: false });
      connector.logger = { info: infoSpy, warn: vi.fn(), error: vi.fn() };
      await connector.load(["secret"]);

      const loggedValueCall = infoSpy.mock.calls.find((call) =>
        String(call[0]).startsWith("Value:")
      );
      expect(loggedValueCall?.[0]).toBe("Value: supersecretvalue");
    });
  });
});
