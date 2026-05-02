import React, { useState } from "react";
import "@/App.css";
import { Masthead } from "@/components/Masthead";
import { Tabs } from "@/components/Tabs";
import { Overview } from "@/components/Overview";
import { Transactions } from "@/components/Transactions";
import { Upload } from "@/components/Upload";
import { Budgets } from "@/components/Budgets";
import { Recurring } from "@/components/Recurring";
import { Export } from "@/components/Export";
import { api } from "@/lib/api";
import { Toaster, toast } from "sonner";

const ILLUSTRATION = "https://static.prod-images.emergentagent.com/jobs/5fb4072f-82ba-48ee-a77d-cdd74558c9ea/images/35312bcc476fd5445fd5e3e78077bb2b645390556a879761c3e2f61c3bfa8777.png";

function App() {
  const [tab, setTab] = useState("overview");
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const seedDemo = async () => {
    if (!window.confirm("This will replace all existing transactions with demo data. Continue?")) return;
    setBusy(true);
    try {
      await api.post("/seed-demo");
      toast.success("Demo data loaded");
      setRefreshKey(k => k + 1);
    } catch (e) {
      toast.error("Failed to load demo data");
    } finally {
      setBusy(false);
    }
  };

  const clearAll = async () => {
    if (!window.confirm("Delete ALL transactions? This cannot be undone.")) return;
    setBusy(true);
    try {
      await api.delete("/transactions");
      toast.success("All transactions cleared");
      setRefreshKey(k => k + 1);
    } catch (e) {
      toast.error("Failed to clear");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="App bg-[#F4F4F0] min-h-screen border-t-8 border-black">
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "#0A0A0A",
            color: "#F4F4F0",
            border: "2px solid #0A0A0A",
            borderRadius: 0,
            fontFamily: "IBM Plex Mono, monospace",
            fontSize: "12px",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          },
        }}
      />
      <Masthead onSeedDemo={seedDemo} onClear={clearAll} busy={busy} />
      <Tabs active={tab} onChange={setTab} />
      <main className="max-w-[1400px] mx-auto px-6 lg:px-12 py-8" key={refreshKey}>
        {tab === "overview" && <Overview />}
        {tab === "transactions" && <Transactions />}
        {tab === "upload" && (
          <Upload
            illustration={ILLUSTRATION}
            onUploaded={() => { toast.success("Statement processed"); setRefreshKey(k => k + 1); }}
          />
        )}
        {tab === "budgets" && <Budgets />}
        {tab === "recurring" && <Recurring />}
        {tab === "export" && <Export />}
      </main>
      <footer className="border-t-2 border-black mt-12 py-6 px-6 lg:px-12 max-w-[1400px] mx-auto">
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-black/50 flex justify-between flex-wrap gap-2">
          <span>The Ledger · Personal Finance Edition</span>
          <span>End of File · {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
