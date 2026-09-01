export function resolveModeReachability({ mode, provider, model, isCloud, isSelfHosted }) {
  if (mode === "openwhispr") return isCloud;
  if (mode === "self-hosted") return isSelfHosted;

  const hasModel = (model?.trim()?.length ?? 0) > 0;
  if (mode === "local") return hasModel;
  if (mode === "providers" || mode === "enterprise") {
    return !!provider?.trim() && hasModel;
  }
  return false;
}

export function resolveDictationTranslationReachability({
  useDictationTranslation,
  translationTargetLanguage,
  translationMode,
  translationProvider,
  translationModel,
  isCloudTranslation,
  isSelfHostedTranslation,
}) {
  if (!useDictationTranslation) return false;
  if (!translationTargetLanguage?.trim()) return false;
  return resolveModeReachability({
    mode: translationMode,
    provider: translationProvider,
    model: translationModel,
    isCloud: isCloudTranslation,
    isSelfHosted: isSelfHostedTranslation,
  });
}

export function resolveModeProvider({ isCloud, mode, provider }) {
  switch (mode) {
    case "openwhispr":
      return isCloud ? "openwhispr" : undefined;
    case "local":
      return "local";
    case "self-hosted":
      return undefined;
    case "providers":
    case "enterprise":
      return provider?.trim() || undefined;
    default:
      return undefined;
  }
}

function resolveModeDisplayProvider(mode, provider) {
  if (mode === "openwhispr") return "openwhispr";
  if (mode === "local") return "local";
  if (mode === "self-hosted") return "self-hosted";
  return provider?.trim() || "none";
}

export function resolveTranslationProviderId({
  isCloudTranslation,
  translationMode,
  translationProvider,
}) {
  return resolveModeProvider({
    isCloud: isCloudTranslation,
    mode: translationMode,
    provider: translationProvider,
  });
}

export function resolveTranslationDisplayProvider({ translationMode, translationProvider }) {
  return resolveModeDisplayProvider(translationMode, translationProvider);
}

// Decides which reasoning path ("translation" | "cleanup" | "skip") a finished
// dictation takes. A translation recording degrades to cleanup rather than
// failing: the transcript is still a useful dictation without the translation
// step.
//
// There used to be an "agent" path here, reached either by the voice-assistant
// hotkey or by a wake word at the start of the transcript. Both are gone with
// the assistant — a dictation now always ends up as text.
export function resolveDictationRouteKind({
  cleanupReachable,
  translationRequested,
  translationReachable,
}) {
  if (translationRequested) {
    if (translationReachable) return "translation";
    return cleanupReachable ? "cleanup" : "skip";
  }
  if (cleanupReachable) return "cleanup";
  return "skip";
}
