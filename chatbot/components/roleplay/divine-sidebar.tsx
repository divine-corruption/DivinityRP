"use client";

import {
  BookOpen,
  Compass,
  Home,
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
  { id: "settings", label: "Settings", icon: Settings },
];

export function DivineSidebar({ user }: { user: User | undefined }) {
  const router = useRouter();
  const { currentView, setCurrentView, selectedCharacter, selectCharacter } =
    useRoleplay();
  const { setOpenMobile, toggleSidebar } = useSidebar();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="pb-0 pt-3">
        <SidebarMenu>
          <SidebarMenuItem className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2 px-2">
              <Compass className="size-5 text-primary" />
              <span className="text-sm font-bold group-data-[collapsible=icon]:hidden">
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
              <div className="px-3 py-2">
                <p className="text-xs text-sidebar-foreground/50">
                  Active Character
                </p>
                <p className="text-sm font-medium truncate mt-1">
                  {selectedCharacter.name}
                </p>
              </div>
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
