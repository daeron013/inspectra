import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bot, X, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const quickPrompts = [
  "Show me a quick quality summary",
  "Any urgent issues I should know about?",
  "Which suppliers need attention?",
  "Draft an NCR for the highest-risk issue",
];

export function FloatingAIButton() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const navigate = useNavigate();

  const goToAI = (prompt?: string) => {
    setOpen(false);
    setInput("");
    if (prompt) {
      navigate(`/ai?prompt=${encodeURIComponent(prompt)}`);
    } else {
      navigate("/ai");
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {open && (
        <div className="mb-3 w-80 glass-card rounded-xl border border-border/50 shadow-xl overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold">Inspectra</span>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setOpen(false)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
          <div className="p-3 space-y-2">
            <p className="text-[10px] text-muted-foreground">Quick ask or go to full assistant</p>
            {quickPrompts.map((p) => (
              <button
                key={p}
                onClick={() => goToAI(p)}
                className="w-full text-left text-[11px] p-2 rounded-md border border-border/40 hover:bg-accent/50 transition-colors text-muted-foreground hover:text-foreground"
              >
                {p}
              </button>
            ))}
            <div className="flex gap-1.5 pt-1">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (input.trim()) goToAI(input.trim());
                  }
                }}
                placeholder="Ask anything..."
                className="min-h-[36px] max-h-20 resize-none text-xs"
                rows={1}
              />
              <Button size="icon" className="h-9 w-9 shrink-0" onClick={() => input.trim() && goToAI(input.trim())} disabled={!input.trim()}>
                <Send className="h-3 w-3" />
              </Button>
            </div>
            <Button variant="outline" size="sm" className="w-full h-7 text-[10px]" onClick={() => goToAI()}>
              Open full AI Assistant →
            </Button>
          </div>
        </div>
      )}
      <Button
        onClick={() => setOpen(!open)}
        size="icon"
        className="h-12 w-12 rounded-full shadow-lg hover:shadow-xl transition-all"
      >
        {open ? <X className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
      </Button>
    </div>
  );
}
