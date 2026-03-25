"use client";

import type { AgentAvatarProfile } from "@/lib/avatars/profile";
import { AgentAvatarEditorPanel } from "@/features/agents/components/AgentAvatarEditorPanel";

type AgentAvatarCreatorModalProps = {
  open: boolean;
  agentId: string;
  agentName: string;
  initialProfile: AgentAvatarProfile | null | undefined;
  onClose: () => void;
  onSave: (profile: AgentAvatarProfile) => Promise<void> | void;
};

export const AgentAvatarCreatorModal = ({
  open,
  agentId,
  agentName,
  initialProfile,
  onClose,
  onSave,
}: AgentAvatarCreatorModalProps) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center bg-background/85 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Customize avatar for ${agentName}`}
      onClick={onClose}
    >
      <div
        className="ui-panel grid w-full max-w-6xl gap-0 overflow-hidden shadow-xs xl:grid-cols-[360px_minmax(0,1fr)]"
        onClick={(event) => event.stopPropagation()}
      >
        <AgentAvatarEditorPanel
          agentId={agentId}
          agentName={agentName}
          initialProfile={initialProfile}
          onCancel={onClose}
          onSave={onSave}
          onSaved={onClose}
        />
      </div>
    </div>
  );
};
