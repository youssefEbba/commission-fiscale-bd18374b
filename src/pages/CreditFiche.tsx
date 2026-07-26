import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, FileText, Building2, Landmark, Award } from "lucide-react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { usePageTitle } from "@/hooks/usePageTitle";
import { formatAmount, formatDate } from "@/i18n/format";
import { tStatutCertificat, tStatutUtilisation, tTypeDocument } from "@/i18n/enums";
import { displayRef } from "@/lib/displayRef";
import { openDocument } from "@/lib/openDocument";
import { certificatCreditConsultation, CertificatCreditFicheDto } from "@/lib/api";

const Field = ({ label, value }: { label: string; value?: string | number | null }) => (
  <div>
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="text-sm font-medium">{value === null || value === undefined || value === "" ? "—" : value}</p>
  </div>
);

export default function CreditFiche() {
  const { reference = "" } = useParams();
  const ref = decodeURIComponent(reference);
  const navigate = useNavigate();
  const { toast } = useToast();
  usePageTitle("nav:credits_consultation");

  const [fiche, setFiche] = useState<CertificatCreditFicheDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    certificatCreditConsultation.fiche(ref)
      .then(f => { if (alive) setFiche(f); })
      .catch((e: any) => toast({ variant: "destructive", title: "Fiche indisponible", description: e?.message || "Erreur serveur" }))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [ref, toast]);

  const c = fiche?.certificat;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/credits/recherche")}>
          <ArrowLeft className="h-4 w-4 me-1 rtl:rotate-180" /> Retour à la recherche
        </Button>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : !c ? (
          <p className="text-muted-foreground">Aucun crédit trouvé pour la référence « {ref} ».</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold">{displayRef(c)}</h1>
              <Badge variant="outline">{tStatutCertificat(c.statut)}</Badge>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" /> Entreprise</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-3">
                  <Field label="Raison sociale" value={fiche?.entreprise?.raisonSociale || c.entrepriseRaisonSociale} />
                  <Field label="NIF" value={fiche?.entreprise?.nifAffiche || fiche?.entreprise?.nif} />
                  <Field label="RC étranger" value={fiche?.entreprise?.registreCommerceEtranger} />
                  <Field label="Chef de file" value={fiche?.entreprise?.chefDeFileRaisonSociale} />
                  <Field label="Adresse" value={fiche?.entreprise?.adresse} />
                  <Field label="Email" value={fiche?.entreprise?.email} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Landmark className="h-4 w-4 text-primary" /> Convention & Autorité</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-3">
                  <Field label="Référence convention" value={fiche?.convention?.reference} />
                  <Field label="Intitulé convention" value={fiche?.convention?.intitule} />
                  <Field label="Projet" value={fiche?.convention?.projectReference} />
                  <Field label="Autorité contractante" value={fiche?.autoriteContractante?.nom} />
                  <Field label="Ministère de tutelle" value={fiche?.autoriteContractante?.ministereTutelleNom} />
                  <Field label="Code ministère" value={fiche?.autoriteContractante?.ministereTutelleCode} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Marché</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-3">
                  <Field label="Intitulé" value={fiche?.intituleMarche || fiche?.marche?.intitule || c.marcheIntitule} />
                  <Field label="N° marché" value={fiche?.marche?.numeroMarche} />
                  <Field label="Montant HT" value={fiche?.marche?.montantContratHt != null ? formatAmount(fiche.marche.montantContratHt) : undefined} />
                  <Field label="Date de signature" value={fiche?.marche?.dateSignature ? formatDate(fiche.marche.dateSignature) : undefined} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Award className="h-4 w-4 text-primary" /> Crédit</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-3">
                  <Field label="Montant cordon" value={formatAmount(c.montantCordon)} />
                  <Field label="Solde cordon" value={formatAmount(c.soldeCordon)} />
                  <Field label="Montant TVA intérieure" value={formatAmount(c.montantTVAInterieure)} />
                  <Field label="Solde TVA intérieure" value={formatAmount(c.soldeTVA)} />
                  <Field label="Date d'émission" value={c.dateEmission ? formatDate(c.dateEmission) : undefined} />
                  <Field label="Date de mise en place" value={c.dateMiseEnPlace ? formatDate(c.dateMiseEnPlace) : undefined} />
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Documents</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Nom</TableHead><TableHead>Date</TableHead><TableHead className="text-end">Action</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {(fiche?.documents || []).length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">Aucun document</TableCell></TableRow>
                    ) : fiche!.documents!.map(d => (
                      <TableRow key={d.id}>
                        <TableCell>{d.type ? tTypeDocument(d.type) : "—"}</TableCell>
                        <TableCell className="max-w-[280px] truncate">{d.nomFichier || "—"}</TableCell>
                        <TableCell>{d.dateUpload ? formatDate(d.dateUpload) : "—"}</TableCell>
                        <TableCell className="text-end">
                          <Button size="sm" variant="outline" onClick={() => void openDocument(d)}>Ouvrir</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Utilisations</CardTitle></CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table className="min-w-[700px]">
                    <TableHeader><TableRow><TableHead>Référence</TableHead><TableHead>Type</TableHead><TableHead>Statut</TableHead><TableHead className="text-end">Montant</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {(fiche?.utilisations || []).length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Aucune utilisation</TableCell></TableRow>
                      ) : fiche!.utilisations!.map(u => (
                        <TableRow key={u.id} className="cursor-pointer" onClick={() => navigate(`/dashboard/utilisations/${u.id}`)}>
                          <TableCell className="font-medium">{displayRef(u)}</TableCell>
                          <TableCell>{u.type || "—"}</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">{tStatutUtilisation(u.statut)}</Badge></TableCell>
                          <TableCell className="text-end">{formatAmount(u.montant ?? u.montantDroits)}</TableCell>
                          <TableCell>{u.dateCreation ? formatDate(u.dateCreation) : "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {!!(fiche?.tvaStock || []).length && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Stock TVA déductible</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader><TableRow><TableHead>Source</TableHead><TableHead className="text-end">Montant</TableHead><TableHead className="text-end">Solde</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {fiche!.tvaStock!.map((s, i) => (
                        <TableRow key={s.id ?? i}>
                          <TableCell>{s.numeroDeclaration || s.source || "—"}</TableCell>
                          <TableCell className="text-end">{formatAmount(s.montantInitial)}</TableCell>
                          <TableCell className="text-end">{formatAmount(s.montantRestant)}</TableCell>
                          <TableCell>{s.dateCreation ? formatDate(s.dateCreation) : "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
