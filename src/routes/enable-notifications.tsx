import { createFileRoute, useNavigate } from "@tanstack/react-router";
import highway from "@/assets/aerial-highway.jpg";
import { PermissionLayout } from "@/components/move/PermissionLayout";
import { setState } from "@/lib/move-store";
import { pageHead } from "@/lib/head";

export const Route = createFileRoute("/enable-notifications")({
  head: () => pageHead("Enable notifications", "Stay up to date with offers and ride updates."),
  component: EnableNotifications,
});

function EnableNotifications() {
  const navigate = useNavigate();
  const next = () => navigate({ to: "/all-set" });

  const allow = async () => {
    try {
      if ("Notification" in window) {
        const res = await Notification.requestPermission();
        setState((s) => ({ ...s, permissions: { ...s.permissions, notifications: res === "granted" } }));
      }
    } finally {
      next();
    }
  };

  return (
    <PermissionLayout
      title="Enable Notification and"
      highlight="Never Miss a Good Deal"
      text="Turn on notification and stay up to date with your favorite ride-hailing app."
      cta="Enable Notification"
      onAllow={allow}
      onSkip={next}
      visual={
        <>
          <div className="absolute inset-0 overflow-hidden rounded-t-[28px] border-[6px] border-b-0 border-card shadow-float">
            <img src={highway} alt="Aerial view of a busy highway" width={768} height={960} className="size-full object-cover" />
          </div>
          <div className="absolute -inset-x-5 top-10 rounded-xl bg-card p-3 shadow-float animate-fade-up [animation-delay:450ms]">
            <div className="flex items-start justify-between">
              <p className="text-[13px] font-semibold">Mile 1 - Artillery Driver</p>
              <span className="text-[10px] text-muted-foreground">now</span>
            </div>
            <p className="text-[11px] text-muted-foreground">You've received 3 updates on your conversation</p>
          </div>
        </>
      }
    />
  );
}
