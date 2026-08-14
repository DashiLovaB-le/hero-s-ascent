const TOUR_STORAGE_PREFIX = "vproject:tour_visto:";
const PENDING_TOUR_KEY = "vproject:pending_tour";

export function productTourStorageKey(userId: string) {
  return `${TOUR_STORAGE_PREFIX}${userId}`;
}

export function markPendingProductTour() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PENDING_TOUR_KEY, "1");
  } catch {
    // ignore
  }
}

export function clearPendingProductTour() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(PENDING_TOUR_KEY);
  } catch {
    // ignore
  }
}

export function hasPendingProductTour(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(PENDING_TOUR_KEY) === "1";
  } catch {
    return false;
  }
}

export function readLocalTourSeen(userId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(productTourStorageKey(userId)) === "1";
  } catch {
    return false;
  }
}

export function writeLocalTourSeen(userId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(productTourStorageKey(userId), "1");
  } catch {
    // ignore quota / private mode
  }
  clearPendingProductTour();
}

/** Deve abrir o tour neste browser? */
export function shouldOpenProductTour(opts: {
  onboardingCompleto: boolean;
  tourVisto: boolean;
  userId: string;
}): boolean {
  if (!opts.onboardingCompleto) return false;
  if (readLocalTourSeen(opts.userId)) return false;
  if (!opts.tourVisto) return true;
  return hasPendingProductTour();
}
