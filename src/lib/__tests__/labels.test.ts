import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma with a mock label model we control from each test.
// vi.hoisted ensures the mock object exists before the hoisted vi.mock call.
const { mockLabel } = vi.hoisted(() => ({
  mockLabel: {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    label: mockLabel,
  },
}));

import {
  listLabels,
  createLabel,
  updateLabel,
  deleteLabel,
  LABEL_COLORS,
} from "@/lib/labels";

beforeEach(() => {
  mockLabel.findMany.mockReset();
  mockLabel.create.mockReset();
  mockLabel.update.mockReset();
  mockLabel.delete.mockReset();
});

describe("labels service", () => {
  describe("listLabels", () => {
    it("returns labels mapped to LabelDto, sorted by name asc", async () => {
      // prisma is asked to order by name asc; simulate the returned order.
      mockLabel.findMany.mockResolvedValue([
        { id: "l1", name: "Bug", color: "red", createdAt: new Date() },
        { id: "l2", name: "Feature", color: "green", createdAt: new Date() },
      ]);

      const labels = await listLabels();

      expect(mockLabel.findMany).toHaveBeenCalledWith({
        orderBy: { name: "asc" },
      });
      expect(labels).toEqual([
        { id: "l1", name: "Bug", color: "red" },
        { id: "l2", name: "Feature", color: "green" },
      ]);
    });

    it("returns an empty array when no labels exist", async () => {
      mockLabel.findMany.mockResolvedValue([]);
      const labels = await listLabels();
      expect(labels).toEqual([]);
    });
  });

  describe("createLabel", () => {
    it("calls prisma.label.create with the provided name and color", async () => {
      mockLabel.create.mockResolvedValue({
        id: "l3",
        name: "Urgent",
        color: "orange",
        createdAt: new Date(),
      });

      const label = await createLabel("Urgent", "orange");

      expect(mockLabel.create).toHaveBeenCalledWith({
        data: { name: "Urgent", color: "orange" },
      });
      expect(label).toEqual({ id: "l3", name: "Urgent", color: "orange" });
    });

    it("throws when given an invalid color", async () => {
      await expect(createLabel("Bad", "not-a-color")).rejects.toThrow(
        /Invalid color/
      );
      expect(mockLabel.create).not.toHaveBeenCalled();
    });

    it("accepts every color in LABEL_COLORS", async () => {
      for (const color of LABEL_COLORS) {
        mockLabel.create.mockResolvedValueOnce({
          id: "x",
          name: "L",
          color,
          createdAt: new Date(),
        });
        const label = await createLabel("L", color);
        expect(label.color).toBe(color);
      }
    });
  });

  describe("updateLabel", () => {
    it("calls prisma.label.update with the provided data", async () => {
      mockLabel.update.mockResolvedValue({
        id: "l1",
        name: "Bug",
        color: "red",
        createdAt: new Date(),
      });

      const label = await updateLabel("l1", { name: "Bugs" });

      expect(mockLabel.update).toHaveBeenCalledWith({
        where: { id: "l1" },
        data: { name: "Bugs" },
      });
      expect(label).toEqual({ id: "l1", name: "Bug", color: "red" });
    });

    it("throws when given an invalid color", async () => {
      await expect(
        updateLabel("l1", { color: "nope" })
      ).rejects.toThrow(/Invalid color/);
      expect(mockLabel.update).not.toHaveBeenCalled();
    });
  });

  describe("deleteLabel", () => {
    it("calls prisma.label.delete with the provided id", async () => {
      mockLabel.delete.mockResolvedValue({ id: "l1" });

      await deleteLabel("l1");

      expect(mockLabel.delete).toHaveBeenCalledWith({
        where: { id: "l1" },
      });
    });
  });
});
