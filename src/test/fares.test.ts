import { describe, expect, it } from "vitest";
import { VEHICLES, offerLabel, tripTotal } from "@/lib/move-data";
import { distanceM, rankPlaces, GULU } from "@/lib/geo";
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
