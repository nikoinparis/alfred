import { describe, expect, it } from "vitest";
import { parseMacroList } from "./macro-import";

describe("parseMacroList", () => {
  it("reads Claude's lines, forgiving formatting", () => {
    const e = parseMacroList(`Here you go:
\`\`\`
Kellogg's Corn Flakes + honey (2 servings) | 420 kcal | P 8 | C 92 | F 2
- Triple meat supreme kebab | 780 | protein: 42g | carbs: 60g | fat: 40g
Oreo milkshake w/ Baileys & Kahlua (1 cup) | 650 kcal | P 10 | C 70 | F 30
\`\`\``)!;
    expect(e.items.map((i) => i.name)).toEqual([
      "Kellogg's Corn Flakes + honey",
      "Triple meat supreme kebab",
      "Oreo milkshake w/ Baileys & Kahlua",
    ]);
    expect(e.items[0]).toMatchObject({ portion: "2 servings", kcal: 420, protein: 8, carbs: 92, fat: 2 });
    expect(e.items[1]).toMatchObject({ kcal: 780, protein: 42, carbs: 60, fat: 40 });
  });

  it("leaves normal descriptions for the AI", () => {
    expect(parseMacroList("2 servings of kellogs with honey, kebab and fries")).toBeNull();
  });
});
