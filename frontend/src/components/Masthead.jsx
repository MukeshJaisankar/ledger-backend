import React from "react";

export const Masthead = ({ onSeedDemo, onClear, busy }) => {
  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  return (
    <header className="border-b-4 border-black bg-[#F4F4F0]" data-testid="masthead">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-4">
        <div className="flex items-center justify-between text-[10px] sm:text-xs uppercase tracking-[0.2em] font-mono text-black/70 border-b border-black/30 pb-2 mb-3">
          <span data-testid="masthead-date">{today}</span>
          <span className="hidden sm:inline">VOL. I — PERSONAL FINANCIAL JOURNAL</span>
          <span>INR &nbsp;{"\u20B9"}</span>
        </div>
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-5xl sm:text-7xl lg:text-8xl font-black tracking-tighter leading-[0.9] uppercase" data-testid="app-title">
              The&nbsp;Ledger
            </h1>
            <p className="font-mono text-xs sm:text-sm uppercase tracking-[0.25em] mt-2 text-black/60">
              An honest record of where your money went.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={onSeedDemo}
              disabled={busy}
              data-testid="seed-demo-button"
              className="bg-transparent text-black border-2 border-black font-bold uppercase tracking-widest text-xs hover:bg-black hover:text-[#F4F4F0] transition-colors duration-150 py-3 px-4 disabled:opacity-50"
            >
              Load Demo Data
            </button>
            <button
              onClick={onClear}
              disabled={busy}
              data-testid="clear-all-button"
              className="bg-transparent text-black border-2 border-black font-bold uppercase tracking-widest text-xs hover:bg-[#E63946] hover:text-white hover:border-[#E63946] transition-colors duration-150 py-3 px-4 disabled:opacity-50"
            >
              Clear All
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
