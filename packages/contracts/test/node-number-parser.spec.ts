import { describe, expect, it } from "vitest";

import { MAX_BULK_NODE_COUNT, parseNodeNumberInput } from "../src/node-number-parser";

describe("parseNodeNumberInput", () => {
  it("parses single, range, comma and mixed input with whitespace", () => {
    expect(parseNodeNumberInput("100").numbers).toEqual(["100"]);
    expect(parseNodeNumberInput("100-103").numbers).toEqual(["100", "101", "102", "103"]);
    expect(parseNodeNumberInput("100, 102, 110").numbers).toEqual(["100", "102", "110"]);
    expect(parseNodeNumberInput("100-103, 110, 120-122").numbers).toEqual([
      "100",
      "101",
      "102",
      "103",
      "110",
      "120",
      "121",
      "122",
    ]);
  });

  it("canonicalizes decimal strings and deduplicates numeric values", () => {
    const result = parseNodeNumberInput("001, 1-2, 002");
    expect(result.numbers).toEqual(["1", "2"]);
    expect(result.duplicateNumbers).toEqual(["1", "2"]);
    expect(result.errors).toEqual([]);
  });

  it("reports malformed, descending, non-positive and unsafe values", () => {
    const result = parseNodeNumberInput("bad, 5-2, 0, -1, 9007199254740992");
    expect(result.invalidSegments).toEqual(["bad", "5-2", "0", "-1", "9007199254740992"]);
    expect(result.errors.map((error) => error.code)).toEqual([
      "INVALID_SEGMENT",
      "DESCENDING_RANGE",
      "NON_POSITIVE",
      "INVALID_SEGMENT",
      "UNSAFE_INTEGER",
    ]);
    expect(parseNodeNumberInput("9007199254740991").numbers).toEqual(["9007199254740991"]);
  });

  it("enforces the maximum batch size", () => {
    expect(parseNodeNumberInput(`1-${MAX_BULK_NODE_COUNT}`).numbers).toHaveLength(
      MAX_BULK_NODE_COUNT,
    );
    const tooLarge = parseNodeNumberInput(`1-${MAX_BULK_NODE_COUNT + 1}`);
    expect(tooLarge.numbers).toEqual([]);
    expect(tooLarge.errors[0]?.code).toBe("MAX_BATCH_SIZE");
  });
});
