import { useSyncExternalStore } from "react";
import { getDocumentTasks, subscribeDocumentTasks, type DocumentTask } from "@/lib/openDocument";

/** Tâches documentaires en cours (ouverture, téléchargement, génération). */
export function useDocumentTasks(): DocumentTask[] {
  return useSyncExternalStore(subscribeDocumentTasks, getDocumentTasks, getDocumentTasks);
}

/** Vrai tant que la tâche de cette clé est en cours. */
export function useDocumentTaskPending(key: string | null | undefined): boolean {
  const tasks = useDocumentTasks();
  return !!key && tasks.some((t) => t.key === key);
}
