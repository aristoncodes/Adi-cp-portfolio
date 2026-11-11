import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { platformSnapshots } from "@/lib/db/schema";
import { adapters } from "@/lib/platforms";
import type { Platform, SyncResult } from "@/lib/platforms/types";

const HANDLES: Partial<Record<Platform, string>> = {
  codeforces: process.env.CODEFORCES_HANDLE,
  leetcode: process.env.LEETCODE_HANDLE,
  atcoder: process.env.ATCODER_HANDLE,
  codechef: process.env.CODECHEF_HANDLE,
};

export interface SyncOutcome {
  syncedAt: string;
  results: SyncResult[];
}

// Shared by /api/sync (Vercel Cron, daily) and the admin "resync now"
// action — the only two places external platform APIs get called.
// Public pages read exclusively from the DB, so a flaky third party
// never blocks a visitor request.
export async function runSync(): Promise<SyncOutcome> {
  const db = getDb();
  const results: SyncResult[] = [];

  for (const [platform, adapter] of Object.entries(adapters) as [
    Platform,
    (typeof adapters)[Platform],
  ][]) {
    const handle = HANDLES[platform];
    if (!adapter || !handle) {
      continue; // adapter not built yet, or handle not configured
    }

    try {
      const profile = await adapter.fetchProfile(handle);
      await db
        .insert(platformSnapshots)
        .values({
          platform,
          status: "ok",
          data: profile,
          error: null,
          fetchedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: platformSnapshots.platform,
          set: {
            status: "ok",
            data: profile,
            error: null,
            fetchedAt: new Date(),
          },
        });
      results.push({ platform, status: "ok", profile });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Last-good data stays in place; only the status/error columns
      // are updated so the UI can show "stale" instead of erroring.
      try {
        await db
          .update(platformSnapshots)
          .set({ status: "failed", error: message })
          .where(eq(platformSnapshots.platform, platform));
      } catch {
        // DB itself may be unreachable — the result below still
        // reports the original failure either way.
      }
      results.push({ platform, status: "failed", profile: null, error: message });
    }
  }

  // Both are statically prerendered, so without this they'd keep
  // serving their build-time snapshot forever regardless of what just
  // got written to the DB above.
  revalidatePath("/");
  revalidatePath("/opengraph-image");

  return { syncedAt: new Date().toISOString(), results };
}
