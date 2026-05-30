import { useEffect, useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { utilisateurApi, UtilisateurDto, ROLE_LABELS } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CircleUser, Save, RefreshCw, CheckCircle, XCircle, KeyRound, Eye, EyeOff } from "lucide-react";

const MonProfil = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [profile, setProfile] = useState<UtilisateurDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ nomComplet: "", email: "" });

  const load = async () => {
    setLoading(true);
    try {
      const me = await utilisateurApi.getMe();
      setProfile(me);
      setForm({ nomComplet: me.nomComplet || "", email: me.email || "" });
    } catch (err) {
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Impossible de charger le profil",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    const initialNom = profile.nomComplet || "";
    const initialEmail = profile.email || "";
    const payload: { nomComplet?: string; email?: string } = {};
    if (form.nomComplet !== initialNom) payload.nomComplet = form.nomComplet;
    if (form.email !== initialEmail) payload.email = form.email;
    if (Object.keys(payload).length === 0) {
      toast({ title: "Aucune modification", description: "Aucun champ n'a été modifié." });
      return;
    }
    setSaving(true);
    try {
      const updated = await utilisateurApi.updateMyProfile(payload);
      setProfile(updated);
      setForm({ nomComplet: updated.nomComplet || "", email: updated.email || "" });
      toast({ title: "Profil mis à jour", description: "Vos informations ont été enregistrées." });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Modification impossible";
      toast({
        title: "Erreur",
        description: msg.includes("409") || msg.toLowerCase().includes("email") ? "Cet e-mail est déjà utilisé." : msg,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <CircleUser className="h-6 w-6 text-primary" />
            Mon profil
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Consultez et mettez à jour vos informations personnelles.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informations du compte</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center text-muted-foreground text-sm">
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Chargement…
              </div>
            ) : profile ? (
              <form onSubmit={submit} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Identifiant</Label>
                    <Input value={profile.username} disabled />
                  </div>
                  <div className="space-y-2">
                    <Label>Rôle</Label>
                    <div className="h-10 flex items-center">
                      <Badge variant="secondary">{ROLE_LABELS[profile.role] || profile.role}</Badge>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Nom complet</Label>
                  <Input
                    value={form.nomComplet}
                    onChange={(e) => setForm((p) => ({ ...p, nomComplet: e.target.value }))}
                    placeholder="Votre nom affiché"
                    maxLength={150}
                  />
                </div>

                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                    placeholder="vous@exemple.mr"
                  />
                  <p className="text-xs text-muted-foreground">
                    L'e-mail est utilisé pour la réinitialisation de mot de passe.
                  </p>
                </div>

                {(profile.entrepriseRaisonSociale || profile.autoriteContractanteNom) && (
                  <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1 text-sm">
                    <p className="font-medium text-foreground">Rattachement</p>
                    {profile.entrepriseRaisonSociale && (
                      <p className="text-muted-foreground">
                        Entreprise : <span className="text-foreground">{profile.entrepriseRaisonSociale}</span>
                      </p>
                    )}
                    {profile.autoriteContractanteNom && (
                      <p className="text-muted-foreground">
                        Autorité Contractante : <span className="text-foreground">{profile.autoriteContractanteNom}</span>
                      </p>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between pt-2">
                  <div className="text-sm">
                    {profile.actif ? (
                      <Badge className="bg-primary/10 text-primary border-primary/20">
                        <CheckCircle className="h-3 w-3 mr-1" /> Compte actif
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        <XCircle className="h-3 w-3 mr-1" /> Compte inactif
                      </Badge>
                    )}
                  </div>
                  <Button type="submit" disabled={saving}>
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? "Enregistrement…" : "Enregistrer"}
                  </Button>
                </div>
              </form>
            ) : (
              <p className="text-sm text-muted-foreground">Profil indisponible.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default MonProfil;
