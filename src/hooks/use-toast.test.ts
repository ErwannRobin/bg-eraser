import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reducer, toast, useToast } from "./use-toast";

type State = Parameters<typeof reducer>[0];
const t = (id: string, extra = {}) => ({ id, title: `toast ${id}`, open: true, ...extra });

describe("toast reducer", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("adds a toast", () => {
    const state = reducer({ toasts: [] }, { type: "ADD_TOAST", toast: t("1") });
    expect(state.toasts).toEqual([t("1")]);
  });

  it("keeps only the newest toast (limit of 1)", () => {
    const state = reducer({ toasts: [t("1")] }, { type: "ADD_TOAST", toast: t("2") });
    expect(state.toasts.map((x) => x.id)).toEqual(["2"]);
  });

  it("updates a matching toast and leaves others alone", () => {
    const state = reducer(
      { toasts: [t("1"), t("2")] },
      { type: "UPDATE_TOAST", toast: { id: "2", title: "changed" } },
    );
    expect(state.toasts[0].title).toBe("toast 1");
    expect(state.toasts[1].title).toBe("changed");
  });

  it("dismisses a toast by id", () => {
    const state = reducer({ toasts: [t("1")] }, { type: "DISMISS_TOAST", toastId: "1" });
    expect(state.toasts[0].open).toBe(false);
  });

  it("dismisses all toasts when no id is given", () => {
    const initial: State = { toasts: [t("a"), t("b")] };
    const state = reducer(initial, { type: "DISMISS_TOAST" });
    expect(state.toasts.every((x) => x.open === false)).toBe(true);
  });

  it("removes a toast by id", () => {
    const state = reducer({ toasts: [t("1"), t("2")] }, { type: "REMOVE_TOAST", toastId: "1" });
    expect(state.toasts.map((x) => x.id)).toEqual(["2"]);
  });

  it("removes every toast when no id is given", () => {
    const state = reducer({ toasts: [t("1"), t("2")] }, { type: "REMOVE_TOAST" });
    expect(state.toasts).toEqual([]);
  });
});

describe("useToast", () => {
  afterEach(() => {
    const { result } = renderHook(() => useToast());
    act(() => result.current.dismiss());
  });

  it("starts with the current toasts and shows a new one", () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      toast({ title: "Hello", description: "World" });
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]).toMatchObject({
      title: "Hello",
      description: "World",
      open: true,
    });
  });

  it("dismisses a toast", () => {
    const { result } = renderHook(() => useToast());
    let handle!: ReturnType<typeof toast>;

    act(() => {
      handle = toast({ title: "Bye" });
    });
    act(() => handle.dismiss());

    expect(result.current.toasts[0].open).toBe(false);
  });

  it("updates a toast", () => {
    const { result } = renderHook(() => useToast());
    let handle!: ReturnType<typeof toast>;

    act(() => {
      handle = toast({ title: "Before" });
    });
    act(() => handle.update({ id: handle.id, title: "After" }));

    expect(result.current.toasts[0].title).toBe("After");
  });

  it("returns unique ids", () => {
    let a!: ReturnType<typeof toast>, b!: ReturnType<typeof toast>;
    act(() => {
      a = toast({ title: "a" });
      b = toast({ title: "b" });
    });
    expect(a.id).not.toBe(b.id);
  });
});
