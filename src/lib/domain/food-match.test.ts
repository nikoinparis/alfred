import { describe, expect, it } from "vitest";
import { matchSavedFoods } from "./food-match";

const foods = [
  { id: "cereal", name: "Kellogg's Corn Flakes + milk", favorite: true },
  { id: "egg", name: "Telur rebus" },
  { id: "ceplok", name: "Telur ceplok/dadar" },
  { id: "nasi", name: "Nasi putih" },
  { id: "nasgor", name: "Nasi goreng" },
];
const m = (t: string) => matchSavedFoods(t, foods)?.map((x) => [x.food.id, x.servings]) ?? null;

describe("matchSavedFoods", () => {
  it("reads quantities in many shapes", () => {
    expect(m("2 servings of kellogs")).toEqual([["cereal", 2]]);
    expect(m("kellogs x2")).toEqual([["cereal", 2]]);
    expect(m("half a bowl of corn flakes")).toEqual([["cereal", 0.5]]);
    expect(m("1.5 nasi putih")).toEqual([["nasi", 1.5]]);
    expect(m("dua telur rebus")).toEqual([["egg", 2]]);
    expect(m("cereal")).toBeNull();
  });

  it("logs several saved foods at once", () => {
    expect(m("2 kellogs and 3 telur rebus")).toEqual([
      ["cereal", 2],
      ["egg", 3],
    ]);
  });

  it("picks the closest food", () => {
    expect(m("nasi goreng")).toEqual([["nasgor", 1]]);
    expect(m("2 telur ceplok")).toEqual([["ceplok", 2]]);
  });

  it("sends anything unknown to the AI", () => {
    expect(m("kebab")).toBeNull();
    expect(m("nasi goreng ayam")).toBeNull();
    expect(m("2 kellogs and a kebab")).toBeNull();
  });
});
