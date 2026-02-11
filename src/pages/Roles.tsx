import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { ROLE_OPTIONS, ROLE_LABELS } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Shield, Users, FileText, Award, Settings, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ROLE_DESCRIPTIONS: Record<string, { description: string; permissions: string[] }> = {
  PRESIDENT: {
    description: "Validation finale exclusive. Signature des documents officiels.",
    permissions: ["Arbitrer corrections (P2)", "Signer certificats (P3)", "Valider modifications (P6)", "Valider transferts (P7)", "Valider clôtures (P8)"],
  },
  ADMIN_SI: {
    description: "Gestion centralisée des comptes utilisateurs et rôles.",
    permissions: ["Créer/modifier/supprimer comptes", "Attribuer les rôles", "Désactiver les accès", "Consulter journal d'audit"],
  },
  DGD: {
    description: "Direction Générale des Douanes – Évaluation douanière.",
    permissions: ["Évaluer offre fiscale (P2)", "Viser bulletin liquidation (P4)", "Consulter imputations"],
  },
  DGI: {
    description: "Direction Générale des Impôts – Validation TVA.",
    permissions: ["Apposer visa Impôts (P2)", "Vérifier situation fiscale (P3)", "Consulter utilisations intérieur (P5)"],
  },
  DGB: {
    description: "Direction Générale du Budget – Visa budgétaire.",
    permissions: ["Valider référentiel projet (P1)", "Apposer visa Budget (P2)", "Consulter reporting (P8)"],
  },
  DGTCP: {
    description: "Direction Générale du Trésor et de la Comptabilité Publique.",
    permissions: ["Arrêter montants (P2)", "Ouvrir crédit (P3)", "Imputer droits (P4)", "Apurer intérieur (P5)", "Traiter modifications (P6)", "Préparer clôture (P8)"],
  },
  AUTORITE_CONTRACTANTE: {
    description: "Maître d'ouvrage – Saisine et dépôt de documents.",
    permissions: ["Créer dossier projet (P1)", "Soumettre correction (P2)", "Soumettre demande certificat (P3)", "Déposer documents complémentaires"],
  },
  ENTREPRISE: {
    description: "Bénéficiaire – Utilisation du crédit d'impôt.",
    permissions: ["Utiliser crédit Douanier (P4)", "Utiliser crédit Intérieur (P5)", "Demander modification (P6)", "Demander transfert (P7)"],
  },
};

const Roles = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Gestion des rôles
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Rôles système et permissions RBAC associées
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {ROLE_OPTIONS.map((role) => {
            const info = ROLE_DESCRIPTIONS[role.value];
            return (
              <Card key={role.value} className="border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Badge variant="secondary" className="text-xs">{role.value}</Badge>
                    <span>{role.label}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">{info?.description}</p>
                  <div>
                    <p className="text-xs font-semibold text-foreground mb-1.5">Permissions :</p>
                    <ul className="space-y-1">
                      {info?.permissions.map((p) => (
                        <li key={p} className="text-xs text-muted-foreground flex items-start gap-1.5">
                          <Eye className="h-3 w-3 mt-0.5 text-primary shrink-0" />
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Roles;
