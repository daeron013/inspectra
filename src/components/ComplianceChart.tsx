import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const data = [
  { month: 'Jul', ncrs: 2, defects: 1.1, capas: 0 },
  { month: 'Aug', ncrs: 3, defects: 1.4, capas: 1 },
  { month: 'Sep', ncrs: 1, defects: 0.8, capas: 0 },
  { month: 'Oct', ncrs: 4, defects: 2.1, capas: 1 },
  { month: 'Nov', ncrs: 5, defects: 3.2, capas: 2 },
  { month: 'Dec', ncrs: 7, defects: 4.8, capas: 3 },
  { month: 'Jan', ncrs: 7, defects: 6.2, capas: 4 },
];

export function ComplianceChart() {
  return (
    <div className="glass-card rounded-xl">
      <div className="border-b border-border/50 px-5 py-4">
        <h3 className="font-semibold text-base text-foreground">Quality Trend</h3>
        <p className="text-xs text-muted-foreground mt-0.5">NCRs, defect rate, and CAPAs over time</p>
      </div>
      <div className="p-4">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="ncrs" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(200, 80%, 55%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(200, 80%, 55%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="defects" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 90%)" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(220, 10%, 46%)" />
            <YAxis tick={{ fontSize: 11 }} stroke="hsl(220, 10%, 46%)" />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(0, 0%, 100%)',
                border: '1px solid hsl(220, 15%, 90%)',
                borderRadius: '8px',
                fontSize: '12px',
              }}
            />
            <Area type="monotone" dataKey="ncrs" stroke="hsl(200, 80%, 55%)" fill="url(#ncrs)" strokeWidth={2} name="NCRs" />
            <Area type="monotone" dataKey="defects" stroke="hsl(0, 72%, 51%)" fill="url(#defects)" strokeWidth={2} name="Defect %" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
