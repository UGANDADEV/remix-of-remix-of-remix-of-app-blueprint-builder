import { describe, expect, it } from "vitest";
import { VEHICLES, offerLabel, searchPlaces, tripTotal } from "@/lib/move-data";
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
    expect(searchPlaces("slaugh")[0]?.id).toBe("slaughter");
    expect(searchPlaces("gulu")).toEqual([]);
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
