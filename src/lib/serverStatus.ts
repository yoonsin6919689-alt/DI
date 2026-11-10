import { useEffect, useState } from "react";
import { api } from "./api";
import type { ServerStatus } from "./types";

const EMPTY: ServerStatus = { online: false, players: 0, maxPlayers: 0, updatedAt: null, live: false };

export function useServerStatus(): ServerStatus {
  const [status, setStatus] = useState<ServerStatus>(EMPTY);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const next = await api<ServerStatus>("/api/status");
        if (active) setStatus(next);
      } catch {
        // Keep the last known status; the homepage stays readable offline.
      }
    };
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 30_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return status;
}

export function statusLabel(status: ServerStatus, fallback: string): string {
  if (!status.live) return fallback;
  if (!status.online) return "오프라인";
  if (status.maxPlayers > 0) return `운영 중 · ${status.players}/${status.maxPlayers}명`;
  return status.players > 0 ? `운영 중 · ${status.players}명 접속` : "운영 중";
}
