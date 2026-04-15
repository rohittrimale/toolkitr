/**
 * Action Parser Utilities
 * 
 * Extraction of helper functions from AICopilot.tsx
 * Handles parsing mainframe actions, error detection, and screen analysis
 */

import type { MainframeAction, ToolCallEntry } from "@/lib/core/types";
import { useStore, AID_ENTER, AID_CLEAR, AID_PA1, AID_PA2, AID_PA3, AID_PF } from "@/store";

// Record for the agentic-loop next-step after a mainframe action
export interface AgentLoopState {
  nextStep: string;
  iteration: number;
  lastThreeErrors: string[];
  previousScreenState?: string;
  currentTask?: string;
  taskRetryCount?: number;
}

/**
 * Parse the first ACTION_JSON block from an AI response string.
 * Handles multiple formats: code fenced, bare JSON, with/without ACTION_JSON label
 */
export function parseActionJson(content: string): MainframeAction | null {
  console.log("=== [PARSE] Starting ACTION_JSON parse ===");
  console.log("[PARSE] Raw content:", content.substring(0, 300));

  // Pattern 1: Explicit ACTION_JSON label with code fence
  let fenced = /ACTION_JSON\s*:\s*\n\s*```(?:json)?\s*\n([\s\S]*?)\n\s*```/i.exec(content);
  if (fenced?.[1]) {
    try {
      const parsed = JSON.parse(fenced[1].trim()) as MainframeAction;
      console.log("[PARSE] ✓ Parsed ACTION_JSON labeled fenced:", parsed.action_type);
      return parsed;
    } catch (e) {
      console.log("[PARSE] ✗ Failed to parse ACTION_JSON fenced:", e);
    }
  }

  // Pattern 2: Bare markdown code fence (no ACTION_JSON: label)
  let bareCodeFence = /```(?:json)?\s*\n([\s\S]*?)\n```/i.exec(content);
  if (bareCodeFence?.[1]) {
    try {
      const parsed = JSON.parse(bareCodeFence[1].trim()) as MainframeAction;
      if (parsed.action_type) {
        console.log("[PARSE] ✓ Parsed bare code fence JSON:", parsed.action_type);
        return parsed;
      }
    } catch (e) {
      console.log("[PARSE] ✗ Failed to parse bare code fence:", e);
    }
  }

  // Pattern 3: Bare form: ACTION_JSON:\n{ … }
  let bare = /ACTION_JSON\s*:\s*(\{[\s\S]*\})/i.exec(content);
  if (bare?.[1]) {
    try {
      const parsed = JSON.parse(bare[1].trim()) as MainframeAction;
      console.log("[PARSE] ✓ Parsed bare JSON:", parsed.action_type);
      return parsed;
    } catch (e) {
      console.log("[PARSE] ✗ Failed to parse bare JSON:", e);
    }
  }

  // Pattern 4: Direct JSON form (no ACTION_JSON label, just raw { … })
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("{") && line.includes('"action_type"')) {
      let jsonStr = line;
      if (line.endsWith(",") || !line.endsWith("}")) {
        let depth = 0;
        for (let j = i; j < lines.length; j++) {
          const l = lines[j];
          depth += (l.match(/\{/g) || []).length;
          depth -= (l.match(/\}/g) || []).length;
          jsonStr += (j > i ? "\n" : "") + l;
          if (depth === 0 && l.includes("}")) break;
        }
      }
      try {
        const parsed = JSON.parse(jsonStr) as MainframeAction;
        if (parsed.action_type) {
          console.log("[parseActionJson] ✓ Parsed direct JSON:", parsed.action_type);
          return parsed;
        }
      } catch (e) {
        // not JSON
      }
    }
  }

  console.log("[parseActionJson] ✗ No ACTION_JSON found in response");
  return null;
}

/**
 * Detect if same error is repeating 3 times in a row.
 * Returns true if should stop the loop due to error loop.
 */
