import EntiteReferentielPage from "@/components/entites/EntiteReferentielPage";
import { autoriteContractanteApi, type AutoriteContractanteDto } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { usePageTitle } from "@/hooks/usePageTitle";

export const AUTORITE_FIELDS = [
  { key: "nom", labelKey: "entites.f_nom", required: true },
  { key: "sigle", labelKey: "entites.f_sigle" },
  { key: "ministereTutelleNom", labelKey: "entites.f_ministere_nom" },
  { key: "ministereTutelleCode", labelKey: "entites.f_ministere_code" },
  { key: "adresse", labelKey: "entites.f_adresse" },
  { key: "telephone", labelKey: "entites.f_telephone", type: "tel" },
  { key: "email", labelKey: "entites.f_email", type: "email" },
];

/** Référentiel des autorités contractantes — boutons conditionnés aux permissions `autorite.*`. */
export default function AutoritesContractantes() {
  usePageTitle("rattachement:entites.autorites_title");
  const { hasPermission } = useAuth();
  return (
    <EntiteReferentielPage<AutoriteContractanteDto>
      titleKey="entites.autorites_title" subtitleKey="entites.autorites_subtitle"
      newKey="entites.new_autorite" editKey="entites.edit_autorite"
      fields={AUTORITE_FIELDS} columns={["nom", "sigle", "ministereTutelleNom", "telephone"]}
      detailHref={(a) => `/dashboard/autorites/${a.id}`} nameOf={(a) => a.nom || `#${a.id}`}
      api={autoriteContractanteApi}
      canCreate={hasPermission("autorite.create")} canUpdate={hasPermission("autorite.update")} canDelete={hasPermission("autorite.delete")}
    />
  );
}
