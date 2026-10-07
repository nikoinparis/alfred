---
name: macros
description: Estimate macros for a list of foods I ate and reply in Alfred's paste format, so I can paste the answer into Alfred's Fuel box without using API credits. Use when I list foods or meals and ask for macros, or run /macros.
---

Estimate calories and macros for what I ate, then give me lines I can paste straight into Alfred's "What did you eat?" box.

## How to estimate

- I live in Indonesia. When a dish has no size, assume a typical Indonesian street-food, warung or mall food-court portion and preparation, not a Western one (e.g. "kebab" is an Indonesian street kebab, roughly 350–450 kcal for a regular one; scale up for "triple meat", "jumbo", "mega").
- If I name a brand or chain (Kellogg's, Sushi Go!/Sushi Tei, McDonald's ID, Kebab Turki Baba Rafi), use its published nutrition or menu info when you know it.
- If I give an amount (servings, cups, grams, "1.5 menu"), scale to it.
- Count hidden calories: cooking oil, mayo and sauces, sugar and honey, milk, ice cream, alcohol in drinks (Baileys ~ 100 kcal per 30 ml, Kahlúa ~ 90 kcal per 30 ml).
- Split combo meals into their parts when that makes the estimate clearer, but keep one line per thing I'd recognise eating.
- Round kcal to the nearest 10 and grams to whole numbers. Check that kcal ≈ 4×protein + 4×carbs + 9×fat (alcohol adds ~7 kcal/g on top).

## Reply format

First, a code block containing only the lines, one food per line, exactly in this shape:

```
Name (portion) | 000 kcal | P 00 | C 00 | F 00
```

Then one line with the day's total, and at most two short sentences on the biggest uncertainty (e.g. "The milkshake could be 500–900 kcal depending on how much alcohol and ice cream went in").

Don't add anything else inside the code block: Alfred reads every line that matches the shape.
