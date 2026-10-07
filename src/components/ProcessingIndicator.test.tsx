import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProcessingIndicator } from "./ProcessingIndicator";

describe("ProcessingIndicator", () => {
  it("shows the status text", () => {
    render(<ProcessingIndicator progress={0} />);
    expect(screen.getByText("Removing background...")).toBeInTheDocument();
    expect(screen.getByText("Processing your image with AI")).toBeInTheDocument();
  });

  it("shows the progress percentage", () => {
    render(<ProcessingIndicator progress={42} />);
    expect(screen.getByText("42%")).toBeInTheDocument();
  });

  it("fills the progress bar proportionally", () => {
    render(<ProcessingIndicator progress={75} />);
    const indicator = screen.getByRole("progressbar").firstElementChild as HTMLElement;
    expect(indicator.style.transform).toBe("translateX(-25%)");
  });
});
