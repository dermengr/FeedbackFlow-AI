import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockUpdate } = vi.hoisted(() => ({ mockUpdate: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    feedbackAnalysis: {
      update: mockUpdate,
    },
  },
}));

beforeEach(() => {
  mockUpdate.mockReset();
});

import { assignFeedback } from "@/lib/assign";

describe("assignFeedback", () => {
  it("calls prisma.feedbackAnalysis.update with the correct where/data when assigning", async () => {
    mockUpdate.mockResolvedValue({});

    await assignFeedback("item-1", "user-42");

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { feedbackItemId: "item-1" },
      data: { assignedToId: "user-42" },
    });
  });

  it("unassigns when assignedToId is null", async () => {
    mockUpdate.mockResolvedValue({});

    await assignFeedback("item-1", null);

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { feedbackItemId: "item-1" },
      data: { assignedToId: null },
    });
  });
});
