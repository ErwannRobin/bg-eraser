import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import NotFound from "./NotFound";

afterEach(() => vi.restoreAllMocks());

describe("NotFound", () => {
  it("shows the 404 message and a link home", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <MemoryRouter initialEntries={["/nope"]}>
        <NotFound />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "404" })).toBeInTheDocument();
    expect(screen.getByText("Oops! Page not found")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Return to Home" })).toHaveAttribute("href", "/");
  });

  it("logs the missing route", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <MemoryRouter initialEntries={["/missing/page"]}>
        <NotFound />
      </MemoryRouter>,
    );
    expect(error).toHaveBeenCalledWith(
      "404 Error: User attempted to access non-existent route:",
      "/missing/page",
    );
  });
});
