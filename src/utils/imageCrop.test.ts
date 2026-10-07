import { afterEach, describe, expect, it, vi } from "vitest";
import { cropToContent } from "./imageCrop";
import { makeImageData, mockCanvas, mockImage } from "@/test/canvas";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** Builds a width x height image that is transparent except for the listed opaque pixels. */
const imageWithOpaque = (width: number, height: number, opaque: Array<[number, number]>) => {
  const px = Array.from({ length: width * height }, () => [0, 0, 0, 0]);
  opaque.forEach(([x, y]) => (px[y * width + x] = [255, 0, 0, 255]));
  return makeImageData(width, height, px);
};

describe("cropToContent", () => {
  it("crops to the bounding box of opaque pixels plus 2px padding", async () => {
    mockImage({ width: 20, height: 20 });
    const canvases = mockCanvas({ imageData: imageWithOpaque(20, 20, [[8, 9], [11, 12]]) });

    await cropToContent("blob:test");

    const cropped = canvases[1];
    // content spans x 8..11, y 9..12 (4x4) -> +2px each side -> 8x8
    expect(cropped.width).toBe(8);
    expect(cropped.height).toBe(8);
    expect(cropped.ctx.drawImage).toHaveBeenCalledWith(canvases[0], 6, 7, 8, 8, 0, 0, 8, 8);
  });

  it("clamps the padding to the image bounds", async () => {
    mockImage({ width: 10, height: 10 });
    const canvases = mockCanvas({ imageData: imageWithOpaque(10, 10, [[0, 0], [9, 9]]) });

    await cropToContent("blob:test");

    expect(canvases[1].width).toBe(10);
    expect(canvases[1].height).toBe(10);
  });

  it("resolves with the PNG blob", async () => {
    mockImage();
    const blob = new Blob(["png"], { type: "image/png" });
    const canvases = mockCanvas({ imageData: imageWithOpaque(10, 10, [[5, 5]]), blob });

    await expect(cropToContent("blob:test")).resolves.toBe(blob);
    expect(canvases[1].toBlob).toHaveBeenCalledWith(expect.any(Function), "image/png", 1.0);
  });

  it("rejects when the image fails to load", async () => {
    mockImage({ fail: true });
    mockCanvas();
    await expect(cropToContent("blob:test")).rejects.toThrow("Failed to load image");
  });

  it("rejects when no canvas context is available", async () => {
    mockImage();
    mockCanvas({ noContext: true });
    await expect(cropToContent("blob:test")).rejects.toThrow("Could not get canvas context");
  });

  it("rejects when the blob cannot be created", async () => {
    mockImage();
    mockCanvas({ imageData: imageWithOpaque(10, 10, [[5, 5]]), blob: null });
    await expect(cropToContent("blob:test")).rejects.toThrow("Failed to create cropped blob");
  });
});
