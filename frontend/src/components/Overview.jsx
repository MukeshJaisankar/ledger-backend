import React, { useEffect, useState } from "react";
import { api, fmtINR, fmtINRShort } from "../lib/api";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
  LineChart, Line, Legend, PieChart, Pie,
} from "recharts";

const Card = ({ title, kicker, children, testId }) => (
  <section
    data-testid={testId}
    className="bg-white border-t-4 border-b border-l border-r border-black p-6 animate-fade-up"
  >
    {kicker && (
      <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-black/50 mb-1">
        {kicker}
      </div>
    )}
    {title && (
      <h3 className="font-display text-xl sm:text-2xl font-bold tracking-tight uppercase mb-4">
        {title}
      </h3>
    )}
    {children}
  </section>
);

const Stat = ({ label, value, accent, testId }) => (
  <div
    data-testid={testId}
    className={`bg-white border-t-4 ${accent ? "border-[#E63946]" : "border-black"} border-b border-l border-r border-black p-6 animate-fade-up`}
  >
    <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-black/50 mb-3">
      {label}
    </div>
    <div className={`font-mono text-3xl sm:text-4xl font-semibold tracking-tighter ${accent ? "text-[#E63946]" : "text-black"}`}>
      {value}
    </div>
  </div>
);

export const Overview = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await api.get("/dashboard");
        if (alive) setData(res.data);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  if (loading) return <div className="font-mono text-sm uppercase tracking-widest p-12">Loading…</div>;
  if (!data || data.txn_count === 0) {
    return (
      <div className="bg-white border-t-4 border-black border-b border-l border-r p-12 text-center" data-testid="empty-overview">
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-black/50">No data yet</div>
        <h3 className="font-display text-3xl sm:text-4xl font-black tracking-tighter uppercase mt-2">Nothing to report.</h3>
        <p className="font-body text-base text-black/60 max-w-md mx-auto mt-3">
          Upload a bank statement (CSV / Excel) — or load demo data — to begin keeping the books.
        </p>
      </div>
    );
  }

  const monthlyData = (data.monthly || []).map(m => ({ ...m, label: m.month.slice(2) }));
  const catData = data.by_category || [];
  const PIE_COLORS = ["#0A0A0A", "#4A4A4A", "#7A7A7A", "#A0A0A0", "#E63946", "#B85C00", "#1E4620", "#2D2D2D", "#5C5C5C", "#8A8A8A"];

  return (
    <div className="space-y-6">
      {/* HERO METRIC */}
      <section className="bg-black text-[#F4F4F0] border-t-4 border-b border-l border-r border-black p-8 sm:p-12 animate-fade-up" data-testid="hero-metric">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#F4F4F0]/60">
          Total Spent — All Time
        </div>
        <div className="font-mono text-6xl sm:text-8xl font-semibold tracking-tighter mt-2 leading-none" data-testid="total-expense-value">
          {fmtINR(data.total_expense)}
        </div>
        <div className="mt-6 flex flex-wrap gap-x-10 gap-y-3 font-mono text-sm border-t border-[#F4F4F0]/20 pt-4">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-[#F4F4F0]/50">Income</div>
            <div className="text-xl" data-testid="total-income-value">{fmtINR(data.total_income)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-[#F4F4F0]/50">Net Balance</div>
            <div className={`text-xl ${data.balance < 0 ? "text-[#E63946]" : ""}`} data-testid="balance-value">{fmtINR(data.balance)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-[#F4F4F0]/50">Transactions</div>
            <div className="text-xl" data-testid="txn-count-value">{data.txn_count}</div>
          </div>
        </div>
      </section>

      {/* CURRENT MONTH STATS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-0 md:gap-4">
        <Stat testId="stat-month-expense" label="This Month — Spent" value={fmtINR(data.current_month.expense)} accent />
        <Stat testId="stat-month-income" label="This Month — Earned" value={fmtINR(data.current_month.income)} />
        <Stat testId="stat-month-net" label="This Month — Net" value={fmtINR(data.current_month.income - data.current_month.expense)} />
      </div>

      {/* CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card testId="chart-monthly" kicker="Fig. 01" title="Monthly Movement">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyData}>
              <CartesianGrid stroke="#D6D6D0" strokeDasharray="2 2" />
              <XAxis dataKey="label" tick={{ fontFamily: "IBM Plex Mono", fontSize: 11 }} stroke="#0A0A0A" />
              <YAxis tickFormatter={fmtINRShort} tick={{ fontFamily: "IBM Plex Mono", fontSize: 11 }} stroke="#0A0A0A" width={70} />
              <Tooltip
                formatter={(v) => fmtINR(v)}
                contentStyle={{ background: "#0A0A0A", color: "#F4F4F0", border: "none", fontFamily: "IBM Plex Mono", fontSize: 12, borderRadius: 0 }}
                labelStyle={{ color: "#F4F4F0" }}
              />
              <Legend wrapperStyle={{ fontFamily: "IBM Plex Mono", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em" }} />
              <Line type="monotone" dataKey="income" stroke="#0A0A0A" strokeWidth={2} dot={{ r: 3 }} name="Income" />
              <Line type="monotone" dataKey="expense" stroke="#E63946" strokeWidth={2} dot={{ r: 3 }} name="Expense" />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card testId="chart-category" kicker="Fig. 02" title="By Category">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={catData.slice(0, 8)} dataKey="amount" nameKey="category" innerRadius={50} outerRadius={100} stroke="#F4F4F0" strokeWidth={2}>
                {catData.slice(0, 8).map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v) => fmtINR(v)}
                contentStyle={{ background: "#0A0A0A", color: "#F4F4F0", border: "none", fontFamily: "IBM Plex Mono", fontSize: 12, borderRadius: 0 }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 space-y-1 font-mono text-xs">
            {catData.slice(0, 5).map((c, i) => (
              <div key={c.category} className="flex justify-between border-b border-black/10 py-1">
                <span className="flex items-center gap-2">
                  <span className="inline-block w-3 h-3" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  {c.category}
                </span>
                <span>{fmtINR(c.amount)}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card testId="chart-merchants" kicker="Fig. 03" title="Top Merchants">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.top_merchants} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid stroke="#D6D6D0" strokeDasharray="2 2" />
              <XAxis type="number" tickFormatter={fmtINRShort} tick={{ fontFamily: "IBM Plex Mono", fontSize: 10 }} stroke="#0A0A0A" />
              <YAxis dataKey="merchant" type="category" tick={{ fontFamily: "IBM Plex Mono", fontSize: 10 }} stroke="#0A0A0A" width={110} />
              <Tooltip
                formatter={(v) => fmtINR(v)}
                contentStyle={{ background: "#0A0A0A", color: "#F4F4F0", border: "none", fontFamily: "IBM Plex Mono", fontSize: 12, borderRadius: 0 }}
              />
              <Bar dataKey="amount" fill="#0A0A0A">
                {data.top_merchants.map((_, i) => (
                  <Cell key={i} fill={i === 0 ? "#E63946" : "#0A0A0A"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
};
