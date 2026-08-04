import type { Platform } from "../lib/types";
import { geeksforgeeksAdapter } from "./geeksforgeeks";
import { hackerrankAdapter } from "./hackerrank";
import { leetcodeAdapter } from "./leetcode";
import type { PlatformAdapter } from "./types";

export type { PlatformAdapter, TaskInfo } from "./types";

/** All supported coding-platform adapters, in deterministic match order. */
export const adapters: PlatformAdapter[] = [
  hackerrankAdapter,
  leetcodeAdapter,
  geeksforgeeksAdapter,
];

/** Returns the adapter for the given URL, or null when no platform matches. */
export function detectAdapter(url: string = location.href): PlatformAdapter | null {
  return adapters.find((a) => a.matches(url)) ?? null;
}

/** Convenience: resolves just the platform code for the given URL. */
export function detectPlatform(url: string = location.href): Platform {
  return detectAdapter(url)?.platform ?? "unknown";
}
