import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppButton } from "@/components/move/AppButton";
import { StepLayout } from "@/components/move/Screen";
import { getState, updateUser } from "@/lib/move-store";
import { pageHead } from "@/lib/head";

export const Route = createFileRoute("/email")({
  head: () => pageHead("Enter your email", "We'll send you a verification code in seconds."),
  component: EmailStep,
});

export const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

function EmailStep() {
  const navigate = useNavigate();
  const [email, setEmail] = useState(() => getState().user.email);
  const [error, setError] = useState("");

  const submit = () => {
    if (!isValidEmail(email)) {
      setError("Enter a valid email address");
      return;
    }
    updateUser({ email: email.trim() });
    navigate({ to: "/verify", search: { via: "email" } });
  };

  return (
    <StepLayout title="Enter your email" subtitle="We'll send you a verification code in seconds.">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          type="email"
          autoFocus
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError("");
          }}
          placeholder="e.g. johndoe@gmail.com"
          className="h-11 w-full rounded-lg border border-input bg-card px-4 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
        />
        {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
        <AppButton type="submit" className="mt-4">
          Continue
        </AppButton>
      </form>
    </StepLayout>
  );
}
