import { describe, expect, it, vi } from "vitest";
import type { CorrectionEvent } from "../domain/correction-history";
import { CORRECTION_HISTORY_HEADERS, saveCorrectionEvents } from "./correction-history-persistence";

const event: CorrectionEvent = {
  id: "id", recordedAt: "2026-07-22T00:00:00.000Z", sourceKind: "screenshot", candidateIndex: 0,
  field: "orchard", beforeValue: "国着", afterValue: "国道", dictionaryEligible: true,
};

describe("correction history persistence", () => {
  it("見出し順に補正イベントを追記する", async () => {
    const client = { getHeaderRow: vi.fn().mockResolvedValue(CORRECTION_HISTORY_HEADERS), appendRows: vi.fn() };
    await saveCorrectionEvents({ client, spreadsheetId: "sheet", events: [event] });
    expect(client.appendRows).toHaveBeenCalledWith(expect.objectContaining({
      sheetName: "補正履歴", rows: [["id", event.recordedAt, "screenshot", 1, "orchard", "国着", "国道", "対象"]],
    }));
  });
});
