import { useTranslation } from "react-i18next";
import { MurmurMark } from "../ui/MurmurMark";

/**
 * Shows what Murmur Assistant does, on the assistant-hotkey step.
 *
 * This replaced a 108KB screenshot — and the screenshot was of *upstream's*
 * interface: their purple pill, their sparkle glyph, and a drafted email to an
 * invented company. New users were being shown a picture of a different product
 * and told it was this one.
 *
 * Built from real DOM instead, so it uses Murmur's own mark and tokens, it
 * cannot drift when the pill changes, it translates like everything else, and
 * it costs nothing to download.
 *
 * `shrink` + `min-h-0` matter — this is decoration, so on a short window it
 * gives way and crops rather than pushing the hotkey capture box out of the
 * shell.
 */
export default function AssistantHotkeyPreview() {
  const { t } = useTranslation();

  return (
    <div
      aria-hidden="true"
      className="mx-auto mt-6 flex min-h-0 w-full max-w-[26rem] shrink select-none flex-col gap-3 overflow-hidden rounded-2xl border border-[var(--onboarding-control-border)] bg-[var(--onboarding-surface-secondary)] p-4"
    >
      {/* What you say. Right-aligned, accent-filled: this is the one utterance. */}
      <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-[var(--onboarding-accent)] px-3.5 py-2 text-left text-sm font-medium leading-snug text-[var(--onboarding-accent-foreground)]">
        {t("onboarding.rehaul.assistantHotkey.previewPrompt")}
      </p>

      {/* What lands in the app you were already in. */}
      <div className="rounded-xl border border-[var(--onboarding-control-border)] bg-[var(--onboarding-surface)] p-3 text-left">
        <p className="text-xs text-[var(--onboarding-text-secondary)]">
          {t("onboarding.rehaul.assistantHotkey.previewSubjectLabel")}{" "}
          <span className="text-[var(--onboarding-text-primary)]">
            {t("onboarding.rehaul.assistantHotkey.previewSubject")}
          </span>
        </p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--onboarding-text-primary)]">
          {t("onboarding.rehaul.assistantHotkey.previewBody")}
          {/* The caret the words are still landing in — the app's signature, at
              text scale, mid-sentence. */}
          <span className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[0.18em] bg-[var(--onboarding-accent)] align-baseline" />
        </p>
      </div>

      <div className="flex items-center gap-2 self-end rounded-full bg-[var(--onboarding-surface)] px-3 py-1.5 ring-1 ring-inset ring-[var(--onboarding-control-border)]">
        <MurmurMark size={16} />
        <span className="text-xs text-[var(--onboarding-text-secondary)]">
          {t("onboarding.rehaul.assistantHotkey.previewStatus")}
        </span>
      </div>
    </div>
  );
}
