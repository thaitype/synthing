/**
 * coerce.ts
 *
 * Type coercion utilities for converting string values to target primitive types.
 * Zero dependencies — pure TypeScript utility functions.
 */

export function coerceFromString(value: string, targetType: "string"): string;
export function coerceFromString(value: string, targetType: "number"): number;
export function coerceFromString(value: string, targetType: "boolean"): boolean;
export function coerceFromString(value: string, targetType: "object"): object | unknown[];
export function coerceFromString(
  value: string,
  targetType: "string" | "number" | "boolean" | "object"
): string | number | boolean | object | unknown[] {
  switch (targetType) {
    case "string":
      return value;

    case "number": {
      const result = Number(value);
      if (Number.isNaN(result)) {
        throw new TypeError(`Cannot coerce "${value}" to number: result is NaN`);
      }
      return result;
    }

    case "boolean": {
      if (value === "true" || value === "1") return true;
      if (value === "false" || value === "0") return false;
      throw new TypeError(
        `Cannot coerce "${value}" to boolean: expected "true", "false", "1", or "0"`
      );
    }

    case "object": {
      let parsed: unknown;
      try {
        parsed = JSON.parse(value);
      } catch {
        throw new TypeError(`Cannot coerce "${value}" to object: invalid JSON`);
      }
      if (
        parsed === null ||
        typeof parsed === "string" ||
        typeof parsed === "number" ||
        typeof parsed === "boolean"
      ) {
        throw new TypeError(
          `Cannot coerce "${value}" to object: JSON parsed to a primitive value`
        );
      }
      return parsed as object | unknown[];
    }
  }
}
