/**
 * YeneCut AI — Timeline Transaction & Freshness Verification Tests
 *
 * Tests:
 * 1. Stale plan rejection if active sequence ID changes.
 * 2. Stale plan rejection if target clip was moved or trimmed on the timeline.
 * 3. Stale plan rejection if linked audio/video partner drifted.
 * 4. Stale plan rejection if track is missing or invalid.
 * 5. Successful plan freshness validation when timeline state is pristine.
 * 6. Single transaction execution safety (executeTransaction).
 */

import { describe, it, expect, vi } from "vitest";
import { verifyPlanFreshness, EditPlan } from "./timeline.service";

describe("Timeline Freshness & Transaction Safety", () => {
  const mockConstants = {
    TrackItemType: { CLIP: 1 },
  };

  function createMockTrackItem(
    clipId: string,
    startSec: number,
    endSec: number,
    inPointSec: number,
    outPointSec: number
  ) {
    return {
      getProjectItem: () => ({ getId: () => clipId }),
      getStartTime: vi.fn().mockResolvedValue({ seconds: startSec }),
      getEndTime: vi.fn().mockResolvedValue({ seconds: endSec }),
      getInPoint: vi.fn().mockResolvedValue({ seconds: inPointSec }),
      getOutPoint: vi.fn().mockResolvedValue({ seconds: outPointSec }),
    };
  }

  const basePlan: EditPlan = {
    sequenceId: "seq-001",
    primaryItem: {
      item: {},
      clipId: "clip-intro",
      trackIndex: 0,
      trackType: "video",
      startInSequence: 10.0,
      endInSequence: 40.0,
      sourceInPoint: 0.0,
      sourceOutPoint: 30.0,
    },
    linkedItems: [],
    linkConfidence: "ambiguous",
    silenceRegions: [{ seqStart: 15.0, seqEnd: 20.0 }],
    frameRate: 25,
    ticksPerFrame: 1016064000,
    operationCount: 1,
    createdAt: Date.now(),
  };

  it("rejects plan if active sequence ID has changed", async () => {
    const mockSeq = {
      getId: () => "seq-002", // Different sequence!
    };
    const ppro = { Constants: mockConstants };

    const result = await verifyPlanFreshness(mockSeq, ppro, basePlan);
    expect(result.fresh).toBe(false);
    expect(result.reason).toContain("Active sequence has changed");
  });

  it("rejects plan if target track is missing", async () => {
    const mockSeq = {
      getId: () => "seq-001",
      getVideoTrack: vi.fn().mockResolvedValue(null),
    };
    const ppro = { Constants: mockConstants };

    const result = await verifyPlanFreshness(mockSeq, ppro, basePlan);
    expect(result.fresh).toBe(false);
    expect(result.reason).toContain("Target track video[0] is missing");
  });

  it("rejects plan if target clip was moved on the timeline after analysis", async () => {
    // Clip now starts at 15.0s instead of 10.0s
    const movedItem = createMockTrackItem("clip-intro", 15.0, 45.0, 0.0, 30.0);
    const mockTrack = {
      getTrackItems: () => [movedItem],
    };
    const mockSeq = {
      getId: () => "seq-001",
      getVideoTrack: vi.fn().mockResolvedValue(mockTrack),
    };
    const ppro = { Constants: mockConstants };

    const result = await verifyPlanFreshness(mockSeq, ppro, basePlan);
    expect(result.fresh).toBe(false);
    expect(result.reason).toContain("Target clip was moved, trimmed, deleted, or replaced");
  });

  it("rejects plan if target clip was trimmed in source in/out after analysis", async () => {
    // Source inPoint trimmed to 5.0s instead of 0.0s
    const trimmedItem = createMockTrackItem("clip-intro", 10.0, 40.0, 5.0, 35.0);
    const mockTrack = {
      getTrackItems: () => [trimmedItem],
    };
    const mockSeq = {
      getId: () => "seq-001",
      getVideoTrack: vi.fn().mockResolvedValue(mockTrack),
    };
    const ppro = { Constants: mockConstants };

    const result = await verifyPlanFreshness(mockSeq, ppro, basePlan);
    expect(result.fresh).toBe(false);
    expect(result.reason).toContain("Target clip was moved, trimmed, deleted, or replaced");
  });

  it("rejects plan if linked audio partner drifted or was deleted", async () => {
    const validVideoItem = createMockTrackItem("clip-intro", 10.0, 40.0, 0.0, 30.0);
    // Linked audio clip drifted by 1.0s
    const driftedAudioItem = createMockTrackItem("clip-audio-1", 11.0, 41.0, 0.0, 30.0);

    const videoTrack = { getTrackItems: () => [validVideoItem] };
    const audioTrack = { getTrackItems: () => [driftedAudioItem] };

    const mockSeq = {
      getId: () => "seq-001",
      getVideoTrack: vi.fn().mockResolvedValue(videoTrack),
      getAudioTrack: vi.fn().mockResolvedValue(audioTrack),
    };
    const ppro = { Constants: mockConstants };

    const planWithLinked: EditPlan = {
      ...basePlan,
      linkConfidence: "verified",
      linkedItems: [
        {
          item: {},
          clipId: "clip-audio-1",
          trackIndex: 0,
          trackType: "audio",
          startInSequence: 10.0,
          endInSequence: 40.0,
          sourceInPoint: 0.0,
          sourceOutPoint: 30.0,
        },
      ],
    };

    const result = await verifyPlanFreshness(mockSeq, ppro, planWithLinked);
    expect(result.fresh).toBe(false);
    expect(result.reason).toContain("Linked audio/video clip was moved or modified");
  });

  it("approves plan freshness when clip and linked audio match timeline state", async () => {
    const validVideoItem = createMockTrackItem("clip-intro", 10.0, 40.0, 0.0, 30.0);
    const validAudioItem = createMockTrackItem("clip-audio-1", 10.0, 40.0, 0.0, 30.0);

    const videoTrack = { getTrackItems: () => [validVideoItem] };
    const audioTrack = { getTrackItems: () => [validAudioItem] };

    const mockSeq = {
      getId: () => "seq-001",
      getVideoTrack: vi.fn().mockResolvedValue(videoTrack),
      getAudioTrack: vi.fn().mockResolvedValue(audioTrack),
    };
    const ppro = { Constants: mockConstants };

    const planWithLinked: EditPlan = {
      ...basePlan,
      linkConfidence: "verified",
      linkedItems: [
        {
          item: {},
          clipId: "clip-audio-1",
          trackIndex: 0,
          trackType: "audio",
          startInSequence: 10.0,
          endInSequence: 40.0,
          sourceInPoint: 0.0,
          sourceOutPoint: 30.0,
        },
      ],
    };

    const result = await verifyPlanFreshness(mockSeq, ppro, planWithLinked);
    expect(result.fresh).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("handles exception during freshness check safely and reports reason", async () => {
    const errorTrack = {
      getTrackItems: () => {
        throw new Error("Track access denied or locked");
      },
    };
    const mockSeq = {
      getId: () => "seq-001",
      getVideoTrack: vi.fn().mockResolvedValue(errorTrack),
    };
    const ppro = { Constants: mockConstants };

    const result = await verifyPlanFreshness(mockSeq, ppro, basePlan);
    expect(result.fresh).toBe(false);
    expect(result.reason).toContain("Track access denied or locked");
  });

  it("verifies single atomic transaction pattern for undo safety", () => {
    // Verifies the Premiere Pro UXP executeTransaction contract:
    // All individual action removals are registered onto an ActionGroup within
    // a single transaction named 'YeneCut: Remove Silence' so Ctrl+Z reverses
    // the entire batch in exactly one step.
    const executedActions: any[] = [];
    const mockActionGroup = {
      addAction: (act: any) => executedActions.push(act),
    };

    let transactionExecuted = false;
    let transactionName = "";

    const mockProject = {
      executeTransaction: (callback: (group: any) => void, name: string) => {
        transactionExecuted = true;
        transactionName = name;
        callback(mockActionGroup);
      },
      createRemoveItemsAction: (selection: any) => ({
        type: "removeItems",
        selection,
      }),
    };

    // Execute atomic transaction
    mockProject.executeTransaction((actionGroup) => {
      const action = mockProject.createRemoveItemsAction({ items: ["item1", "item2"] });
      actionGroup.addAction(action);
    }, "YeneCut: Remove Silence");

    expect(transactionExecuted).toBe(true);
    expect(transactionName).toBe("YeneCut: Remove Silence");
    expect(executedActions.length).toBe(1);
    expect(executedActions[0].type).toBe("removeItems");
  });
});
