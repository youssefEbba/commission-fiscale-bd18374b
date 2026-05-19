import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { UserPlus, Eye, EyeOff, Building2, ArrowLeft } from "lucide-react";
import logo from "@/assets/logo.svg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { authApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { usePageTitle } from "@/hooks/usePageTitle";
import { LanguageSwitcher } from "@/i18n/LanguageSwitcher";

const Register = () => {
  const { t } = useTranslation("auth");
  usePageTitle("auth:register.title");

  const ROLES = [
    { value: "AUTORITE_CONTRACTANTE", label: t("roles.AUTORITE_CONTRACTANTE") },
    { value: "ENTREPRISE", label: t("roles.ENTREPRISE") },
  ];

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

  const [phoneError, setPhoneError] = useState("");
  const [newEntreprise, setNewEntreprise] = useState({
    raisonSociale: "",
    nomCommercial: "",
    nif: "",
    adresse: "",
    telephone: "",
    email: "",
    activite: "",
    autre: "",
  });

  const [newAC, setNewAC] = useState({
    nom: "",
    sigle: "",
    adresse: "",
    telephone: "",
    email: "",
  });

  const validatePhone = (phone: string) => {
    if (!phone) return "";
    const cleaned = phone.replace(/\s/g, "");
    if (!/^[234]\d{7}$/.test(cleaned)) {
      return t("register.errors.phone_invalid");
    }
    return "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      toast({ title: t("register.errors.title"), description: t("register.errors.passwords_dont_match"), variant: "destructive" });
      return;
    }
    if (form.password.length < 6) {
      toast({ title: t("register.errors.title"), description: t("register.errors.password_too_short"), variant: "destructive" });
      return;
    }
    const entPhone = form.role === "ENTREPRISE" ? validatePhone(newEntreprise.telephone) : "";
    const acPhone = form.role === "AUTORITE_CONTRACTANTE" ? validatePhone(newAC.telephone) : "";
    if (entPhone || acPhone) {
      toast({ title: t("register.errors.title"), description: entPhone || acPhone, variant: "destructive" });
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
          toast({ title: t("register.errors.title"), description: t("register.errors.entreprise_required"), variant: "destructive" });
          setLoading(false);
          return;
        }
        registerData.entrepriseRaisonSociale = newEntreprise.raisonSociale;
        registerData.entrepriseNif = newEntreprise.nif;
        registerData.entrepriseAdresse = newEntreprise.adresse;
        registerData.entrepriseSituationFiscale = "";
        if (newEntreprise.nomCommercial) registerData.entrepriseNomCommercial = newEntreprise.nomCommercial;
        if (newEntreprise.activite) registerData.entrepriseActivite = newEntreprise.activite;
        if (newEntreprise.autre) registerData.entrepriseAutre = newEntreprise.autre;
      }

      if (form.role === "AUTORITE_CONTRACTANTE") {
        if (!newAC.nom) {
          toast({ title: t("register.errors.title"), description: t("register.errors.ac_required"), variant: "destructive" });
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

      toast({ title: t("register.success_title"), description: t("register.success_description") });
      navigate("/login");
    } catch (err: unknown) {
      toast({
        title: t("register.errors.register_failed_title"),
        description: err instanceof Error ? err.message : t("register.errors.register_failed_default"),
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
        <div className="flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
            {t("back_home")}
          </Link>
          <LanguageSwitcher variant="compact" />
        </div>
        <div className="text-center">
          <Link to="/" className="inline-flex items-center gap-2">
            <img src={logo} alt={t("brand.name")} className="h-12 w-12" />
            <div className="text-start leading-tight">
              <span className="block text-lg font-bold text-foreground">{t("brand.name")}</span>
              <span className="block text-xs font-medium text-accent tracking-wider uppercase">{t("brand.country")}</span>
            </div>
          </Link>
        </div>

        <div className="rounded-xl border border-border bg-card p-8 shadow-lg">
          <h1 className="text-2xl font-bold text-foreground text-center mb-2">{t("register.title")}</h1>
          <p className="text-muted-foreground text-center text-sm mb-6">
            {t("register.subtitle")}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nomComplet">{t("register.nom_complet")}</Label>
              <Input id="nomComplet" value={form.nomComplet} onChange={(e) => update("nomComplet", e.target.value)} placeholder={t("register.nom_complet_placeholder")} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{t("register.email")}</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder={t("register.email_placeholder")} required pattern="[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}" title={t("register.email_title")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reg-username">{t("register.username")}</Label>
              <Input id="reg-username" value={form.username} onChange={(e) => update("username", e.target.value)} placeholder={t("register.username_placeholder")} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">{t("register.role")}</Label>
              <Select value={form.role} onValueChange={(v) => update("role", v)}>
                <SelectTrigger>
                  <SelectValue placeholder={t("register.role_placeholder")} />
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
                  <Label className="text-sm font-semibold">{t("register.entreprise.title")}</Label>
                </div>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">{t("register.entreprise.raison_sociale")}</Label>
                    <Input value={newEntreprise.raisonSociale} onChange={(e) => updateEntreprise("raisonSociale", e.target.value)} placeholder={t("register.entreprise.raison_sociale_placeholder")} required />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t("register.entreprise.nom_commercial")}</Label>
                    <Input value={newEntreprise.nomCommercial} onChange={(e) => updateEntreprise("nomCommercial", e.target.value)} placeholder={t("register.entreprise.nom_commercial_placeholder")} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t("register.entreprise.nif")}</Label>
                    <Input value={newEntreprise.nif} onChange={(e) => updateEntreprise("nif", e.target.value)} placeholder={t("register.entreprise.nif_placeholder")} required />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t("register.entreprise.activite")}</Label>
                    <Input value={newEntreprise.activite} onChange={(e) => updateEntreprise("activite", e.target.value)} placeholder={t("register.entreprise.activite_placeholder")} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t("register.entreprise.adresse")}</Label>
                    <Input value={newEntreprise.adresse} onChange={(e) => updateEntreprise("adresse", e.target.value)} placeholder={t("register.entreprise.adresse_placeholder")} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">{t("register.entreprise.telephone")}</Label>
                      <Input value={newEntreprise.telephone} onChange={(e) => { updateEntreprise("telephone", e.target.value); setPhoneError(validatePhone(e.target.value)); }} placeholder={t("register.entreprise.telephone_placeholder")} pattern="[234]\d{7}" title={t("register.entreprise.telephone_title")} maxLength={8} />
                      {phoneError && newEntreprise.telephone && <p className="text-xs text-destructive">{phoneError}</p>}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t("register.entreprise.email")}</Label>
                      <Input type="email" value={newEntreprise.email} onChange={(e) => updateEntreprise("email", e.target.value)} placeholder={t("register.entreprise.email_placeholder")} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t("register.entreprise.autre")}</Label>
                    <Input value={newEntreprise.autre} onChange={(e) => updateEntreprise("autre", e.target.value)} placeholder={t("register.entreprise.autre_placeholder")} maxLength={2000} />
                  </div>
                </div>
              </div>
            )}

            {form.role === "AUTORITE_CONTRACTANTE" && (
              <div className="space-y-3 rounded-lg border border-border p-4 bg-muted/30">
                <div className="flex items-center gap-2 mb-1">
                  <Building2 className="h-4 w-4 text-primary" />
                  <Label className="text-sm font-semibold">{t("register.ac.title")}</Label>
                </div>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">{t("register.ac.nom")}</Label>
                    <Input value={newAC.nom} onChange={(e) => updateAC("nom", e.target.value)} placeholder={t("register.ac.nom_placeholder")} required />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t("register.ac.sigle")}</Label>
                    <Input value={newAC.sigle} onChange={(e) => updateAC("sigle", e.target.value)} placeholder={t("register.ac.sigle_placeholder")} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t("register.ac.adresse")}</Label>
                    <Input value={newAC.adresse} onChange={(e) => updateAC("adresse", e.target.value)} placeholder={t("register.ac.adresse_placeholder")} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">{t("register.ac.telephone")}</Label>
                      <Input value={newAC.telephone} onChange={(e) => { updateAC("telephone", e.target.value); setPhoneError(validatePhone(e.target.value)); }} placeholder={t("register.ac.telephone_placeholder")} pattern="[234]\d{7}" title={t("register.entreprise.telephone_title")} maxLength={8} />
                      {phoneError && newAC.telephone && <p className="text-xs text-destructive">{phoneError}</p>}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t("register.ac.email")}</Label>
                      <Input type="email" value={newAC.email} onChange={(e) => updateAC("email", e.target.value)} placeholder={t("register.ac.email_placeholder")} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="reg-password">{t("register.password")}</Label>
              <div className="relative">
                <Input
                  id="reg-password"
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => update("password", e.target.value)}
                  placeholder={t("register.password_placeholder")}
                  required
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? t("login.toggle_password_hide") : t("login.toggle_password_show")} className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t("register.confirm_password")}</Label>
              <Input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                value={form.confirmPassword}
                onChange={(e) => update("confirmPassword", e.target.value)}
                placeholder={t("register.password_placeholder")}
                required
              />
            </div>

            <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={loading || !form.role}>
              <UserPlus className="h-4 w-4 me-2" />
              {loading ? t("register.submitting") : t("register.submit")}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            {t("register.have_account")}{" "}
            <Link to="/login" className="text-primary font-medium hover:underline">
              {t("register.login")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
