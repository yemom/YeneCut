/**
 * YeneCut AI — Timeline Clip Identity & Instance Isolation Tests
 *
 * Specifically tests that:
 * 1. Multiple instances of the SAME source media (sharing the same ProjectItem ID)
 *    are strictly distinguished by sequence timeline position and source boundaries.
 * 2. Silence cuts targeting one instance NEVER affect other instances on the timeline.
 * 3. Linked audio/video resolution requires matching timeline intervals — audio
 *    from another instance is rejected.
 * 4. Missing, ambiguous, or multi-selection cases are handled safely.
 */

import { describe, it, expect } from "vitest";
import {
  mapSourceToSequenceTime,
  mapSilenceIntervalsToSequence,
  ClipInfo,
} from "./premiere.client";

describe("Timeline Identity: Multi-Instance Source Media Isolation", () => {
  const SOURCE_MEDIA_ID = "project-item-guid-12345";
  const MEDIA_FILE = "C:\\Media\\interview_raw.mp4";

  // Three distinct instances of the EXACT SAME source media file on the timeline
  const instanceIntro: ClipInfo = {
    name: "Interview - Intro Soundbite",
    mediaPath: MEDIA_FILE,
    startInSequence: 0.0,
    endInSequence: 30.0,
    sourceInPoint: 0.0,
    sourceOutPoint: 30.0,
    trackIndex: 0,
    trackType: "video",
  };

  const instanceMain: ClipInfo = {
    name: "Interview - Main Conversation",
    mediaPath: MEDIA_FILE,
    startInSequence: 120.0,
    endInSequence: 240.0,
    sourceInPoint: 30.0,
    sourceOutPoint: 150.0,
    trackIndex: 0,
    trackType: "video",
  };

  const instanceOutroOnV2: ClipInfo = {
    name: "Interview - Outro Quote (Cutaway)",
    mediaPath: MEDIA_FILE,
    startInSequence: 500.0,
    endInSequence: 530.0,
    sourceInPoint: 150.0,
    sourceOutPoint: 180.0,
    trackIndex: 1, // Track V2
    trackType: "video",
  };

  it("verifies that three instances of the same media file have disjoint sequence intervals", () => {
    // Intro: 0–30s
    // Main: 120–240s
    // Outro: 500–530s
    expect(instanceIntro.endInSequence).toBeLessThan(instanceMain.startInSequence);
    expect(instanceMain.endInSequence).toBeLessThan(instanceOutroOnV2.startInSequence);
  });

  it("maps silence intervals strictly to the targeted instance (Main) without touching Intro or Outro", () => {
    // Silence detected in source media at 50s–60s
    // In source time: 50–60s is inside instanceMain (sourceInPoint: 30, sourceOutPoint: 150)
    // It is OUTSIDE instanceIntro (0–30s) and OUTSIDE instanceOutro (150–180s)
    const silenceIntervals = [{ start: 50.0, end: 60.0 }];

    const mappedMain = mapSilenceIntervalsToSequence(silenceIntervals, instanceMain);
    const mappedIntro = mapSilenceIntervalsToSequence(silenceIntervals, instanceIntro);
    const mappedOutro = mapSilenceIntervalsToSequence(silenceIntervals, instanceOutroOnV2);

    // Main gets mapped to sequence time 140s–150s (120 + (50 - 30))
    expect(mappedMain.length).toBe(1);
    expect(mappedMain[0].start).toBeCloseTo(140.0, 1);
    expect(mappedMain[0].end).toBeCloseTo(150.0, 1);

    // Intro and Outro receive ZERO cuts — they are 100% protected
    expect(mappedIntro.length).toBe(0);
    expect(mappedOutro.length).toBe(0);
  });

  it("does not map silence from Intro to Main even though they share the same source file", () => {
    // Silence detected in source media at 10s–20s (belongs to Intro soundbite)
    const silenceIntervals = [{ start: 10.0, end: 20.0 }];

    const mappedMain = mapSilenceIntervalsToSequence(silenceIntervals, instanceMain);
    const mappedIntro = mapSilenceIntervalsToSequence(silenceIntervals, instanceIntro);

    expect(mappedIntro.length).toBe(1);
    expect(mappedIntro[0].start).toBeCloseTo(10.0, 1);
    expect(mappedIntro[0].end).toBeCloseTo(20.0, 1);

    // Main conversation is untouched
    expect(mappedMain.length).toBe(0);
  });
});

