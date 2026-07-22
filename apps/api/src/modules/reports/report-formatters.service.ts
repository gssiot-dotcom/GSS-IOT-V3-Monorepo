import { Injectable } from "@nestjs/common";

import type { NormalizedReportDataset, ReportValue } from "./report-types";

@Injectable()
export class ReportFormattersService {
  toCsv(dataset: NormalizedReportDataset): Buffer {
    const header = dataset.columns.map((column) => this.csvCell(column.header)).join(",");
    const rows = dataset.rows.map((row) =>
      dataset.columns.map((column) => this.csvCell(row[column.key])).join(","),
    );
    return Buffer.from(`\uFEFF${[header, ...rows].join("\r\n")}\r\n`, "utf8");
  }

  toXlsx(dataset: NormalizedReportDataset): Buffer {
    const sheetRows = [
      dataset.columns.map((column) => column.header),
      ...dataset.rows.map((row) => dataset.columns.map((column) => this.cellText(row[column.key]))),
    ];
    const widths = dataset.columns.map((column, index) =>
      Math.min(
        60,
        Math.max(
          column.header.length + 2,
          ...sheetRows.map((row) => (row[index] ?? "").length + 2),
        ),
      ),
    );
    const worksheet = [
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
      `<cols>${widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("")}</cols>`,
      `<sheetData>${sheetRows.map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((value, columnIndex) => this.xlsxCell(value, rowIndex, columnIndex)).join("")}</row>`).join("")}</sheetData>`,
      "</worksheet>",
    ].join("");
    const entries: [string, string][] = [
      [
        "[Content_Types].xml",
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
      ],
      [
        "_rels/.rels",
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
      ],
      [
        "xl/workbook.xml",
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Report" sheetId="1" r:id="rId1"/></sheets></workbook>',
      ],
      [
        "xl/_rels/workbook.xml.rels",
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
      ],
      [
        "xl/styles.xml",
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellXfs></styleSheet>',
      ],
      ["xl/worksheets/sheet1.xml", worksheet],
    ];
    return this.zip(entries);
  }

  private csvCell(value: ReportValue): string {
    const text = this.cellText(value);
    const safe = /^[=+\-@]/.test(text.trim()) ? `'${text}` : text;
    return `"${safe.replaceAll('"', '""')}"`;
  }

  private cellText(value: ReportValue): string {
    if (value === null || value === undefined) return "";
    if (value instanceof Date) return value.toISOString();
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  }

  private xlsxCell(value: string, rowIndex: number, columnIndex: number): string {
    const reference = `${this.columnName(columnIndex)}${rowIndex + 1}`;
    const style = rowIndex === 0 ? ' s="0"' : "";
    const safe = /^[=+\-@]/.test(value.trim()) ? `'${value}` : value;
    return `<c r="${reference}" t="inlineStr"${style}><is><t xml:space="preserve">${this.xml(safe)}</t></is></c>`;
  }

  private columnName(index: number): string {
    let value = index + 1;
    let result = "";
    while (value > 0) {
      const remainder = (value - 1) % 26;
      result = String.fromCharCode(65 + remainder) + result;
      value = Math.floor((value - 1) / 26);
    }
    return result;
  }

  private xml(value: string): string {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&apos;");
  }

  private zip(entries: [string, string][]): Buffer {
    const localParts: Buffer[] = [];
    const centralParts: Buffer[] = [];
    let offset = 0;
    for (const [name, content] of entries) {
      const nameBytes = Buffer.from(name, "utf8");
      const data = Buffer.from(content, "utf8");
      const header = Buffer.alloc(30);
      header.writeUInt32LE(0x04034b50, 0);
      header.writeUInt16LE(20, 4);
      header.writeUInt16LE(0x800, 6);
      header.writeUInt16LE(0, 8);
      header.writeUInt16LE(0, 10);
      header.writeUInt16LE(0, 12);
      header.writeUInt32LE(this.crc32(data), 14);
      header.writeUInt32LE(data.length, 18);
      header.writeUInt32LE(data.length, 22);
      header.writeUInt16LE(nameBytes.length, 26);
      header.writeUInt16LE(0, 28);
      localParts.push(Buffer.concat([header, nameBytes, data]));

      const central = Buffer.alloc(46);
      central.writeUInt32LE(0x02014b50, 0);
      central.writeUInt16LE(20, 4);
      central.writeUInt16LE(20, 6);
      central.writeUInt16LE(0x800, 8);
      central.writeUInt16LE(0, 10);
      central.writeUInt16LE(0, 12);
      central.writeUInt16LE(0, 14);
      central.writeUInt32LE(this.crc32(data), 16);
      central.writeUInt32LE(data.length, 20);
      central.writeUInt32LE(data.length, 24);
      central.writeUInt16LE(nameBytes.length, 28);
      central.writeUInt16LE(0, 30);
      central.writeUInt16LE(0, 32);
      central.writeUInt16LE(0, 34);
      central.writeUInt16LE(0, 36);
      central.writeUInt32LE(0, 38);
      central.writeUInt32LE(offset, 42);
      centralParts.push(Buffer.concat([central, nameBytes]));
      offset += localParts.at(-1)?.length ?? 0;
    }
    const centralDirectory = Buffer.concat(centralParts);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(0, 4);
    end.writeUInt16LE(0, 6);
    end.writeUInt16LE(entries.length, 8);
    end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(centralDirectory.length, 12);
    end.writeUInt32LE(offset, 16);
    return Buffer.concat([...localParts, centralDirectory, end]);
  }

  private crc32(value: Buffer): number {
    let crc = 0xffffffff;
    for (const byte of value) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }
}
