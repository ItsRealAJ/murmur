import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import "./index.css";
import { useToast } from "./components/ui/useToast";
import { useHotkey } from "./hooks/useHotkey";
import { formatHotkeyListLabel } from "./utils/hotkeys";
import { useWindowDrag } from "./hooks/useWindowDrag";
import { useAudioRecording } from "./hooks/useAudioRecording";
import { useLiveTranscriptPanel } from "./hooks/useLiveTranscriptPanel";
import { useMainWindowSizeOwner } from "./hooks/useMainWindowSizeOwner";
import { useMainProcessNotifications } from "./hooks/useMainProcessNotifications";
import { useWindowResizeCompensation } from "./hooks/useWindowResizeCompensation";
import { useSettingsStore } from "./stores/settingsStore";
import { VoicePill } from "./components/dictation/VoicePill";
import { LiveTranscriptPanel } from "./components/dictation/LiveTranscriptPanel";
import { VoiceModePanelCore } from "./components/dictation/VoiceModePanelCore";
import { PillTooltip } from "./components/dictation/PillTooltip";
import { PillCommandMenu } from "./components/dictation/PillCommandMenu";
import { createMainWindowResizeCoordinator } from "./utils/mainWindowResizeCoordinator";
import {
  ASSISTANT_FOOTER_TRANSITION_TIMING,
  getListeningEntranceTimeline,
  LIVE_TRANSCRIPT_ENTRANCE_TIMING,
  resolveLiveTranscriptEntrancePresentation,
  resolveAssistantFooterPresentation,
  resolveAgentModeActive,
  resolveListeningEntrancePresentation,
  resolveVoiceActivityPresentation,
  resolveVoiceHorizontalDirection,
  resolveVoicePanelCorePresentation,
  resolveVoicePillDock,
  resolveVoicePillInteraction,
  isVoicePillActivationKey,
  shouldActivateVoicePill,
  shouldOfferLiveTranscriptReopen,
} from "./helpers/voicePillPresentation";

const formatPillHotkeyLabel = (value) =>
  formatHotkeyListLabel(value)
    .replace(/\s*\+\s*/g, " + ")
    .replace(/\s+/g, " ")
    .trim();

const UNMOUNTED_RESIZE = {
  success: false,
  superseded: true,
  message: "Resize coordinator not mounted",
};

