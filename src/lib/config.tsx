import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "./api";
import { DEFAULT_WORLD_CARDS } from "./worldCards";
import type { SiteConfig } from "./types";

const DEFAULTS: SiteConfig = {
  server_name: "DIMENSION",
  tagline: "차원의 균열을 넘어, 모험이 시작된다.",
  java_host: "",
  java_port: "25565",
  bedrock_host: "",
  bedrock_port: "19132",
  status_text: "오픈 준비 중",
  status_note: "서버 주소와 오픈 일정은 공지사항에서 안내됩니다.",
  discord_url: "",
  world_cards: JSON.stringify(DEFAULT_WORLD_CARDS),
};

type ConfigValue = {
  config: SiteConfig;
  loading: boolean;
  reload: () => Promise<void>;
  setConfig: (next: SiteConfig) => void;
};

const ConfigContext = createContext<ConfigValue | null>(null);

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<SiteConfig>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const result = await api<{ config: SiteConfig }>("/api/config");
      setConfig({ ...DEFAULTS, ...result.config });
    } catch {
      // Keep the last known values; the homepage stays usable offline.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const value = useMemo(
    () => ({ config, loading, reload, setConfig }),
    [config, loading, reload],
  );
  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}

export function useConfig(): ConfigValue {
  const value = useContext(ConfigContext);
  if (!value) throw new Error("useConfig must be used inside ConfigProvider");
  return value;
}
