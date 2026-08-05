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
import SignatureManager from "@/components/signatures/SignatureManager";
import { CircleUser, Save, RefreshCw, CheckCircle, XCircle, KeyRound, Eye, EyeOff } from "lucide-react";

const SIGNATAIRE_ROLES = ["PRESIDENT", "DGD", "DGI", "DGTCP", "DGB", "ADMIN_SI"];


const MonProfil = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [profile, setProfile] = useState<UtilisateurDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ nomComplet: "", email: "" });
  const [pwdForm, setPwdForm] = useState({ current: "", next: "", confirm: "" });
  const [pwdSaving, setPwdSaving] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwdForm.current || !pwdForm.next) {
      toast({ title: "Champs requis", description: "Renseignez tous les champs.", variant: "destructive" });
      return;
    }
    if (pwdForm.next.length < 8) {
      toast({ title: "Mot de passe trop court", description: "Minimum 8 caractères.", variant: "destructive" });
      return;
    }
    if (pwdForm.next === pwdForm.current) {
      toast({ title: "Mot de passe identique", description: "Le nouveau mot de passe doit être différent.", variant: "destructive" });
      return;
    }
    if (pwdForm.next !== pwdForm.confirm) {
      toast({ title: "Confirmation invalide", description: "Les deux mots de passe ne correspondent pas.", variant: "destructive" });
      return;
    }
    setPwdSaving(true);
    try {
      await utilisateurApi.changeMyPassword(pwdForm.current, pwdForm.next);
      toast({ title: "Mot de passe modifié", description: "Votre mot de passe a été mis à jour." });
      setPwdForm({ current: "", next: "", confirm: "" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Impossible de modifier le mot de passe";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally {
      setPwdSaving(false);
    }
  };

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

        {profile && SIGNATAIRE_ROLES.includes(profile.role) && (
          <SignatureManager
            role={profile.role}
            utilisateurId={profile.id}
            utilisateurNom={profile.nomComplet}
            title="Ma signature"
            description="Cette image PNG (fond transparent) sera apposée automatiquement sur les documents que vous générez : certificat de crédit, lettre d'adoption, documents d'utilisation."
          />
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" />
              Changer mon mot de passe
            </CardTitle>

          </CardHeader>
          <CardContent>
            <form onSubmit={submitPassword} className="space-y-5">
              <div className="space-y-2">
                <Label>Mot de passe actuel</Label>
                <div className="relative">
                  <Input
                    type={showCurrent ? "text" : "password"}
                    autoComplete="current-password"
                    value={pwdForm.current}
                    onChange={(e) => setPwdForm((p) => ({ ...p, current: e.target.value }))}
                    className="pr-10"
                  />
                  <button type="button" onClick={() => setShowCurrent((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nouveau mot de passe</Label>
                  <div className="relative">
                    <Input
                      type={showNext ? "text" : "password"}
                      autoComplete="new-password"
                      value={pwdForm.next}
                      onChange={(e) => setPwdForm((p) => ({ ...p, next: e.target.value }))}
                      className="pr-10"
                    />
                    <button type="button" onClick={() => setShowNext((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showNext ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">Minimum 8 caractères, différent de l'actuel.</p>
                </div>
                <div className="space-y-2">
                  <Label>Confirmer</Label>
                  <div className="relative">
                    <Input
                      type={showConfirm ? "text" : "password"}
                      autoComplete="new-password"
                      value={pwdForm.confirm}
                      onChange={(e) => setPwdForm((p) => ({ ...p, confirm: e.target.value }))}
                      className="pr-10"
                    />
                    <button type="button" onClick={() => setShowConfirm((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={pwdSaving}>
                  <KeyRound className="h-4 w-4 mr-2" />
                  {pwdSaving ? "Modification…" : "Modifier le mot de passe"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default MonProfil;
