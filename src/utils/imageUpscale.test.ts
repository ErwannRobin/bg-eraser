import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { upscaleImage } from "./imageUpscale";
import { FakeImageData, makeImageData, mockCanvas, mockImage } from "@/test/canvas";

beforeEach(() => {
  vi.stubGlobal("ImageData", FakeImageData);
  URL.createObjectURL = vi.fn(() => "blob:upscaled");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const flat = (w: number, h: number, rgba: number[]) =>
  makeImageData(w, h, Array.from({ length: w * h }, () => rgba));

describe("upscaleImage", () => {
  it("doubles the image dimensions", async () => {
    mockImage({ width: 4, height: 3 });
    const canvases = mockCanvas({ imageData: flat(8, 6, [10, 20, 30, 255]) });

    await upscaleImage("blob:in");

    expect(canvases[0].width).toBe(8);
    expect(canvases[0].height).toBe(6);
    expect(canvases[0].ctx.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 8, 6);
  });

  it("resolves with the blob and an object URL", async () => {
    mockImage({ width: 4, height: 4 });
    const blob = new Blob(["x"], { type: "image/png" });
    mockCanvas({ imageData: flat(8, 8, [1, 2, 3, 255]), blob });

    const result = await upscaleImage("blob:in");

    expect(result.blob).toBe(blob);
    expect(result.url).toBe("blob:upscaled");
    expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
  });

  it("reports increasing progress up to 100", async () => {
    mockImage({ width: 4, height: 4 });
    mockCanvas({ imageData: flat(8, 8, [1, 2, 3, 255]) });
    const onProgress = vi.fn();

    await upscaleImage("blob:in", onProgress);

    expect(onProgress.mock.calls.map(([p]) => p)).toEqual([25, 50, 75, 90, 100]);
  });

  it("keeps a uniform image unchanged after sharpening and preserves alpha", async () => {
    mockImage({ width: 4, height: 4 });
    const canvases = mockCanvas({ imageData: flat(8, 8, [100, 100, 100, 200]) });

    await upscaleImage("blob:in");

    const sharpened = canvases[0].ctx.putImageData.mock.calls[0][0] as ImageData;
    // interior pixel: the kernel sums to 1, so a flat color stays the same
    const idx = (3 * 8 + 3) * 4;
    expect(Array.from(sharpened.data.slice(idx, idx + 4))).toEqual([100, 100, 100, 200]);
  });

  it("increases contrast at an edge and clamps to 0-255", async () => {
    mockImage({ width: 2, height: 2 });
    // 4x4 upscaled image: one bright pixel in a dark field
    const px = Array.from({ length: 16 }, () => [50, 50, 50, 255]);
    px[5] = [200, 200, 200, 255];
    const canvases = mockCanvas({ imageData: makeImageData(4, 4, px) });

    await upscaleImage("blob:in");

    const out = canvases[0].ctx.putImageData.mock.calls[0][0] as ImageData;
    const at = (x: number, y: number) => out.data[(y * 4 + x) * 4];
    expect(at(1, 1)).toBe(255); // 5*200 - 4*50 = 800 -> clamped
    expect(at(2, 1)).toBe(0); // 5*50 - (200+50*3) = -100 -> clamped
  });

  it("rejects when the image fails to load", async () => {
    mockImage({ fail: true });
    mockCanvas();
    await expect(upscaleImage("blob:in")).rejects.toThrow("Failed to load image");
  });

  it("rejects when there is no canvas context", async () => {
    mockImage();
    mockCanvas({ noContext: true });
    await expect(upscaleImage("blob:in")).rejects.toThrow("Failed to get canvas context");
  });

  it("rejects when the blob cannot be created", async () => {
    mockImage({ width: 4, height: 4 });
    mockCanvas({ imageData: flat(8, 8, [1, 2, 3, 255]), blob: null });
    await expect(upscaleImage("blob:in")).rejects.toThrow("Failed to create blob");
  });
});
