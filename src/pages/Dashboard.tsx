import { useEffect, useState } from "react";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Link } from "react-router-dom";
import {
  Users, FileText, Award, Activity, ArrowRight, Shield, Building2,
  Landmark, BarChart3, ClipboardCheck, ArrowRightLeft, Archive, Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  demandeCorrectionApi, certificatCreditApi, utilisationCreditApi,
  utilisateurApi, DemandeCorrectionDto, CertificatCreditDto,
  UtilisationCreditDto, DEMANDE_STATUT_LABELS, CERTIFICAT_STATUT_LABELS,
  UTILISATION_STATUT_LABELS,
} from "@/lib/api";

interface QuickAction {
  label: string;
  href: string;
  icon: React.ElementType;
  description: string;
  roles: AppRole[];
}

const QUICK_ACTIONS: QuickAction[] = [
  { label: "Nouvelle demande", href: "/dashboard/demandes", icon: FileText, description: "Soumettre une correction d'offre fiscale", roles: ["AUTORITE_CONTRACTANTE"] },
  { label: "Mes certificats", href: "/dashboard/certificats", icon: Award, description: "Consulter vos certificats de crédit", roles: ["AUTORITE_CONTRACTANTE", "ENTREPRISE"] },
  { label: "Utilisation Douane", href: "/dashboard/utilisations", icon: Landmark, description: "Soumettre une utilisation douanière", roles: ["ENTREPRISE"] },
  { label: "Utilisation Intérieur", href: "/dashboard/utilisations", icon: Building2, description: "Soumettre une utilisation intérieure", roles: ["ENTREPRISE"] },
  { label: "Dossiers à traiter", href: "/dashboard/demandes", icon: ClipboardCheck, description: "Évaluer les corrections d'offre", roles: ["DGD", "DGI", "DGB", "DGTCP"] },
  { label: "Validation finale", href: "/dashboard/demandes", icon: Shield, description: "Valider et signer les dossiers", roles: ["PRESIDENT"] },
  { label: "Certificats à signer", href: "/dashboard/certificats", icon: Award, description: "Certificats en attente de signature", roles: ["PRESIDENT"] },
  { label: "Transferts", href: "/dashboard/transferts", icon: ArrowRightLeft, description: "Gérer les transferts de solde", roles: ["ENTREPRISE", "DGTCP", "PRESIDENT"] },
  { label: "Clôture & Reporting", href: "/dashboard/cloture", icon: Archive, description: "Clôture, archivage et rapports", roles: ["DGTCP", "PRESIDENT"] },
  { label: "Utilisateurs", href: "/dashboard/utilisateurs", icon: Users, description: "Gérer les comptes et rôles", roles: ["ADMIN_SI", "PRESIDENT"] },
  { label: "Journal d'audit", href: "/dashboard/audit", icon: BarChart3, description: "Consulter les logs d'activité", roles: ["ADMIN_SI"] },
];

const Dashboard = () => {
  const { user, hasRole } = useAuth();
  const role = user?.role as AppRole;
  const [loading, setLoading] = useState(true);
  const [demandes, setDemandes] = useState<DemandeCorrectionDto[]>([]);
  const [certificats, setCertificats] = useState<CertificatCreditDto[]>([]);
  const [utilisations, setUtilisations] = useState<UtilisationCreditDto[]>([]);
  const [userCount, setUserCount] = useState(0);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const promises: Promise<void>[] = [];
        promises.push(demandeCorrectionApi.getAll().then(setDemandes).catch(() => setDemandes([])));
        promises.push(certificatCreditApi.getAll().then(setCertificats).catch(() => setCertificats([])));
        promises.push(utilisationCreditApi.getAll().then(setUtilisations).catch(() => setUtilisations([])));
        if (hasRole(["ADMIN_SI", "PRESIDENT"])) {
          promises.push(utilisateurApi.getAll().then((u) => setUserCount(u.length)).catch(() => setUserCount(0)));
        }
        await Promise.all(promises);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const myActions = QUICK_ACTIONS.filter((a) => a.roles.includes(role));

  const stats = [
    { label: "Demandes", icon: FileText, value: demandes.length, color: "text-primary" },
    { label: "Certificats", icon: Award, value: certificats.length, color: "text-accent" },
    { label: "Utilisations", icon: Activity, value: utilisations.length, color: "text-green-glow" },
    ...(hasRole(["ADMIN_SI", "PRESIDENT"]) ? [{ label: "Utilisateurs", icon: Users, value: userCount, color: "text-primary" }] : []),
  ];

  const pendingDemandes = demandes.filter((d) => !["ADOPTEE", "REJETEE", "NOTIFIEE"].includes(d.statut));
  const pendingCertificats = certificats.filter((c) => !["CLOTURE", "ANNULE"].includes(c.statut));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Bonjour, {user?.nomComplet || user?.username}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Bienvenue sur votre tableau de bord – <Badge variant="secondary" className="text-xs">{user?.role}</Badge>
          </p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <Card key={s.label}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">{s.label}</span>
                  <s.icon className={`h-5 w-5 ${s.color}`} />
                </div>
                <p className="mt-2 text-2xl font-bold text-foreground">
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : s.value}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        {myActions.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-3">Actions rapides</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {myActions.map((a) => (
                <Link key={a.label + a.href} to={a.href}>
                  <Card className="hover:border-primary/40 transition-colors cursor-pointer h-full">
                    <CardContent className="p-4 flex items-start gap-3">
                      <div className="rounded-lg bg-primary/10 p-2">
                        <a.icon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{a.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{a.description}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Recent activity */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recent Demandes */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center justify-between">
                <span>Demandes récentes</span>
                <Link to="/dashboard/demandes">
                  <Button variant="ghost" size="sm" className="text-xs">Voir tout <ArrowRight className="h-3 w-3 ml-1" /></Button>
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : pendingDemandes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Aucune demande en cours</p>
              ) : (
                <div className="space-y-2">
                  {pendingDemandes.slice(0, 5).map((d) => (
                    <div key={d.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">{d.numero || `Demande #${d.id}`}</p>
                        <p className="text-xs text-muted-foreground">{d.autoriteContractanteNom || "—"}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">{DEMANDE_STATUT_LABELS[d.statut]}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Certificats */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center justify-between">
                <span>Certificats récents</span>
                <Link to="/dashboard/certificats">
                  <Button variant="ghost" size="sm" className="text-xs">Voir tout <ArrowRight className="h-3 w-3 ml-1" /></Button>
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : pendingCertificats.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Aucun certificat en cours</p>
              ) : (
                <div className="space-y-2">
                  {pendingCertificats.slice(0, 5).map((c) => (
                    <div key={c.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">{c.reference || `Certificat #${c.id}`}</p>
                        <p className="text-xs text-muted-foreground">{c.entrepriseNom || "—"}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">{CERTIFICAT_STATUT_LABELS[c.statut]}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
