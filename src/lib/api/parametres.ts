import { apiFetch } from "./client";
import type { ParametreDto, ParametresPublics } from "./reporting";
export const parametrePublicApi = {
  get: () => apiFetch<ParametresPublics>("/public/parametres", { noAuth: true, skipAuthRedirect: true }),
};

export const parametreApi = {
  list: () => apiFetch<ParametreDto[]>("/parametres"),
  update: (cle: string, valeur: string) =>
    apiFetch<ParametreDto>(`/parametres/${encodeURIComponent(cle)}`, { method: "PUT", body: { valeur } }),
};