export function detectErrorLoop(
  agentState: AgentLoopState | null,
  currentScreenText: string
): { shouldStop: boolean; reason: string } {
  if (!agentState) return { shouldStop: false, reason: "" };

  const errorKeywords = [
    "ISPF screen input error",
    "code = 32",
    "Data set not cataloged",
    "Invalid value",
    "No data set names found",
    "NOT FOUND",
    "NOT ALLOCATED",
    "error",
    "LASTCC=4",
    "LASTCC=8",
  ];

  const hasError = errorKeywords.some((kw) =>
    currentScreenText.toUpperCase().includes(kw.toUpperCase())
  );

  if (!hasError) return { shouldStop: false, reason: "" };

  const errorMatch = currentScreenText.match(/(?:error|Error|ERROR)[:\s]*([^\n]{0,80})/);
  const currentError = errorMatch?.[1] || "unknown error";

  const updatedErrors = [...agentState.lastThreeErrors.slice(-2), currentError];
  agentState.lastThreeErrors = updatedErrors;

  if (
    updatedErrors.length === 3 &&
    updatedErrors[0] === updatedErrors[1] &&
    updatedErrors[1] === updatedErrors[2]
  ) {
    return {
      shouldStop: true,
      reason: `Detected same error 3 times: "${currentError}". Stopping agentic loop.`,
    };
  }

  return { shouldStop: false, reason: "" };
}

/**
 * Verify screen changed after WRITE/NAVIGATE action.
 * Compare new screen to previousScreenState with normalization.
 * Returns true if changed.
 */
export function screenHasChanged(previousState: string | undefined, currentScreenText: string): boolean {
  if (!previousState) return true;
  const normalize = (s: string) => s.split("\n").map((l) => l.trimEnd()).join("\n").trim();
  const prevNorm = normalize(previousState);
  const currNorm = normalize(currentScreenText);
  return prevNorm !== currNorm;
}

/**
 * Deduplicate dataset name prefix.
 * If user prefix already at start of dataset name, don't add it again.
 */
export function deduplicateDatasetPrefix(userPrefix: string, datasetName: string): string {
  if (!userPrefix || !datasetName) return datasetName;
  const normalizedPrefix = userPrefix.toUpperCase().trim();
  const normalizedName = datasetName.toUpperCase().trim();

  if (normalizedName.startsWith(normalizedPrefix + ".") || normalizedName === normalizedPrefix) {
    return datasetName.trim();
  }

  return `${userPrefix}.${datasetName}`.trim();
}

/**
 * Check screen for failure keywords before claiming success.
 * Returns true if screen shows a failure condition.
 */
export function screenShowsFailure(screenText: string): boolean {
  const failureKeywords = [
    "error",
    "invalid",
    "not found",
    "not cataloged",
    "not allocated",
    "LASTCC=4",
    "LASTCC=8",
    "code = 32",
    "ISRZ002",
    "S913",
    "ICH408I",
    "IEF450I",
  ];

  const upper = screenText.toUpperCase();
  return failureKeywords.some((kw) => upper.includes(kw));
}

/**
 * Get max retry count for a given task type.
 * Different tasks have different thresholds.
 */
export function getMaxRetryForTask(taskType: string | undefined): number {
  const taskRetryMap: Record<string, number> = {
    "create dataset": 5,
    "open file": 4,
    "submit job": 5,
    compile: 6,
  };
  return taskRetryMap[taskType?.toLowerCase() ?? ""] ?? 5;
}

/**
 * Auto-recovery from ISPF error 32 (screen input error).
 * When error 32 is detected, press CLEAR to reset screen state.
 * Returns true if error 32 was found.
 */
export function checkForError32(screenText: string): boolean {
  const upper = screenText.toUpperCase();
  return (
    upper.includes("CODE = 32") ||
    upper.includes("CODE=32") ||
    upper.includes("ERROR 32") ||
    (upper.includes("SCREEN INPUT ERROR") && upper.includes("32"))
  );
}

/**
 * Pre-flight check before agent task starts.
 * Clears any error state on screen, verifies clear was successful.
 */
export async function preFlightCheck(sendAid: (code: number) => void): Promise<boolean> {
  try {
    const screen = useStore.getState().screen;
    if (!screen || !screen.cells) {
      return true;
    }

    const screenText = screen.cells.map((c) => (!c.isAttr ? c.char || " " : " ")).join("");

    const hasError =
      screenText.toUpperCase().includes("error") ||
      screenText.toUpperCase().includes("invalid") ||
      screenText.toUpperCase().includes("code = 32");

    if (hasError) {
      console.log("[PREFLIGHT] Error detected on screen - sending CLEAR");
      sendAid(0x6d);
      await new Promise((r) => setTimeout(r, 500));

      const screenAfter = useStore.getState().screen;
      const textAfter = screenAfter?.cells.map((c) => (!c.isAttr ? c.char || " " : " ")).join("") ?? "";

      const stillHasError =
        textAfter.toUpperCase().includes("error") ||
        textAfter.toUpperCase().includes("invalid") ||
        textAfter.toUpperCase().includes("code = 32");

      if (stillHasError) {
        console.warn("[PREFLIGHT] Error still present after CLEAR - may indicate persistent condition");
        return false;
      }
    }

    return true;
  } catch (e) {
    console.error("[PREFLIGHT] Error during preflight check:", e);
    return false;
  }
}

