import React from "react";
import { API } from "../lib/api";
import { Download } from "iconoir-react";

export const Export = () => {
  return (
    <div className="space-y-4" data-testid="export-section">
      <div className="bg-white border-t-4 border-b border-l border-r border-black p-6">
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-black/50">Section 06</div>
        <h2 className="font-display text-3xl sm:text-4xl font-black tracking-tighter uppercase mt-1">Export</h2>
        <p className="font-body text-sm text-black/60 mt-2 max-w-2xl">
          Take your records elsewhere. CSV for spreadsheets, PDF for the records.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <a
          href={`${API}/export/csv`}
          target="_blank"
          rel="noreferrer"
          data-testid="export-csv-link"
          className="bg-white border-t-4 border-b border-l border-r border-black p-8 hover:bg-black hover:text-[#F4F4F0] transition-colors group"
        >
          <Download className="w-8 h-8" />
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] mt-4 opacity-60 group-hover:opacity-80">Format</div>
          <h3 className="font-display text-3xl font-black tracking-tighter uppercase mt-1">CSV</h3>
          <p className="font-body text-sm mt-2 opacity-80">All transactions, in spreadsheet form. Open in Excel / Numbers / Sheets.</p>
        </a>

        <a
          href={`${API}/export/pdf`}
          target="_blank"
          rel="noreferrer"
          data-testid="export-pdf-link"
          className="bg-white border-t-4 border-[#E63946] border-b border-l border-r border-black p-8 hover:bg-[#E63946] hover:text-white transition-colors group"
        >
          <Download className="w-8 h-8" />
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] mt-4 opacity-60 group-hover:opacity-80">Format</div>
          <h3 className="font-display text-3xl font-black tracking-tighter uppercase mt-1">PDF</h3>
          <p className="font-body text-sm mt-2 opacity-80">A printed statement — total income, total expense, balance and a transaction ledger.</p>
        </a>
      </div>
    </div>
  );
};
