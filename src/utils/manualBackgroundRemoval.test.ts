import { afterEach, describe, expect, it, vi } from "vitest";
import {
  colorDistance,
  getColorAtPixel,
  hexToRgb,
  removeColorFromImage,
  rgbToHex,
} from "./manualBackgroundRemoval";
import { makeImageData, mockCanvas } from "@/test/canvas";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("hexToRgb", () => {
  it("parses a 6-digit hex with a hash", () => {
    expect(hexToRgb("#ff8000")).toEqual({ r: 255, g: 128, b: 0 });
  });

  it("parses a hex without a hash", () => {
    expect(hexToRgb("00ff00")).toEqual({ r: 0, g: 255, b: 0 });
  });

  it("is case insensitive", () => {
    expect(hexToRgb("#ABCDEF")).toEqual(hexToRgb("#abcdef"));
  });

  it.each(["", "#fff", "#12345", "#1234567", "#gggggg", "red"])(
    "returns null for invalid input %j",
    (value) => {
      expect(hexToRgb(value)).toBeNull();
    },
  );
});

describe("rgbToHex", () => {
  it("formats colors with a leading hash", () => {
    expect(rgbToHex(255, 128, 0)).toBe("#ff8000");
  });

  it("pads single digit values with zero", () => {
    expect(rgbToHex(0, 1, 15)).toBe("#00010f");
  });

  it("round-trips with hexToRgb", () => {
    const { r, g, b } = hexToRgb("#3a7bd5")!;
    expect(rgbToHex(r, g, b)).toBe("#3a7bd5");
  });
});

describe("colorDistance", () => {
  it("is zero for identical colors", () => {
    const c = { r: 10, g: 20, b: 30 };
    expect(colorDistance(c, c)).toBe(0);
  });

  it("computes the Euclidean distance", () => {
    expect(colorDistance({ r: 0, g: 0, b: 0 }, { r: 3, g: 4, b: 0 })).toBe(5);
  });

  it("is symmetric", () => {
    const a = { r: 200, g: 10, b: 90 };
    const b = { r: 15, g: 220, b: 40 };
    expect(colorDistance(a, b)).toBeCloseTo(colorDistance(b, a));
  });

  it("gives the maximum distance between black and white", () => {
    expect(colorDistance({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })).toBeCloseTo(
      Math.sqrt(3 * 255 * 255),
    );
  });
});

describe("getColorAtPixel", () => {
  // 2x2 image: red, green / blue, white
  const image = makeImageData(2, 2, [
    [255, 0, 0, 255],
    [0, 255, 0, 255],
    [0, 0, 255, 255],
    [255, 255, 255, 255],
  ]);

  it("reads the color at the given coordinates", () => {
    expect(getColorAtPixel(image, 0, 0)).toEqual({ r: 255, g: 0, b: 0 });
    expect(getColorAtPixel(image, 1, 0)).toEqual({ r: 0, g: 255, b: 0 });
    expect(getColorAtPixel(image, 0, 1)).toEqual({ r: 0, g: 0, b: 255 });
    expect(getColorAtPixel(image, 1, 1)).toEqual({ r: 255, g: 255, b: 255 });
  });
});

describe("removeColorFromImage", () => {
  const imageEl = { naturalWidth: 3, naturalHeight: 1 } as HTMLImageElement;
  const white = { id: "1", color: "#ffffff", rgb: { r: 255, g: 255, b: 255 } };

  const pixels = () =>
    makeImageData(3, 1, [
      [255, 255, 255, 255], // white
      [250, 250, 250, 255], // near white
      [0, 0, 0, 255], // black
    ]);

  it("makes pixels matching the color transparent", async () => {
    const data = pixels();
    mockCanvas({ imageData: data });
    await removeColorFromImage(imageEl, [white], 0);
    expect(Array.from(data.data)).toEqual([
      255, 255, 255, 0,
      250, 250, 250, 255,
      0, 0, 0, 255,
    ]);
  });

  it("removes similar colors within the tolerance", async () => {
    const data = pixels();
    mockCanvas({ imageData: data });
    await removeColorFromImage(imageEl, [white], 10);
    expect(data.data[3]).toBe(0);
    expect(data.data[7]).toBe(0);
    expect(data.data[11]).toBe(255);
  });

  it("handles several colors to remove", async () => {
    const data = pixels();
    mockCanvas({ imageData: data });
    const black = { id: "2", color: "#000000", rgb: { r: 0, g: 0, b: 0 } };
    await removeColorFromImage(imageEl, [white, black], 0);
    expect([data.data[3], data.data[7], data.data[11]]).toEqual([0, 255, 0]);
  });

  it("leaves the image untouched when there is no color to remove", async () => {
    const data = pixels();
    mockCanvas({ imageData: data });
    await removeColorFromImage(imageEl, [], 50);
    expect([data.data[3], data.data[7], data.data[11]]).toEqual([255, 255, 255]);
  });

  it("sizes the canvas from the natural image size and writes the pixels back", async () => {
    const data = pixels();
    const canvases = mockCanvas({ imageData: data });
    await removeColorFromImage(imageEl, [white], 0);
    const [canvas] = canvases;
    expect(canvas.width).toBe(3);
    expect(canvas.height).toBe(1);
    expect(canvas.ctx.drawImage).toHaveBeenCalledWith(imageEl, 0, 0);
    expect(canvas.ctx.putImageData).toHaveBeenCalledWith(data, 0, 0);
  });

  it("resolves with the blob produced by the canvas", async () => {
    const blob = new Blob(["x"], { type: "image/png" });
    mockCanvas({ imageData: pixels(), blob });
    await expect(removeColorFromImage(imageEl, [white], 0)).resolves.toBe(blob);
  });

  it("rejects when the blob cannot be created", async () => {
    mockCanvas({ imageData: pixels(), blob: null });
    await expect(removeColorFromImage(imageEl, [white], 0)).rejects.toThrow(
      "Failed to create blob",
    );
  });

  it("throws when there is no 2d context", () => {
    mockCanvas({ noContext: true });
    expect(() => removeColorFromImage(imageEl, [white], 0)).toThrow(
      "Could not get canvas context",
    );
  });
});
