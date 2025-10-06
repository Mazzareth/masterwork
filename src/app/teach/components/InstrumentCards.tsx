/* src/app/teach/components/InstrumentCards.tsx */
"use client";

import React, { useMemo, useState } from "react";
import {
  BACK_OF_CARD,
  INSTRUMENTS,
  type InstrumentKey,
} from "@/config/instrumentinfo";

type Props = {
  selected: InstrumentKey[];
  onToggle: (key: InstrumentKey) => void;
};

type FlipState = Partial<Record<InstrumentKey, boolean>>;

function classNames(...xs: Array<string | false | null | undefined>): string {
  return xs.filter(Boolean).join(" ");
}

function useFlipState(keys: InstrumentKey[]) {
  const [state, setState] = useState<FlipState>({});
  const setFlipped = (k: InstrumentKey, v: boolean) =>
    setState((s) => ({ ...s, [k]: v }));
  const toggle = (k: InstrumentKey) =>
    setState((s) => ({ ...s, [k]: !s[k] }));
  const resetMissing = () =>
    setState((s) => {
      const next: FlipState = {};
      for (const k of keys) next[k] = s[k] ?? false;
      return next;
    });
  React.useEffect(() => {
    resetMissing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys.join(",")]);
  return { flipped: state, setFlipped, toggle };
}

export default function InstrumentCards({ selected, onToggle }: Props) {
  const keys = useMemo<InstrumentKey[]>(
    () => INSTRUMENTS.map((i) => i.key),
    []
  );
  const { flipped, toggle } = useFlipState(keys);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {INSTRUMENTS.map((inst) => {
        const k = inst.key;
        const isSelected = selected.includes(k);
        const isFlipped = Boolean(flipped[k]);

        return (
          <div
            key={k}
            aria-selected={isSelected}
            className={classNames(
              "flip-card group relative focus-within:ring-2 focus-within:ring-cyan-400/50",
              "rounded-xl border p-0 transition-shadow",
              "border-neutral-200 dark:border-neutral-800",
              isSelected
                ? "ring-2 ring-cyan-400/60 dark:ring-cyan-300/40 shadow-lg shadow-cyan-500/10"
                : "ring-0 shadow-sm"
            )}
          >
            <div
              className={classNames(
                "flip-card-inner",
                isFlipped && "is-flipped"
              )}
            >
              {/* Front */}
              <div className="flip-card-front rounded-xl overflow-hidden">
                <div className="w-full h-full flex flex-col justify-between bg-white/70 dark:bg-neutral-900/40 backdrop-blur p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-lg font-medium">{inst.label}</div>
                    <span
                      className={classNames(
                        "px-2 py-0.5 rounded text-xs border",
                        isSelected
                          ? "bg-black text-white border-black dark:bg-white dark:text-black dark:border-white"
                          : "text-neutral-600 border-neutral-300 dark:text-neutral-300 dark:border-white/15"
                      )}
                    >
                      {isSelected ? "Selected" : "Select"}
                    </span>
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => onToggle(k)}
                      aria-pressed={isSelected}
                      aria-label={`${isSelected ? "Deselect" : "Select"} ${inst.label}`}
                      className={classNames(
                        "px-3 py-1.5 rounded-md border text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60",
                        isSelected
                          ? "bg-black text-white border-black dark:bg-white dark:text-black"
                          : "border-neutral-300 hover:bg-neutral-100 dark:border-white/10 dark:hover:bg-white/10"
                      )}
                    >
                      {isSelected ? "Selected" : "Select"}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggle(k)}
                      className="text-sm text-cyan-700 hover:underline dark:text-cyan-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 rounded"
                      aria-label={`Learn more about ${inst.label}`}
                    >
                      Learn more
                    </button>
                  </div>
                </div>
              </div>

              {/* Back */}
              <div className="flip-card-back rounded-xl overflow-hidden">
                <div className="h-full bg-white/80 dark:bg-neutral-900/60 backdrop-blur p-4 flex flex-col">
                  <div className="text-sm uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-1">
                    About {inst.label}
                  </div>
                  <div className="text-neutral-800 dark:text-neutral-100 text-sm grow">
                    {BACK_OF_CARD[k]}
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => onToggle(k)}
                      aria-pressed={isSelected}
                      aria-label={`${isSelected ? "Deselect" : "Select"} ${inst.label}`}
                      className={classNames(
                        "px-3 py-1.5 rounded-md border text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60",
                        isSelected
                          ? "bg-black text-white border-black dark:bg-white dark:text-black"
                          : "border-neutral-300 hover:bg-neutral-100 dark:border-white/10 dark:hover:bg-white/10"
                      )}
                    >
                      {isSelected ? "Selected" : "Select"}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggle(k)}
                      className="text-sm text-neutral-600 hover:underline dark:text-neutral-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 rounded"
                    >
                      Flip back
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}