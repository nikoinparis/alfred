/**
 * Match what you typed against your saved foods, so repeat meals log instantly without an AI call.
 *
 * "2 servings of kellogs", "kellogs x2", "half a bowl of cereal and 2 telur rebus": every part has
 * to match a saved food, otherwise the whole text goes to Claude.
 */

export interface MatchableFood {
  id: string;
  name: string;
  favorite?: boolean;
  lastUsed?: number;
}

export interface QuickMatch<F extends MatchableFood> {
  food: F;
  servings: number;
}

const WORD_NUM: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  half: 0.5,
  double: 2,
  satu: 1,
  dua: 2,
  tiga: 3,
  setengah: 0.5,
};
const UNITS =
  /^(servings?|portions?|porsi|bowls?|mangkok|cups?|gelas|glass(es)?|plates?|piring|pieces?|pcs|packs?|bungkus|scoops?|slices?|biji|buah|times)$/;
const FILLER = new Set(["a", "an", "of", "my", "the", "usual", "some", "x", "×"]);

function normalize(s: string) {
  return s
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9.½/ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s: string) {
  return normalize(s).split(" ").filter(Boolean);
}

function parseNumber(t: string): number | null {
  if (t === "½") return 0.5;
  if (/^\d+(\.\d+)?$/.test(t)) return Number(t);
  const frac = /^(\d+)\/(\d+)$/.exec(t);
  if (frac && Number(frac[2]) > 0) return Number(frac[1]) / Number(frac[2]);
  const x = /^x?(\d+(\.\d+)?)x?$/.exec(t);
  if (x) return Number(x[1]);
  return WORD_NUM[t] ?? null;
}

/** Edit distance, capped: we only care whether it's 0, 1 or "more". */
function within1(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

function tokenMatches(q: string, f: string) {
  if (q === f) return true;
  if (q.length >= 3 && f.startsWith(q)) return true; // "kell" → "kelloggs"
  return q.length >= 5 && within1(q, f); // "kellogs" ↔ "kelloggs"
}

/** Split "2 bowls of cereal" into quantity 2 and the words ["cereal"]. */
function parsePart(part: string): { servings: number; words: string[] } | null {
  let servings: number | null = null;
  const words: string[] = [];
  for (const t of tokens(part)) {
    const n = parseNumber(t);
    if (n !== null && servings === null && (words.length === 0 || /^x?\d/.test(t))) {
      servings = n;
      continue;
    }
    if (UNITS.test(t) || FILLER.has(t)) continue;
    words.push(t);
  }
  if (!words.length) return null;
  const s = servings ?? 1;
  return s > 0 && s <= 20 ? { servings: s, words } : null;
}

function bestFood<F extends MatchableFood>(words: string[], foods: F[]): F | null {
  let best: F | null = null;
  let bestScore = 0;
  for (const food of foods) {
    const ft = tokens(food.name);
    if (!words.every((w) => ft.some((t) => tokenMatches(w, t)))) continue;
    const coverage = ft.filter((t) => words.some((w) => tokenMatches(w, t))).length / ft.length;
    const score = coverage * 10 + (food.favorite ? 1 : 0) + (food.lastUsed ? 0.5 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = food;
    }
  }
  return best;
}

export function matchSavedFoods<F extends MatchableFood>(text: string, foods: F[]): QuickMatch<F>[] | null {
  const parts = text
    .split(/,|\+|&|\band\b|\bdan\b|\bwith\b|\bpakai\b/i)
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) return null;
  const out: QuickMatch<F>[] = [];
  for (const part of parts) {
    const parsed = parsePart(part);
    if (!parsed) return null;
    const food = bestFood(parsed.words, foods);
    if (!food) return null;
    out.push({ food, servings: parsed.servings });
  }
  return out;
}