/**
 * Wait for mainframe screen response instead of using hardcoded timeouts.
 * Monitors bytesRx counter - incremented only on real server responses.
 * Returns true if screen changed, false if timeout expires.
 */
export function waitForScreenChange(timeoutMs: number = 3000): Promise<boolean> {
  return new Promise((resolve) => {
    const startBytesRx = useStore.getState().bytesRx;
    const startTime = Date.now();

    const timer = setInterval(() => {
      const currentBytesRx = useStore.getState().bytesRx;
      const elapsed = Date.now() - startTime;

      if (currentBytesRx !== startBytesRx) {
        clearInterval(timer);
        resolve(true);
      } else if (elapsed > timeoutMs) {
        clearInterval(timer);
        console.warn(`[waitForScreenChange] Timeout after ${timeoutMs}ms - no mainframe response`);
        resolve(false);
      }
    }, 50);
  });
}

/**
 * Strip the ACTION_JSON block from the text shown in chat.
 * Prevents users from ever seeing the raw AI instruction blocks.
 * Only removes blocks that contain "action_type" — preserves regular JSON code blocks.
 */
export function cleanMfContent(raw: string): string {
  let out = raw;

  // Only strip ACTION_JSON labeled blocks
  out = out.replace(/ACTION_JSON:\s*```json[\s\S]*?```/gi, "");
  out = out.replace(/ACTION_JSON:\s*\{[\s\S]*?\n\}/gi, "");

  // Only strip bare JSON blocks that contain "action_type" (mainframe action blocks)
  // This preserves regular JSON code examples in responses
  out = out.replace(/```json\s*\n([\s\S]*?)```/gi, (_match, inner: string) => {
    if (inner.includes('"action_type"')) {
      return ""; // Remove mainframe action blocks
    }
    return _match; // Keep regular JSON examples
  });

  // Only strip bare JSON objects that start with "action_type"
  out = out.replace(/^\s*\{\s*"action_type"\s*:[\s\S]*?\n\}/gim, "");

  // Collapse excessive blank lines
  out = out.replace(/\n{3,}/g, "\n\n");

  return out.trim();
}

/**
 * Convert a parsed MainframeAction into a ToolCallEntry.
 * Renders it as a collapsible plain-English pill.
 */
export function actionToToolCall(
  action: MainframeAction,
  state: "running" | "done" | "error" = "done"
): ToolCallEntry {
  const name = `mf_${action.action_type.toLowerCase()}`;
  const input: Record<string, string | number> = {};
  if (action.ispf_command) input.command = action.ispf_command;
  if (action.tso_command) input.tso_command = action.tso_command;
  if (action.text) input.text = action.text;
  if (action.keystroke) input.key = action.keystroke;
  if (action.find_text) input.find = action.find_text;
  if (action.replace_text) input.replace = action.replace_text;
  if ((action.row ?? 0) > 0) input.row = action.row ?? 0;
  if ((action.col ?? 0) > 0) input.col = action.col ?? 0;
  if (action.explanation) input.note = action.explanation;
  return { id: `mf-${action.action_type.toLowerCase()}-${Date.now()}`, name, input, state };
}

/**
 * Map a keystroke name to an AID byte.
 * Returns null for unknown keys.
 */
export function aidForKey(key: string): number | null {
  const k = key.toUpperCase().trim();

  if (k === "ENTER") return AID_ENTER;
  if (k === "CLEAR") return AID_CLEAR;
  if (k === "PA1") return AID_PA1;
  if (k === "PA2") return AID_PA2;
  if (k === "PA3") return AID_PA3;

  if (k === "RETURN") return AID_ENTER;
  if (k === "ESCAPE") return 0x5c;

  if (k === "TAB") return 0x05;
  if (k === "BACKTAB") return 0x2f;

  const pf = /^PF(\d{1,2})$/.exec(k);
  if (pf) {
    const pfNum = parseInt(pf[1], 10);
    if (pfNum >= 1 && pfNum <= 24) {
      return AID_PF[pfNum] ?? null;
    }
  }

  if (k.length === 1 && /^\d$/.test(k)) {
    const num = parseInt(k, 10);
    if (num === 0) return AID_PF[10] ?? null;
    return AID_PF[num] ?? null;
  }

  console.warn(`[aidForKey] Unknown keystroke: ${key}`);
  return null;
}
