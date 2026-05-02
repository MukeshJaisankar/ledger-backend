import React, { useRef, useState } from "react";
import { api } from "../lib/api";
import { CloudUpload, Page, CheckCircle, WarningTriangle } from "iconoir-react";

const SAMPLE_CSV = `Date,Narration,Debit,Credit
2025-01-02,UPI/SWIGGY/ORDER123,480,
2025-01-03,UPI/UBER INDIA/RIDE,320,
2025-01-05,SALARY CREDIT - ACME CORP,,85000
2025-01-08,NETFLIX SUBSCRIPTION,649,
2025-01-10,UPI/BLINKIT/GROCERY,1245,
2025-01-12,HDFC HOMELOAN EMI,24500,
2025-01-15,AIRTEL POSTPAID,599,
2025-01-18,AMAZON.IN SHOPPING,1899,
2025-01-22,INDIANOIL PETROL,2200,
2025-01-25,APOLLO PHARMACY,540,
`;

export const Upload = ({ onUploaded, illustration }) => {
  const inputRef = useRef(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleFiles = async (file) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.post("/upload-statement", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(res.data);
      onUploaded?.();
    } catch (e) {
      setError(e?.response?.data?.detail || "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDrag(false);
    const file = e.dataTransfer.files?.[0];
    handleFiles(file);
  };

  const downloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sample_statement.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4" data-testid="upload-section">
      <div className="bg-white border-t-4 border-b border-l border-r border-black p-6">
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-black/50">Section 03</div>
        <h2 className="font-display text-3xl sm:text-4xl font-black tracking-tighter uppercase mt-1">Upload Statement</h2>
        <p className="font-body text-sm text-black/60 mt-2 max-w-2xl">
          Drop a CSV or Excel export from any Indian bank — HDFC, SBI, ICICI, Axis, Kotak. We auto-detect the date,
          narration, debit and credit columns. Transactions are categorised on arrival.
        </p>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        className={`bg-white border-2 border-dashed border-black p-10 sm:p-16 text-center transition-colors ${drag ? "bg-[#EAEAE5] border-solid" : ""}`}
        data-testid="upload-dropzone"
      >
        {illustration && (
          <img
            src={illustration}
            alt="Upload"
            className="mx-auto mb-6 w-48 h-48 object-contain"
            style={{ filter: "grayscale(0.2) contrast(1.05)" }}
          />
        )}
        <CloudUpload className="w-12 h-12 mx-auto mb-3" />
        <h3 className="font-display text-2xl font-bold tracking-tight uppercase">Drag your statement here</h3>
        <p className="font-mono text-xs uppercase tracking-widest text-black/50 mt-2">or pick a file from your machine</p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={(e) => handleFiles(e.target.files?.[0])}
          className="hidden"
          data-testid="file-input"
        />
        <div className="mt-6 flex flex-wrap gap-3 justify-center">
          <button
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            data-testid="choose-file-button"
            className="bg-black text-[#F4F4F0] font-bold uppercase tracking-widest text-xs hover:bg-[#E63946] transition-colors duration-150 py-3 px-5 disabled:opacity-50"
          >
            {busy ? "Uploading…" : "Choose File"}
          </button>
          <button
            onClick={downloadSample}
            data-testid="download-sample-button"
            className="bg-transparent text-black border-2 border-black font-bold uppercase tracking-widest text-xs hover:bg-black hover:text-[#F4F4F0] transition-colors duration-150 py-3 px-5"
          >
            <Page className="w-4 h-4 inline-block mr-2" />
            Download Sample CSV
          </button>
        </div>
      </div>

      {result && (
        <div className="bg-[#1E4620] text-white border-t-4 border-black p-5 flex items-start gap-3" data-testid="upload-success">
          <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest opacity-70">Success</div>
            <div className="font-mono text-base">
              Inserted <strong>{result.inserted}</strong> transactions. Skipped <strong>{result.skipped}</strong>.
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-[#E63946] text-white border-t-4 border-black p-5 flex items-start gap-3" data-testid="upload-error">
          <WarningTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest opacity-80">Error</div>
            <div className="font-mono text-sm">{error}</div>
          </div>
        </div>
      )}

      <div className="bg-[#EAEAE5] border-t-4 border-b border-l border-r border-black p-6">
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-black/50 mb-2">Required columns</div>
        <div className="font-mono text-sm space-y-1">
          <div><span className="font-bold">Date</span> — any standard format (auto-detected, day-first)</div>
          <div><span className="font-bold">Narration / Description / Particulars</span> — merchant text</div>
          <div><span className="font-bold">Debit + Credit</span> — OR a single <strong>Amount</strong> column</div>
        </div>
      </div>
    </div>
  );
};
