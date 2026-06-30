import { errorCodes } from "../src";

describe("errorCodes map", () => {
  it("is a Map with common HTTP codes", () => {
    expect(errorCodes instanceof Map).toBe(true);
    expect(errorCodes.get(400)).toBe("Bad Request");
    expect(errorCodes.get(404)).toBe("Not Found");
    expect(errorCodes.get(500)).toBe("Internal Server Error");
  });

  describe("read-only protections (Task 14a)", () => {
    it("supports .has() for known and unknown codes", () => {
      expect(errorCodes.has(404)).toBe(true);
      expect(errorCodes.has(200)).toBe(false);
      expect(errorCodes.has(999)).toBe(false);
    });

    it("supports .get() for known and unknown codes", () => {
      expect(errorCodes.get(418)).toBe("I'm a teapot");
      expect(errorCodes.get(200)).toBeUndefined();
    });

    it("supports iteration (for...of, .keys, .values, .entries)", () => {
      let count = 0;
      for (const [code, text] of errorCodes) {
        expect(typeof code).toBe("number");
        expect(typeof text).toBe("string");
        count++;
      }
      expect(count).toBeGreaterThan(0);

      const keys = Array.from(errorCodes.keys());
      expect(keys).toContain(404);
      expect(keys).toContain(500);

      const values = Array.from(errorCodes.values());
      expect(values).toContain("Not Found");

      const entries = Array.from(errorCodes.entries());
      expect(entries.length).toBe(errorCodes.size);
    });

    it("supports forEach", () => {
      const seen: number[] = [];
      // Cast to any to access the not-statically-typed forEach (ReadonlyMap has it)
      (errorCodes as any).forEach((_text: string, code: number) => {
        seen.push(code);
      });
      expect(seen).toContain(404);
    });

    it(".set throws and the map is unchanged after attempted mutation", () => {
      const sizeBefore = errorCodes.size;
      const originalText = errorCodes.get(404);
      // Use `as any` to bypass the ReadonlyMap type at compile time, simulating
      // a runtime attacker that doesn't go through the type system.
      expect(() => (errorCodes as any).set(404, "Hacked")).toThrow(TypeError);
      expect(() => (errorCodes as any).set(999, "Bogus")).toThrow(/read-only/);
      expect(errorCodes.size).toBe(sizeBefore);
      expect(errorCodes.get(404)).toBe(originalText);
      expect(errorCodes.has(999)).toBe(false);
    });

    it(".delete throws and the map is unchanged after attempted mutation", () => {
      const sizeBefore = errorCodes.size;
      expect(() => (errorCodes as any).delete(404)).toThrow(TypeError);
      expect(() => (errorCodes as any).delete(404)).toThrow(/read-only/);
      expect(errorCodes.size).toBe(sizeBefore);
      expect(errorCodes.has(404)).toBe(true);
    });

    it(".clear throws and the map is unchanged after attempted mutation", () => {
      const sizeBefore = errorCodes.size;
      expect(() => (errorCodes as any).clear()).toThrow(TypeError);
      expect(() => (errorCodes as any).clear()).toThrow(/read-only/);
      expect(errorCodes.size).toBe(sizeBefore);
      expect(errorCodes.has(404)).toBe(true);
      expect(errorCodes.has(500)).toBe(true);
    });

    it("type is ReadonlyMap (compile-time): mutation methods are not on the type", () => {
      // The following lines must NOT compile if errorCodes is typed correctly.
      // We assert at runtime by checking the imported value's static type via
      // `satisfies` — if errorCodes were a plain Map, the satisfies check would
      // still pass, so this is mostly a documentation/marker test. The real
      // contract is enforced by `tsc` in `npm run type-check`.
      const ro: ReadonlyMap<number, string> = errorCodes;
      expect(ro.get(404)).toBe("Not Found");
    });
  });

  describe("Object.freeze hardening (Phase 3 Task 3.1)", () => {
    it("is frozen (Object.isFrozen returns true)", () => {
      expect(Object.isFrozen(errorCodes)).toBe(true);
    });

    it("read operations remain intact after freeze: .get, .has, .size, iteration", () => {
      expect(errorCodes.get(404)).toBe("Not Found");
      expect(errorCodes.has(500)).toBe(true);
      expect(errorCodes.size).toBeGreaterThan(0);
      const entries = Array.from(errorCodes.entries());
      expect(entries.length).toBe(errorCodes.size);
    });

    it("adding an arbitrary own property is rejected in strict-mode context", () => {
      // Object.freeze makes the map non-extensible; assigning a new own property
      // in strict mode (which TypeScript CJS output always enables via "use strict")
      // throws TypeError. This closes the own-property injection vector that the
      // per-method set/delete/clear overrides alone cannot cover.
      expect(() => {
        (errorCodes as any).arbitraryProp = "injected";
      }).toThrow(TypeError);
    });
  });
});
