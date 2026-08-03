import { execFileSync } from "node:child_process";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  normalizeOptionalDateTimeRange,
  normalizeRequiredDateTimeRange,
} from "../shared/date-time/local-date-time-range";

function normalizeInTimezone(
  timezone: string,
  mode: "initial" | "optional" | "required",
  args: unknown[],
) {
  const sourcePath = path.resolve("src/shared/date-time/local-date-time-range.ts");
  const script = String.raw`
    const fs = require("node:fs");
    const ts = require("typescript");
    const source = fs.readFileSync(process.argv[1], "utf8");
    const output = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const compiledModule = { exports: {} };
    new Function("exports", "module", "require", output)(
      compiledModule.exports,
      compiledModule,
      require,
    );
    const api = compiledModule.exports;
    const mode = process.argv[2];
    const args = JSON.parse(process.argv[3]);
    let result;
    if (mode === "initial") {
      const to = new Date(args[0]);
      const from = new Date(to.getTime() - 24 * 60 * 60 * 1000);
      result = api.normalizeRequiredDateTimeRange(
        api.localDateTimeValue(from),
        api.localDateTimeValue(to),
        args[1],
      );
    } else if (mode === "optional") {
      result = api.normalizeOptionalDateTimeRange(...args);
    } else {
      result = api.normalizeRequiredDateTimeRange(...args);
    }
    process.stdout.write(JSON.stringify(result));
  `;
  return JSON.parse(
    execFileSync(process.execPath, ["-e", script, sourcePath, mode, JSON.stringify(args)], {
      encoding: "utf8",
      env: { ...process.env, TZ: timezone },
    }),
  ) as ReturnType<typeof normalizeRequiredDateTimeRange>;
}

describe("local date/time range normalization", () => {
  it("converts explicit browser-local values to UTC", () => {
    expect(
      normalizeInTimezone("Asia/Seoul", "required", [
        { date: "2026-08-01", time: "09:15" },
        { date: "2026-08-01", time: "10:15" },
        { toBoundary: "exclusive" },
      ]),
    ).toEqual({
      value: {
        from: "2026-08-01T00:15:00.000Z",
        to: "2026-08-01T01:15:00.000Z",
      },
    });
  });

  it("keeps the default instant-based range at exactly 24 hours", () => {
    const result = normalizeInTimezone("America/New_York", "initial", [
      "2026-03-08T17:00:00.000Z",
      { maxRangeMs: 31 * 24 * 60 * 60 * 1000, toBoundary: "exclusive" },
    ]);

    expect(result.error).toBeUndefined();
    expect(Date.parse(result.value!.to) - Date.parse(result.value!.from)).toBe(24 * 60 * 60 * 1000);
  });

  it("uses calendar-day boundaries across a DST transition instead of adding 24 hours", () => {
    const result = normalizeInTimezone("America/New_York", "required", [
      { date: "2026-03-07", time: "" },
      { date: "2026-03-08", time: "" },
      { toBoundary: "exclusive" },
    ]);

    expect(result).toEqual({
      value: {
        from: "2026-03-07T05:00:00.000Z",
        to: "2026-03-09T04:00:00.000Z",
      },
    });
  });

  it("makes an Archive date-only end inclusive through the last millisecond", () => {
    expect(
      normalizeInTimezone("UTC", "optional", [
        { date: "2026-08-01", time: "" },
        { date: "2026-08-02", time: "" },
        { toBoundary: "inclusive" },
      ]),
    ).toEqual({
      value: {
        from: "2026-08-01T00:00:00.000Z",
        to: "2026-08-02T23:59:59.999Z",
      },
    });
  });

  it("rejects partial required, reversed, invalid and over-31-day ranges", () => {
    expect(
      normalizeRequiredDateTimeRange(
        { date: "2026-08-01", time: "" },
        { date: null, time: "" },
        { toBoundary: "exclusive" },
      ).error,
    ).toBe("required");
    expect(
      normalizeRequiredDateTimeRange(
        { date: "2026-08-02", time: "12:00" },
        { date: "2026-08-02", time: "11:00" },
        { toBoundary: "exclusive" },
      ).error,
    ).toBe("reversed");
    expect(
      normalizeRequiredDateTimeRange(
        { date: "2026-02-30", time: "12:00" },
        { date: "2026-03-01", time: "12:00" },
        { toBoundary: "exclusive" },
      ).error,
    ).toBe("invalid");
    expect(
      normalizeRequiredDateTimeRange(
        { date: "2026-01-01", time: "00:00" },
        { date: "2026-02-02", time: "00:00" },
        { maxRangeMs: 31 * 24 * 60 * 60 * 1000, toBoundary: "exclusive" },
      ).error,
    ).toBe("max-range");
  });

  it("keeps an empty Archive range unbounded and rejects time without a date", () => {
    expect(
      normalizeOptionalDateTimeRange(
        { date: null, time: "" },
        { date: null, time: "" },
        { toBoundary: "inclusive" },
      ),
    ).toEqual({ value: {} });
    expect(
      normalizeOptionalDateTimeRange(
        { date: null, time: "10:30" },
        { date: null, time: "" },
        { toBoundary: "inclusive" },
      ).error,
    ).toBe("invalid");
  });
});
