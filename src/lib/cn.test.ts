import { describe, expect, it } from "vitest";
import { cn } from "./cn";

describe("cn", () => {
  it("keeps custom text colours alongside font sizes", () => {
    expect(cn("text-signal-ink text-base")).toBe("text-signal-ink text-base");
    expect(cn("text-fog text-[15px]", "text-bone")).toBe("text-[15px] text-bone");
  });
});
