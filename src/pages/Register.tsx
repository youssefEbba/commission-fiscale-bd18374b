import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Check, CheckCircle2, Copy, Eye, EyeOff, Loader2, Paperclip, Search, Send } from "lucide-react";
import logo from "@/assets/logo.svg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  rattachementPublicApi, RATTACHEMENT_ROLES, typeEntiteForRole, formatApiErrorMessage,
  type RattachementRole, type EntitePubliqueDto, type DocumentRequirementDto, type DemandeRattachementDto,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { usePageTitle } from "@/hooks/usePageTitle";
import { LanguageSwitcher } from "@/i18n/LanguageSwitcher";

const ACCEPT: Record<string, string> = { PDF: ".pdf", IMAGE: ".png,.jpg,.jpeg", WORD: ".doc,.docx", EXCEL: ".xls,.xlsx" };

/**
 * Demande de rattachement publique : la personne décrit qui elle est, choisit (ou décrit) l'entité,
 * joint ses justificatifs. Aucune entité ni aucun compte n'est créé ici : c'est l'approbation du Président.
 */
const Register = () => {
  const { t } = useTranslation(["auth", "rattachement", "common"]);
  usePageTitle("auth:register.title");
  const { toast } = useToast();

  const [form, setForm] = useState({ nomComplet: "", email: "", telephone: "", username: "", password: "", confirmPassword: "" });
  const [role, setRole] = useState<RattachementRole | "">("");
  const [showPassword, setShowPassword] = useState(false);

  const [q, setQ] = useState("");
  const [results, setResults] = useState<EntitePubliqueDto[]>([]);
  const [searching, setSearching] = useState(false);
  const [entite, setEntite] = useState<EntitePubliqueDto | null>(null);
  const [absente, setAbsente] = useState(false);
  const [nouvelle, setNouvelle] = useState({ entiteNom: "", entiteSigle: "", entiteNif: "", entiteAdresse: "", entiteActivite: "", entiteMinistereTutelle: "" });

  const [pieces, setPieces] = useState<DocumentRequirementDto[]>([]);
  const [piecesError, setPiecesError] = useState(false);
  const [files, setFiles] = useState<Record<string, File>>({});
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<DemandeRattachementDto | null>(null);
  const [copied, setCopied] = useState(false);

  const typeEntite = role ? typeEntiteForRole(role) : null;

  useEffect(() => {
    rattachementPublicApi.getPieces()
      .then((p) => setPieces([...p].sort((a, b) => (a.ordreAffichage ?? 0) - (b.ordreAffichage ?? 0))))
      .catch(() => setPiecesError(true));
  }, []);

  // Changer de qualité peut changer le type d'entité : on repart d'une sélection vide.
  useEffect(() => { setEntite(null); setResults([]); setQ(""); }, [typeEntite]);

  useEffect(() => {
    if (!typeEntite || absente || entite || q.trim().length < 2) { setResults([]); return; }
    const h = setTimeout(() => {
      setSearching(true);
      rattachementPublicApi.searchEntites(typeEntite, q.trim())
        .then(setResults).catch(() => setResults([])).finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(h);
  }, [q, typeEntite, absente, entite]);

  const update = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));
  const err = (description: string) => toast({ title: t("register.errors.title"), description, variant: "destructive" });
  const pieceLabel = (p: DocumentRequirementDto) => p.libelle || p.codeDocument || p.typeDocument || "";
  const pieceCode = (p: DocumentRequirementDto) => p.codeDocument || p.typeDocument || "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 6) return err(t("register.errors.password_too_short"));
    if (form.password !== form.confirmPassword) return err(t("register.errors.passwords_dont_match"));
    if (!role || !typeEntite) return err(t("register.errors.qualite_required"));
    if (absente ? !nouvelle.entiteNom.trim() : !entite) return err(absente ? t("register.errors.entite_nom_required") : t("register.errors.entite_required"));
    const missing = pieces.find((p) => p.obligatoire && !files[pieceCode(p)]);
    if (missing) return err(t("register.errors.piece_required", { label: pieceLabel(missing) }));

    setLoading(true);
    try {
      const fields: Record<string, string | undefined> = {
        username: form.username.trim(), password: form.password, nomComplet: form.nomComplet.trim(),
        email: form.email.trim(), telephone: form.telephone.trim(), roleDemande: role, typeEntite,
        ...(absente
          ? Object.fromEntries(Object.entries(nouvelle).map(([k, v]) => [k, v.trim()]))
          : { entiteId: String(entite!.id) }),
      };
      const res = await rattachementPublicApi.submit(fields, files);
      setDone(res);
      window.scrollTo({ top: 0 });
    } catch (e2) {
      err(formatApiErrorMessage(e2, t("register.errors.submit_failed")));
    } finally {
      setLoading(false);
    }
  };

  const copyRef = async () => {
    if (!done?.reference) return;
    try { await navigator.clipboard.writeText(done.reference); setCopied(true); toast({ title: t("register.done.copied") }); setTimeout(() => setCopied(false), 2000); } catch { /* noop */ }
  };

  const header = useMemo(() => (
    <>
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
            <span className="block text-xl font-bold text-foreground">{t("common:app.ministry")}</span>
            <span className="block text-base font-semibold text-foreground/80">{t("brand.name")}</span>
            <span className="block text-xs font-medium text-accent tracking-wider uppercase">{t("brand.country")}</span>
          </div>
        </Link>
      </div>
    </>
  ), [t]);

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
        <div className="w-full max-w-lg space-y-8">
          {header}
          <div className="rounded-xl border border-border bg-card p-8 shadow-lg space-y-6 text-center">
            <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
            <h1 className="text-2xl font-bold text-foreground">{t("register.done.title")}</h1>
            <div className="rounded-lg border-2 border-accent bg-accent/10 p-5 space-y-3">
              <p className="text-sm text-muted-foreground">{t("register.done.reference_label")}</p>
              <p className="text-3xl font-bold tracking-wider text-foreground font-mono break-all" dir="ltr">{done.reference || `#${done.id}`}</p>
              <Button type="button" variant="outline" size="sm" onClick={copyRef}>
                {copied ? <Check className="h-4 w-4 me-1" /> : <Copy className="h-4 w-4 me-1" />}{t("register.done.copy")}
              </Button>
              <p className="text-xs text-muted-foreground">{t("register.done.keep")}</p>
            </div>
            <div className="text-start space-y-2">
              <p className="font-semibold text-foreground">{t("register.done.next_title")}</p>
              <ol className="list-decimal ps-5 space-y-1 text-sm text-muted-foreground">
                <li>{t("register.done.next_1")}</li>
                <li>{t("register.done.next_2", { email: done.email || form.email })}</li>
                <li>{t("register.done.next_3")}</li>
              </ol>
            </div>
            <Button asChild className="w-full"><Link to="/">{t("register.done.back_home")}</Link></Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-xl space-y-8">
        {header}
        <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card p-8 shadow-lg space-y-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground mb-2">{t("register.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("register.subtitle")}</p>
          </div>

          {/* 1. Entité */}
          <section className="space-y-4">
            <h2 className="font-semibold text-foreground border-b border-border pb-1">{t("register.section_entite")}</h2>
            <div className="space-y-2">
              <Label>{t("register.qualite")} *</Label>
              <Select value={role} onValueChange={(v) => setRole(v as RattachementRole)}>
                <SelectTrigger><SelectValue placeholder={t("register.qualite_placeholder")} /></SelectTrigger>
                <SelectContent>
                  {RATTACHEMENT_ROLES.map((r) => <SelectItem key={r} value={r}>{t(`rattachement:roles.${r}`)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {typeEntite && (
              <>
                {!absente && (
                  entite ? (
                    <div className="flex items-center justify-between gap-2 rounded-md border border-primary/40 bg-primary/5 p-3">
                      <div>
                        <p className="text-xs text-muted-foreground">{t("register.entite_selected")} — {t(`rattachement:type_entite.${typeEntite}`)}</p>
                        <p className="font-medium text-foreground">{entite.nom}</p>
                      </div>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setEntite(null)}>{t("register.entite_change")}</Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label>{t("register.entite_search")} *</Label>
                      <div className="relative">
                        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input className="ps-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("register.entite_search_placeholder")} />
                        {searching && <Loader2 className="absolute end-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
                      </div>
                      {q.trim().length >= 2 && !searching && (
                        <div className="rounded-md border border-border max-h-56 overflow-auto">
                          {results.length === 0
                            ? <p className="p-3 text-sm text-muted-foreground">{t("register.entite_none")}</p>
                            : results.map((r) => (
                              <button type="button" key={r.id} onClick={() => setEntite(r)} className="block w-full text-start px-3 py-2 text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none">
                                {r.nom}
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  )
                )}

                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={absente} onCheckedChange={(c) => { setAbsente(!!c); setEntite(null); }} />
                  {t("register.entite_absente")}
                </label>

                {absente && (
                  <div className="space-y-3 rounded-md border border-border bg-muted/30 p-4">
                    <p className="text-xs text-muted-foreground">{t("register.entite_absente_hint")}</p>
                    <div className="space-y-1"><Label>{t("register.e_nom")} *</Label><Input value={nouvelle.entiteNom} onChange={(e) => setNouvelle((p) => ({ ...p, entiteNom: e.target.value }))} required /></div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1"><Label>{t("register.e_sigle")}</Label><Input value={nouvelle.entiteSigle} onChange={(e) => setNouvelle((p) => ({ ...p, entiteSigle: e.target.value }))} /></div>
                      <div className="space-y-1"><Label>{t("register.e_nif")}</Label><Input value={nouvelle.entiteNif} onChange={(e) => setNouvelle((p) => ({ ...p, entiteNif: e.target.value }))} /></div>
                    </div>
                    <div className="space-y-1"><Label>{t("register.e_adresse")}</Label><Input value={nouvelle.entiteAdresse} onChange={(e) => setNouvelle((p) => ({ ...p, entiteAdresse: e.target.value }))} /></div>
                    {typeEntite === "ENTREPRISE"
                      ? <div className="space-y-1"><Label>{t("register.e_activite")}</Label><Input value={nouvelle.entiteActivite} onChange={(e) => setNouvelle((p) => ({ ...p, entiteActivite: e.target.value }))} /></div>
                      : <div className="space-y-1"><Label>{t("register.e_ministere")}</Label><Input value={nouvelle.entiteMinistereTutelle} onChange={(e) => setNouvelle((p) => ({ ...p, entiteMinistereTutelle: e.target.value }))} /></div>}
                  </div>
                )}
              </>
            )}
          </section>

          {/* 2. Personne */}
          <section className="space-y-4">
            <h2 className="font-semibold text-foreground border-b border-border pb-1">{t("register.section_compte")}</h2>
            <div className="space-y-1"><Label htmlFor="nomComplet">{t("register.nom_complet")} *</Label><Input id="nomComplet" value={form.nomComplet} onChange={(e) => update("nomComplet", e.target.value)} required /></div>
            <div className="space-y-1">
              <Label htmlFor="email">{t("register.email")} *</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => update("email", e.target.value)} required />
              <p className="text-xs text-muted-foreground">{t("register.email_hint")}</p>
            </div>
            <div className="space-y-1"><Label htmlFor="tel">{t("register.telephone")}</Label><Input id="tel" type="tel" value={form.telephone} onChange={(e) => update("telephone", e.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="reg-username">{t("register.username")} *</Label><Input id="reg-username" value={form.username} onChange={(e) => update("username", e.target.value)} autoComplete="username" required /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="pwd">{t("register.password")} *</Label>
                <div className="relative">
                  <Input id="pwd" type={showPassword ? "text" : "password"} value={form.password} onChange={(e) => update("password", e.target.value)} autoComplete="new-password" required className="pe-10" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-label={t("login.toggle_password_show")}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1"><Label htmlFor="pwd2">{t("register.confirm_password")} *</Label><Input id="pwd2" type={showPassword ? "text" : "password"} value={form.confirmPassword} onChange={(e) => update("confirmPassword", e.target.value)} autoComplete="new-password" required /></div>
            </div>
          </section>

          {/* 3. Justificatifs */}
          <section className="space-y-3">
            <h2 className="font-semibold text-foreground border-b border-border pb-1">{t("register.section_pieces")}</h2>
            {piecesError && <p className="text-sm text-destructive">{t("register.pieces_error")}</p>}
            {pieces.map((p) => {
              const code = pieceCode(p);
              const f = files[code];
              const accept = (p.typesAutorises || []).map((x) => ACCEPT[x]).filter(Boolean).join(",");
              return (
                <div key={code} className={`rounded-md border p-3 space-y-2 ${p.obligatoire ? "border-accent" : "border-border"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-foreground">{pieceLabel(p)}</span>
                    <Badge variant={p.obligatoire ? "default" : "secondary"}>{p.obligatoire ? t("register.obligatoire") : t("register.facultatif")}</Badge>
                  </div>
                  <label className="flex items-center gap-2 text-sm cursor-pointer text-primary hover:underline">
                    <Paperclip className="h-4 w-4" />
                    <span className="truncate">{f ? f.name : t("register.choose_file")}</span>
                    <input type="file" className="sr-only" accept={accept || undefined}
                      onChange={(e) => { const file = e.target.files?.[0]; setFiles((prev) => { const n = { ...prev }; if (file) n[code] = file; else delete n[code]; return n; }); }} />
                  </label>
                  {!!p.typesAutorises?.length && <p className="text-xs text-muted-foreground">{t("register.formats", { formats: p.typesAutorises.join(", ") })}</p>}
                </div>
              );
            })}
          </section>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Send className="h-4 w-4 me-2 rtl:rotate-180" />}
            {loading ? t("register.submitting") : t("register.submit")}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            {t("register.have_account")}{" "}
            <Link to="/login" className="text-primary hover:underline font-medium">{t("register.login")}</Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default Register;
