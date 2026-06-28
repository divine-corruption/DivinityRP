"use client";

import {
  BookOpen,
  FlaskConical,
  Home,
  Pencil,
  Settings,
  Skull,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { User } from "next-auth";
import { useRoleplay } from "@/lib/roleplay-store";
import type { SidebarView } from "@/lib/types";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { SidebarUserNav } from "@/components/chat/sidebar-user-nav";

const navItems: { id: SidebarView; label: string; icon: React.ElementType }[] = [
  { id: "dashboard", label: "Dashboard", icon: Home },
  { id: "characters", label: "Characters", icon: Users },
  { id: "loreuniverse", label: "LoreUniverse", icon: BookOpen },
  { id: "divinecorruption", label: "Divine Corruption", icon: Skull },
  { id: "modeltester", label: "Model Tester", icon: FlaskConical },
  { id: "settings", label: "Settings", icon: Settings },
];

export function DivineSidebar({ user }: { user: User | undefined }) {
  const router = useRouter();
  const { currentView, setCurrentView, selectedCharacter, selectCharacter } =
    useRoleplay();
  const { setOpenMobile, toggleSidebar, state } = useSidebar();

  const isCollapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="pb-0 pt-3">
        <SidebarMenu>
          <SidebarMenuItem className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2 px-2">
              <img
                src="/images/heavenlogo.png"
                alt="DIVINE"
                className="size-6 object-contain"
              />
              <span className="text-sm font-bold divine-wordmark group-data-[collapsible=icon]:hidden">
                DIVINE
              </span>
            </div>
            <div className="group-data-[collapsible=icon]:hidden">
              <SidebarTrigger className="text-sidebar-foreground/60" />
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    isActive={currentView === item.id}
                    className={
                      currentView === item.id
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/70"
                    }
                    onClick={() => {
                      setOpenMobile(false);
                      setCurrentView(item.id);
                      if (item.id !== "characters") {
                        selectCharacter(null);
                      }
                      router.push(
                        item.id === "dashboard" ? "/" : `/?view=${item.id}`
                      );
                    }}
                    tooltip={item.label}
                  >
                    <item.icon className="size-4" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {currentView === "characters" && selectedCharacter && (
          <SidebarGroup>
            <SidebarGroupContent>
              {isCollapsed ? (
                /* Collapsed: just the avatar circle */
                <div className="flex justify-center py-2">
                  <div className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-muted ring-1 ring-border/60">
                    {selectedCharacter.avatar ? (
                      <img
                        src={selectedCharacter.avatar}
                        alt={selectedCharacter.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-xs font-bold text-primary">
                        {selectedCharacter.name.charAt(0)}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                /* Expanded: full detailed character card */
                <div className="mx-2 mb-1 overflow-hidden rounded-xl border border-border/30 bg-sidebar-accent/30">
                  {/* Avatar banner */}
                  <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
                    {selectedCharacter.avatar ? (
                      <img
                        src={selectedCharacter.avatar}
                        alt={selectedCharacter.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 to-fuchsia-500/10">
                        <span className="text-4xl font-bold text-primary/50">
                          {selectedCharacter.name.charAt(0)}
                        </span>
                      </div>
                    )}
                    {/* Gradient overlay at bottom */}
                    <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent" />
                    {/* Edit button — top-right */}
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentView("characters");
                        router.push("/?view=characters");
                      }}
                      className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-md bg-black/50 text-white/80 backdrop-blur-sm transition-colors hover:bg-black/70 hover:text-white"
                      title="Edit character"
                    >
                      <Pencil className="size-3" />
                    </button>
                    {/* Character name on the image */}
                    <div className="absolute inset-x-0 bottom-0 px-2 pb-1.5">
                      <p className="truncate text-xs font-semibold text-white drop-shadow">
                        {selectedCharacter.name}
                      </p>
                    </div>
                  </div>

                  {/* Description snippet */}
                  {selectedCharacter.description && (
                    <div className="px-2.5 pb-2 pt-1.5">
                      <p className="line-clamp-2 text-[10px] leading-relaxed text-sidebar-foreground/60">
                        {selectedCharacter.description}
                      </p>
                    </div>
                  )}

                  {/* Tags row */}
                  {selectedCharacter.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 px-2.5 pb-2">
                      {selectedCharacter.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary"
                        >
                          {tag}
                        </span>
                      ))}
                      {selectedCharacter.tags.length > 3 && (
                        <span className="rounded-md bg-muted/60 px-1.5 py-0.5 text-[9px] text-muted-foreground">
                          +{selectedCharacter.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border pt-2 pb-3">
        {user && <SidebarUserNav user={user} />}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
