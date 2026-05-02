import React, { useEffect, useState } from "react";
import { api, fmtINR } from "../lib/api";
import { Trash, Edit, Search, Sparks } from "iconoir-react";
import { toast } from "sonner";

export const Transactions = () => {
  const [txns, setTxns] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filter, setFilter] = useState({ search: "", category: "", type: "" });
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [recatBusy, setRecatBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filter.search) params.search = filter.search;
      if (filter.category) params.category = filter.category;
      if (filter.type) params.type = filter.type;
      const [tRes, cRes] = await Promise.all([
        api.get("/transactions", { params }),
        api.get("/categories"),
      ]);
      setTxns(tRes.data);
      setCategories(cRes.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter.category, filter.type]);

  const onSearch = (e) => {
    e.preventDefault();
    load();
  };

  const updateCategory = async (id, category) => {
    await api.patch(`/transactions/${id}`, { category });
    setTxns(prev => prev.map(t => t.id === id ? { ...t, category } : t));
    setEditing(null);
  };

  const remove = async (id) => {
    await api.delete(`/transactions/${id}`);
    setTxns(prev => prev.filter(t => t.id !== id));
  };

  const recategorize = async () => {
    setRecatBusy(true);
    const id = toast.loading("AI is reading your transactions…");
    try {
      const res = await api.post("/recategorize", { only_other: true, limit: 100 });
      toast.success(`Recategorised ${res.data.updated} of ${res.data.examined}`, { id });
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Recategorise failed", { id });
    } finally {
      setRecatBusy(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="transactions-section">
      {/* FILTERS */}
      <div className="bg-white border-t-4 border-b border-l border-r border-black p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-black/50">Filter & Search</div>
          <button
            onClick={recategorize}
            disabled={recatBusy}
            data-testid="ai-recategorize-button"
            className="inline-flex items-center gap-2 bg-[#E63946] text-white border-2 border-[#E63946] font-bold uppercase tracking-widest text-[11px] hover:bg-black hover:border-black transition-colors duration-150 py-2 px-3 disabled:opacity-50"
          >
            <Sparks className="w-4 h-4" />
            {recatBusy ? "Thinking…" : "AI Re-categorise 'Other'"}
          </button>
        </div>
        <form onSubmit={onSearch} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
          <div className="sm:col-span-5">
            <label className="font-mono text-[10px] uppercase tracking-widest text-black/60 block mb-1">Search</label>
            <div className="flex items-center border-b-2 border-black">
              <Search className="w-4 h-4 mr-2" />
              <input
                data-testid="search-input transactions-search"
                value={filter.search}
                onChange={(e) => setFilter({ ...filter, search: e.target.value })}
                className="bg-transparent py-2 w-full font-mono text-sm focus:outline-none"
                placeholder="merchant or description"
              />
            </div>
          </div>
          <div className="sm:col-span-3">
            <label className="font-mono text-[10px] uppercase tracking-widest text-black/60 block mb-1">Category</label>
            <select
              data-testid="filter-category"
              value={filter.category}
              onChange={(e) => setFilter({ ...filter, category: e.target.value })}
              className="border-b-2 border-black bg-transparent py-2 w-full font-mono text-sm focus:outline-none"
            >
              <option value="">All</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="font-mono text-[10px] uppercase tracking-widest text-black/60 block mb-1">Type</label>
            <select
              data-testid="filter-type"
              value={filter.type}
              onChange={(e) => setFilter({ ...filter, type: e.target.value })}
              className="border-b-2 border-black bg-transparent py-2 w-full font-mono text-sm focus:outline-none"
            >
              <option value="">All</option>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              data-testid="apply-filter-button"
              className="w-full bg-black text-[#F4F4F0] font-bold uppercase tracking-widest text-xs hover:bg-[#E63946] transition-colors duration-150 py-3 px-4"
            >
              Apply
            </button>
          </div>
        </form>
      </div>

      {/* TABLE */}
      <div className="bg-white border-t-4 border-b border-l border-r border-black overflow-hidden">
        {loading ? (
          <div className="p-12 font-mono text-sm uppercase tracking-widest">Loading…</div>
        ) : txns.length === 0 ? (
          <div className="p-12 text-center">
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-black/50">Empty</div>
            <h3 className="font-display text-2xl font-black tracking-tighter uppercase mt-2">No transactions match.</h3>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" data-testid="transactions-table">
              <thead>
                <tr className="bg-[#EAEAE5]">
                  <th className="text-left font-mono text-[10px] uppercase tracking-widest border-b-4 border-black py-4 px-4">Date</th>
                  <th className="text-left font-mono text-[10px] uppercase tracking-widest border-b-4 border-black py-4 px-4">Description</th>
                  <th className="text-left font-mono text-[10px] uppercase tracking-widest border-b-4 border-black py-4 px-4">Category</th>
                  <th className="text-left font-mono text-[10px] uppercase tracking-widest border-b-4 border-black py-4 px-4">Type</th>
                  <th className="text-right font-mono text-[10px] uppercase tracking-widest border-b-4 border-black py-4 px-4">Amount</th>
                  <th className="border-b-4 border-black py-4 px-4 w-24"></th>
                </tr>
              </thead>
              <tbody>
                {txns.map((t) => (
                  <tr key={t.id} className="hover:bg-[#F4F4F0] transition-colors" data-testid={`txn-row-${t.id}`}>
                    <td className="font-mono text-sm border-b border-black/10 py-3 px-4 whitespace-nowrap">{t.date}</td>
                    <td className="font-body text-sm border-b border-black/10 py-3 px-4 max-w-md truncate">
                      <div className="font-medium truncate">{t.merchant}</div>
                      <div className="text-xs text-black/50 truncate">{t.description}</div>
                    </td>
                    <td className="border-b border-black/10 py-3 px-4">
                      {editing === t.id ? (
                        <select
                          autoFocus
                          defaultValue={t.category}
                          onBlur={(e) => updateCategory(t.id, e.target.value)}
                          onChange={(e) => updateCategory(t.id, e.target.value)}
                          className="border-b-2 border-black bg-transparent py-1 font-mono text-xs focus:outline-none"
                          data-testid={`category-select-${t.id}`}
                        >
                          {categories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      ) : (
                        <button
                          onClick={() => setEditing(t.id)}
                          className="inline-flex items-center font-mono text-xs uppercase tracking-widest border border-black px-2 py-1 hover:bg-black hover:text-[#F4F4F0] transition-colors"
                          data-testid={`edit-category-${t.id}`}
                        >
                          {t.category}
                          <Edit className="w-3 h-3 ml-2" />
                        </button>
                      )}
                    </td>
                    <td className="border-b border-black/10 py-3 px-4">
                      <span className={`font-mono text-[10px] uppercase tracking-widest px-2 py-1 ${t.type === "income" ? "bg-[#1E4620] text-white" : "bg-black text-[#F4F4F0]"}`}>
                        {t.type}
                      </span>
                    </td>
                    <td className={`font-mono text-sm text-right border-b border-black/10 py-3 px-4 whitespace-nowrap ${t.type === "income" ? "text-[#1E4620]" : "text-black"}`}>
                      {t.type === "income" ? "+" : "−"} {fmtINR(t.amount)}
                    </td>
                    <td className="border-b border-black/10 py-3 px-4 text-right">
                      <button
                        onClick={() => remove(t.id)}
                        data-testid={`delete-txn-${t.id}`}
                        className="p-1 hover:bg-[#E63946] hover:text-white transition-colors"
                        aria-label="Delete"
                      >
                        <Trash className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="font-mono text-xs text-black/50 uppercase tracking-widest" data-testid="txn-count">
        {txns.length} record{txns.length === 1 ? "" : "s"}
      </div>
    </div>
  );
};