export default function App() {
  const [isHovered, setIsHovered] = useState(false);
  const [isCommandMenuOpen, setIsCommandMenuOpen] = useState(false);
  const buttonRef = useRef(null);
  const { toast, dismiss, toastCount, dictationErrorActionCount, dismissByPresentation } =
    useToast();
  const { t } = useTranslation();
  const { hotkey } = useHotkey();
  const { isDragging, handleMouseDown, handleMouseUp } = useWindowDrag();

  const [dragStartPos, setDragStartPos] = useState(null);
  const [hasDragged, setHasDragged] = useState(false);

  // Floating icon auto-hide setting (read from store, synced via IPC)
  const floatingIconAutoHide = useSettingsStore((s) => s.floatingIconAutoHide);
  const panelStartPosition = useSettingsStore((s) => s.panelStartPosition);
  const beamTheme = useSettingsStore((s) => s.theme);
  const prevAutoHideRef = useRef(floatingIconAutoHide);
  const [voiceHorizontalDirection, setVoiceHorizontalDirection] = useState(() =>
    resolveVoiceHorizontalDirection(panelStartPosition)
  );
  const [mainWindowHorizontalDirection, setMainWindowHorizontalDirection] = useState(null);

  const setWindowInteractivity = React.useCallback((shouldCapture) => {
    window.electronAPI?.setMainWindowInteractivity?.(shouldCapture);
  }, []);
  const dismissDictationError = React.useCallback(
    () => dismissByPresentation("dictation-error"),
    [dismissByPresentation]
  );

  useEffect(() => {
    setWindowInteractivity(false);
    return () => setWindowInteractivity(false);
  }, [setWindowInteractivity]);

  useEffect(() => {
    let disposed = false;
    const applyDirection = (direction) => {
      if (!disposed && (direction === "left" || direction === "right")) {
        setMainWindowHorizontalDirection(direction);
      }
    };
    const unsubscribe =
      window.electronAPI?.onMainWindowHorizontalDirectionChanged?.(applyDirection);
    const initialDirection = window.electronAPI?.getMainWindowHorizontalDirection?.();
    initialDirection?.then(applyDirection).catch(() => {});
    return () => {
      disposed = true;
      unsubscribe?.();
    };
  }, []);

  useWindowResizeCompensation();
  useMainProcessNotifications({ toast, dismiss, t });

  const mainWindowResizeCoordinatorRef = useRef(null);
  useEffect(() => {
    // Created in the effect, not lazily during render: React StrictMode's
    // dev-only setup→cleanup→setup cycle then disposes and recreates it
    // instead of disposing the only instance for the rest of the session.
    const coordinator = createMainWindowResizeCoordinator({
      resizeMainWindow: (sizeKey) => window.electronAPI?.resizeMainWindow?.(sizeKey),
      resizeAssistantWindowToContent: (height) =>
        window.electronAPI?.resizeAssistantWindowToContent?.(height),
    });
    mainWindowResizeCoordinatorRef.current = coordinator;
    return () => {
      coordinator.dispose();
      if (mainWindowResizeCoordinatorRef.current === coordinator) {
        mainWindowResizeCoordinatorRef.current = null;
      }
    };
  }, []);

  const requestMainWindowSize = React.useCallback(
    (sizeKey) =>
      mainWindowResizeCoordinatorRef.current?.resizeMainWindow(sizeKey) ??
      Promise.resolve(UNMOUNTED_RESIZE),
    []
  );
  const resizeLiveTranscriptToContent = React.useCallback(
    (height) =>
      mainWindowResizeCoordinatorRef.current?.resizeAssistantWindowToContent(height) ??
      Promise.resolve(UNMOUNTED_RESIZE),
    []
  );

  const onPanelOpened = React.useCallback(() => setIsHovered(false), []);

  // The live transcript needs recording state as effect deps; this ref breaks
  // the render-order cycle and is read only at event time, never during render.
  const recordingControlsRef = useRef({});
  const liveTranscriptApiRef = useRef(null);

  const handleDictationError = React.useCallback(() => {
    liveTranscriptApiRef.current?.dismissForError();
  }, []);

  const handleDictationToggle = React.useCallback(() => {
    setIsCommandMenuOpen(false);
    if (!liveTranscriptApiRef.current?.openRef.current) {
      setWindowInteractivity(false);
    }
  }, [setWindowInteractivity]);

  const {
    isRecording,
    isProcessing,
    isAssistantVoice,
    isPreparing,
    isStopping,
    micCaptureStatus,
    toggleListening,
    cancelRecording,
    cancelProcessing,
    getAudioLevel,
  } = useAudioRecording(toast, {
    onToggle: handleDictationToggle,
    onDemoEvent: (event) => {
      // Demo sessions only exist while onboarding is incomplete — skip the IPC otherwise.
      if (localStorage.getItem("onboardingCompleted") === "true") return;
      window.electronAPI?.publishOnboardingDemoEvent?.(event);
    },
    dismissDictationError,
    onDictationError: handleDictationError,
    onShowTranscript: (text) => liveTranscriptApiRef.current?.showFinalText(text),
  });
  const isVisuallyProcessing = isProcessing || isPreparing || isStopping;

  useLayoutEffect(() => {
    recordingControlsRef.current = {
      isAssistantVoice,
      isRecording,
      isPreparing,
      isProcessing,
      cancelRecording,
      cancelProcessing,
    };
  });

  const liveTranscript = useLiveTranscriptPanel({
    resizeToContent: resizeLiveTranscriptToContent,
    onWillOpen: onPanelOpened,
    isRecording,
    isProcessing,
    isAssistantVoice,
  });

  useLayoutEffect(() => {
    liveTranscriptApiRef.current = liveTranscript;
  });

  // Must run before the size owner's ladder effect below: the error teardown
  // drops the live transcript's open ref, which the ladder reads this commit.
  useEffect(() => {
    if (dictationErrorActionCount > 0) handleDictationError();
  }, [dictationErrorActionCount, handleDictationError]);

  // Direction is part of the interaction's geometry, not a live decoration.
  // Hold the origin through processing and panel exit so every close animation
  // returns to the same side from which that voice session started.
  const voiceDirectionLocked =
    isRecording || isVisuallyProcessing || false || liveTranscript.mounted;
  useLayoutEffect(() => {
    if (voiceDirectionLocked) return;
    setVoiceHorizontalDirection(
      mainWindowHorizontalDirection ?? resolveVoiceHorizontalDirection(panelStartPosition)
    );
  }, [mainWindowHorizontalDirection, panelStartPosition, voiceDirectionLocked]);

  const voiceActivity = resolveVoiceActivityPresentation({
    isRecording,
    isProcessing: isVisuallyProcessing,
    isAssistantVoice,
    assistantThinking: false,
  });
  const [listeningEntrancePhase, setListeningEntrancePhase] = useState("idle");
  useLayoutEffect(() => {
    if (!isRecording) {
      setListeningEntrancePhase("idle");
      return;
    }

    setListeningEntrancePhase("thinking");
    const timeline = getListeningEntranceTimeline();
    const expansionTimer = setTimeout(
      () => setListeningEntrancePhase("expanding"),
      timeline.expandAtMs
    );
    const settledTimer = setTimeout(
      () => setListeningEntrancePhase("settled"),
      timeline.settleAtMs
    );
    const waveformTimer = setTimeout(
      () => setListeningEntrancePhase("waveform"),
      timeline.waveformAtMs
    );

    return () => {
      clearTimeout(expansionTimer);
      clearTimeout(settledTimer);
      clearTimeout(waveformTimer);
    };
  }, [isRecording]);
  const listeningEntrance = resolveListeningEntrancePresentation({
    isRecording,
    phase: listeningEntrancePhase,
  });
  const isCompactPill = isRecording ? listeningEntrance.compactPill : voiceActivity.compactPill;

  const { dictationErrorPillHandoffActive } = useMainWindowSizeOwner({
    requestMainWindowSize,
    dictationErrorActionCount,
    toastCount,
    isCommandMenuOpen,
    isCompactPill,
    liveTranscriptOpen: liveTranscript.open,
    liveTranscriptMounted: liveTranscript.mounted,
    liveTranscriptOpenRef: liveTranscript.openRef,
  });

  useEffect(() => {
    if (isCommandMenuOpen || toastCount > 0 || liveTranscript.mounted) {
      setWindowInteractivity(true);
    } else if (!isHovered) {
      setWindowInteractivity(false);
    }
  }, [isCommandMenuOpen, isHovered, toastCount, liveTranscript.mounted, setWindowInteractivity]);

  useEffect(() => {
    if (isRecording && dictationErrorActionCount > 0) {
      dismissByPresentation("dictation-error");
    }
  }, [isRecording, dictationErrorActionCount, dismissByPresentation]);

  // Sync auto-hide from main process — setState directly to avoid IPC echo
  useEffect(() => {
    const unsubscribe = window.electronAPI?.onFloatingIconAutoHideChanged?.((enabled) => {
      localStorage.setItem("floatingIconAutoHide", String(enabled));
      useSettingsStore.setState({ floatingIconAutoHide: enabled });
    });
    return () => unsubscribe?.();
  }, []);

  const isRecordingRef = useRef(isRecording);

  useLayoutEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    const unsubscribe = window.electronAPI?.onCancelHotkeyPressed?.(() => {
      if (isRecordingRef.current) cancelRecording();
    });
    return () => unsubscribe?.();
  }, [cancelRecording]);

  // Auto-hide the floating icon when idle (setting enabled or dictation cycle completed)
  useEffect(() => {
    let hideTimeout;

    if (
      floatingIconAutoHide &&
      !isRecording &&
      !isVisuallyProcessing &&
      toastCount === 0 &&
      !dictationErrorPillHandoffActive &&
      !false &&
      !liveTranscript.mounted
    ) {
      // Delay briefly so processing can start after recording stops without a flash
      hideTimeout = setTimeout(() => {
        window.electronAPI?.hideWindow?.();
      }, 500);
    } else if (!floatingIconAutoHide && prevAutoHideRef.current) {
      window.electronAPI?.showDictationPanel?.();
    }

    prevAutoHideRef.current = floatingIconAutoHide;
    return () => clearTimeout(hideTimeout);
  }, [
    isRecording,
    isVisuallyProcessing,
    floatingIconAutoHide,
    toastCount,
    dictationErrorPillHandoffActive,
    liveTranscript.mounted,
  ]);

  const handleClose = () => {
    window.electronAPI.hideWindow();
  };

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === "Escape") {
        if (isCommandMenuOpen) {
          setIsCommandMenuOpen(false);
        } else if (isRecording) {
          cancelRecording();
        } else if (isPreparing) {
          cancelRecording();
        } else if (isProcessing) {
          cancelProcessing();
        } else {
          handleClose();
        }
      }
    };

    document.addEventListener("keydown", handleKeyPress);
    return () => document.removeEventListener("keydown", handleKeyPress);
  }, [
    isCommandMenuOpen,
    isRecording,
    isPreparing,
    isProcessing,
    cancelRecording,
    cancelProcessing,
  ]);

  // Determine current mic state
  const getMicState = () => {
    if (isRecording && (micCaptureStatus === "reconnecting" || micCaptureStatus === "unavailable"))
      return "unavailable";
    if (isRecording) return "recording";
    if (isVisuallyProcessing) return "processing";
    if (isHovered && !isRecording && !isVisuallyProcessing) return "hover";
    return "idle";
  };

  const micState = getMicState();

  const getMicTooltip = () => {
    switch (micState) {
      case "recording":
        return t("app.mic.recording");
      case "unavailable":
        return t("app.mic.waitingForMicrophone");
      case "processing":
        return t("app.mic.processing");
      default:
        return formatPillHotkeyLabel(hotkey);
    }
  };

  const micTooltip = getMicTooltip();
  const anyPanelOpen = liveTranscript.open;
  const anyPanelMounted = liveTranscript.mounted;
  const canReopenLiveTranscript =
    shouldOfferLiveTranscriptReopen({
      manuallyCollapsed: liveTranscript.manuallyCollapsed,
      isRecording,
      isProcessing,
      isAssistantVoice,
    }) && !anyPanelMounted;
  const agentModeActive = resolveAgentModeActive({
    isAssistantVoice,
    isRecording,
    isProcessing: isVisuallyProcessing,
    assistantPanelMounted: false,
  });
  const assistantFooter = resolveAssistantFooterPresentation(null);
  const voicePillInteraction = resolveVoicePillInteraction({
    assistantMounted: false,
    liveTranscriptMounted: liveTranscript.mounted,
    isRecording,
    isProcessing,
    isHovered,
  });
  const pillIsInteractive = voicePillInteraction.pillInteractive;
  const activateVoicePill = () => {
    if (!pillIsInteractive) return;
    if (canReopenLiveTranscript) {
      liveTranscript.reopen();
      return;
    }
    if (
      shouldActivateVoicePill({
        hasDragged,
        liveTranscriptMounted: liveTranscript.mounted,
        isProcessing: micState === "processing",
        isAgentThinking: voiceActivity.isAgentThinking,
      })
    ) {
      setIsCommandMenuOpen(false);
      toggleListening({ voiceAgentRequested: false });
    }
  };
  // Prefer a currently open mode over a sibling finishing its exit. The core
  // itself never unmounts; only these inner sections change ownership.
  const activeVoicePanel = resolveVoicePanelCorePresentation({
    assistantOpen: false,
    assistantMounted: false,
    liveTranscriptOpen: liveTranscript.open,
    liveTranscriptMounted: liveTranscript.mounted,
  });
  const activeVoicePanelMode = activeVoicePanel.mode;
  const liveTranscriptEntrance = resolveLiveTranscriptEntrancePresentation(
    liveTranscript.entrancePhase
  );
  const activeVoicePanelLabel =
    activeVoicePanelMode === "assistant"
      ? t("settingsPage.agentConfig.title")
      : activeVoicePanelMode === "live-transcript"
        ? t("transcriptionPreview.label")
        : undefined;
  const commonPillState =
    micState === "unavailable"
      ? "unavailable"
      : listeningEntrance.activeState || voiceActivity.activeState || micState;
  const voicePillDock = resolveVoicePillDock({
    liveTranscriptOpen: liveTranscript.open,
    liveTranscriptEntrancePhase: liveTranscript.entrancePhase,
    assistantOpen: false,
    panelStartPosition,
    horizontalDirection: voiceHorizontalDirection,
  });
  const voicePillTravelDuration =
    liveTranscript.open && liveTranscript.entrancePhase === "encapsulate"
      ? LIVE_TRANSCRIPT_ENTRANCE_TIMING.encapsulateMs
      : LIVE_TRANSCRIPT_ENTRANCE_TIMING.horizontalMs;
  const dictationErrorSuppressesPill =
    dictationErrorActionCount > 0 || dictationErrorPillHandoffActive;
  // Keep one pill DOM node alive while final Agent actions own the footer. On
  // close it can fade and travel from the panel dock instead of mounting at
  // the resting dock halfway through the surface contraction.
  const pillVisuallySuppressed = dictationErrorSuppressesPill;
  const pillInteractionSuppressed = pillVisuallySuppressed;

  return (
    <div className="dictation-window">
      {/* The panel footer can hide this pill, but never unmounts it. */}
      <div
        className={`voice-pill-position voice-pill-position-${voicePillDock} fixed z-50 transition-opacity duration-150 ease-out ${
          pillInteractionSuppressed ? "pointer-events-none" : ""
        } ${pillVisuallySuppressed ? "opacity-0" : "opacity-100"}`}
        style={{
          "--voice-pill-travel-duration": `${voicePillTravelDuration}ms`,
        }}
        data-dictation-error-suppressed={dictationErrorSuppressesPill || undefined}
        aria-hidden={pillVisuallySuppressed || undefined}
      >
        <div
          className="assistant-pill-presence relative flex items-center gap-2"
          data-horizontal-direction={voiceHorizontalDirection}
          style={{
            "--assistant-pill-retreat-duration": `${ASSISTANT_FOOTER_TRANSITION_TIMING.pillRetreatMs}ms`,
            "--assistant-pill-entrance-duration": `${ASSISTANT_FOOTER_TRANSITION_TIMING.pillEntranceMs}ms`,
          }}
          onMouseEnter={() => {
            if (!pillIsInteractive) return;
            setIsHovered(true);
            setWindowInteractivity(true);
          }}
          onMouseLeave={() => {
            setIsHovered(false);
            if (!pillIsInteractive) return;
            if (!isCommandMenuOpen && !false) {
              setWindowInteractivity(false);
            }
          }}
        >
          <PillTooltip
            content={canReopenLiveTranscript ? t("transcriptionPreview.label") : micTooltip}
            disabled={anyPanelMounted}
            align={panelStartPosition === "center" ? "center" : voiceHorizontalDirection}
          >
            <VoicePill
              ref={buttonRef}
              variant={anyPanelOpen ? "panel" : "floating"}
              state={commonPillState}
              expanded={!anyPanelOpen && isCompactPill}
              collapseToLogo={
                listeningEntrance.collapseToLogo || assistantFooter.collapsePillToLogo
              }
              beamActive={listeningEntrance.beamActive ?? undefined}
              waveformVisible={listeningEntrance.waveformVisible}
              waveformOnlyWhileRecording={anyPanelMounted}
              integratedWithPanel={liveTranscript.open}
              agentMode={agentModeActive}
              beamTheme={beamTheme}
              showExpandChevron={canReopenLiveTranscript && isHovered}
              getAudioLevel={getAudioLevel}
              isDragging={isDragging}
              horizontalDirection={voiceHorizontalDirection}
              role={pillIsInteractive ? "button" : "status"}
              tabIndex={pillIsInteractive ? 0 : undefined}
              aria-label={
                canReopenLiveTranscript || liveTranscript.mounted
                  ? t("transcriptionPreview.label")
                  : micTooltip
              }
              onMouseDown={(e) => {
                if (anyPanelMounted) {
                  setHasDragged(false);
                  return;
                }
                setIsCommandMenuOpen(false);
                setDragStartPos({ x: e.clientX, y: e.clientY });
                setHasDragged(false);
                handleMouseDown(e);
              }}
              onMouseMove={(e) => {
                if (anyPanelMounted) return;
                if (dragStartPos && !hasDragged) {
                  const distance = Math.sqrt(
                    Math.pow(e.clientX - dragStartPos.x, 2) +
                      Math.pow(e.clientY - dragStartPos.y, 2)
                  );
                  if (distance > 5) {
                    // 5px threshold for drag
                    setHasDragged(true);
                  }
                }
              }}
              onMouseUp={(e) => {
                if (anyPanelMounted) return;
                handleMouseUp(e);
                setDragStartPos(null);
              }}
              onClick={(e) => {
                activateVoicePill();
                e.preventDefault();
              }}
              onKeyDown={(event) => {
                if (event.repeat || !isVoicePillActivationKey(event.key)) return;
                event.preventDefault();
                activateVoicePill();
              }}
              onContextMenu={(e) => {
                if (anyPanelMounted) return;
                e.preventDefault();
                if (!hasDragged) {
                  setWindowInteractivity(true);
                  setIsCommandMenuOpen((prev) => !prev);
                }
              }}
            />
          </PillTooltip>
          {voicePillInteraction.cancelVisible && (
            <button
              type="button"
              aria-label={
                isRecording ? t("app.buttons.cancelRecording") : t("app.buttons.cancelProcessing")
              }
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (isRecording) cancelRecording();
                else cancelProcessing();
              }}
              className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border/55 bg-surface-2 text-muted-foreground shadow-sm transition-colors hover:bg-surface-3 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              <X size={13} strokeWidth={2.5} aria-hidden="true" />
            </button>
          )}
          {!anyPanelMounted && isCommandMenuOpen && (
            <PillCommandMenu
              buttonRef={buttonRef}
              isRecording={isRecording}
              isHovered={isHovered}
              setWindowInteractivity={setWindowInteractivity}
              onToggleListening={() => {
                toggleListening();
              }}
              onHide={() => {
                setIsCommandMenuOpen(false);
                setWindowInteractivity(false);
                handleClose();
              }}
              onClose={() => setIsCommandMenuOpen(false)}
            />
          )}
        </div>
      </div>

      <VoiceModePanelCore
        mode={activeVoicePanelMode}
        open={activeVoicePanel.open}
        closing={false}
        stage={
          activeVoicePanelMode === "live-transcript" ? liveTranscriptEntrance.coreStage : "content"
        }
        horizontalDirection={voiceHorizontalDirection}
        label={activeVoicePanelLabel}
        measurementRevision={
          activeVoicePanelMode === "live-transcript" ? liveTranscript.measurementText : null
        }
        onPreferredHeightChange={liveTranscript.requestHeight}
      >
        {
          <LiveTranscriptPanel
            text={liveTranscript.mounted ? liveTranscript.text : ""}
            measurementText={liveTranscript.mounted ? liveTranscript.measurementText : ""}
            phase={liveTranscript.phase}
            processing={liveTranscript.mounted && isProcessing && !isAssistantVoice}
            controlsVisible={liveTranscript.mounted && liveTranscriptEntrance.controlsVisible}
            contentVisible={liveTranscript.mounted && liveTranscriptEntrance.contentVisible}
            onCollapse={() => liveTranscript.close({ suppress: true })}
            onHoldChange={liveTranscript.holdFinal}
          />
        }
      </VoiceModePanelCore>
    </div>
  );
}
