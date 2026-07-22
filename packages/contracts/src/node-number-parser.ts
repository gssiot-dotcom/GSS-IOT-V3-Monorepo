export const MAX_BULK_NODE_COUNT = 1_000;

export type NodeNumberParseErrorCode =
  | "EMPTY_INPUT"
  | "INVALID_SEGMENT"
  | "NON_POSITIVE"
  | "UNSAFE_INTEGER"
  | "DESCENDING_RANGE"
  | "MAX_BATCH_SIZE";

export interface NodeNumberParseError {
  code: NodeNumberParseErrorCode;
  segment: string;
}

export interface NodeNumberParseResult {
  duplicateNumbers: string[];
  errors: NodeNumberParseError[];
  invalidSegments: string[];
  numbers: string[];
}

type CanonicalIntegerResult =
  { ok: true; value: string } | { code: "NON_POSITIVE" | "UNSAFE_INTEGER"; ok: false };

function canonicalPositiveInteger(value: string): CanonicalIntegerResult {
  const numericValue = BigInt(value);
  if (numericValue <= 0n) return { code: "NON_POSITIVE", ok: false };
  if (numericValue > BigInt(Number.MAX_SAFE_INTEGER)) return { code: "UNSAFE_INTEGER", ok: false };
  return { ok: true, value: numericValue.toString() };
}

export function parseNodeNumberInput(
  input: string,
  maxCount = MAX_BULK_NODE_COUNT,
): NodeNumberParseResult {
  const errors: NodeNumberParseError[] = [];
  const invalidSegments: string[] = [];
  const duplicateNumbers = new Set<string>();
  const numbers = new Set<string>();
  const trimmedInput = input.trim();

  if (!trimmedInput) {
    return {
      duplicateNumbers: [],
      errors: [{ code: "EMPTY_INPUT", segment: "" }],
      invalidSegments: [],
      numbers: [],
    };
  }

  for (const rawSegment of trimmedInput.split(",")) {
    const segment = rawSegment.trim();
    if (!segment) {
      errors.push({ code: "INVALID_SEGMENT", segment });
      invalidSegments.push(segment);
      continue;
    }

    const range = segment.match(/^(\d+)\s*-\s*(\d+)$/);
    const single = /^\d+$/.test(segment);
    if (!range && !single) {
      errors.push({ code: "INVALID_SEGMENT", segment });
      invalidSegments.push(segment);
      continue;
    }

    const startText = range?.[1] ?? segment;
    const endText = range?.[2] ?? segment;
    const start = canonicalPositiveInteger(startText);
    const end = canonicalPositiveInteger(endText);
    if (!start.ok || !end.ok) {
      const code = !start.ok ? start.code : !end.ok ? end.code : "INVALID_SEGMENT";
      errors.push({ code, segment });
      invalidSegments.push(segment);
      continue;
    }

    const startNumber = BigInt(start.value);
    const endNumber = BigInt(end.value);
    if (range && startNumber > endNumber) {
      errors.push({ code: "DESCENDING_RANGE", segment });
      invalidSegments.push(segment);
      continue;
    }

    const span = endNumber - startNumber + 1n;
    if (span > BigInt(maxCount)) {
      errors.push({ code: "MAX_BATCH_SIZE", segment });
      invalidSegments.push(segment);
      continue;
    }

    for (let value = startNumber; value <= endNumber; value += 1n) {
      const canonical = value.toString();
      if (numbers.has(canonical)) duplicateNumbers.add(canonical);
      numbers.add(canonical);
    }
    if (numbers.size > maxCount) {
      errors.push({ code: "MAX_BATCH_SIZE", segment });
      invalidSegments.push(segment);
      break;
    }
  }

  if (errors.some((error) => error.code === "MAX_BATCH_SIZE")) {
    return { duplicateNumbers: [...duplicateNumbers], errors, invalidSegments, numbers: [] };
  }

  return {
    duplicateNumbers: [...duplicateNumbers],
    errors,
    invalidSegments,
    numbers: [...numbers],
  };
}
