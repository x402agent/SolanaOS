import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AgentAvatarCreatorModal } from "@/features/agents/components/AgentAvatarCreatorModal";
import { createDefaultAgentAvatarProfile } from "@/lib/avatars/profile";

vi.mock("@/features/agents/components/AgentAvatarPreview3D", () => ({
  AgentAvatarPreview3D: () => <div data-testid="avatar-preview-3d">preview</div>,
}));

describe("AgentAvatarCreatorModal", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("saves the edited avatar profile", async () => {
    const initialProfile = createDefaultAgentAvatarProfile("seed-a");
    const onSave = vi.fn(async () => {});

    render(
      <AgentAvatarCreatorModal
        open
        agentId="agent-1"
        agentName="Agent One"
        initialProfile={initialProfile}
        onClose={() => {}}
        onSave={onSave}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Backpack" }));
    fireEvent.click(screen.getByRole("button", { name: "Save avatar" }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        seed: "seed-a",
        accessories: expect.objectContaining({
          backpack: !initialProfile.accessories.backpack,
        }),
      })
    );
  });
});