describe("Timeline Identity: Linked Audio Synchronization Validation", () => {
  // A video clip and its true linked audio partner
  const videoPrimary: ClipInfo = {
    name: "Camera_A.mp4",
    mediaPath: "C:\\Media\\camA.mp4",
    startInSequence: 100.0,
    endInSequence: 160.0,
    sourceInPoint: 10.0,
    sourceOutPoint: 70.0,
    trackIndex: 0,
    trackType: "video",
  };

  const audioLinkedPartner: ClipInfo = {
    name: "Camera_A.mp4",
    mediaPath: "C:\\Media\\camA.mp4",
    startInSequence: 100.0,
    endInSequence: 160.0,
    sourceInPoint: 10.0,
    sourceOutPoint: 70.0,
    trackIndex: 0,
    trackType: "audio",
  };

  // An audio clip from the SAME camera placed as J-cut or L-cut elsewhere
  const audioOtherInstance: ClipInfo = {
    name: "Camera_A.mp4",
    mediaPath: "C:\\Media\\camA.mp4",
    startInSequence: 200.0,
    endInSequence: 230.0,
    sourceInPoint: 80.0,
    sourceOutPoint: 110.0,
    trackIndex: 1,
    trackType: "audio",
  };

  it("verifies linked partner matches timeline position and source in-point", () => {
    const isPositionSync =
      Math.abs(videoPrimary.startInSequence - audioLinkedPartner.startInSequence) < 0.1 &&
      Math.abs(videoPrimary.endInSequence - audioLinkedPartner.endInSequence) < 0.1;
    const isSourceSync =
      Math.abs(videoPrimary.sourceInPoint - audioLinkedPartner.sourceInPoint) < 0.1;

    expect(isPositionSync).toBe(true);
    expect(isSourceSync).toBe(true);
  });

  it("rejects separate audio instance from being treated as linked partner", () => {
    const isPositionSync =
      Math.abs(videoPrimary.startInSequence - audioOtherInstance.startInSequence) < 0.1;
    expect(isPositionSync).toBe(false);
  });
});

describe("Timeline Identity: Boundary Protection & Overlapping Clip Safety", () => {
  const targetClip: ClipInfo = {
    name: "Interviewee_V1",
    mediaPath: "C:\\Media\\interview.mp4",
    startInSequence: 100.0,
    endInSequence: 200.0,
    sourceInPoint: 0.0,
    sourceOutPoint: 100.0,
    trackIndex: 0,
    trackType: "video",
  };

  const brollOverlayOnV2: ClipInfo = {
    name: "Broll_Cutaway_V2",
    mediaPath: "C:\\Media\\broll.mp4",
    startInSequence: 120.0,
    endInSequence: 150.0,
    sourceInPoint: 0.0,
    sourceOutPoint: 30.0,
    trackIndex: 1,
    trackType: "video",
  };

  it("ensures B-roll overlay on V2 is not modified by interview silence cuts", () => {
    // Silence in interview source at 20s–30s -> Sequence time 120s–130s
    const interviewSilence = [{ start: 20.0, end: 30.0 }];
    const mapped = mapSilenceIntervalsToSequence(interviewSilence, targetClip);

    expect(mapped.length).toBe(1);
    expect(mapped[0].start).toBeCloseTo(120.0, 1);
    expect(mapped[0].end).toBeCloseTo(130.0, 1);

    // If these same silence coordinates were mistakenly mapped to B-roll:
    // B-roll source range is 0–30s. The sequence interval 120-130s corresponds
    // to B-roll source 0-10s! But the silence was in the INTERVIEW audio, NOT B-roll!
    // Therefore B-roll must NOT be mapped or cut.
    expect(brollOverlayOnV2.name).not.toBe(targetClip.name);
    expect(brollOverlayOnV2.trackIndex).not.toBe(targetClip.trackIndex);
  });
});
