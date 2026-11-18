import { describe, it, expect } from "vitest";
import {
  mapSourceToSequenceTime,
  mapSilenceIntervalsToSequence,
  isPremiereAvailable,
  ClipInfo,
} from "./premiere.client";

describe("Premiere Client - Time Mapping & Adapter", () => {
  const sampleClip: ClipInfo = {
    name: "Interview_Speaker.mp4",
    mediaPath: "C:\\Media\\interview.mp4",
    startInSequence: 120.0,
    endInSequence: 180.0,
    sourceInPoint: 10.0,
    sourceOutPoint: 70.0,
    trackIndex: 0,
    trackType: "video",
  };

  it("reports false for isPremiereAvailable in standard test environment", () => {
    expect(isPremiereAvailable()).toBe(false);
  });

  it("correctly maps source time inside clip range to sequence timeline time", () => {
    // Offset in source: 15.0 - 10.0 = 5.0s -> sequence time: 120.0 + 5.0 = 125.0s
    const seqTime = mapSourceToSequenceTime(15.0, sampleClip);
    expect(seqTime).toBe(125.0);
  });

  it("returns null when source time is before clip sourceInPoint", () => {
    const seqTime = mapSourceToSequenceTime(5.0, sampleClip);
    expect(seqTime).toBeNull();
  });

  it("returns null when source time is after clip sourceOutPoint", () => {
    const seqTime = mapSourceToSequenceTime(75.0, sampleClip);
    expect(seqTime).toBeNull();
  });

  it("maps and clamps silence intervals to sequence timeline time", () => {
    const intervals = [
      { start: 0.0, end: 5.0 },    // completely before clip -> dropped
      { start: 12.0, end: 18.0 },  // inside clip -> [122.0, 128.0]
      { start: 65.0, end: 80.0 },  // partially outside -> clamped to 70.0 -> [175.0, 180.0]
      { start: 85.0, end: 90.0 },  // completely after clip -> dropped
    ];

    const mapped = mapSilenceIntervalsToSequence(intervals, sampleClip);
    expect(mapped.length).toBe(2);
    expect(mapped[0].start).toBeCloseTo(122.0, 1);
    expect(mapped[0].end).toBeCloseTo(128.0, 1);
    expect(mapped[1].start).toBeCloseTo(175.0, 1);
    expect(mapped[1].end).toBeCloseTo(180.0, 1);
  });
});
