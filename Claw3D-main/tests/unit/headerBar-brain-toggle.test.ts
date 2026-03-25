import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { HeaderBar } from "@/features/agents/components/HeaderBar";

describe("HeaderBar controls", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("does_not_render_brain_toggle_in_header", () => {
    render(
      createElement(HeaderBar, {
        status: "disconnected",
        onConnectionSettings: vi.fn(),
      })
    );

    expect(screen.queryByTestId("brain-files-toggle")).not.toBeInTheDocument();
  });

  it("opens_menu_and_calls_connection_settings_handler", () => {
    const onConnectionSettings = vi.fn();

    render(
      createElement(HeaderBar, {
        status: "disconnected",
        onConnectionSettings,
      })
    );

    fireEvent.click(screen.getByTestId("studio-menu-toggle"));
    fireEvent.click(screen.getByTestId("gateway-settings-toggle"));

    expect(onConnectionSettings).toHaveBeenCalledTimes(1);
  });
});
