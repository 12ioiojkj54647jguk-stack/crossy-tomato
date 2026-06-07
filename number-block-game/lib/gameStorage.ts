export interface LeaderboardEntry {
  score: number;
  date: string;
}

const LEADERBOARD_KEY = "number-block-leaderboard";
const ACHIEVEMENTS_KEY = "number-block-achievements";

export function loadLeaderboard(): LeaderboardEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LEADERBOARD_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLeaderboard(entries: LeaderboardEntry[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(entries));
}

export function addToLeaderboard(score: number): LeaderboardEntry[] {
  const entries = loadLeaderboard();
  entries.push({
    score,
    date: new Date().toLocaleDateString("zh-CN"),
  });
  entries.sort((a, b) => b.score - a.score);
  const trimmed = entries.slice(0, 10);
  saveLeaderboard(trimmed);
  return trimmed;
}

export function getScoreRank(entries: LeaderboardEntry[], score: number): number | null {
  const index = entries.findIndex(entry => entry.score === score);
  return index >= 0 ? index + 1 : null;
}

export function loadAchievements(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ACHIEVEMENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveAchievements(ids: string[]) {
  if (typeof window === "undefined" || ids.length === 0) return;
  localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(ids));
}
