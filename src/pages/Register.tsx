import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Shield, UserPlus, Eye, EyeOff } from "lucide-react";
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      toast({ title: "Erreur", description: "Les mots de passe ne correspondent pas", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.register({
        username: form.username,
        password: form.password,
        role: form.role,
        nomComplet: form.nomComplet,
        email: form.email,
        ...(form.role === "ENTREPRISE" && form.entrepriseId ? { entrepriseId: Number(form.entrepriseId) } : {}),
      });
      login(res);
      toast({ title: "Inscription réussie", description: "Votre compte a été créé avec succès" });
      navigate("/dashboard");
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Link to="/" className="inline-flex items-center gap-2">
            <Shield className="h-10 w-10 text-primary" />
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
              <div className="space-y-2">
                <Label htmlFor="entrepriseId">ID Entreprise</Label>
                <Input id="entrepriseId" type="number" value={form.entrepriseId} onChange={(e) => update("entrepriseId", e.target.value)} placeholder="Identifiant de l'entreprise" required />
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
