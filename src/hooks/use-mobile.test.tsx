import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useIsMobile } from "./use-mobile";

const setup = (width: number) => {
  let listener: (() => void) | undefined;
  Object.defineProperty(window, "innerWidth", { value: width, configurable: true, writable: true });
  const mql = {
    addEventListener: vi.fn((_: string, cb: () => void) => (listener = cb)),
    removeEventListener: vi.fn(),
  };
  window.matchMedia = vi.fn(() => mql) as unknown as typeof window.matchMedia;
  return { mql, fire: () => listener?.() };
};

afterEach(() => vi.restoreAllMocks());

describe("useIsMobile", () => {
  it("is true below the 768px breakpoint", () => {
    setup(500);
    expect(renderHook(() => useIsMobile()).result.current).toBe(true);
  });

  it("is false at and above the breakpoint", () => {
    setup(768);
    expect(renderHook(() => useIsMobile()).result.current).toBe(false);
  });

  it("queries the matching media query", () => {
    setup(1000);
    renderHook(() => useIsMobile());
    expect(window.matchMedia).toHaveBeenCalledWith("(max-width: 767px)");
  });

  it("updates when the viewport changes", () => {
    const { fire } = setup(1000);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    act(() => {
      window.innerWidth = 400;
      fire();
    });

    expect(result.current).toBe(true);
  });

  it("removes the listener on unmount", () => {
    const { mql } = setup(1000);
    renderHook(() => useIsMobile()).unmount();
    expect(mql.removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  });
});
