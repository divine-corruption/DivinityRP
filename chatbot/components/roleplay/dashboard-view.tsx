"use client";

import { BookOpen, MessagesSquare, Sparkles, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { listThreadsForCharacter } from "@/lib/conversation-threads";
import { useRoleplay } from "@/lib/roleplay-store";

export function DashboardView() {
  const { characters, loreEntries, setCurrentView, selectCharacter } =
    useRoleplay();

  // Count saved conversations across all characters (client-only).
  const [conversationCount, setConversationCount] = useState(0);
  useEffect(() => {
    let total = 0;
    for (const c of characters) {
      total += listThreadsForCharacter(c.id).length;
    }
    setConversationCount(total);
  }, [characters]);

  const stats = [
    {
      label: "Characters",
      value: characters.length,
      icon: Users,
      onClick: () => setCurrentView("characters"),
    },
    {
      label: "Conversations",
      value: conversationCount,
      icon: MessagesSquare,
      onClick: () => setCurrentView("characters"),
    },
    {
      label: "Lore Entries",
      value: loreEntries.length,
      icon: BookOpen,
      onClick: () => setCurrentView("loreuniverse"),
    },
  ];

  return (
    <div className="flex h-full flex-col items-center justify-center overflow-y-auto p-8">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-10 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-primary">
            <Sparkles className="size-3" />
            Roleplay Engine
          </div>
          <h1 className="divine-wordmark divine-glow-text text-6xl font-black tracking-tight">
            DIVINE
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Immersive AI roleplay — powered by xAI Grok 4.3
          </p>
        </div>

        <div className="mb-8 grid grid-cols-3 gap-4">
          {stats.map((stat) => (
            <button
              key={stat.label}
              type="button"
              onClick={stat.onClick}
              className="divine-card group flex flex-col items-center gap-2 rounded-2xl p-5"
            >
              <div className="rounded-xl bg-primary/12 p-2.5 text-primary ring-1 ring-primary/20 transition-all group-hover:bg-primary/20 group-hover:ring-primary/40">
                <stat.icon className="size-5" />
              </div>
              <span className="text-3xl font-bold tabular-nums">
                {stat.value}
              </span>
              <span className="text-xs text-muted-foreground">
                {stat.label}
              </span>
            </button>
          ))}
        </div>

        {characters.length === 0 && (
          <div className="divine-card rounded-2xl border-dashed p-8 text-center">
            <p className="text-muted-foreground">
              Import a character from Chub.ai or SillyTavern to begin
            </p>
          </div>
        )}

        {characters.length > 0 && (
          <div>
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">
              Recent Characters
            </h2>
            <div className="space-y-2">
              {characters.slice(0, 5).map((char) => (
                <button
                  key={char.id}
                  type="button"
                  onClick={() => {
                    selectCharacter(char);
                    setCurrentView("characters");
                  }}
                  className="divine-card flex w-full items-center gap-3 rounded-xl p-3 text-left"
                >
                  <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-muted text-sm font-bold ring-1 ring-border/60">
                    {char.avatar ? (
                      // biome-ignore lint/performance/noImgElement: avatar
                      <img
                        src={char.avatar}
                        alt={char.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      char.name.charAt(0)
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{char.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {char.description.slice(0, 60)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
