const FOCUS_STORAGE_KEY = "v-project-mentor-focus";
export const MENTOR_FOCUS_EVENT = "v-project-mentor-focus";

export function readMentorFocusMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(FOCUS_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeMentorFocusMode(enabled: boolean) {
  try {
    window.sessionStorage.setItem(FOCUS_STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") {
    // Defer: evita setState no AuthedLayout durante o render do MentorPage
    // (dispatchEvent síncrono + listener = "Cannot update AuthedLayout while rendering MentorPage").
    queueMicrotask(() => {
      window.dispatchEvent(new CustomEvent(MENTOR_FOCUS_EVENT, { detail: enabled }));
    });
  }
  return enabled;
}
