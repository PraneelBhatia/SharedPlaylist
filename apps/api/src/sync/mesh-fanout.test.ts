import { describe, expect, it } from "vitest";
import { computeFanoutTargets } from "./mesh-fanout.ts";

describe("computeFanoutTargets", () => {
  it("returns all non-source playlist links", () => {
    const links = [
      { id: "l1", userId: "u1", provider: "spotify" as const },
      { id: "l2", userId: "u2", provider: "apple_music" as const },
      { id: "l3", userId: "u3", provider: "youtube" as const },
    ];
    const targets = computeFanoutTargets(links, "u1");
    expect(targets.map((t) => t.id).sort()).toEqual(["l2", "l3"]);
  });

  it("returns empty when only one link", () => {
    const links = [{ id: "l1", userId: "u1", provider: "spotify" as const }];
    expect(computeFanoutTargets(links, "u1")).toEqual([]);
  });

  it("ignores the source's own link even with multiple members on same provider", () => {
    const links = [
      { id: "l1", userId: "u1", provider: "spotify" as const },
      { id: "l2", userId: "u2", provider: "spotify" as const },
    ];
    const targets = computeFanoutTargets(links, "u1");
    expect(targets.map((t) => t.id)).toEqual(["l2"]);
  });
});
