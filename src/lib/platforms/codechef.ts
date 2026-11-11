import type {
  ActivityDay,
  NormalizedProfile,
  PlatformAdapter,
  RatingPoint,
} from "./types";

// CodeChef has no public API, so this scrapes the public profile page
// (codechef.com/users/<handle>). Everything we need is server-rendered:
//   - `<div class="rating-number">3355</div>` — current rating
//     (a trailing "?" marks a provisional rating, e.g. "2608?")
//   - `<small>(Highest Rating 3445)</small>` — peak rating
//   - `<h3>Total Problems Solved: 632</h3>`
//   - `var all_rating = [...]` — inline JSON rating history
// Markup drift is the main risk here (PRD §3); the contract test
// fixture in codechef.test.ts mirrors the real page structure.

interface CodeChefHistoryEntry {
  code: string;
  name: string;
  rating: string;
  end_date: string; // "YYYY-MM-DD HH:mm:ss", IST
}

// Star tiers by rating threshold, same as CodeChef's own coloring.
const STAR_TIERS: { minRating: number; rank: string }[] = [
  { minRating: 2500, rank: "7★" },
  { minRating: 2200, rank: "6★" },
  { minRating: 2000, rank: "5★" },
  { minRating: 1800, rank: "4★" },
  { minRating: 1600, rank: "3★" },
  { minRating: 1400, rank: "2★" },
  { minRating: 0, rank: "1★" },
];

function rankFor(rating: number): string {
  return STAR_TIERS.find((tier) => rating >= tier.minRating)?.rank ?? "1★";
}

function parseIntOrNull(raw: string | undefined): number | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, "");
  return digits ? Number.parseInt(digits, 10) : null;
}

// CodeChef's end_date has no offset and is in IST (UTC+05:30).
function istToIso(date: string): string {
  const parsed = new Date(`${date.replace(" ", "T")}+05:30`);
  return Number.isNaN(parsed.getTime()) ? date : parsed.toISOString();
}

function parseHistory(html: string): RatingPoint[] {
  const match = html.match(/var\s+all_rating\s*=\s*(\[[\s\S]*?\]);/);
  if (!match) return [];
  let entries: CodeChefHistoryEntry[];
  try {
    entries = JSON.parse(match[1]) as CodeChefHistoryEntry[];
  } catch {
    return [];
  }
  return entries
    .map((entry) => ({
      contestId: entry.code,
      contestName: entry.name,
      date: istToIso(entry.end_date),
      rating: Number.parseInt(entry.rating, 10),
    }))
    .filter((point) => Number.isFinite(point.rating));
}

async function fetchProfile(handle: string): Promise<NormalizedProfile> {
  const profileUrl = `https://www.codechef.com/users/${encodeURIComponent(handle)}`;
  const res = await fetch(profileUrl, {
    headers: {
      // Plain browser-ish UA; CodeChef currently serves the page either
      // way, but this avoids looking like an unidentified bot.
      "User-Agent": "Mozilla/5.0 (compatible; cp-portfolio-sync)",
      Accept: "text/html",
    },
    redirect: "follow",
  });
  if (!res.ok) {
    throw new Error(`CodeChef profile request failed: ${res.status}`);
  }
  const html = await res.text();

  const ratingMatch = html.match(/class="rating-number"[^>]*>\s*([^<]*?)\s*</);
  // Unknown handles redirect to the homepage with a 200, so the absence
  // of the profile's rating block is the real "not found" signal.
  if (!ratingMatch && !/var\s+all_rating\s*=/.test(html)) {
    throw new Error(`CodeChef user "${handle}" not found`);
  }

  const ratingHistory = parseHistory(html);
  const historyMax = ratingHistory.length
    ? Math.max(...ratingHistory.map((p) => p.rating))
    : null;

  const currentRating =
    parseIntOrNull(ratingMatch?.[1]) ?? ratingHistory.at(-1)?.rating ?? null;
  // First "(Highest Rating N)" on the page is the main CodeChef rating;
  // later ones belong to secondary ratings (e.g. DSA Rating).
  const highest = parseIntOrNull(html.match(/Highest Rating\s+(\d+)/)?.[1]);
  const maxRating =
    [highest, historyMax, currentRating]
      .filter((n): n is number => n != null && n > 0)
      .reduce<number | null>((a, b) => (a == null ? b : Math.max(a, b)), null);

  const solvedCount = parseIntOrNull(
    html.match(/Total Problems Solved:\s*(\d+)/)?.[1],
  );

  // The submission heatmap is loaded client-side, not in the page HTML.
  const activityCalendar: ActivityDay[] = [];

  return {
    platform: "codechef",
    handle,
    profileUrl,
    currentRating,
    maxRating,
    rank: currentRating != null ? rankFor(currentRating) : null,
    maxRank: maxRating != null ? rankFor(maxRating) : null,
    ratingHistory,
    activityCalendar,
    solvedCount,
    fetchedAt: new Date().toISOString(),
  };
}

export const codechefAdapter: PlatformAdapter = {
  platform: "codechef",
  fetchProfile,
};
