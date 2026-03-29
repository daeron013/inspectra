import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { FloatingAIButton } from "@/components/FloatingAIButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Bell } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useDashboardPriorities } from "@/hooks/useDashboardPriorities";

interface PageLayoutProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

export function PageLayout({ title, subtitle, children }: PageLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const showFloatingAI = location.pathname !== "/ai";
  const { items: priorityItems } = useDashboardPriorities(5);
  const notificationCount = priorityItems.length > 9 ? "9+" : String(priorityItems.length);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card/90 backdrop-blur-sm px-5">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <div>
                <h1 className="text-base font-semibold text-foreground">{title}</h1>
                <p className="text-[10px] text-muted-foreground tracking-wide">{subtitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Popover>
                <PopoverTrigger asChild>
                  <button className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-border/50 bg-card text-muted-foreground transition-colors hover:text-foreground">
                    <Bell className="h-4 w-4" />
                    {priorityItems.length > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-status-danger px-1 text-[9px] font-bold text-primary-foreground">
                        {notificationCount}
                      </span>
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-[360px] p-0">
                  <div className="border-b border-border/50 px-4 py-3">
                    <div className="text-sm font-semibold text-foreground">Priority Actions</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      Important items pulled from inspections, suppliers, NCRs, CAPAs, and compliance risk.
                    </div>
                  </div>
                  <div className="max-h-[360px] overflow-auto">
                    {priorityItems.length === 0 ? (
                      <div className="px-4 py-6 text-sm text-muted-foreground">
                        No active priority actions right now.
                      </div>
                    ) : (
                      priorityItems.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => navigate("/dashboard")}
                          className="w-full border-b border-border/40 px-4 py-3 text-left transition-colors hover:bg-accent/30"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-foreground">{item.title}</div>
                              <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.description}</div>
                              <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground/70">
                                <span>{item.agent}</span>
                                <span>•</span>
                                <span>{item.timestamp}</span>
                              </div>
                            </div>
                            <span className="shrink-0 rounded bg-accent px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-foreground">
                              {item.risk}
                            </span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6 space-y-6 overflow-auto">
            {children}
          </main>
          {showFloatingAI && <FloatingAIButton />}
        </div>
      </div>
    </SidebarProvider>
  );
}
