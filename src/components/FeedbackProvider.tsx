"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";

type Notice = { id: number; message: string; kind: "success" | "error" };
type Feedback = {
  notify: (message: string, kind?: Notice["kind"]) => void;
  beginTask: () => () => void;
  navigate: (href: string, replace?: boolean) => void;
  refresh: () => void;
};
const FeedbackContext = createContext<Feedback | null>(null);

export default function FeedbackProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [tasks, setTasks] = useState(0);
  const [navigating, startTransition] = useTransition();
  const nextId = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setNotices((current) => current.filter((item) => item.id !== id));
  }, []);

  const notify = useCallback((message: string, kind: Notice["kind"] = "success") => {
    const id = ++nextId.current;
    setNotices((current) => [...current.slice(-3), { id, message, kind }]);
    timers.current.set(id, setTimeout(() => dismiss(id), kind === "error" ? 9000 : 6000));
  }, [dismiss]);

  useEffect(() => {
    const activeTimers = timers.current;
    return () => { activeTimers.forEach(clearTimeout); activeTimers.clear(); };
  }, []);

  const beginTask = useCallback(() => {
    setTasks((count) => count + 1);
    let finished = false;
    return () => {
      if (!finished) {
        finished = true;
        setTasks((count) => Math.max(0, count - 1));
      }
    };
  }, []);

  const navigate = useCallback((href: string, replace = false) => {
    startTransition(() => {
      if (replace) router.replace(href);
      else router.push(href);
    });
  }, [router]);

  const refresh = useCallback(() => startTransition(() => router.refresh()), [router]);

  return (
    <FeedbackContext.Provider value={{ notify, beginTask, navigate, refresh }}>
      {children}
      {(tasks > 0 || navigating) && <div className="app-progress" role="status" aria-label="Loading"><span /><span className="sr-only">Please wait</span></div>}
      <div className="notification-stack" aria-label="Notifications">
        {notices.map((notice) => (
          <div key={notice.id} className={`notification notification-${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"} aria-atomic="true">
            <span className="notification-icon" aria-hidden="true">{notice.kind === "success" ? "✓" : "!"}</span>
            <div><strong>{notice.kind === "success" ? "Success" : "Something needs your attention"}</strong><p>{notice.message}</p></div>
            <button type="button" className="notification-close" aria-label="Dismiss notification" onClick={() => dismiss(notice.id)}>×</button>
          </div>
        ))}
      </div>
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const context = useContext(FeedbackContext);
  if (!context) throw new Error("FeedbackProvider is required.");
  return context;
}

export function useMutation() {
  const { notify, beginTask } = useFeedback();
  const [pending, setPending] = useState(false);
  const busy = useRef(false);

  async function execute(action: () => Promise<void>) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    const finish = beginTask();
    try {
      await action();
    } catch (error) {
      notify(error instanceof Error ? error.message : "The request could not be completed. Please try again.", "error");
    } finally {
      finish();
      busy.current = false;
      setPending(false);
    }
  }

  return { pending, execute };
}
