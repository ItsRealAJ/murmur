import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Globe, Loader2, RefreshCw, Trash2, TriangleAlert } from "lucide-react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Toggle } from "./ui/toggle";
import { useToast } from "./ui/useToast";
import { useSettings } from "../hooks/useSettings";

/**
 * Shared dictionary packs.
 *
 * A community curates one word list — member handles, project names, in-jokes —
 * and every subscriber's transcription improves at once. Pack words are stored
 * separately from the user's own, so a refresh never overwrites personal entries
 * and unsubscribing removes exactly what the pack added.
 */
export default function DictionaryPacksView() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const {
    dictionaryPacks,
    addDictionaryPack,
    removeDictionaryPack,
    setDictionaryPackEnabled,
    refreshDictionaryPacks,
  } = useSettings();

  const [url, setUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const activeWordCount = useMemo(
    () =>
      (dictionaryPacks || [])
        .filter((p) => p.enabled)
        .reduce((sum, p) => sum + (p.words?.length ?? 0), 0),
    [dictionaryPacks]
  );

  const handleAdd = useCallback(async () => {
    const trimmed = url.trim();
    if (!trimmed || adding) return;
    setAdding(true);
    try {
      const result = await addDictionaryPack(trimmed);
      if (result.success) {
        setUrl("");
        toast({ title: t("dictionaryPacks.added"), variant: "success", duration: 2500 });
      } else {
        toast({
          title: t("dictionaryPacks.addFailed"),
          description: result.error,
          variant: "destructive",
        });
      }
    } finally {
      setAdding(false);
    }
  }, [url, adding, addDictionaryPack, toast, t]);

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await refreshDictionaryPacks();
      toast({ title: t("dictionaryPacks.refreshed"), variant: "success", duration: 2000 });
    } finally {
      setRefreshing(false);
    }
  }, [refreshing, refreshDictionaryPacks, toast, t]);

  return (
    <div className="px-5 py-4 flex flex-col gap-3">
      <div>
        <div className="flex items-center gap-2">
          <Input
            placeholder={t("dictionaryPacks.urlPlaceholder")}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleAdd();
            }}
            className="flex-1 h-8 text-xs placeholder:text-foreground/20"
          />
          <Button
            size="sm"
            className="h-8 px-3 text-xs"
            disabled={!url.trim() || adding}
            onClick={() => void handleAdd()}
          >
            {adding ? <Loader2 className="w-3 h-3 animate-spin" /> : t("dictionaryPacks.subscribe")}
          </Button>
        </div>
        <p className="mt-1.5 text-[11px] leading-snug text-foreground/40">
          {t("dictionaryPacks.help")}
        </p>
      </div>

      {(dictionaryPacks || []).length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <Globe className="w-5 h-5 text-foreground/20" />
          <p className="text-xs text-foreground/40 max-w-[19rem] leading-snug">
            {t("dictionaryPacks.empty")}
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-foreground/40">
              {t("dictionaryPacks.activeWords", { count: activeWordCount })}
            </span>
            <button
              onClick={() => void handleRefresh()}
              disabled={refreshing}
              className="flex items-center gap-1 text-[11px] text-foreground/40 hover:text-primary disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
              {t("dictionaryPacks.refresh")}
            </button>
          </div>

          <ul className="flex flex-col">
            {dictionaryPacks.map((pack) => (
              <li
                key={pack.url}
                className="flex items-start gap-3 py-2.5 border-b border-foreground/4 dark:border-white/3 last:border-b-0"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium truncate">
                      {pack.name || t("dictionaryPacks.untitled")}
                    </span>
                    <span className="text-[11px] text-foreground/35 shrink-0">
                      {t("dictionaryPacks.wordCount", { count: pack.words?.length ?? 0 })}
                    </span>
                  </div>
                  <p className="text-[11px] text-foreground/30 truncate" title={pack.url}>
                    {pack.url}
                  </p>
                  {pack.lastError && (
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] text-destructive">
                      <TriangleAlert className="w-3 h-3 shrink-0" />
                      {/* Words from the last good fetch are still in use. */}
                      {t("dictionaryPacks.stale", { error: pack.lastError })}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0 pt-0.5">
                  <Toggle
                    checked={pack.enabled}
                    onChange={(v) => setDictionaryPackEnabled(pack.url, v)}
                  />
                  <button
                    onClick={() => removeDictionaryPack(pack.url)}
                    aria-label={t("dictionaryPacks.remove")}
                    className="text-foreground/25 hover:text-destructive transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
