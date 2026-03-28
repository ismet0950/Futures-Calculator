"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type PositionType = "long" | "short";

type EntryItem = {
  id: number;
  price: string;
};

type ChartOption = {
  symbol: string;
  base: string;
  name: string;
};

const CHART_OPTIONS: ChartOption[] = [
  { symbol: "BINANCE:BTCUSDT", base: "BTC", name: "Bitcoin" },
  { symbol: "BINANCE:ETHUSDT", base: "ETH", name: "Ethereum" },
  { symbol: "BINANCE:BNBUSDT", base: "BNB", name: "BNB" },
  { symbol: "BINANCE:SOLUSDT", base: "SOL", name: "Solana" },
  { symbol: "BINANCE:XRPUSDT", base: "XRP", name: "XRP" },
  { symbol: "BINANCE:ADAUSDT", base: "ADA", name: "Cardano" },
  { symbol: "BINANCE:DOGEUSDT", base: "DOGE", name: "Dogecoin" },
  { symbol: "BINANCE:AVAXUSDT", base: "AVAX", name: "Avalanche" },
  { symbol: "BINANCE:LINKUSDT", base: "LINK", name: "Chainlink" },
  { symbol: "BINANCE:DOTUSDT", base: "DOT", name: "Polkadot" },
  { symbol: "BINANCE:TRXUSDT", base: "TRX", name: "TRON" },
  { symbol: "BINANCE:TONUSDT", base: "TON", name: "Toncoin" },
  { symbol: "BINANCE:NEARUSDT", base: "NEAR", name: "NEAR Protocol" },
  { symbol: "BINANCE:ARBUSDT", base: "ARB", name: "Arbitrum" },
  { symbol: "BINANCE:OPUSDT", base: "OP", name: "Optimism" },
];

const formatMoney = (value: number) =>
  Number.isFinite(value)
    ? value.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "0.00";

const formatPrice = (value: number) =>
  Number.isFinite(value)
    ? value.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 4,
      })
    : "0.00";

const asNumber = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeChartSymbol = (value: string) => {
  const normalized = value.trim().toUpperCase().replace(/\s+/g, "");
  if (!normalized) {
    return "BINANCE:BTCUSDT";
  }
  if (normalized.includes(":")) {
    return normalized;
  }
  if (normalized.endsWith("USDT")) {
    return `BINANCE:${normalized}`;
  }
  return `BINANCE:${normalized}USDT`;
};

