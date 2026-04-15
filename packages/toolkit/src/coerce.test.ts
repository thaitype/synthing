import { describe, it, expect } from "vitest";
import { coerceFromString } from "./coerce.js";

describe("coerceFromString", () => {
  // ----- string -----
  describe("targetType: string", () => {
    it('returns the value unchanged', () => {
      expect(coerceFromString("hello", "string")).toBe("hello");
    });

    it('returns empty string unchanged', () => {
      expect(coerceFromString("", "string")).toBe("");
    });
  });

  // ----- number -----
  describe("targetType: number", () => {
    it('coerces "42" to 42', () => {
      expect(coerceFromString("42", "number")).toBe(42);
    });

    it('coerces "3.14" to 3.14', () => {
      expect(coerceFromString("3.14", "number")).toBe(3.14);
    });

    it('coerces "0" to 0', () => {
      expect(coerceFromString("0", "number")).toBe(0);
    });

    it('coerces negative number string', () => {
      expect(coerceFromString("-7", "number")).toBe(-7);
    });

    it('throws for "123abc" (NaN)', () => {
      expect(() => coerceFromString("123abc", "number")).toThrow(TypeError);
    });

    it('throws for empty string (NaN)', () => {
      // Number("") === 0, not NaN — so this should NOT throw
      expect(coerceFromString("", "number")).toBe(0);
    });

    it('throws for "abc" (NaN)', () => {
      expect(() => coerceFromString("abc", "number")).toThrow(TypeError);
    });
  });

  // ----- boolean -----
  describe("targetType: boolean", () => {
    it('coerces "true" to true', () => {
      expect(coerceFromString("true", "boolean")).toBe(true);
    });

    it('coerces "1" to true', () => {
      expect(coerceFromString("1", "boolean")).toBe(true);
    });

    it('coerces "false" to false', () => {
      expect(coerceFromString("false", "boolean")).toBe(false);
    });

    it('coerces "0" to false', () => {
      expect(coerceFromString("0", "boolean")).toBe(false);
    });

    it('throws for "yes"', () => {
      expect(() => coerceFromString("yes", "boolean")).toThrow(TypeError);
    });

    it('throws for "no"', () => {
      expect(() => coerceFromString("no", "boolean")).toThrow(TypeError);
    });

    it('throws for "TRUE" (case-sensitive)', () => {
      expect(() => coerceFromString("TRUE", "boolean")).toThrow(TypeError);
    });

    it('throws for empty string', () => {
      expect(() => coerceFromString("", "boolean")).toThrow(TypeError);
    });
  });

  // ----- object -----
  describe("targetType: object", () => {
    it('parses valid JSON object', () => {
      expect(coerceFromString('{"a":1}', "object")).toEqual({ a: 1 });
    });

    it('parses valid JSON array', () => {
      expect(coerceFromString('[1,2]', "object")).toEqual([1, 2]);
    });

    it('parses nested object', () => {
      expect(coerceFromString('{"x":{"y":2}}', "object")).toEqual({ x: { y: 2 } });
    });

    it('throws for JSON string primitive "hello"', () => {
      expect(() => coerceFromString('"hello"', "object")).toThrow(TypeError);
    });

    it('throws for JSON number primitive "42"', () => {
      expect(() => coerceFromString("42", "object")).toThrow(TypeError);
    });

    it('throws for JSON boolean primitive "true"', () => {
      expect(() => coerceFromString("true", "object")).toThrow(TypeError);
    });

    it('throws for JSON null', () => {
      expect(() => coerceFromString("null", "object")).toThrow(TypeError);
    });

    it('throws for invalid JSON', () => {
      expect(() => coerceFromString("not-json", "object")).toThrow(TypeError);
    });
  });
});
