import type { Food } from "./schema";

type Row = [id: string, name: string, serving: string, kcal: number, p: number, c: number, f: number, tags: string[], favorite?: boolean];

/** Typical values; real dishes vary a lot by cook. Edit any of them in Fuel → Foods. */
const ROWS: Row[] = [
  ["nasi-putih", "Nasi putih", "1 cup (160 g)", 205, 4, 45, 0.5, ["id", "staple"], true],
  ["nasi-goreng", "Nasi goreng", "1 plate (~300 g)", 500, 15, 65, 20, ["id"]],
  ["mie-goreng", "Mie goreng", "1 plate (~300 g)", 480, 13, 60, 20, ["id"]],
  ["indomie-goreng", "Indomie goreng", "1 pack", 380, 8, 54, 14, ["id"]],
  ["ayam-bakar", "Ayam bakar", "1 piece (~150 g)", 300, 30, 6, 17, ["id"], true],
  ["ayam-goreng", "Ayam goreng", "1 piece (~120 g)", 290, 25, 5, 19, ["id"]],
  ["dada-ayam", "Dada ayam rebus/panggang", "100 g", 165, 31, 0, 4, ["id", "lean"], true],
  ["sate-ayam", "Sate ayam + bumbu kacang", "10 sticks", 450, 35, 18, 26, ["id"]],
  ["tempe-goreng", "Tempe goreng", "2 pieces (~100 g)", 280, 18, 10, 19, ["id"], true],
  ["tahu-goreng", "Tahu goreng", "2 pieces (~100 g)", 270, 17, 10, 20, ["id"]],
  ["telur-rebus", "Telur rebus", "1 egg", 78, 6, 0.6, 5, ["id", "staple"], true],
  ["telur-ceplok", "Telur ceplok/dadar", "1 egg", 100, 6.5, 0.5, 8, ["id"]],
  ["gado-gado", "Gado-gado", "1 plate", 400, 15, 30, 25, ["id"]],
  ["soto-ayam", "Soto ayam (no rice)", "1 bowl", 300, 22, 20, 14, ["id"]],
  ["bakso", "Bakso", "1 bowl", 380, 20, 40, 15, ["id"]],
  ["rendang", "Rendang daging", "100 g", 250, 22, 6, 15, ["id"]],
  ["nasi-padang", "Nasi padang (rice + rendang + sayur)", "1 plate", 750, 30, 85, 30, ["id"]],
  ["martabak-manis", "Martabak manis", "1 slice", 280, 5, 38, 12, ["id"]],
  ["pisang", "Pisang", "1 medium", 105, 1.3, 27, 0.4, ["id", "fruit"]],
  ["es-teh-manis", "Es teh manis", "1 glass", 120, 0, 30, 0, ["id", "drink"]],
  ["kopi-susu-aren", "Es kopi susu gula aren", "1 cup", 200, 4, 30, 7, ["id", "drink"]],
  ["whey", "Whey protein", "1 scoop (30 g)", 120, 24, 3, 1.5, ["supplement"], true],
  ["oats", "Oats", "40 g", 150, 5, 27, 2.7, ["staple"]],
  ["greek-yogurt", "Greek yogurt, plain", "170 g", 100, 17, 6, 0.7, []],
  ["milk", "Full-cream milk", "250 ml", 155, 8, 12, 8, ["drink"]],
  ["peanut-butter", "Peanut butter", "1 tbsp (16 g)", 95, 3.5, 3.5, 8, []],
  ["salmon", "Salmon, cooked", "100 g", 206, 22, 0, 12, []],
  ["lean-beef", "Lean beef, cooked", "100 g", 215, 26, 0, 12, []],
];

export function seedFoods(): Food[] {
  return ROWS.map(([id, name, serving, kcal, protein, carbs, fat, tags, favorite]) => ({
    id,
    name,
    serving,
    kcal,
    protein,
    carbs,
    fat,
    tags,
    favorite: Boolean(favorite),
  }));
}
