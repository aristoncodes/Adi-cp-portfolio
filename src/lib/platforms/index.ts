import { atcoderAdapter } from "./atcoder";
import { codechefAdapter } from "./codechef";
import { codeforcesAdapter } from "./codeforces";
import { leetcodeAdapter } from "./leetcode";
import type { Platform, PlatformAdapter } from "./types";

export const adapters: Record<Platform, PlatformAdapter | null> = {
  codeforces: codeforcesAdapter,
  leetcode: leetcodeAdapter,
  atcoder: atcoderAdapter,
  codechef: codechefAdapter, // scrapes the public profile page (no API)
};

export * from "./types";
