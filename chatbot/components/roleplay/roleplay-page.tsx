"use client";

import { useRoleplay } from "@/lib/roleplay-store";
import { ChatShell } from "@/components/chat/shell";
import { RoleplayLayout } from "./roleplay-layout";

export function RoleplayPage() {
  const { selectedCharacter, currentView } = useRoleplay();

  const isCharacterChat =
    selectedCharacter && currentView === "characters";

  if (isCharacterChat) {
    return <ChatShell />;
  }

  return <RoleplayLayout />;
}
