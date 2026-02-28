import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { LogIn, Eye, EyeOff, ArrowLeft, AlertCircle } from "lucide-react";
import logo from "@/assets/logo.svg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

const API_BASE = "https://63eb-2605-59c0-49ed-9e08-f1d5-e0ac-3fc6-77f5.ngrok-free.app/api";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        let msg = "Identifiants incorrects";
        try {
          const json = JSON.parse(body);
          if (json.error) msg = json.error;
          if (json.message) msg = json.message;
        } catch { /* use default */ }

        // Detect "not validated" case
        const lower = msg.toLowerCase();
        if (lower.includes("valid") || lower.includes("activ") || lower.includes("approuv") || lower.includes("disabled")) {
          setError("Votre compte n'est pas encore validé par un administrateur. Veuillez patienter.");
        } else {
          setError("Nom d'utilisateur ou mot de passe incorrect.");
        }
        return;
      }

      const data = await res.json();
      login(data);
      toast({ title: "Connexion réussie", description: `Bienvenue, ${data.nomComplet || data.username}` });
      navigate("/dashboard");
    } catch {
      setError("Impossible de contacter le serveur. Vérifiez votre connexion.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Accueil
          </Link>
        </div>
        {/* Logo */}
        <div className="text-center">
          <Link to="/" className="inline-flex items-center gap-2">
            <img src={logo} alt="Commission Fiscale" className="h-12 w-12" />
            <div className="text-left leading-tight">
              <span className="block text-lg font-bold text-foreground">Commission Fiscale</span>
              <span className="block text-xs font-medium text-accent tracking-wider uppercase">Mauritanie</span>
            </div>
          </Link>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-border bg-card p-8 shadow-lg">
          <h1 className="text-2xl font-bold text-foreground text-center mb-2">Connexion</h1>
          <p className="text-muted-foreground text-center text-sm mb-6">
            Accédez à votre espace de gestion des crédits d'impôt
          </p>

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username">Nom d'utilisateur</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Votre identifiant"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={loading}>
              <LogIn className="h-4 w-4 mr-2" />
              {loading ? "Connexion..." : "Se connecter"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Pas encore de compte ?{" "}
            <Link to="/register" className="text-primary font-medium hover:underline">
              S'inscrire
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
