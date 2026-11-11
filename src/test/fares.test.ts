import { describe, expect, it } from "vitest";
import { VEHICLES, offerLabel, tripTotal } from "@/lib/move-data";
import { distanceM, inGulu, rankPlaces, GULU } from "@/lib/geo";
import { searchRows, type GuluRow } from "@/lib/gulu-search";
import { isValidEmail, isValidPhone } from "@/lib/validation";

describe("fares", () => {
  it("lists bus at ₦300, mini bus at ₦400 and taxi at ₦600 per seat", () => {
    expect(VEHICLES.map((v) => [v.id, v.pricePerSeat])).toEqual([
      ["bus", 300],
      ["minibus", 400],
      ["taxi", 600],
    ]);
  });

  it("multiplies the price per seat by seats booked", () => {
    expect(tripTotal(300, 1)).toBe(300);
    expect(tripTotal(300, 3)).toBe(900);
  });

  it("labels an offer ₦200 above the named price", () => {
    expect(offerLabel(500, 300)).toEqual({ tone: "above", text: "₦200 above your offer" });
    expect(offerLabel(300, 300).text).toBe("Matches your offer");
  });
});

describe("search", () => {
  it("finds Slaughter and reports nothing for gulu", () => {
    const near = { id: "a", short: "Gulu Market", name: "Gulu Market", area: "", lng: GULU[0], lat: GULU[1] };
    const far = { ...near, id: "b", lng: GULU[0] + 1 };
    expect(rankPlaces([far, near], "gulu", GULU)[0]?.id).toBe("a");
    expect(Math.round(distanceM([32.3, 2.77], [32.3, 2.78]) / 10) * 10).toBe(1110);
  });
});

describe("sign-in validation", () => {
  it("accepts real emails and 10+ digit phones only", () => {
    expect(isValidEmail("mainplatform.nexus@gmail.com")).toBe(true);
    expect(isValidEmail("nope@")).toBe(false);
    expect(isValidPhone("0803 123 4567")).toBe(true);
    expect(isValidPhone("12345")).toBe(false);
  });
});

describe("Gulu-only search", () => {
  const rows: GuluRow[] = [
    ["Custom Corner", "Junction · Juba Road, Layibi", "area", 32.27854, 2.7618, ["Customs Corner"]],
    ["Kanyagoga A", "Village", "area", 32.29, 2.76],
    ["Gulu Main Market", "Market", "poi", 32.2995, 2.7724],
  ];

  it("finds Custom Corner when typed 'custom corner', 'customs corner' or with a typo", () => {
    for (const q of ["custom corner", "Customs Corner", "custm corner", "custom cor"]) {
      expect(searchRows(rows, q, GULU)[0]?.name).toBe("Custom Corner");
    }
  });

  it("drops results outside Gulu", () => {
    const inside = { id: "a", short: "Market", name: "Market", area: "", lng: 32.3, lat: 2.77 };
    const kampala = { ...inside, id: "k", lng: 32.58, lat: 0.31 };
    expect(rankPlaces([kampala, inside], "market", GULU).map((p) => p.id)).toEqual(["a"]);
  });

  it("the built-in Gulu list has every place inside Gulu and includes Custom Corner", async () => {
    const all = (await import("@/lib/gulu-places.json")).default as unknown as GuluRow[];
    expect(all.length).toBeGreaterThan(1000);
    expect(all.every((r) => inGulu([r[3], r[4]]))).toBe(true);
    expect(searchRows(all, "custom corner", GULU)[0]?.name).toBe("Custom Corner");
    const juba = searchRows(all, "juba road", GULU)[0];
    expect(juba?.name).toBe("Juba Road");
    expect(juba?.area).toContain("Nimule - Gulu Road");
  });
});
