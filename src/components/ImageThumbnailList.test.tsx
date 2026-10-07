import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ImageThumbnailList, type ProcessedImageItem } from "./ImageThumbnailList";

const item = (id: string, overrides: Partial<ProcessedImageItem> = {}): ProcessedImageItem => ({
  id,
  originalFile: new File(["x"], `${id}.png`, { type: "image/png" }),
  originalUrl: `blob:original-${id}`,
  processedUrl: null,
  processedBlob: null,
  upscaledOriginalUrl: null,
  upscaledOriginalBlob: null,
  status: "pending",
  ...overrides,
});

describe("ImageThumbnailList", () => {
  it("renders one button per image", () => {
    render(
      <ImageThumbnailList images={[item("a"), item("b")]} selectedId={null} onSelect={vi.fn()} />,
    );
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("renders nothing when the list is empty", () => {
    render(<ImageThumbnailList images={[]} selectedId={null} onSelect={vi.fn()} />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("shows the original image until a processed one exists", () => {
    render(
      <ImageThumbnailList
        images={[item("a"), item("b", { processedUrl: "blob:processed-b", status: "done" })]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    const [first, second] = screen.getAllByAltText("Thumbnail");
    expect(first).toHaveAttribute("src", "blob:original-a");
    expect(second).toHaveAttribute("src", "blob:processed-b");
  });

  it("calls onSelect with the clicked image id", async () => {
    const onSelect = vi.fn();
    render(
      <ImageThumbnailList images={[item("a"), item("b")]} selectedId={null} onSelect={onSelect} />,
    );
    await userEvent.click(screen.getAllByRole("button")[1]);
    expect(onSelect).toHaveBeenCalledWith("b");
  });

  it("highlights only the selected image", () => {
    render(
      <ImageThumbnailList images={[item("a"), item("b")]} selectedId="b" onSelect={vi.fn()} />,
    );
    const [first, second] = screen.getAllByRole("button");
    expect(second.className).toContain("border-primary");
    expect(second.className).toContain("ring-2");
    expect(first.className).not.toContain("ring-2");
  });

  it("dims the thumbnail while processing", () => {
    render(
      <ImageThumbnailList
        images={[item("a", { status: "processing" })]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByAltText("Thumbnail").className).toContain("opacity-50");
  });

  it("does not dim the thumbnail in other states", () => {
    render(
      <ImageThumbnailList
        images={[item("a", { status: "done" })]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByAltText("Thumbnail").className).not.toContain("opacity-50");
  });

  it.each([
    ["pending", "svg", false],
    ["processing", "svg.animate-spin", true],
    ["done", "div.bg-green-500", true],
    ["error", "div.bg-destructive", true],
  ] as const)("renders the %s status indicator", (status, selector, present) => {
    const { container } = render(
      <ImageThumbnailList images={[item("a", { status })]} selectedId={null} onSelect={vi.fn()} />,
    );
    const button = container.querySelector("button")!;
    if (status === "pending") {
      expect(button.querySelector("div.bg-muted-foreground")).toBeInTheDocument();
      expect(button.querySelector("svg")).not.toBeInTheDocument();
    } else {
      expect(Boolean(button.querySelector(selector))).toBe(present);
    }
  });
});
