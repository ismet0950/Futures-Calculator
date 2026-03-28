"use client";

import { useMemo, useState } from "react";

type PositionType = "long" | "short";

type EntryInput = {
  price: string;
  allocationPercent: string;
};

type TakeProfitInput = {
  id: number;
  price: string;
  closePercent: string;
};

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

const safeNumber = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export default function Home() {
  const [margin, setMargin] = useState("1000");
  const [leverage, setLeverage] = useState("20");
  const [positionType, setPositionType] = useState<PositionType>("long");
  const [stopLoss, setStopLoss] = useState("");
  const [entries, setEntries] = useState<EntryInput[]>([
    { price: "42000", allocationPercent: "20" },
    { price: "41000", allocationPercent: "30" },
    { price: "40000", allocationPercent: "50" },
  ]);
  const [tpTargets, setTpTargets] = useState<TakeProfitInput[]>([
    { id: 1, price: "44000", closePercent: "100" },
  ]);
  const [nextTpId, setNextTpId] = useState(2);

  const calculations = useMemo(() => {
    const marginValue = Math.max(0, safeNumber(margin));
    const leverageValue = Math.max(1, safeNumber(leverage));
    const slValue = safeNumber(stopLoss);
    const totalPositionSize = marginValue * leverageValue;

    let totalQty = 0;
    let totalNotional = 0;
    let allocationTotal = 0;

    entries.forEach((entry) => {
      const price = safeNumber(entry.price);
      const allocation = Math.max(0, safeNumber(entry.allocationPercent));
      if (price <= 0 || allocation <= 0 || marginValue <= 0) {
        return;
      }

      const allocatedMargin = marginValue * (allocation / 100);
      const notional = allocatedMargin * leverageValue;
      const qty = notional / price;

      totalNotional += notional;
      totalQty += qty;
      allocationTotal += allocation;
    });

    const avgEntry = totalQty > 0 ? totalNotional / totalQty : 0;
    const activePositionSize = totalNotional;

    const slPnl =
      totalQty > 0 && slValue > 0
        ? positionType === "long"
          ? (slValue - avgEntry) * totalQty
          : (avgEntry - slValue) * totalQty
        : 0;
    const slLossAbs = Math.max(0, -slPnl);
    const slRoePercent = marginValue > 0 ? (slPnl / marginValue) * 100 : 0;

    const tpRows = tpTargets.map((tp) => {
      const price = safeNumber(tp.price);
      const closePercent = Math.max(0, safeNumber(tp.closePercent));
      const closeQty = totalQty * (closePercent / 100);

      const pnl =
        totalQty > 0 && price > 0
          ? positionType === "long"
            ? (price - avgEntry) * closeQty
            : (avgEntry - price) * closeQty
          : 0;

      return {
        ...tp,
        closePercent,
        profit: pnl,
      };
    });

    const totalTpClosePercent = tpRows.reduce(
      (sum, row) => sum + row.closePercent,
      0,
    );
    const tpOverLimit = totalTpClosePercent > 100;

    const totalExpectedProfit = tpRows.reduce((sum, row) => sum + row.profit, 0);
    const riskRewardRatio =
      slLossAbs > 0 ? totalExpectedProfit / slLossAbs : totalExpectedProfit > 0 ? Infinity : 0;

    return {
      marginValue,
      leverageValue,
      avgEntry,
      totalPositionSize,
      activePositionSize,
      allocationTotal,
      slLossAbs,
      slRoePercent,
      tpRows,
      totalTpClosePercent,
      tpOverLimit,
      totalExpectedProfit,
      riskRewardRatio,
    };
  }, [margin, leverage, stopLoss, entries, tpTargets, positionType]);

  const updateEntry = (
    index: number,
    field: keyof EntryInput,
    value: string,
  ) => {
    setEntries((prev) =>
      prev.map((entry, i) => (i === index ? { ...entry, [field]: value } : entry)),
    );
  };

  const updateTp = (
    id: number,
    field: keyof Omit<TakeProfitInput, "id">,
    value: string,
  ) => {
    setTpTargets((prev) =>
      prev.map((tp) => (tp.id === id ? { ...tp, [field]: value } : tp)),
    );
  };

  const addTp = () => {
    setTpTargets((prev) => [...prev, { id: nextTpId, price: "", closePercent: "0" }]);
    setNextTpId((prev) => prev + 1);
  };

  const removeTp = (id: number) => {
    setTpTargets((prev) => prev.filter((tp) => tp.id !== id));
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050b17] text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(34,197,94,0.22),transparent_32%),radial-gradient(circle_at_80%_0%,rgba(14,165,233,0.18),transparent_28%),radial-gradient(circle_at_50%_100%,rgba(220,38,38,0.14),transparent_24%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] [background-size:38px_38px]" />

      <main className="relative mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <header className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-5 backdrop-blur-sm sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">
            Crypto Futures Toolkit
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-100 sm:text-3xl">
            Trade Risk and Reward Calculator
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-300 sm:text-base">
            Build your DCA position, map stop-loss risk, and plan multi-target take-profit exits in USDT before entering a trade.
          </p>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.18fr_0.82fr]">
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-700 bg-slate-900/75 p-5 shadow-[0_18px_60px_-24px_rgba(15,23,42,0.9)] sm:p-6">
              <h2 className="text-lg font-semibold text-slate-100">Basic Trade Setup</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm text-slate-300">Total Margin / Capital (USDT)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={margin}
                    onChange={(event) => setMargin(event.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-100 outline-none ring-0 transition focus:border-cyan-500"
                    placeholder="e.g. 1000"
                  />
                </label>

                <div className="space-y-2">
                  <span className="text-sm text-slate-300">Leverage</span>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="1"
                      max="125"
                      value={calculations.leverageValue}
                      onChange={(event) => setLeverage(event.target.value)}
                      className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-800 accent-cyan-500"
                    />
                    <input
                      type="number"
                      min="1"
                      max="125"
                      value={leverage}
                      onChange={(event) => setLeverage(event.target.value)}
                      className="w-20 rounded-lg border border-slate-700 bg-slate-950/70 px-2 py-2 text-right text-sm text-slate-100 outline-none transition focus:border-cyan-500"
                    />
                    <span className="text-sm text-cyan-300">x</span>
                  </div>
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <span className="text-sm text-slate-300">Position Type</span>
                  <div className="inline-flex rounded-lg border border-slate-700 bg-slate-950/60 p-1">
                    <button
                      type="button"
                      onClick={() => setPositionType("long")}
                      className={`rounded-md px-4 py-2 text-sm font-medium transition ${
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
                      className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                        positionType === "short"
                          ? "bg-rose-500/20 text-rose-300"
                          : "text-slate-300 hover:text-slate-100"
                      }`}
                    >
                      Short
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-700 bg-slate-900/75 p-5 sm:p-6">
              <h2 className="text-lg font-semibold text-slate-100">Entry Points (DCA)</h2>
              <p className="mt-1 text-sm text-slate-300">
                Configure up to 3 entries and allocation percentages.
              </p>

              <div className="mt-4 grid gap-3">
                {entries.map((entry, index) => (
                  <div key={`entry-${index}`} className="grid gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-4 sm:grid-cols-[1fr_1fr]">
                    <label className="space-y-1.5">
                      <span className="text-xs uppercase tracking-wide text-slate-400">
                        Entry {index + 1} Price
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.0001"
                        value={entry.price}
                        onChange={(event) => updateEntry(index, "price", event.target.value)}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-500"
                        placeholder="Price"
                      />
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-xs uppercase tracking-wide text-slate-400">
                        Allocation %
                      </span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={entry.allocationPercent}
                        onChange={(event) => updateEntry(index, "allocationPercent", event.target.value)}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-500"
                        placeholder="e.g. 33.33"
                      />
                    </label>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm text-slate-300">
                <p>
                  Allocation Entered: <span className="font-semibold text-slate-100">{formatMoney(calculations.allocationTotal)}%</span>
                </p>
                <p className="mt-1">
                  Weighted Average Entry: <span className="font-semibold text-cyan-300">{formatPrice(calculations.avgEntry)}</span>
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-700 bg-slate-900/75 p-5 sm:p-6">
              <h2 className="text-lg font-semibold text-slate-100">Stop Loss (SL)</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm text-slate-300">Stop Loss Price</span>
                  <input
                    type="number"
                    min="0"
                    step="0.0001"
                    value={stopLoss}
                    onChange={(event) => setStopLoss(event.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-rose-500"
                    placeholder="SL price"
                  />
                </label>

                <div className="rounded-xl border border-rose-900/50 bg-rose-950/20 p-4">
                  <p className="text-sm text-rose-300">Estimated Loss if SL Hit</p>
                  <p className="mt-1 text-2xl font-semibold text-rose-300">
                    -{formatMoney(calculations.slLossAbs)} USDT
                  </p>
                  <p className="mt-2 text-sm text-rose-200/90">
                    SL ROE: {calculations.slRoePercent.toFixed(2)}%
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-700 bg-slate-900/75 p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-100">Take Profit Targets</h2>
                  <p className="mt-1 text-sm text-slate-300">
                    Add dynamic TP levels with close percentages.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addTp}
                  className="rounded-lg border border-emerald-500/60 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/20"
                >
                  Add TP Target
                </button>
              </div>

              <div className="mt-4 grid gap-3">
                {tpTargets.map((tp, index) => {
                  const row = calculations.tpRows.find((item) => item.id === tp.id);
                  const rowProfit = row?.profit ?? 0;

                  return (
                    <div key={tp.id} className="grid gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                        <label className="space-y-1.5">
                          <span className="text-xs uppercase tracking-wide text-slate-400">
                            TP{index + 1} Price
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="0.0001"
                            value={tp.price}
                            onChange={(event) => updateTp(tp.id, "price", event.target.value)}
                            className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-emerald-500"
                            placeholder="TP price"
                          />
                        </label>
                        <label className="space-y-1.5">
                          <span className="text-xs uppercase tracking-wide text-slate-400">
                            Closing %
                          </span>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={tp.closePercent}
                            onChange={(event) => updateTp(tp.id, "closePercent", event.target.value)}
                            className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-emerald-500"
                            placeholder="e.g. 40"
                          />
                        </label>
                        <button
                          type="button"
                          disabled={tpTargets.length === 1}
                          onClick={() => removeTp(tp.id)}
                          className="self-end rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:border-rose-500 hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="rounded-lg border border-emerald-900/45 bg-emerald-950/20 px-3 py-2 text-sm">
                        <p className="text-emerald-300">
                          TP{index + 1} Profit: <span className="font-semibold">{formatMoney(rowProfit)} USDT</span>
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-sm text-slate-300">
                  Total TP Closing: {formatMoney(calculations.totalTpClosePercent)}%
                </p>
                {calculations.tpOverLimit ? (
                  <p className="mt-1 text-sm text-rose-300">
                    Closing percentages exceed 100%. Reduce TP allocations.
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-emerald-300">
                    Closing percentages are valid.
                  </p>
                )}
                <p className="mt-3 text-lg font-semibold text-emerald-300">
                  Total Expected Profit: {formatMoney(calculations.totalExpectedProfit)} USDT
                </p>
              </div>
            </div>
          </div>

          <aside className="h-fit rounded-2xl border border-slate-700 bg-slate-900/75 p-5 shadow-[0_18px_60px_-24px_rgba(15,23,42,0.9)] sm:p-6 lg:sticky lg:top-6">
            <h2 className="text-lg font-semibold text-slate-100">Trade Summary</h2>
            <div className="mt-4 grid gap-3">
              <div className="rounded-xl border border-slate-800 bg-slate-950/55 p-3.5">
                <p className="text-xs uppercase tracking-wide text-slate-400">Average Entry Price</p>
                <p className="mt-1 text-lg font-semibold text-cyan-300">{formatPrice(calculations.avgEntry)}</p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/55 p-3.5">
                <p className="text-xs uppercase tracking-wide text-slate-400">Total Position Size</p>
                <p className="mt-1 text-lg font-semibold text-slate-100">{formatMoney(calculations.totalPositionSize)} USDT</p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/55 p-3.5">
                <p className="text-xs uppercase tracking-wide text-slate-400">Active Position Size (From Entries)</p>
                <p className="mt-1 text-lg font-semibold text-slate-100">{formatMoney(calculations.activePositionSize)} USDT</p>
              </div>

              <div className="rounded-xl border border-rose-900/50 bg-rose-950/20 p-3.5">
                <p className="text-xs uppercase tracking-wide text-rose-300">Max Risk (SL Loss)</p>
                <p className="mt-1 text-lg font-semibold text-rose-300">-{formatMoney(calculations.slLossAbs)} USDT</p>
              </div>

              <div className="rounded-xl border border-emerald-900/50 bg-emerald-950/20 p-3.5">
                <p className="text-xs uppercase tracking-wide text-emerald-300">Max Reward (All TP Hit)</p>
                <p className="mt-1 text-lg font-semibold text-emerald-300">{formatMoney(calculations.totalExpectedProfit)} USDT</p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/55 p-3.5">
                <p className="text-xs uppercase tracking-wide text-slate-400">Risk / Reward Ratio</p>
                <p className="mt-1 text-lg font-semibold text-slate-100">
                  {Number.isFinite(calculations.riskRewardRatio)
                    ? calculations.riskRewardRatio.toFixed(2)
                    : "Infinite"}
                </p>
              </div>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}
