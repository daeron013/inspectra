import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { FloatingAIButton } from "@/components/FloatingAIButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Bell } from "lucide-react";
import { useLocation } from "react-router-dom";

interface PageLayoutProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

export function PageLayout({ title, subtitle, children }: PageLayoutProps) {
  const location = useLocation();
  const showFloatingAI = location.pathname !== "/ai";

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
              <button className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-border/50 bg-card text-muted-foreground hover:text-foreground transition-colors">
                <Bell className="h-4 w-4" />
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-status-danger text-[9px] font-bold text-primary-foreground">3</span>
              </button>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-bold">QA</div>
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
