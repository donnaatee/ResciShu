import { describe, expect, it } from "vitest";
import { formatClock, parseDurations } from "../timers";

const secs = (s: string) => parseDurations(s).map((t) => t.seconds);

describe("parseDurations", () => {
  it("bake the banana bread for 20 mins", () => expect(secs("Bake the banana bread for 20 mins")).toEqual([1200]));
  it("bake 50 minutes.", () => expect(secs("Layer potatoes and sauce, bake 50 minutes.")).toEqual([3000]));
  it("ranges use the shorter time", () => {
    expect(parseDurations("Simmer 10-12 minutes")).toEqual([{ seconds: 600, label: "10 min–12 min" }]);
    expect(secs("Cook 3–4 min per side")).toEqual([180]);
    expect(secs("Bake 25 to 30 minutes")).toEqual([1500]);
  });
  it("hours and minutes together", () => expect(secs("Roast for 1 hour 15 minutes")).toEqual([4500]));
  it("words and fractions", () => {
    expect(secs("Let the dough rest for an hour")).toEqual([3600]);
    expect(secs("Cook 1½ hours")).toEqual([5400]);
    expect(secs("Braise 1 1/2 hrs")).toEqual([5400]);
    expect(secs("Chill for half an hour")).toEqual([1800]);
    expect(secs("Rest ten minutes")).toEqual([600]);
  });
  it("seconds", () => expect(secs("Boil for 30 seconds")).toEqual([30]));
  it("two times in one step", () => expect(secs("Rest 5 minutes, then bake 25 minutes")).toEqual([300, 1500]));
  it("ignores temperatures and amounts", () => {
    expect(secs("Heat oven to 375°F.")).toEqual([]);
    expect(secs("Add 2 cups flour and 1 tsp salt")).toEqual([]);
    expect(secs("Slice potatoes thinly.")).toEqual([]);
  });
});

describe("formatClock", () => {
  it("minutes", () => expect(formatClock(1205)).toBe("20:05"));
  it("hours", () => expect(formatClock(4500)).toBe("1:15:00"));
  it("never negative", () => expect(formatClock(-3)).toBe("0:00"));
});
