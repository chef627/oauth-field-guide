import type { Confidence, Difficulty, Owner } from "@/lib/guide";
import { CONFIDENCE, DIFFICULTY, OWNER } from "@/lib/labels";

const DIFFICULTY_STYLE: Record<Difficulty, string> = {
  easy: "border-emerald-200 bg-emerald-50 text-emerald-800",
  moderate: "border-amber-200 bg-amber-50 text-amber-800",
  hard: "border-orange-300 bg-orange-50 text-orange-800",
  gated: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800",
};

export const DIFFICULTY_DOT: Record<Difficulty, string> = {
  easy: "bg-emerald-500",
  moderate: "bg-amber-500",
  hard: "bg-orange-600",
  gated: "bg-fuchsia-600",
};

export function DifficultyBadge({ value, large }: { value: Difficulty; large?: boolean }) {
  return (
    <span title={DIFFICULTY[value].blurb} className={`chip ${DIFFICULTY_STYLE[value]} ${large ? "px-3 py-1 text-sm" : ""}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${DIFFICULTY_DOT[value]}`} />
      {DIFFICULTY[value].label}
    </span>
  );
}

const OWNER_STYLE: Record<Owner, string> = {
  agent: "border-sky-200 bg-sky-50 text-sky-800",
  agent_assisted: "border-indigo-200 bg-indigo-50 text-indigo-800",
  you: "border-stone-300 bg-stone-100 text-stone-700",
};

const OWNER_ICON: Record<Owner, string> = { agent: "◆", agent_assisted: "◇", you: "●" };

export function OwnerChip({ value }: { value: Owner }) {
  return (
    <span title={OWNER[value].blurb} className={`chip ${OWNER_STYLE[value]}`}>
      <span aria-hidden className="text-[9px]">{OWNER_ICON[value]}</span>
      {OWNER[value].label}
    </span>
  );
}

const CONFIDENCE_STYLE: Record<Confidence, string> = {
  tested: "border-emerald-300 bg-emerald-600 text-white",
  documented: "border-blue-200 bg-blue-50 text-blue-800",
  reported: "border-amber-200 bg-amber-50 text-amber-800",
  unverified: "border-dashed border-stone-400 bg-transparent text-stone-600",
};

export function ConfidenceChip({ value }: { value: Confidence }) {
  return (
    <span title={CONFIDENCE[value].blurb} className={`chip ${CONFIDENCE_STYLE[value]}`}>
      {CONFIDENCE[value].label}
    </span>
  );
}

export function Cites({ ids }: { ids: number[] }) {
  if (!ids.length) return null;
  return (
    <span className="ml-1 inline-flex gap-0.5 align-super text-[10px]">
      {ids.map((id) => (
        <a key={id} href={`#source-${id}`} className="text-accent hover:underline">
          [{id}]
        </a>
      ))}
    </span>
  );
}
