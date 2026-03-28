import { useState } from "react";
import { Slider } from "@/components/ui/slider";
import { AlertTriangle, TrendingUp } from "lucide-react";

export function ScenarioSimulator() {
  const [defectRate, setDefectRate] = useState(2.0);
  const [supplierDelay, setSupplierDelay] = useState(0);
  const [inspectionBacklog, setInspectionBacklog] = useState(0);

  const riskScore = Math.min(
    100,
    Math.round(
      defectRate * 8 +
      supplierDelay * 3 +
      inspectionBacklog * 2
    )
  );

  const riskLevel = riskScore < 25 ? 'Low' : riskScore < 50 ? 'Moderate' : riskScore < 75 ? 'High' : 'Critical';
  const riskColor = riskScore < 25 ? 'text-status-success' : riskScore < 50 ? 'text-status-warning' : riskScore < 75 ? 'text-status-warning' : 'text-status-danger';

  return (
    <div className="glass-card rounded-xl">
      <div className="border-b border-border/50 px-5 py-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold text-base text-foreground">Scenario Simulator</h3>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">Model compliance risk impact</p>
      </div>
      <div className="p-5 space-y-5">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-foreground">Defect Rate</label>
            <span className="text-xs font-mono text-muted-foreground">{defectRate.toFixed(1)}%</span>
          </div>
          <Slider value={[defectRate]} onValueChange={([v]) => setDefectRate(v)} min={0} max={10} step={0.1} />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-foreground">Supplier Delay (days)</label>
            <span className="text-xs font-mono text-muted-foreground">{supplierDelay}d</span>
          </div>
          <Slider value={[supplierDelay]} onValueChange={([v]) => setSupplierDelay(v)} min={0} max={30} step={1} />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-foreground">Inspection Backlog</label>
            <span className="text-xs font-mono text-muted-foreground">{inspectionBacklog} lots</span>
          </div>
          <Slider value={[inspectionBacklog]} onValueChange={([v]) => setInspectionBacklog(v)} min={0} max={50} step={1} />
        </div>

        <div className="rounded-lg border border-border/50 bg-accent/30 p-4 text-center">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
            Compliance Risk Score
          </div>
          <div className={`text-4xl font-semibold tracking-tight ${riskColor}`}>{riskScore}</div>
          <div className={`mt-1 flex items-center justify-center gap-1.5 text-xs font-medium ${riskColor}`}>
            {riskScore >= 50 && <AlertTriangle className="h-3 w-3" />}
            {riskLevel}
          </div>
        </div>
      </div>
    </div>
  );
}
