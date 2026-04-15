import { describe, it, expect, beforeEach, afterEach } from "vitest";
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
    it("reads env var using prefix + key as-is (no uppercase transform)", async () => {
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
    it("reads env var using key as-is (no uppercase transform)", async () => {
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

  describe("key casing — no uppercase transform", () => {
    it("uses key exactly as given (mixed-case)", async () => {
      process.env["APP_myKey"] = "value";
      const connector = new EnvConnector({ prefix: "APP_" });
      await connector.load(["myKey"]);
      expect(connector.get("myKey")).toBe("value");
    });
  });

  describe("caseInsensitive option", () => {
    it("matches env vars case-insensitively when enabled", async () => {
      process.env["APP_PORT"] = "9090";
      const connector = new EnvConnector({ prefix: "APP_", caseInsensitive: true });
      await connector.load(["port"]);
      expect(connector.get("port")).toBe("9090");
    });

    it("stores key normalized when caseInsensitive is true", async () => {
      process.env["APP_MYKEY"] = "hello";
      const connector = new EnvConnector({ prefix: "APP_", caseInsensitive: true });
      await connector.load(["myKey"]);
      expect(connector.get("myKey")).toBe("hello");
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

  describe("tryParseSecretValue()", () => {
    it("returns raw string for plain strings", () => {
      const connector = new EnvConnector();
      expect(connector.tryParseSecretValue("hello")).toBe("hello");
    });

    it("parses flat JSON object", () => {
      const connector = new EnvConnector();
      const result = connector.tryParseSecretValue('{"user":"admin","port":5432}');
      expect(result).toEqual({ user: "admin", port: 5432 });
    });

    it("returns raw string for non-flat JSON (arrays)", () => {
      const connector = new EnvConnector();
      const result = connector.tryParseSecretValue("[1,2,3]");
      expect(result).toBe("[1,2,3]");
    });

    it("returns raw string for non-flat JSON (nested objects)", () => {
      const connector = new EnvConnector();
      const result = connector.tryParseSecretValue('{"a":{"b":1}}');
      expect(result).toBe('{"a":{"b":1}}');
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
});
