import { useState } from "react";
import { useTranslation } from "react-i18next";
import { BailleurDto } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { OrderedMultiSelect } from "@/components/ui/ordered-multi-select";
import { Pencil, Plus } from "lucide-react";
import BailleurFormDialog from "./BailleurFormDialog";

interface Props {
  label: string;
  /** Référentiel chargé par le formulaire (GET /api/bailleurs). */
  bailleurs: BailleurDto[];
  setBailleurs: (updater: (prev: BailleurDto[]) => BailleurDto[]) => void;
  loading?: boolean;
  /** Bailleurs choisis, dans l'ordre : le premier est le principal. */
  value: number[];
  onChange: (ids: number[]) => void;
  /** Noms connus des bailleurs déjà liés (si absents du référentiel chargé). */
  knownNames?: Record<number, string>;
}

/** Sélection multiple des bailleurs, création à la volée, modification pour le Président / l'administrateur. */
const BailleursField = ({ label, bailleurs, setBailleurs, loading, value, onChange, knownNames }: Props) => {
  const { t } = useTranslation(["conventions"]);
  const { hasRole, hasPermission } = useAuth();
  const canEditBailleur = hasRole(["PRESIDENT", "ADMIN_SI"]) && hasPermission("bailleur.update");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<BailleurDto | null>(null);

  const labelOf = (v: string) => {
    const id = Number(v);
    return bailleurs.find((b) => b.id === id)?.nom || knownNames?.[id] || `#${id}`;
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <OrderedMultiSelect
        options={bailleurs.map((b) => ({ value: String(b.id), label: b.nom, keywords: b.details }))}
        values={value.map(String)}
        onChange={(vals) => onChange(vals.map(Number))}
        labelOf={labelOf}
        placeholder={loading ? t("conventions:create.loading") : t("conventions:bailleurs.add_placeholder")}
        searchPlaceholder={t("conventions:create.search_bailleur")}
        principalLabel={t("conventions:bailleurs.principal")}
        makePrincipalLabel={t("conventions:bailleurs.make_principal")}
        removeLabel={t("conventions:bailleurs.remove")}
        renderItemActions={canEditBailleur ? (v) => {
          const b = bailleurs.find((x) => x.id === Number(v)) ?? { id: Number(v), nom: labelOf(v) };
          return (
            <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0" onClick={() => setEditing(b)}
              title={t("conventions:bailleur.edit_title")} aria-label={t("conventions:bailleur.edit_title")}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          );
        } : undefined}
        addon={
          <Button type="button" variant="outline" size="icon" onClick={() => setCreateOpen(true)} title={t("conventions:create.add_bailleur_title")} aria-label={t("conventions:create.add_bailleur_title")}>
            <Plus className="h-4 w-4" />
          </Button>
        }
      />
      <p className="text-xs text-muted-foreground">{t("conventions:bailleurs.hint")}</p>

      <BailleurFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={(created) => {
          setBailleurs((prev) => [...prev.filter((b) => b.id !== created.id), created]);
          if (!value.includes(created.id)) onChange([...value, created.id]);
        }}
      />
      <BailleurFormDialog
        open={!!editing}
        onOpenChange={(o) => { if (!o) setEditing(null); }}
        bailleur={editing}
        onSaved={(saved) => setBailleurs((prev) => prev.map((b) => (b.id === saved.id ? saved : b)))}
      />
    </div>
  );
};

export default BailleursField;
