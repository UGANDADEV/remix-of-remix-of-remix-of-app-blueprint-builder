import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { StepLayout } from "@/components/move/Screen";
import { pageHead } from "@/lib/head";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/verify")({
  validateSearch: (s: Record<string, unknown>) => ({
    via: s["via"] === "phone" ? ("phone" as const) : ("email" as const),
  }),
  head: () => pageHead("Verify your code", "Enter the 6-digit code we sent you."),
  component: Verify,
});

const LEN = 6;

function Verify() {
  const { via } = Route.useSearch();
  const navigate = useNavigate();
  const [digits, setDigits] = useState<string[]>(Array(LEN).fill(""));
  const [seconds, setSeconds] = useState(60);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  useEffect(() => {
    if (digits.every(Boolean)) {
      const t = setTimeout(() => navigate({ to: "/name" }), 350);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [digits, navigate]);

  const setAt = (idx: number, value: string) => {
    const clean = value.replace(/\D/g, "");
    if (clean.length > 1) {
      const next = [...digits];
      clean.slice(0, LEN - idx).split("").forEach((d, k) => (next[idx + k] = d));
      setDigits(next);
      refs.current[Math.min(idx + clean.length, LEN - 1)]?.focus();
      return;
    }
    const next = [...digits];
    next[idx] = clean;
    setDigits(next);
    if (clean && idx < LEN - 1) refs.current[idx + 1]?.focus();
  };

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <StepLayout
      title={via === "phone" ? "Verify your number" : "Verify your email"}
      subtitle={`Enter the code we sent to your ${via === "phone" ? "phone" : "email"}.`}
    >
      <div className="flex justify-between gap-2">
        {digits.map((d, idx) => (
          <input
            key={idx}
            ref={(el) => {
              refs.current[idx] = el;
            }}
            value={d}
            inputMode="numeric"
            autoComplete={idx === 0 ? "one-time-code" : "off"}
            aria-label={`Digit ${idx + 1}`}
            onChange={(e) => setAt(idx, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && !digits[idx] && idx > 0) refs.current[idx - 1]?.focus();
            }}
            className={cn(
              "h-14 w-full min-w-0 rounded-md border text-center text-lg font-semibold outline-none transition-colors",
              d ? "border-input bg-card" : "border-transparent bg-secondary",
              "focus:border-primary focus:bg-card",
            )}
          />
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {seconds > 0 ? (
          <>
            Resend in <span className="font-semibold text-foreground">{mm}:{ss}</span>
          </>
        ) : (
          <button className="font-semibold text-primary" onClick={() => setSeconds(60)}>
            Resend code
          </button>
        )}
      </p>
    </StepLayout>
  );
}
