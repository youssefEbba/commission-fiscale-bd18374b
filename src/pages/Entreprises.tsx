import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import EntiteReferentielPage, { type EntiteField } from "@/components/entites/EntiteReferentielPage";
import { entrepriseApi, ENTREPRISE_CATEGORIES, type EntrepriseDto, type SecteurActiviteDto } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { loadSecteursActifs } from "@/lib/secteurs";
import { usePageTitle } from "@/hooks/usePageTitle";

const BASE_FIELDS: EntiteField[] = [
  { key: "raisonSociale", labelKey: "entites.f_raison_sociale", required: true },
  { key: "nomCommercial", labelKey: "entites.f_nom_commercial" },
  { key: "nif", labelKey: "entites.f_nif" },
  { key: "adresse", labelKey: "entites.f_adresse" },
  { key: "telephone", labelKey: "entites.f_telephone", type: "tel" },
  { key: "email", labelKey: "entites.f_email", type: "email" },
  { key: "activite", labelKey: "entites.f_activite" },
];

/** Référentiel des entreprises — CRUD complet (Président / ADMIN_SI). */
export default function Entreprises() {
  usePageTitle("rattachement:entites.entreprises_title");
  const { t, i18n } = useTranslation(["rattachement", "enums"]);
  const { user } = useAuth();
  const [secteurs, setSecteurs] = useState<SecteurActiviteDto[]>([]);
  const [secteursLoading, setSecteursLoading] = useState(true);

  useEffect(() => {
    loadSecteursActifs(user)
      .then(setSecteurs)
      .catch(() => setSecteurs([]))
      .finally(() => setSecteursLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.userId, user?.actingEntrepriseId, user?.actingAutoriteContractanteId]);

  const fields = useMemo<EntiteField[]>(() => {
    const ar = i18n.language?.startsWith("ar");
    return [
      ...BASE_FIELDS,
      {
        key: "categorie",
        labelKey: "entites.f_categorie",
        options: ENTREPRISE_CATEGORIES.map((c) => ({ value: c, label: t(`enums:entreprise_categorie.${c}`) })),
      },
      {
        key: "secteurId",
        labelKey: "entites.f_secteur",
        numeric: true,
        optionsLoading: secteursLoading,
        options: secteurs.map((s) => ({ value: String(s.id), label: (ar && s.libelleAr) || s.libelle })),
        display: (e) => (e.secteurLibelle as string | undefined) ?? (e.secteurId != null ? String(e.secteurId) : null),
      },
    ];
  }, [secteurs, secteursLoading, t, i18n.language]);

  return (
    <EntiteReferentielPage<EntrepriseDto>
      titleKey="entites.entreprises_title" subtitleKey="entites.entreprises_subtitle"
      newKey="entites.new_entreprise" editKey="entites.edit_entreprise"
      fields={fields} columns={["raisonSociale", "nif", "categorie", "secteurId", "telephone"]}
      detailHref={(e) => `/dashboard/entreprises/${e.id}`} nameOf={(e) => e.raisonSociale || `#${e.id}`}
      api={entrepriseApi} canCreate canUpdate canDelete
    />
  );
}
