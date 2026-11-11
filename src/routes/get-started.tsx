import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Mail } from "lucide-react";
import { useState } from "react";
import { AppButton } from "@/components/move/AppButton";
import { AppleIcon, GoogleIcon } from "@/components/move/BrandIcons";
import { Screen } from "@/components/move/Screen";
import { updateUser } from "@/lib/move-store";
import { pageHead } from "@/lib/head";

export const Route = createFileRoute("/get-started")({
  head: () => pageHead("Get started", "Sign in with your phone, email, Google or Apple to start riding."),
  component: GetStarted,
});

function GetStarted() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");

  const continuePhone = () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      setError("Enter a valid phone number, e.g. 0803 123 4567");
      return;
    }
    updateUser({ phone });
    navigate({ to: "/verify", search: { via: "phone" } });
  };

  const social = () => navigate({ to: "/name" });

  return (
    <Screen>
      <div className="flex flex-1 flex-col px-5 pt-safe">
        <h1 className="mt-16 text-[22px] font-bold">Let's get you started</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">Pick a way in. We'll get you moving in seconds.</p>

        <form
          className="mt-9"
          onSubmit={(e) => {
            e.preventDefault();
            continuePhone();
          }}
        >
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setError("");
            }}
            placeholder="Enter your phone number"
            className="h-12 w-full rounded-full border border-input bg-card px-4 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
          />
          {error && <p className="mt-2 px-2 text-xs text-destructive">{error}</p>}
          <AppButton type="submit" className="mt-4">
            Continue
          </AppButton>
        </form>

        <p className="my-4 text-center text-sm text-muted-foreground">OR</p>

        <div className="space-y-3">
          <AppButton variant="outline" size="md" onClick={() => navigate({ to: "/email" })}>
            <Mail className="size-[18px] fill-foreground text-card" /> Connect with Email
          </AppButton>
          <AppButton variant="outline" size="md" onClick={social}>
            <GoogleIcon /> Connect with Google
          </AppButton>
          <AppButton variant="outline" size="md" onClick={social}>
            <AppleIcon /> Connect with Apple
          </AppButton>
        </div>

        <p className="mt-auto pb-safe pt-6 text-center text-[11px] leading-snug text-muted-foreground">
          By continuing, you agree to our{" "}
          <a href="#" className="text-foreground underline">
            Terms &amp; Privacy Policy
          </a>{" "}
          and
          <br />
          confirm you're 18+.
        </p>
      </div>
    </Screen>
  );
}
