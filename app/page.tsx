"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type PositionType = "long" | "short";
type MarginMode = "isolated" | "cross";

type EntryInput = {
  price: string;
  marginUsdt: string;
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
  const [leverage, setLeverage] = useState("");
  const [positionType, setPositionType] = useState<PositionType>("long");
  const [marginMode, setMarginMode] = useState<MarginMode>("isolated");
  const [accountBalance, setAccountBalance] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [entries, setEntries] = useState<EntryInput[]>([
    { price: "", marginUsdt: "" },
  ]);
  const [tpTargets, setTpTargets] = useState<TakeProfitInput[]>([
    { id: 1, price: "", closePercent: "" },
  ]);
  const [nextTpId, setNextTpId] = useState(2);

  const calculations = useMemo(() => {
    const leverageValue = Math.max(1, safeNumber(leverage));
    const crossBalance = Math.max(0, safeNumber(accountBalance));
    const slValue = safeNumber(stopLoss);

    let totalQty = 0;
    let totalNotional = 0;
    let totalUsedMargin = 0;

    entries.forEach((entry) => {
      const price = safeNumber(entry.price);
      const entryMargin = Math.max(0, safeNumber(entry.marginUsdt));
      if (price <= 0 || entryMargin <= 0) {
        return;
      }

      const notional = entryMargin * leverageValue;
      const qty = notional / price;

      totalNotional += notional;
      totalQty += qty;
      totalUsedMargin += entryMargin;
    });

    const totalPositionSize = totalUsedMargin * leverageValue;
    const riskCapital = marginMode === "cross" ? crossBalance : totalUsedMargin;

    const avgEntry = totalQty > 0 ? totalNotional / totalQty : 0;
    const activePositionSize = totalNotional;

    const slPnl =
      totalQty > 0 && slValue > 0
        ? positionType === "long"
          ? (slValue - avgEntry) * totalQty
          : (avgEntry - slValue) * totalQty
        : 0;
    const slLossAbs = Math.max(0, -slPnl);
    const slRoePercent = riskCapital > 0 ? (slPnl / riskCapital) * 100 : 0;

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
      leverageValue,
      riskCapital,
      totalUsedMargin,
      avgEntry,
      totalPositionSize,
      activePositionSize,
      slLossAbs,
      slRoePercent,
      tpRows,
      totalTpClosePercent,
      tpOverLimit,
      totalExpectedProfit,
      riskRewardRatio,
    };
  }, [
    leverage,
    stopLoss,
    entries,
    tpTargets,
    positionType,
    marginMode,
    accountBalance,
  ]);

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
    setTpTargets((prev) => [...prev, { id: nextTpId, price: "", closePercent: "" }]);
    setNextTpId((prev) => prev + 1);
  };

  const removeTp = (id: number) => {
    setTpTargets((prev) => prev.filter((tp) => tp.id !== id));
  };

  const addEntry = () => {
    setEntries((prev) => {
      if (prev.length >= 3) {
        return prev;
      }
      return [...prev, { price: "", marginUsdt: "" }];
    });
  };

  const removeEntry = (index: number) => {
    setEntries((prev) => {
      if (prev.length === 1) {
        return prev;
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const clearAll = () => {
    setLeverage("");
    setPositionType("long");
    setMarginMode("isolated");
    setAccountBalance("");
    setStopLoss("");
    setEntries([{ price: "", marginUsdt: "" }]);
    setTpTargets([{ id: 1, price: "", closePercent: "" }]);
    setNextTpId(2);
  };

  const leverageSliderValue = Math.max(1, Math.min(125, safeNumber(leverage) || 1));

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050b17] text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(34,197,94,0.22),transparent_32%),radial-gradient(circle_at_80%_0%,rgba(14,165,233,0.18),transparent_28%),radial-gradient(circle_at_50%_100%,rgba(220,38,38,0.14),transparent_24%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] [background-size:38px_38px]" />

      <main className="relative mx-auto flex w-full max-w-7xl flex-col gap-4 px-3 py-4 sm:px-5 sm:py-5 lg:px-6">
        <header className="rounded-xl border border-slate-700/70 bg-slate-900/70 p-4 backdrop-blur-sm sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">
                Crypto Futures Toolkit
              </p>
              <h1 className="mt-1.5 text-xl font-semibold tracking-tight text-slate-100 sm:text-2xl">
                Trade Risk and Reward Calculator
              </h1>
              <p className="mt-1.5 max-w-3xl text-xs text-slate-300 sm:text-sm">
                Build your DCA position, map stop-loss risk, and plan multi-target take-profit exits in USDT before entering a trade.
              </p>
            </div>
            <Link
              href="/entry-risk-planner"
              className="rounded-md border border-emerald-400/70 bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/30"
            >
              Entry Risk Planner
            </Link>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[1.16fr_0.84fr]">
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-700 bg-slate-900/75 p-4 shadow-[0_18px_60px_-24px_rgba(15,23,42,0.9)] sm:p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-slate-100">Basic Trade Setup</h2>
                <button
                  type="button"
                  onClick={clearAll}
                  className="rounded-md border border-slate-700 bg-slate-950/50 px-2.5 py-1.5 text-xs font-medium text-slate-200 transition hover:border-rose-500 hover:text-rose-300"
                >
                  Clear
                </button>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <span className="text-xs text-slate-300">Leverage</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="1"
                      max="125"
                      value={leverageSliderValue}
                      onChange={(event) => setLeverage(event.target.value)}
                      className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-800 accent-cyan-500"
                    />
                    <input
                      type="number"
                      min="1"
                      max="125"
                      value={leverage}
                      onChange={(event) => setLeverage(event.target.value)}
                      className="w-16 rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1.5 text-right text-xs text-slate-100 outline-none transition focus:border-cyan-500"
                    />
                    <span className="text-xs text-cyan-300">x</span>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">Auto Total Margin</p>
                  <p className="mt-1 text-sm font-semibold text-slate-100">
                    {formatMoney(calculations.totalUsedMargin)} USDT
                  </p>
                </div>

                <div className="space-y-2">
                  <span className="text-xs text-slate-300">Position Type</span>
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

                <div className="space-y-2 sm:col-span-2">
                  <span className="text-xs text-slate-300">Margin Mode</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex rounded-md border border-slate-700 bg-slate-950/60 p-0.5">
                      <button
                        type="button"
                        onClick={() => setMarginMode("isolated")}
                        className={`rounded px-3 py-1.5 text-xs font-medium transition ${
                          marginMode === "isolated"
                            ? "bg-cyan-500/20 text-cyan-300"
                            : "text-slate-300 hover:text-slate-100"
                        }`}
                      >
                        Isolated
                      </button>
                      <button
                        type="button"
                        onClick={() => setMarginMode("cross")}
                        className={`rounded px-3 py-1.5 text-xs font-medium transition ${
                          marginMode === "cross"
                            ? "bg-cyan-500/20 text-cyan-300"
                            : "text-slate-300 hover:text-slate-100"
                        }`}
                      >
                        Cross
                      </button>
                    </div>
                    <label className="min-w-[180px] flex-1 space-y-1">
                      <span className="text-[11px] text-slate-400">
                        Account Balance (for Cross mode)
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={accountBalance}
                        onChange={(event) => setAccountBalance(event.target.value)}
                        disabled={marginMode !== "cross"}
                        className="w-full rounded-md border border-slate-700 bg-slate-950/70 px-2.5 py-1.5 text-xs text-slate-100 outline-none transition focus:border-cyan-500 disabled:opacity-50"
                        placeholder="Cross risk capital"
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-700 bg-slate-900/75 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold text-slate-100">Entry Points (DCA)</h2>
                  <p className="mt-1 text-xs text-slate-300">
                    Start with 1 entry and add up to 3.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addEntry}
                  disabled={entries.length >= 3}
                  className="rounded-md border border-cyan-500/60 bg-cyan-500/10 px-2.5 py-1.5 text-xs font-medium text-cyan-300 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Add Entry
                </button>
              </div>

              <div className="mt-3 grid gap-2.5">
                {entries.map((entry, index) => (
                  <div key={`entry-${index}`} className="grid gap-2.5 rounded-lg border border-slate-800 bg-slate-950/50 p-3 sm:grid-cols-[1fr_1fr_auto]">
                    <label className="space-y-1.5">
                      <span className="text-[11px] uppercase tracking-wide text-slate-400">
                        Entry {index + 1} Price
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.0001"
                        value={entry.price}
                        onChange={(event) => updateEntry(index, "price", event.target.value)}
                        className="w-full rounded-md border border-slate-700 bg-slate-900/70 px-2.5 py-1.5 text-xs text-slate-100 outline-none transition focus:border-cyan-500"
                        placeholder="Price"
                      />
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-[11px] uppercase tracking-wide text-slate-400">
                        Entry Margin (USDT)
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={entry.marginUsdt}
                        onChange={(event) => updateEntry(index, "marginUsdt", event.target.value)}
                        className="w-full rounded-md border border-slate-700 bg-slate-900/70 px-2.5 py-1.5 text-xs text-slate-100 outline-none transition focus:border-cyan-500"
                        placeholder="USDT"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => removeEntry(index)}
                      disabled={entries.length === 1}
                      className="self-end rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 transition hover:border-rose-500 hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs text-slate-300">
                <p>
                  Total Used Margin: <span className="font-semibold text-slate-100">{formatMoney(calculations.totalUsedMargin)} USDT</span>
                </p>
                <p className="mt-1">
                  Weighted Average Entry: <span className="font-semibold text-cyan-300">{formatPrice(calculations.avgEntry)}</span>
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-700 bg-slate-900/75 p-4 sm:p-5">
              <h2 className="text-base font-semibold text-slate-100">Stop Loss (SL)</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-xs text-slate-300">Stop Loss Price</span>
                  <input
                    type="number"
                    min="0"
                    step="0.0001"
                    value={stopLoss}
                    onChange={(event) => setStopLoss(event.target.value)}
                    className="w-full rounded-md border border-slate-700 bg-slate-950/70 px-2.5 py-1.5 text-xs text-slate-100 outline-none transition focus:border-rose-500"
                    placeholder="SL price"
                  />
                </label>

                <div className="rounded-lg border border-rose-900/50 bg-rose-950/20 p-3">
                  <p className="text-xs text-rose-300">Estimated Loss if SL Hit</p>
                  <p className="mt-1 text-xl font-semibold text-rose-300">
                    -{formatMoney(calculations.slLossAbs)} USDT
                  </p>
                  <p className="mt-1 text-xs text-rose-200/90">
                    SL ROE: {calculations.slRoePercent.toFixed(2)}%
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-700 bg-slate-900/75 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-100">Take Profit Targets</h2>
                  <p className="mt-1 text-xs text-slate-300">
                    Add dynamic TP levels with close percentages.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addTp}
                  className="rounded-md border border-emerald-500/60 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/20"
                >
                  Add TP Target
                </button>
              </div>

              <div className="mt-3 grid gap-2.5">
                {tpTargets.map((tp, index) => {
                  const row = calculations.tpRows.find((item) => item.id === tp.id);
                  const rowProfit = row?.profit ?? 0;

                  return (
                    <div key={tp.id} className="grid gap-2.5 rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                      <div className="grid gap-2.5 sm:grid-cols-[1fr_1fr_auto]">
                        <label className="space-y-1.5">
                          <span className="text-[11px] uppercase tracking-wide text-slate-400">
                            TP{index + 1} Price
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="0.0001"
                            value={tp.price}
                            onChange={(event) => updateTp(tp.id, "price", event.target.value)}
                            className="w-full rounded-md border border-slate-700 bg-slate-900/70 px-2.5 py-1.5 text-xs text-slate-100 outline-none transition focus:border-emerald-500"
                            placeholder="TP price"
                          />
                        </label>
                        <label className="space-y-1.5">
                          <span className="text-[11px] uppercase tracking-wide text-slate-400">
                            Closing %
                          </span>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={tp.closePercent}
                            onChange={(event) => updateTp(tp.id, "closePercent", event.target.value)}
                            className="w-full rounded-md border border-slate-700 bg-slate-900/70 px-2.5 py-1.5 text-xs text-slate-100 outline-none transition focus:border-emerald-500"
                            placeholder="e.g. 40"
                          />
                        </label>
                        <button
                          type="button"
                          disabled={tpTargets.length === 1}
                          onClick={() => removeTp(tp.id)}
                          className="self-end rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 transition hover:border-rose-500 hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="rounded-md border border-emerald-900/45 bg-emerald-950/20 px-2.5 py-1.5 text-xs">
                        <p className="text-emerald-300 text-xs">
                          TP{index + 1} Profit: <span className="font-semibold">{formatMoney(rowProfit)} USDT</span>
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                <p className="text-xs text-slate-300">
                  Total TP Closing: {formatMoney(calculations.totalTpClosePercent)}%
                </p>
                {calculations.tpOverLimit ? (
                  <p className="mt-1 text-xs text-rose-300">
                    Closing percentages exceed 100%. Reduce TP allocations.
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-emerald-300">
                    Closing percentages are valid.
                  </p>
                )}
                <p className="mt-2 text-base font-semibold text-emerald-300">
                  Total Expected Profit: {formatMoney(calculations.totalExpectedProfit)} USDT
                </p>
              </div>
            </div>
          </div>

          <aside className="h-fit rounded-xl border border-slate-700 bg-slate-900/75 p-4 shadow-[0_18px_60px_-24px_rgba(15,23,42,0.9)] sm:p-5 lg:sticky lg:top-5">
            <h2 className="text-base font-semibold text-slate-100">Trade Summary</h2>
            <div className="mt-3 grid gap-2.5">
              <div className="rounded-lg border border-slate-800 bg-slate-950/55 p-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Average Entry Price</p>
                <p className="mt-1 text-base font-semibold text-cyan-300">{formatPrice(calculations.avgEntry)}</p>
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-950/55 p-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Total Position Size</p>
                <p className="mt-1 text-base font-semibold text-slate-100">{formatMoney(calculations.totalPositionSize)} USDT</p>
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-950/55 p-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Used Margin (Auto)</p>
                <p className="mt-1 text-base font-semibold text-slate-100">{formatMoney(calculations.totalUsedMargin)} USDT</p>
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-950/55 p-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Active Position Size (Entries)</p>
                <p className="mt-1 text-base font-semibold text-slate-100">{formatMoney(calculations.activePositionSize)} USDT</p>
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-950/55 p-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Margin Mode</p>
                <p className="mt-1 text-sm font-semibold text-cyan-300">{marginMode === "cross" ? "Cross" : "Isolated"}</p>
                <p className="mt-1 text-xs text-slate-300">
                  Risk Capital: {formatMoney(calculations.riskCapital)} USDT
                </p>
              </div>

              <div className="rounded-lg border border-rose-900/50 bg-rose-950/20 p-3">
                <p className="text-[11px] uppercase tracking-wide text-rose-300">Max Risk (SL Loss)</p>
                <p className="mt-1 text-base font-semibold text-rose-300">-{formatMoney(calculations.slLossAbs)} USDT</p>
              </div>

              <div className="rounded-lg border border-emerald-900/50 bg-emerald-950/20 p-3">
                <p className="text-[11px] uppercase tracking-wide text-emerald-300">Max Reward (All TP Hit)</p>
                <p className="mt-1 text-base font-semibold text-emerald-300">{formatMoney(calculations.totalExpectedProfit)} USDT</p>
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-950/55 p-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Risk / Reward Ratio</p>
                <p className="mt-1 text-base font-semibold text-slate-100">
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
