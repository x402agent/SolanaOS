/**
 * CompleteStep — Final wizard screen before entering the office.
 */
import { Building2, Rocket } from "lucide-react";

export const CompleteStep = () => (
  <div className="flex flex-col items-center justify-center gap-5 py-4">
    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#14F195]/15">
      <Rocket className="h-7 w-7 text-[#14F195]" />
    </div>

    <div className="space-y-2 text-center">
      <p className="text-base font-semibold text-white">
        Welcome to your AI office
      </p>
      <p className="max-w-sm text-sm text-white/60">
        Your gateway is connected and your agents are ready. Step inside and
        explore the 3D workspace where your AI team operates.
      </p>
    </div>

    <div className="w-full max-w-xs space-y-2">
      <div className="flex items-center gap-2.5 rounded-lg border border-white/8 bg-white/[0.03] px-3.5 py-2.5">
        <Building2 className="h-4 w-4 shrink-0 text-[#14F195]" />
        <div>
          <p className="text-xs font-medium text-white">Explore the Office</p>
          <p className="text-[10px] text-white/45">
            Navigate rooms, watch agents, and interact
          </p>
        </div>
      </div>
    </div>

    <p className="text-[11px] text-white/35">
      You can always re-run onboarding from Studio settings.
    </p>
  </div>
);
