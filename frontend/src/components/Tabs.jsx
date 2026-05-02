import React from "react";

const TABS = [
  { id: "overview", label: "01 / Overview" },
  { id: "transactions", label: "02 / Transactions" },
  { id: "upload", label: "03 / Upload" },
  { id: "budgets", label: "04 / Budgets" },
  { id: "recurring", label: "05 / Recurring" },
  { id: "export", label: "06 / Export" },
];

export const Tabs = ({ active, onChange }) => (
  <nav className="border-b-2 border-black bg-[#F4F4F0] sticky top-0 z-30" data-testid="main-tabs">
    <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
      <div className="flex overflow-x-auto no-scrollbar">
        {TABS.map((t) => {
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              data-testid={`tab-${t.id}`}
              onClick={() => onChange(t.id)}
              className={`relative font-mono uppercase text-xs tracking-[0.2em] py-4 px-5 whitespace-nowrap border-r border-black/20 transition-colors duration-150
                ${isActive
                  ? "bg-black text-[#F4F4F0]"
                  : "bg-transparent text-black hover:bg-black/5"
                }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  </nav>
);
