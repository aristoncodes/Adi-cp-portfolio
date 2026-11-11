import { afterEach, describe, expect, it, vi } from "vitest";
import { codechefAdapter } from "./codechef";

// Fixture mirrors the relevant parts of codechef.com/users/<handle>'s
// server-rendered HTML. A failing test here signals markup drift.
const history = [
  { code: "START100", name: "Starters 100", rating: "1500", rank: "900", end_date: "2024-01-10 22:00:00", color: "#666" },
  { code: "START101", name: "Starters 101", rating: "1910", rank: "120", end_date: "2024-02-10 22:00:00", color: "#666" },
  { code: "START102", name: "Starters 102", rating: "1750", rank: "400", end_date: "2024-03-10 22:00:00", color: "#666" },
];

const profileHtml = `
<html><body>
  <div class="rating-header text-center">
    <div class="rating-number">
      1750?                </div>
    <div>(Div 2)</div>
    <div class="rating-star"><span>&#9733;</span><span>&#9733;</span><span>&#9733;</span></div>
    <a href="/ratings"><strong>CodeChef Rating</strong></a>
    <small>(Highest Rating 1910)</small>
  </div>
  <div class="rating-header text-center">
    <div class="rating-number">NA</div>
    <a href="/ratings/dsa-monday"><strong>DSA Rating</strong></a>
    <small>(Highest Rating 0)</small>
  </div>
  <h3>Total Problems Solved: 321</h3>
  <script>
    var all_rating = ${JSON.stringify(history)};
    var current_user_rating = all_rating.length > 0 ? 1 : 0;
  </script>
</body></html>`;

function htmlResponse(body: string) {
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/html" },
  });
}

describe("codechefAdapter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("normalizes a CodeChef profile", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(htmlResponse(profileHtml)));

    const profile = await codechefAdapter.fetchProfile("someuser");

    expect(profile.platform).toBe("codechef");
    expect(profile.profileUrl).toBe("https://www.codechef.com/users/someuser");
    expect(profile.currentRating).toBe(1750); // provisional "?" stripped
    expect(profile.maxRating).toBe(1910);
    expect(profile.rank).toBe("3★");
    expect(profile.maxRank).toBe("4★");
    expect(profile.solvedCount).toBe(321);
    expect(profile.ratingHistory).toHaveLength(3);
    expect(profile.ratingHistory[0]).toEqual({
      contestId: "START100",
      contestName: "Starters 100",
      date: "2024-01-10T16:30:00.000Z", // IST → UTC
      rating: 1500,
    });
  });

  it("throws when the handle doesn't exist (redirected to homepage)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(htmlResponse("<html><body>Home</body></html>")),
    );

    await expect(codechefAdapter.fetchProfile("nope")).rejects.toThrow("not found");
  });

  it("throws on a non-2xx response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response("", { status: 503 })));

    await expect(codechefAdapter.fetchProfile("someuser")).rejects.toThrow("503");
  });
});
