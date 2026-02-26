import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { UserPlus, Eye, EyeOff, Building2 } from "lucide-react";
import logo from "@/assets/logo.svg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { authApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const ROLES = [
  { value: "ENTREPRISE", label: "Entreprise" },
  { value: "AUTORITE_CONTRACTANTE", label: "Autorité Contractante" },
  { value: "DGD", label: "DGD - Direction Générale des Douanes" },
  { value: "DGI", label: "DGI - Direction Générale des Impôts" },
  { value: "DGTCP", label: "DGTCP - Trésor Public" },
  { value: "DGB", label: "DGB - Direction Générale du Budget" },
  { value: "PRESIDENT", label: "Président de la Commission" },
];

const Register = () => {
  const [form, setForm] = useState({
    username: "",
    password: "",
    confirmPassword: "",
    nomComplet: "",
    email: "",
    role: "",
    entrepriseId: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // New entreprise fields
  const [newEntreprise, setNewEntreprise] = useState({
    raisonSociale: "",
    nif: "",
    adresse: "",
    telephone: "",
    email: "",
  });

  // New AC fields
  const [newAC, setNewAC] = useState({
    nom: "",
    sigle: "",
    adresse: "",
    telephone: "",
    email: "",
  });


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      toast({ title: "Erreur", description: "Les mots de passe ne correspondent pas", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const registerData: any = {
        username: form.username,
        password: form.password,
        role: form.role,
        nomComplet: form.nomComplet,
        email: form.email,
      };

      if (form.role === "ENTREPRISE") {
        if (!newEntreprise.raisonSociale || !newEntreprise.nif) {
          toast({ title: "Erreur", description: "Raison sociale et NIF sont obligatoires", variant: "destructive" });
          setLoading(false);
          return;
        }
        registerData.entrepriseRaisonSociale = newEntreprise.raisonSociale;
        registerData.entrepriseNif = newEntreprise.nif;
        registerData.entrepriseAdresse = newEntreprise.adresse;
        registerData.entrepriseSituationFiscale = "";
      }

      if (form.role === "AUTORITE_CONTRACTANTE") {
        if (!newAC.nom) {
          toast({ title: "Erreur", description: "Le nom de l'Autorité Contractante est obligatoire", variant: "destructive" });
          setLoading(false);
          return;
        }
        registerData.acNom = newAC.nom;
        registerData.acSigle = newAC.sigle;
        registerData.acAdresse = newAC.adresse;
        registerData.acTelephone = newAC.telephone;
        registerData.acEmail = newAC.email;
      }

      await authApi.register(registerData);

      toast({ title: "Inscription réussie", description: "Votre compte a été créé. Veuillez attendre la validation par un administrateur avant de vous connecter." });
      navigate("/login");
    } catch (err: unknown) {
      toast({
        title: "Erreur d'inscription",
        description: err instanceof Error ? err.message : "Impossible de créer le compte",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const update = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));
  const updateEntreprise = (field: string, value: string) => setNewEntreprise((prev) => ({ ...prev, [field]: value }));
  const updateAC = (field: string, value: string) => setNewAC((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Link to="/" className="inline-flex items-center gap-2">
            <img src={logo} alt="Commission Fiscale" className="h-12 w-12" />
            <div className="text-left leading-tight">
              <span className="block text-lg font-bold text-foreground">Commission Fiscale</span>
              <span className="block text-xs font-medium text-accent tracking-wider uppercase">Mauritanie</span>
            </div>
          </Link>
        </div>

        <div className="rounded-xl border border-border bg-card p-8 shadow-lg">
          <h1 className="text-2xl font-bold text-foreground text-center mb-2">Inscription</h1>
          <p className="text-muted-foreground text-center text-sm mb-6">
            Créez votre compte pour accéder à la plateforme
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nomComplet">Nom complet</Label>
              <Input id="nomComplet" value={form.nomComplet} onChange={(e) => update("nomComplet", e.target.value)} placeholder="Prénom et nom" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="votre@email.mr" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reg-username">Nom d'utilisateur</Label>
              <Input id="reg-username" value={form.username} onChange={(e) => update("username", e.target.value)} placeholder="Identifiant de connexion" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Rôle</Label>
              <Select value={form.role} onValueChange={(v) => update("role", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionnez votre rôle" />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {form.role === "ENTREPRISE" && (
              <div className="space-y-3 rounded-lg border border-border p-4 bg-muted/30">
                <div className="flex items-center gap-2 mb-1">
                  <Building2 className="h-4 w-4 text-primary" />
                  <Label className="text-sm font-semibold">Informations de l'entreprise</Label>
                </div>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Raison sociale *</Label>
                    <Input value={newEntreprise.raisonSociale} onChange={(e) => updateEntreprise("raisonSociale", e.target.value)} placeholder="Nom de l'entreprise" required />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">NIF *</Label>
                    <Input value={newEntreprise.nif} onChange={(e) => updateEntreprise("nif", e.target.value)} placeholder="Numéro d'identification fiscale" required />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Adresse</Label>
                    <Input value={newEntreprise.adresse} onChange={(e) => updateEntreprise("adresse", e.target.value)} placeholder="Adresse" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Téléphone</Label>
                      <Input value={newEntreprise.telephone} onChange={(e) => updateEntreprise("telephone", e.target.value)} placeholder="+222..." />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Email entreprise</Label>
                      <Input type="email" value={newEntreprise.email} onChange={(e) => updateEntreprise("email", e.target.value)} placeholder="contact@..." />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {form.role === "AUTORITE_CONTRACTANTE" && (
              <div className="space-y-3 rounded-lg border border-border p-4 bg-muted/30">
                <div className="flex items-center gap-2 mb-1">
                  <Building2 className="h-4 w-4 text-primary" />
                  <Label className="text-sm font-semibold">Informations de l'Autorité Contractante</Label>
                </div>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Nom de l'AC *</Label>
                    <Input value={newAC.nom} onChange={(e) => updateAC("nom", e.target.value)} placeholder="Nom de l'autorité contractante" required />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Sigle</Label>
                    <Input value={newAC.sigle} onChange={(e) => updateAC("sigle", e.target.value)} placeholder="Ex: MAEP, MEN..." />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Adresse</Label>
                    <Input value={newAC.adresse} onChange={(e) => updateAC("adresse", e.target.value)} placeholder="Adresse" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Téléphone</Label>
                      <Input value={newAC.telephone} onChange={(e) => updateAC("telephone", e.target.value)} placeholder="+222..." />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Email AC</Label>
                      <Input type="email" value={newAC.email} onChange={(e) => updateAC("email", e.target.value)} placeholder="contact@..." />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="reg-password">Mot de passe</Label>
              <div className="relative">
                <Input
                  id="reg-password"
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => update("password", e.target.value)}
                  placeholder="••••••••"
                  required
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
              <Input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                value={form.confirmPassword}
                onChange={(e) => update("confirmPassword", e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={loading || !form.role}>
              <UserPlus className="h-4 w-4 mr-2" />
              {loading ? "Inscription..." : "S'inscrire"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Déjà un compte ?{" "}
            <Link to="/login" className="text-primary font-medium hover:underline">
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
