import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Globe, RefreshCw, Settings } from "lucide-react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { parametreApi, formatApiErrorMessage, PARAMETRE_VALEUR_MAX, type ParametreDto } from "@/lib/api";

const Parametres = () => {
  const { t, i18n } = useTranslation("referentiel");
  const { toast } = useToast();
  const [items, setItems] = useState<ParametreDto[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const list = await parametreApi.list();
      const arr = Array.isArray(list) ? list : [];
      setItems(arr);
      setDrafts(Object.fromEntries(arr.map((p) => [p.cle, p.valeur ?? ""])));
    } catch (err) {
      toast({ title: t("parametres.error_load"), description: formatApiErrorMessage(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const save = async (p: ParametreDto) => {
    setSaving(p.cle);
    try {
      const updated = await parametreApi.update(p.cle, drafts[p.cle] ?? "");
      setItems((prev) => prev.map((x) => (x.cle === p.cle ? { ...x, ...updated } : x)));
      toast({ title: t("parametres.saved") });
    } catch (err) {
      toast({ title: t("parametres.error_save"), description: formatApiErrorMessage(err), variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  const fmt = (v?: string | null) => (v ? new Date(v).toLocaleString(i18n.language === "ar" ? "ar" : "fr-FR") : null);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Settings className="h-6 w-6 text-primary" /> {t("parametres.title")}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{t("parametres.subtitle")}</p>
        </div>
        <Card>
          <CardHeader><CardTitle className="text-base">{t("parametres.title")}</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            {loading ? (
              <div className="flex items-center text-muted-foreground text-sm"><RefreshCw className="h-4 w-4 me-2 animate-spin" /></div>
            ) : items.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("parametres.empty")}</p>
            ) : items.map((p) => {
              const value = drafts[p.cle] ?? "";
              const dirty = value !== (p.valeur ?? "");
              const tooLong = value.length > PARAMETRE_VALEUR_MAX;
              const modified = fmt(p.dateModification);
              return (
                <div key={p.cle} className="space-y-2">
                  <Label htmlFor={`param-${p.cle}`}>{p.description || p.cle}</Label>
                  <div className="flex gap-2">
                    <Input id={`param-${p.cle}`} value={value} maxLength={PARAMETRE_VALEUR_MAX}
                      onChange={(e) => setDrafts((d) => ({ ...d, [p.cle]: e.target.value }))} />
                    <Button onClick={() => save(p)} disabled={!dirty || tooLong || saving === p.cle}>
                      {saving === p.cle && <RefreshCw className="h-4 w-4 me-2 animate-spin" />}
                      {t("parametres.save")}
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {p.publique && (
                      <span className="flex items-center gap-1 text-accent-foreground"><Globe className="h-3.5 w-3.5 text-gold" />{t("parametres.public_notice")}</span>
                    )}
                    <span>{modified ? t("parametres.last_modified", { date: modified }) : t("parametres.never_modified")}</span>
                    {tooLong && <span className="text-destructive">{t("parametres.too_long", { max: PARAMETRE_VALEUR_MAX })}</span>}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Parametres;
