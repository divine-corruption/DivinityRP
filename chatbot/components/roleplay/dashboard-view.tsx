"use client";

import { BookOpen, Skull, Users } from "lucide-react";
import { useRoleplay } from "@/lib/roleplay-store";

export function DashboardView() {
  const {
    characters,
    loreEntries,
    storyNodes,
    setCurrentView,
    selectCharacter,
  } = useRoleplay();

  const stats = [
    {
      label: "Characters",
      value: characters.length,
      icon: Users,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      onClick: () => setCurrentView("characters"),
    },
    {
      label: "Lore Entries",
      value: loreEntries.length,
      icon: BookOpen,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
      onClick: () => setCurrentView("loreuniverse"),
    },
    {
      label: "Story Nodes",
      value: storyNodes.length,
      icon: Skull,
      color: "text-purple-500",
      bg: "bg-purple-500/10",
      onClick: () => setCurrentView("divinecorruption"),
    },
  ];

  return (
    <div className="flex h-full flex-col items-center justify-center p-8 overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold">DIVINE</h1>
          <p className="mt-2 text-muted-foreground">
            Immersive AI roleplay engine powered by Grok 4.3
          </p>
        </div>

        <div className="mb-8 grid grid-cols-3 gap-4">
          {stats.map((stat) => (
            <button
              key={stat.label}
              type="button"
              onClick={stat.onClick}
              className="flex flex-col items-center gap-2 rounded-xl border border-border/40 p-4 transition-colors hover:bg-accent/50"
            >
              <div className={`rounded-lg ${stat.bg} p-2`}>
                <stat.icon className={`size-5 ${stat.color}`} />
              </div>
              <span className="text-2xl font-bold">{stat.value}</span>
              <span className="text-xs text-muted-foreground">
                {stat.label}
              </span>
            </button>
          ))}
        </div>

        {characters.length === 0 && (
          <div className="rounded-xl border border-dashed border-border/40 p-8 text-center">
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
                  className="flex w-full items-center gap-3 rounded-lg border border-border/20 p-3 text-left transition-colors hover:bg-accent/50"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-bold">
                    {char.name.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {char.name}
                    </p>
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
