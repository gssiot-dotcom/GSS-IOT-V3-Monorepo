import { ReportFormattersService } from "../src/modules/reports/report-formatters.service";
import { describe, expect, it } from "vitest";

describe("report formatters", () => {
  const formatters = new ReportFormattersService();

  it("escapes CSV cells and neutralizes spreadsheet formulas", () => {
    const csv = formatters
      .toCsv({
        columns: [
          { key: "name", header: "Name" },
          { key: "note", header: "Note" },
        ],
        rows: [{ name: '=HYPERLINK("https://example.test")', note: "quoted, value\nnext" }],
      })
      .toString("utf8");

    expect(csv).toContain("\uFEFF");
    expect(csv).toContain('\'=HYPERLINK(""https://example.test"")');
    expect(csv).toContain('"quoted, value\nnext"');
  });

  it("creates a deterministic XLSX package with headers, widths and safe text cells", () => {
    const xlsx = formatters.toXlsx({
      columns: [{ key: "value", header: "Value" }],
      rows: [{ value: "@unsafe" }],
    });
    const packageText = xlsx.toString("binary");

    expect(xlsx.subarray(0, 2).toString()).toBe("PK");
    expect(packageText).toContain("xl/worksheets/sheet1.xml");
    expect(packageText).toContain("&apos;@unsafe");
    expect(packageText).toContain('customWidth="1"');
  });
});
