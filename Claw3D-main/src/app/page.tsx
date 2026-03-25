"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { loadBrowserGatewaySettings } from "@/lib/gateway/gateway-settings-store";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const saved = loadBrowserGatewaySettings();
    // If user has a saved gateway connection, go straight to the office.
    // Otherwise, send them to the gateway setup page.
    if (saved.gatewayUrl && saved.lastConnected) {
      router.replace("/office");
    } else {
      router.replace("/gateway");
    }
  }, [router]);

  return null;
}
