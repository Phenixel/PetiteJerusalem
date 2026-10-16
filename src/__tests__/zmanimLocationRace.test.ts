import { describe, expect, it, vi } from "vitest";
import type { City } from "../services/zmanimService";

/**
 * Asking for the device position can take twenty seconds (permission
 * prompt, native timeout then the browser). A city picked in the meantime
 * is the reader's choice: the late position used to replace it, and to be
 * saved as the place of every later visit.
 */

vi.mock("../composables/useNativeApp", () => ({ isNativeApp: false, appPlatform: "web" }));

describe("the device position", () => {
  it("does not replace a city picked while it was on its way", async () => {
    let answer: (position: GeolocationPosition) => void = () => {};
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (resolve: (position: GeolocationPosition) => void) => {
          answer = resolve;
        },
      },
    });
    const { useZmanimLocation } = await import("../composables/useZmanimLocation");
    const { place, locateDevice, selectCity } = useZmanimLocation();

    const located = locateDevice();
    const jerusalem: City = {
      name: "Jerusalem",
      country: "IL",
      lat: 31.76904,
      lon: 35.21633,
      tz: "Asia/Jerusalem",
    };
    selectCity(jerusalem);
    answer({ coords: { latitude: 48.9, longitude: 2.4 } } as GeolocationPosition);

    expect(await located).toBe(false);
    expect(place.value.source).toBe("city");
    expect(place.value.tzid).toBe("Asia/Jerusalem");
    expect(localStorage.getItem("pj_zmanim_place")).toContain("Asia/Jerusalem");
  });
});
