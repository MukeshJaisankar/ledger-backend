import React, { useEffect, useState } from "react";
import { api, fmtINR } from "../lib/api";
import { Trash, Plus, WarningTriangle } from "iconoir-react";

export const Budgets = () => {
  const [budgets, setBudgets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({ category: "", monthly_limit: "" });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [bRes, cRes] = await Promise.all([api.get("/budgets"), api.get("/categories")]);
    setBudgets(bRes.data);
    setCategories(cRes.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.category || !form.monthly_limit) return;
    await api.post("/budgets", {
      category: form.category,
      monthly_limit: parseFloat(form.monthly_limit),
    });
    setForm({ category: "", monthly_limit: "" });
    load();
  };

  const remove = async (id) => {
    await api.delete(`/budgets/${id}`);
    load();
  };

  return (
    <div className="space-y-4" data-testid="budgets-section">
      <div className="bg-white border-t-4 border-b border-l border-r border-black p-6">
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-black/50">Section 04</div>
        <h2 className="font-display text-3xl sm:text-4xl font-black tracking-tighter uppercase mt-1">Budgets & Alerts</h2>
        <p className="font-body text-sm text-black/60 mt-2 max-w-2xl">
          Set a monthly ceiling per category. Cross it — we ring the bell.
        </p>
      </div>

      <form onSubmit={submit} className="bg-white border-t-4 border-b border-l border-r border-black p-6 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end" data-testid="budget-form">
        <div className="sm:col-span-5">
          <label className="font-mono text-[10px] uppercase tracking-widest text-black/60 block mb-1">Category</label>
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="border-b-2 border-black bg-transparent py-2 w-full font-mono text-sm focus:outline-none"
            data-testid="budget-category budget-category-select"
            required
          >
            <option value="">Select…</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="sm:col-span-5">
          <label className="font-mono text-[10px] uppercase tracking-widest text-black/60 block mb-1">Monthly Limit (₹)</label>
          <input
            type="number"
            min="0"
            step="100"
            value={form.monthly_limit}
            onChange={(e) => setForm({ ...form, monthly_limit: e.target.value })}
            className="border-b-2 border-black bg-transparent py-2 w-full font-mono text-sm focus:outline-none"
            placeholder="10000"
            data-testid="budget-limit"
            required
          />
        </div>
        <div className="sm:col-span-2">
          <button
            type="submit"
            data-testid="add-budget-button"
            className="w-full bg-black text-[#F4F4F0] font-bold uppercase tracking-widest text-xs hover:bg-[#E63946] transition-colors duration-150 py-3 px-4 inline-flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" /> Set Budget
          </button>
        </div>
      </form>

      {/* BUDGETS LIST */}
      <div className="space-y-3">
        {loading ? (
          <div className="font-mono text-sm uppercase tracking-widest p-6">Loading…</div>
        ) : budgets.length === 0 ? (
          <div className="bg-white border-t-4 border-b border-l border-r border-black p-12 text-center" data-testid="budgets-empty">
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-black/50">No budgets set</div>
            <h3 className="font-display text-2xl font-black tracking-tighter uppercase mt-2">Spend without a leash.</h3>
          </div>
        ) : (
          budgets.map(b => {
            const pct = Math.min(b.percent, 100);
            const over = b.over_budget;
            return (
              <div key={b.id} className="bg-white border-t-4 border-black border-b border-l border-r p-5" data-testid={`budget-row-${b.id}`}>
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <h4 className="font-display text-lg font-bold uppercase tracking-tight">{b.category}</h4>
                    {over && (
                      <span className="inline-flex items-center gap-1 bg-[#E63946] text-white font-mono text-[10px] uppercase tracking-widest px-2 py-1">
                        <WarningTriangle className="w-3 h-3" /> Over Budget
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="font-mono text-sm">
                      <span className={over ? "text-[#E63946] font-semibold" : ""}>{fmtINR(b.spent)}</span>
                      <span className="text-black/40"> / </span>
                      <span>{fmtINR(b.monthly_limit)}</span>
                    </div>
                    <button
                      onClick={() => remove(b.id)}
                      data-testid={`delete-budget-${b.id}`}
                      className="p-2 hover:bg-[#E63946] hover:text-white transition-colors border border-black"
                      aria-label="Delete budget"
                    >
                      <Trash className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className={`w-full bg-[#EAEAE5] ${over ? "h-6" : "h-4"} border border-black`}>
                  <div
                    className={`${over ? "bg-[#E63946] h-6" : "bg-black h-4"} transition-all duration-500`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="mt-2 font-mono text-[10px] uppercase tracking-widest text-black/60">
                  {b.percent}% used · {b.remaining < 0 ? `${fmtINR(Math.abs(b.remaining))} over` : `${fmtINR(b.remaining)} remaining`}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
