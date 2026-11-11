import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Logo } from "@/components/move/Logo";
import { getState } from "@/lib/move-store";
import { pageHead } from "@/lib/head";

export const Route = createFileRoute("/")({
  head: () => pageHead("Pay less. Ride more.", "Move Naija — cheap shared rides around Port Harcourt."),
  component: Splash,
});

function Splash() {
  const navigate = useNavigate();
  useEffect(() => {
    const t = setTimeout(() => {
      const { user } = getState();
      navigate({ to: user.name && user.role ? "/home" : "/welcome", replace: true });
    }, 1700);
    return () => clearTimeout(t);
  }, [navigate]);

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-background">
      <Logo className="w-28 animate-logo-in" />
    </div>
  );
}
