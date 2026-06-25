import { describe, it, expect } from "vitest";
import { itemsToCsv } from "@/lib/export";
import type { ExportItem } from "@/lib/export";

const sampleItem: ExportItem = {
  externalId: "gh-123",
  source: "github",
  title: "Login button broken",
  rawContent: "The login button does not work.",
  authorLogin: "alice",
  url: "https://example.com/issues/123",
  originalTimestamp: new Date("2024-01-15T10:30:00.000Z"),
  analysis: {
    sentiment: "negative",
    topics: ["Bug Report", "UX/UI"],
    severityScore: 4,
    summary: "User reports the login button is broken.",
    status: "NEW",
    language: "en",
    emotion: "frustrated",
  },
};

describe("itemsToCsv", () => {
  it("produces the correct header row", () => {
    const csv = itemsToCsv([]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe(
      "externalId,source,title,author,sentiment,severity,status,topics,language,emotion,summary,url,originalTimestamp,rawContent"
    );
  });

  it("produces correct CSV for a sample item", () => {
    const csv = itemsToCsv([sampleItem]);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('"gh-123"');
    expect(lines[1]).toContain('"github"');
    expect(lines[1]).toContain('"Login button broken"');
    expect(lines[1]).toContain('"alice"');
    expect(lines[1]).toContain('"negative"');
    expect(lines[1]).toContain('"4"');
    expect(lines[1]).toContain('"NEW"');
    expect(lines[1]).toContain('"en"');
    expect(lines[1]).toContain('"frustrated"');
    expect(lines[1]).toContain('"https://example.com/issues/123"');
    expect(lines[1]).toContain('"2024-01-15T10:30:00.000Z"');
    expect(lines[1]).toContain('"The login button does not work."');
  });

  it("converts topics JSON array to semicolon-separated string", () => {
    const csv = itemsToCsv([sampleItem]);
    const lines = csv.split("\n");
    // topics field is the 8th column (index 7)
    const row = lines[1];
    const fields = parseCsvRow(row);
    expect(fields[7]).toBe("Bug Report;UX/UI");
  });

  it("formats originalTimestamp as ISO string", () => {
    const csv = itemsToCsv([sampleItem]);
    const lines = csv.split("\n");
    const fields = parseCsvRow(lines[1]);
    // originalTimestamp is column index 12
    expect(fields[12]).toBe("2024-01-15T10:30:00.000Z");
  });

  it("truncates rawContent to 500 chars", () => {
    const longContent = "x".repeat(600);
    const item: ExportItem = {
      ...sampleItem,
      rawContent: longContent,
    };
    const csv = itemsToCsv([item]);
    const lines = csv.split("\n");
    const fields = parseCsvRow(lines[1]);
    // rawContent is the last column (index 13)
    expect(fields[13]).toBe("x".repeat(500));
  });

  it("escapes values with commas", () => {
    const item: ExportItem = {
      ...sampleItem,
      title: "Hello, World",
      analysis: {
        ...sampleItem.analysis!,
        summary: "A, B, and C",
      },
    };
    const csv = itemsToCsv([item]);
    const lines = csv.split("\n");
    const fields = parseCsvRow(lines[1]);
    expect(fields[2]).toBe("Hello, World");
    expect(fields[10]).toBe("A, B, and C");
  });

  it("escapes values with double quotes by doubling them", () => {
    const item: ExportItem = {
      ...sampleItem,
      title: 'He said "hi"',
      analysis: {
        ...sampleItem.analysis!,
        summary: 'Quote "end"',
      },
    };
    const csv = itemsToCsv([item]);
    const lines = csv.split("\n");
    // The raw row should contain doubled quotes.
    expect(lines[1]).toContain('""hi""');
    expect(lines[1]).toContain('""end""');
    const fields = parseCsvRow(lines[1]);
    expect(fields[2]).toBe('He said "hi"');
    expect(fields[10]).toBe('Quote "end"');
  });

  it("escapes values with newlines", () => {
    const item: ExportItem = {
      ...sampleItem,
      rawContent: "line1\nline2",
    };
    const csv = itemsToCsv([item]);
    // The CSV row itself should contain the embedded newline within quotes.
    // Splitting the whole CSV by \n would yield 3 lines; verify the content
    // reassembles correctly.
    const lines = csv.split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('"line1');
    expect(lines[2]).toContain('line2"');
    // Reassemble the quoted field.
    const reassembled = `${lines[1]}\n${lines[2]}`;
    const fields = parseCsvRow(reassembled);
    expect(fields[13]).toBe("line1\nline2");
  });

  it("handles null fields as empty strings in CSV", () => {
    const item: ExportItem = {
      externalId: "x-1",
      source: "email",
      title: null,
      rawContent: "content",
      authorLogin: null,
      url: null,
      originalTimestamp: new Date("2024-02-01T00:00:00.000Z"),
      analysis: null,
    };
    const csv = itemsToCsv([item]);
    const lines = csv.split("\n");
    const fields = parseCsvRow(lines[1]);
    // title (2), author (3), sentiment (4), severity (5), status (6),
    // topics (7), language (8), emotion (9), summary (10), url (11)
    expect(fields[2]).toBe("");
    expect(fields[3]).toBe("");
    expect(fields[4]).toBe("");
    expect(fields[5]).toBe("");
    expect(fields[6]).toBe("");
    expect(fields[7]).toBe("");
    expect(fields[8]).toBe("");
    expect(fields[9]).toBe("");
    expect(fields[10]).toBe("");
    expect(fields[11]).toBe("");
    // externalId, source, rawContent, originalTimestamp still present
    expect(fields[0]).toBe("x-1");
    expect(fields[1]).toBe("email");
    expect(fields[12]).toBe("2024-02-01T00:00:00.000Z");
    expect(fields[13]).toBe("content");
  });

  it("handles non-array topics gracefully", () => {
    const item: ExportItem = {
      ...sampleItem,
      analysis: {
        ...sampleItem.analysis!,
        topics: "not-an-array",
      },
    };
    const csv = itemsToCsv([item]);
    const lines = csv.split("\n");
    const fields = parseCsvRow(lines[1]);
    expect(fields[7]).toBe("");
  });
});

/**
 * Minimal CSV row parser supporting quoted fields, doubled-quote escaping,
 * and embedded commas/newlines (callers must join multi-line rows first).
 */
function parseCsvRow(row: string): string[] {
  const fields: string[] = [];
  let i = 0;
  while (i <= row.length) {
    if (i < row.length && row[i] === '"') {
      // Quoted field.
      i++; // skip opening quote
      let value = "";
      while (i < row.length) {
        if (row[i] === '"') {
          if (i + 1 < row.length && row[i + 1] === '"') {
            value += '"';
            i += 2;
          } else {
            i++; // skip closing quote
            break;
          }
        } else {
          value += row[i];
          i++;
        }
      }
      fields.push(value);
      // Skip trailing comma
      if (i < row.length && row[i] === ",") i++;
      else break;
    } else {
      // Unquoted field.
      const commaIdx = row.indexOf(",", i);
      if (commaIdx === -1) {
        fields.push(row.slice(i));
        break;
      } else {
        fields.push(row.slice(i, commaIdx));
        i = commaIdx + 1;
      }
    }
  }
  return fields;
}
