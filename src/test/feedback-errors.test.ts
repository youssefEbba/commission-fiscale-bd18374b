import { beforeEach, expect, it, vi } from "vitest";
import { ApiRequestError } from "@/lib/api";
const emit = vi.hoisted(() => vi.fn());
vi.mock("@/components/ErrorDialog", () => ({ emitErrorDialog: emit }));
vi.mock("@/i18n", () => ({ default: { t: () => "Action non autorisée" } }));
import { showApiError } from "@/lib/feedback";

beforeEach(() => emit.mockClear());
it("ne remplace jamais le refus métier explicite par une traduction générique", () => {
  showApiError(new ApiRequestError({ status: 409, code: "BUSINESS_RULE_VIOLATION", message: "Réactivation impossible : la convention est annulée" }));
  expect(emit).toHaveBeenCalledWith(expect.objectContaining({ description: expect.stringContaining("Réactivation impossible : la convention est annulée") }));
});