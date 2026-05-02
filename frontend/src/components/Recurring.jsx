import React, { useEffect, useState } from "react";
import { api, fmtINR } from "../lib/api";
import Marquee from "react-fast-marquee";

export const Recurring = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await api.get("/recurring");
        if (alive) setItems(res.data);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const totalMonthly = items.reduce((s, i) => s + (i.cadence === "Monthly" ? i.avg_amount : i.cadence === "Bi-weekly" ? i.avg_amount * 2 : i.avg_amount * 4), 0);

  return (
    <div className="space-y-4" data-testid="recurring-section">
      <div className="bg-white border-t-4 border-b border-l border-r border-black p-6">
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-black/50">Section 05</div>
        <h2 className="font-display text-3xl sm:text-4xl font-black tracking-tighter uppercase mt-1">Recurring Charges</h2>
        <p className="font-body text-sm text-black/60 mt-2 max-w-2xl">
          Subscriptions, EMIs, rent — anything that returns. Detected automatically from cadence and merchant repetition.
        </p>
      </div>

      {/* TICKER */}
      {items.length > 0 && (
        <div className="border-y-2 border-black bg-[#EAEAE5] py-4 overflow-hidden" data-testid="recurring-ticker">
          <Marquee speed={50} gradient={false} pauseOnHover>
            {items.map((i, idx) => (
              <span key={idx} className="font-display text-2xl sm:text-3xl font-black uppercase tracking-widest mx-8 whitespace-nowrap">
                {i.merchant} <span className="text-[#E63946]">{fmtINR(i.avg_amount)}</span> <span className="text-black/40">·</span>
              </span>
            ))}
          </Marquee>
        </div>
      )}

      {loading ? (
        <div className="font-mono text-sm uppercase tracking-widest p-6">Detecting…</div>
      ) : items.length === 0 ? (
        <div className="bg-white border-t-4 border-b border-l border-r border-black p-12 text-center" data-testid="recurring-empty">
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-black/50">Nothing detected</div>
          <h3 className="font-display text-2xl font-black tracking-tighter uppercase mt-2">No repeating charges yet.</h3>
          <p className="font-body text-sm text-black/60 mt-2">Need at least 2 occurrences with similar cadence.</p>
        </div>
      ) : (
        <>
          <div className="bg-black text-[#F4F4F0] border-t-4 border-b border-l border-r border-black p-6">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#F4F4F0]/60">Estimated Monthly Outflow</div>
            <div className="font-mono text-4xl sm:text-5xl font-semibold tracking-tighter mt-1" data-testid="recurring-total">
              {fmtINR(totalMonthly)}
            </div>
          </div>

          <div className="bg-white border-t-4 border-b border-l border-r border-black overflow-x-auto">
            <table className="w-full border-collapse" data-testid="recurring-table">
              <thead>
                <tr className="bg-[#EAEAE5]">
                  <th className="text-left font-mono text-[10px] uppercase tracking-widest border-b-4 border-black py-4 px-4">Merchant</th>
                  <th className="text-left font-mono text-[10px] uppercase tracking-widest border-b-4 border-black py-4 px-4">Category</th>
                  <th className="text-left font-mono text-[10px] uppercase tracking-widest border-b-4 border-black py-4 px-4">Cadence</th>
                  <th className="text-left font-mono text-[10px] uppercase tracking-widest border-b-4 border-black py-4 px-4">Last</th>
                  <th className="text-right font-mono text-[10px] uppercase tracking-widest border-b-4 border-black py-4 px-4">Avg</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i, idx) => (
                  <tr key={idx} className="hover:bg-[#F4F4F0]" data-testid={`recurring-row-${idx}`}>
                    <td className="font-body font-medium border-b border-black/10 py-3 px-4">{i.merchant}</td>
                    <td className="border-b border-black/10 py-3 px-4">
                      <span className="inline-block font-mono text-[10px] uppercase tracking-widest border border-black px-2 py-1">{i.category}</span>
                    </td>
                    <td className="font-mono text-sm border-b border-black/10 py-3 px-4">{i.cadence}</td>
                    <td className="font-mono text-sm border-b border-black/10 py-3 px-4">{i.last_date}</td>
                    <td className="font-mono text-sm text-right border-b border-black/10 py-3 px-4">{fmtINR(i.avg_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};
