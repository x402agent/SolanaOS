import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AgentCreateModal } from "@/features/agents/components/AgentCreateModal";

const openModal = (overrides?: {
  busy?: boolean;
  onClose?: () => void;
  onSubmit?: (payload: unknown) => void;
}) => {
  const onClose = overrides?.onClose ?? vi.fn();
  const onSubmit = overrides?.onSubmit ?? vi.fn();
  render(
    createElement(AgentCreateModal, {
      open: true,
      suggestedName: "New Agent",
      busy: overrides?.busy,
      onClose,
      onSubmit,
    })
  );
  return { onClose, onSubmit };
};

describe("AgentCreateModal", () => {
  afterEach(() => {
    cleanup();
  });

  it("submits simple payload with name and avatar seed", () => {
    const onSubmit = vi.fn();
    openModal({ onSubmit });

    fireEvent.change(screen.getByLabelText("Agent name"), {
      target: { value: "Execution Operator" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Launch agent" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Execution Operator",
        avatarSeed: expect.any(String),
      })
    );
  });

  it("submits when the form is submitted from keyboard flow", () => {
    const onSubmit = vi.fn();
    openModal({ onSubmit });

    fireEvent.change(screen.getByLabelText("Agent name"), {
      target: { value: "Keyboard Agent" },
    });
    fireEvent.submit(screen.getByTestId("agent-create-modal"));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Keyboard Agent",
      })
    );
  });

  it("renders one-step create form without guided wizard copy", () => {
    openModal();

    expect(screen.getByRole("button", { name: "Launch agent" })).toBeInTheDocument();
    expect(screen.getByLabelText("Agent name")).toBeInTheDocument();
    expect(screen.getByText("Choose avatar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Shuffle avatar selection" })).toBeInTheDocument();
    expect(screen.queryByText("Define Ownership")).not.toBeInTheDocument();
    expect(screen.queryByText("Set Authority Level")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
  });

  it("disables launch when the name is blank", () => {
    const onSubmit = vi.fn();
    openModal({ onSubmit });

    fireEvent.change(screen.getByLabelText("Agent name"), {
      target: { value: "   " },
    });
    const launchButton = screen.getByRole("button", { name: "Launch agent" });
    expect(launchButton).toBeDisabled();
    fireEvent.click(launchButton);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows launching state while busy", () => {
    openModal({ busy: true });

    expect(screen.getByRole("button", { name: "Launching..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Close" })).toBeDisabled();
  });

  it("calls onClose when close is pressed", () => {
    const onClose = vi.fn();
    openModal({ onClose });

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not reset typed name when suggestedName changes while open", () => {
    const onClose = vi.fn();
    const onSubmit = vi.fn();
    const view = render(
      createElement(AgentCreateModal, {
        open: true,
        suggestedName: "New Agent",
        onClose,
        onSubmit,
      })
    );

    fireEvent.change(screen.getByLabelText("Agent name"), {
      target: { value: "My Draft Name" },
    });

    view.rerender(
      createElement(AgentCreateModal, {
        open: true,
        suggestedName: "New Agent 2",
        onClose,
        onSubmit,
      })
    );

    expect(screen.getByLabelText("Agent name")).toHaveValue("My Draft Name");
  });
});