export default function EntryRiskPlannerPage() {
  const [positionType, setPositionType] = useState<PositionType>("long");
  const [leverage, setLeverage] = useState("");
  const [stopPrice, setStopPrice] = useState("");
  const [maxLossUsdt, setMaxLossUsdt] = useState("");
  const [chartSymbol, setChartSymbol] = useState("BINANCE:BTCUSDT");
  const [chartSearch, setChartSearch] = useState("BTC");
  const [entries, setEntries] = useState<EntryItem[]>([{ id: 1, price: "" }]);
  const [nextId, setNextId] = useState(2);

  const leverageValue = Math.max(1, asNumber(leverage) || 1);
  const chartSymbolParam = encodeURIComponent(chartSymbol);
  const chartEmbedUrl = `https://s.tradingview.com/widgetembed/?symbol=${chartSymbolParam}&interval=60&hidesidetoolbar=1&symboledit=1&saveimage=1&toolbarbg=0f172a&theme=dark&style=1&timezone=Etc%2FUTC&withdateranges=1&hideideas=1`;
  const chartOpenUrl = `https://www.tradingview.com/chart/?symbol=${chartSymbolParam}`;
  const filteredChartOptions = useMemo(() => {
    const q = chartSearch.trim().toUpperCase();
    if (!q) {
      return CHART_OPTIONS.slice(0, 8);
    }
    return CHART_OPTIONS.filter((option) => {
      const full = `${option.base} ${option.name} ${option.symbol}`.toUpperCase();
      return full.includes(q);
    }).slice(0, 8);
  }, [chartSearch]);

  const result = useMemo(() => {
    const stop = asNumber(stopPrice);
    const maxLoss = Math.max(0, asNumber(maxLossUsdt));

    const rows = entries.map((entry) => {
      const entryPrice = asNumber(entry.price);

      const lossFactor =
        positionType === "long"
          ? entryPrice > 0 ? (entryPrice - stop) / entryPrice : 0
          : entryPrice > 0 ? (stop - entryPrice) / entryPrice : 0;

      return {
        id: entry.id,
        entryPrice,
        isValidForRisk: entryPrice > 0 && stop > 0 && lossFactor > 0,
        lossFactor: Math.max(0, lossFactor),
      };
    });

    const validRows = rows.filter((row) => row.isValidForRisk);
    const totalLossFactor = validRows.reduce((sum, row) => sum + row.lossFactor, 0);

    if (validRows.length === 0 || totalLossFactor <= 0 || maxLoss <= 0) {
      return {
        canCalculate: false,
        message:
          "Entry qiyməti(ləri), Stop və Max Loss daxil edin. Stop loss istiqaməti seçdiyiniz Long/Short rejiminə uyğun olmalıdır.",
        rows: rows.map((row) => ({
          ...row,
          recommendedNotional: 0,
          recommendedMargin: 0,
          estimatedLoss: 0,
        })),
        totalNotional: 0,
        totalMargin: 0,
        averageEntryPrice: 0,
      };
    }

    // Equal-risk split model: each active entry gets equal notional size.
    const recommendedNotionalPerEntry = maxLoss / totalLossFactor;

    const withAlloc = rows.map((row) => {
      if (!row.isValidForRisk) {
        return {
          ...row,
          recommendedNotional: 0,
          recommendedMargin: 0,
          estimatedLoss: 0,
          recommendedQty: 0,
        };
      }

      const estimatedLoss = recommendedNotionalPerEntry * row.lossFactor;
      const recommendedQty = row.entryPrice > 0 ? recommendedNotionalPerEntry / row.entryPrice : 0;
      return {
        ...row,
        recommendedNotional: recommendedNotionalPerEntry,
        recommendedMargin: recommendedNotionalPerEntry / leverageValue,
        estimatedLoss,
        recommendedQty,
      };
    });

    const totalNotional = withAlloc.reduce(
      (sum, row) => sum + row.recommendedNotional,
      0,
    );
    const totalQty = withAlloc.reduce((sum, row) => sum + row.recommendedQty, 0);
    const totalMargin = totalNotional / leverageValue;
    const averageEntryPrice = totalQty > 0 ? totalNotional / totalQty : 0;

    return {
      canCalculate: true,
      message: "Hesablandı. Hər aktiv entry üçün tövsiyə olunan məbləğ aşağıdadır.",
      rows: withAlloc,
      totalNotional,
      totalMargin,
      averageEntryPrice,
    };
  }, [entries, stopPrice, maxLossUsdt, positionType, leverageValue]);

  const updateEntry = (id: number, price: string) => {
    setEntries((prev) =>
      prev.map((entry) => (entry.id === id ? { ...entry, price } : entry)),
    );
  };

  const addEntry = () => {
    setEntries((prev) => {
      if (prev.length >= 3) {
        return prev;
      }
      return [...prev, { id: nextId, price: "" }];
    });
    setNextId((prev) => prev + 1);
  };

  const removeEntry = (id: number) => {
    setEntries((prev) => {
      if (prev.length === 1) {
        return prev;
      }
      return prev.filter((entry) => entry.id !== id);
    });
  };

  const clearAll = () => {
    setPositionType("long");
    setLeverage("");
    setStopPrice("");
    setMaxLossUsdt("");
    setEntries([{ id: 1, price: "" }]);
    setNextId(2);
  };

  const applyChartSymbol = () => {
    setChartSymbol(normalizeChartSymbol(chartSearch));
  };

  const selectChartOption = (option: ChartOption) => {
    setChartSymbol(option.symbol);
    setChartSearch(option.base);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050b17] text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_8%,rgba(34,197,94,0.24),transparent_36%),radial-gradient(circle_at_85%_0%,rgba(6,182,212,0.2),transparent_30%),radial-gradient(circle_at_60%_100%,rgba(239,68,68,0.15),transparent_28%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] [background-size:34px_34px]" />

      <main className="relative mx-auto w-full max-w-5xl px-3 py-4 sm:px-5 sm:py-6">
        <header className="rounded-xl border border-slate-700/70 bg-slate-900/70 p-4 backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">
                Risk-Based Entry Sizing
              </p>
              <h1 className="mt-1.5 text-xl font-semibold tracking-tight text-slate-100">
                Entry Risk Planner
              </h1>
              <p className="mt-1 text-xs text-slate-300 sm:text-sm">
                Entry və Stop nöqtələrini yazın, Stop-da itirə biləcəyiniz maksimum məbləği daxil edin, sistem sizə hər entry üçün neçə dollar ilə girmək lazım olduğunu hesablaysın.
              </p>
            </div>
            <Link
              href="/"
              className="rounded-md border border-slate-600 bg-slate-900/70 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-cyan-500 hover:text-cyan-300"
            >
              Main Calculator
            </Link>
            <a
              href={chartOpenUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border border-emerald-400/70 bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/30"
            >
              + TradingView
            </a>
          </div>
        </header>

        <section className="mt-4 rounded-xl border border-slate-700 bg-slate-900/75 p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-100">Integrated Chart</h2>
            <p className="text-xs text-slate-300">TradingView - {chartSymbol}</p>
          </div>
          <div className="mb-3 grid gap-2.5 rounded-lg border border-slate-800 bg-slate-950/55 p-3 sm:grid-cols-[1fr_auto]">
            <div className="relative">
              <input
                type="text"
                value={chartSearch}
                onChange={(event) => setChartSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    applyChartSymbol();
                  }
                }}
                placeholder="Coin yaz: BTC, ETH, SOL və ya BINANCE:ADAUSDT"
                className="w-full rounded-md border border-slate-700 bg-slate-900/70 px-2.5 py-1.5 text-xs text-slate-100 outline-none transition focus:border-cyan-500"
              />
              {filteredChartOptions.length > 0 ? (
                <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-slate-700 bg-slate-900 shadow-xl">
                  {filteredChartOptions.map((option) => (
                    <button
                      key={option.symbol}
                      type="button"
                      onClick={() => selectChartOption(option)}
                      className="flex w-full items-center justify-between px-2.5 py-2 text-left text-xs text-slate-200 transition hover:bg-slate-800"
                    >
                      <span>{option.name} ({option.base})</span>
                      <span className="text-slate-400">{option.symbol}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={applyChartSymbol}
              className="rounded-md border border-cyan-500/60 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-500/20"
            >
              Open Chart
            </button>
          </div>
          <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950/60">
            <iframe
              title="TradingView BTCUSDT Chart"
              src={chartEmbedUrl}
              className="h-[430px] w-full"
              loading="lazy"
              allowFullScreen
            />
          </div>
        </section>

        <section className="mt-4 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-xl border border-slate-700 bg-slate-900/75 p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-100">Inputs</h2>
              <button
                type="button"
                onClick={clearAll}
                className="rounded-md border border-slate-700 bg-slate-950/50 px-2.5 py-1.5 text-xs font-medium text-slate-200 transition hover:border-rose-500 hover:text-rose-300"
              >
                Clear
              </button>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <p className="text-xs text-slate-300">Position Type</p>
                <div className="inline-flex rounded-md border border-slate-700 bg-slate-950/60 p-0.5">
                  <button
                    type="button"
                    onClick={() => setPositionType("long")}
                    className={`rounded px-3 py-1.5 text-xs font-medium transition ${
                      positionType === "long"
                        ? "bg-emerald-500/20 text-emerald-300"
                        : "text-slate-300 hover:text-slate-100"
                    }`}
                  >
                    Long
                  </button>
                  <button
                    type="button"
                    onClick={() => setPositionType("short")}
                    className={`rounded px-3 py-1.5 text-xs font-medium transition ${
                      positionType === "short"
                        ? "bg-rose-500/20 text-rose-300"
                        : "text-slate-300 hover:text-slate-100"
                    }`}
                  >
                    Short
                  </button>
                </div>
              </div>

              <label className="space-y-1.5">
                <span className="text-xs text-slate-300">Leverage (optional)</span>
                <input
                  type="number"
                  min="1"
                  max="125"
                  step="1"
                  value={leverage}
                  onChange={(event) => setLeverage(event.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-slate-950/70 px-2.5 py-1.5 text-xs text-slate-100 outline-none transition focus:border-cyan-500"
                  placeholder="1"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs text-slate-300">Stop Price</span>
                <input
                  type="number"
                  min="0"
                  step="0.0001"
                  value={stopPrice}
                  onChange={(event) => setStopPrice(event.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-slate-950/70 px-2.5 py-1.5 text-xs text-slate-100 outline-none transition focus:border-rose-500"
                  placeholder="Stop"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs text-slate-300">Max Loss at Stop (USDT)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={maxLossUsdt}
                  onChange={(event) => setMaxLossUsdt(event.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-slate-950/70 px-2.5 py-1.5 text-xs text-slate-100 outline-none transition focus:border-rose-500"
                  placeholder="Maksimum itki"
                />
              </label>
            </div>

            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-100">Entries</h3>
                <button
                  type="button"
                  onClick={addEntry}
                  disabled={entries.length >= 3}
                  className="rounded-md border border-cyan-500/60 bg-cyan-500/10 px-2.5 py-1.5 text-xs font-medium text-cyan-300 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Add Entry
                </button>
              </div>

              <div className="grid gap-2.5">
                {entries.map((entry, index) => (
                  <div
                    key={entry.id}
                    className="grid gap-2.5 rounded-lg border border-slate-800 bg-slate-950/50 p-3 sm:grid-cols-[1fr_auto]"
                  >
                    <label className="space-y-1.5">
                      <span className="text-[11px] uppercase tracking-wide text-slate-400">
                        Entry {index + 1} Price
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.0001"
                        value={entry.price}
                        onChange={(event) => updateEntry(entry.id, event.target.value)}
                        className="w-full rounded-md border border-slate-700 bg-slate-900/70 px-2.5 py-1.5 text-xs text-slate-100 outline-none transition focus:border-cyan-500"
                        placeholder="Entry price"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => removeEntry(entry.id)}
                      disabled={entries.length === 1}
                      className="self-end rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 transition hover:border-rose-500 hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <aside className="rounded-xl border border-slate-700 bg-slate-900/75 p-4 sm:p-5">
            <h2 className="text-base font-semibold text-slate-100">Recommended Allocation</h2>
            <p className="mt-1 text-xs text-slate-300">Model: aktiv entry-lər arasında bərabər risk bölüşdürülür.</p>

            <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/55 p-3 text-xs text-slate-200">
              {result.message}
            </div>

            <div className="mt-3 grid gap-2.5">
              {result.rows.map((row, idx) => (
                <div key={row.id} className="rounded-lg border border-slate-800 bg-slate-950/55 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">Entry {idx + 1}</p>
                  <p className="mt-1 text-xs text-slate-300">
                    Price: <span className="font-semibold text-slate-100">{formatPrice(row.entryPrice)}</span>
                  </p>
                  <p className="mt-1 text-xs text-cyan-300">
                    Enter with (Notional): <span className="font-semibold">{formatMoney(row.recommendedNotional)} USDT</span>
                  </p>
                  <p className="mt-1 text-xs text-slate-300">
                    Margin needed: <span className="font-semibold text-slate-100">{formatMoney(row.recommendedMargin)} USDT</span>
                  </p>
                  <p className="mt-1 text-xs text-rose-300">
                    Estimated loss from this entry: <span className="font-semibold">{formatMoney(row.estimatedLoss)} USDT</span>
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-3 grid gap-2.5">
              <div className="rounded-lg border border-cyan-900/50 bg-cyan-950/20 p-3">
                <p className="text-[11px] uppercase tracking-wide text-cyan-300">Average Entry Price</p>
                <p className="mt-1 text-base font-semibold text-cyan-200">{formatPrice(result.averageEntryPrice)}</p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950/55 p-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Total Notional</p>
                <p className="mt-1 text-base font-semibold text-slate-100">{formatMoney(result.totalNotional)} USDT</p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950/55 p-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Total Margin Needed</p>
                <p className="mt-1 text-base font-semibold text-slate-100">{formatMoney(result.totalMargin)} USDT</p>
              </div>
            </div>
          </aside>
        </section>

      </main>
    </div>
  );
}
