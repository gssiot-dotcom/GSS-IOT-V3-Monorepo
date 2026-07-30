import { describe, expect, it } from "vitest";

import {
  attachmentDisposition,
  localizedReportFileName,
  localizeReportDataset,
  normalizeReportLocale,
} from "../src/modules/reports/report-localization";

describe("report localization", () => {
  it("defaults to Korean and accepts English language headers", () => {
    expect(normalizeReportLocale()).toBe("ko-KR");
    expect(normalizeReportLocale("ko-KR,ko;q=0.9")).toBe("ko-KR");
    expect(normalizeReportLocale("en-US,en;q=0.8")).toBe("en-US");
  });

  it("localizes headers and semantic values without changing IDs or timestamps", () => {
    const localized = localizeReportDataset(
      {
        columns: [
          { header: "Status", key: "status" },
          { header: "Node type", key: "nodeType" },
          { header: "Created at", key: "createdAt" },
        ],
        rows: [
          {
            createdAt: "2026-07-30T12:00:00.000Z",
            id: "stable-id",
            nodeType: "door_node",
            status: "WARNING",
          },
        ],
      },
      "ko-KR",
    );
    expect(localized.columns.map((column) => column.header)).toEqual([
      "상태",
      "노드 유형",
      "등록 시각",
    ]);
    expect(localized.rows[0]).toMatchObject({
      createdAt: "2026-07-30T12:00:00.000Z",
      id: "stable-id",
      nodeType: "도어 노드",
      status: "경고",
    });
  });

  it("creates localized filenames with an RFC 5987 disposition", () => {
    const fileName = localizedReportFileName("ko-KR", "ALARM_HISTORY", "job-1", "CSV");
    expect(fileName).toBe("gss-보고서-alarm_history-job-1.csv");
    expect(attachmentDisposition(fileName)).toContain(
      "filename*=UTF-8''gss-%EB%B3%B4%EA%B3%A0%EC%84%9C",
    );
  });
});
