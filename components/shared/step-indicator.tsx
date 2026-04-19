interface StepIndicatorProps {
  state: "pending" | "active" | "done";
  icon: string;
  label: string;
}

export function StepIndicator({ state, label }: StepIndicatorProps) {
  const barColor =
    state === "done" ? "var(--green)" : state === "active" ? "var(--pearl)" : "var(--border)";
  const barWidth =
    state === "done" ? "100%" : state === "active" ? "50%" : "0%";
  const textColor =
    state === "done" ? "var(--green)" : state === "active" ? "var(--pearl)" : "var(--text-muted)";
  const symbol = state === "done" ? "✓" : state === "active" ? "◌" : "○";

  return (
    <div style={{ flex: 1, minWidth: 60 }}>
      <div style={{ height: 2, width: "100%", background: "var(--border)", position: "relative" }}>
        <div
          style={{
            position: "absolute", top: 0, left: 0,
            height: 2, width: barWidth,
            background: barColor,
            transition: "width 500ms ease",
          }}
        />
      </div>
      <div style={{ marginTop: 6, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
        <span
          style={{
            fontSize: 11,
            color: textColor,
            animation: state === "active" ? "blink 1.2s infinite" : "none",
          }}
        >
          {symbol}
        </span>
        <span
          className="eyebrow"
          style={{ color: textColor, fontSize: 9 }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}

export interface ProgressStep {
  key: string;
  icon: string;
  label: string;
}

interface ProgressTrackerProps {
  currentStep: string;
  steps: ProgressStep[];
}

export function ProgressTracker({ currentStep, steps }: ProgressTrackerProps) {
  function stateFor(target: ProgressStep): "pending" | "active" | "done" {
    if (currentStep === "idle" || currentStep === "error") return "pending";
    const currentIdx = steps.findIndex((s) => s.key === currentStep);
    const targetIdx = steps.findIndex((s) => s.key === target.key);
    if (currentIdx > targetIdx) return "done";
    if (currentIdx === targetIdx) {
      return targetIdx === steps.length - 1 ? "done" : "active";
    }
    return "pending";
  }

  return (
    <div
      style={{ display: "flex", alignItems: "start", gap: 4 }}
      role="status"
      aria-live="polite"
    >
      {steps.map((step) => (
        <StepIndicator
          key={step.key}
          state={stateFor(step)}
          icon={step.icon}
          label={step.label}
        />
      ))}
    </div>
  );
}
