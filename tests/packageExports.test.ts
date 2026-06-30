import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("package.json exports map", () => {
  const pkg = JSON.parse(
    readFileSync(join(__dirname, "..", "package.json"), "utf8")
  );

  it("exposes the ./package.json subpath", () => {
    expect(pkg.exports["./package.json"]).toBe("./package.json");
  });

  it("keeps the main entry resolution intact", () => {
    expect(pkg.exports["."].import.default).toBe("./dist/index.mjs");
    expect(pkg.exports["."].require.default).toBe("./dist/index.js");
    expect(pkg.exports["."].import.types).toBe("./dist/index.d.mts");
    expect(pkg.exports["."].require.types).toBe("./dist/index.d.ts");
    expect(pkg.exports["."].default).toBe("./dist/index.mjs");
    expect(pkg.main).toBe("./dist/index.js");
    expect(pkg.module).toBe("./dist/index.mjs");
    expect(pkg.types).toBe("./dist/index.d.ts");
  });
});
