import EntiteReferentielPage from "@/components/entites/EntiteReferentielPage";
import { entrepriseApi, type EntrepriseDto } from "@/lib/api";
import { usePageTitle } from "@/hooks/usePageTitle";

const FIELDS = [
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
  return (
    <EntiteReferentielPage<EntrepriseDto>
      titleKey="entites.entreprises_title" subtitleKey="entites.entreprises_subtitle"
      newKey="entites.new_entreprise" editKey="entites.edit_entreprise"
      fields={FIELDS} columns={["raisonSociale", "nif", "activite", "telephone"]}
      detailHref={(e) => `/dashboard/entreprises/${e.id}`} nameOf={(e) => e.raisonSociale || `#${e.id}`}
      api={entrepriseApi} canCreate canUpdate canDelete
    />
  );
}
