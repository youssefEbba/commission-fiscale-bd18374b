import { BookOpen, FileSpreadsheet, FileText, Scale, Download } from "lucide-react";
import { useTranslation } from "react-i18next";

type Doc = { key: string; icon: typeof FileText; href?: string };

// Renseigner `href` quand le fichier officiel est disponible.
const texts: Doc[] = [
  { key: "cgi", icon: Scale },
  { key: "cgd", icon: Scale },
  { key: "textes", icon: FileText },
  { key: "manuel", icon: BookOpen },
];
const forms: Doc[] = [
  { key: "ef1", icon: FileSpreadsheet },
  { key: "ef2", icon: FileSpreadsheet },
];

const DocumentationSection = () => {
  const { t } = useTranslation("landing");

  const Item = ({ d }: { d: Doc }) => (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <d.icon className="h-5 w-5 text-primary" />
        </div>
        <span className="text-sm font-semibold text-foreground">{t(`docs.items.${d.key}`)}</span>
      </div>
      {d.href ? (
        <a href={d.href} download className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
          <Download className="h-4 w-4" /> {t("docs.download")}
        </a>
      ) : (
        <span className="shrink-0 text-xs text-muted-foreground">{t("docs.coming_soon")}</span>
      )}
    </div>
  );

  return (
    <section id="documentation" className="py-20 bg-muted/30">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-12 text-center">
          <p className="mb-2 text-sm font-bold uppercase tracking-wider text-accent">{t("docs.kicker")}</p>
          <h2 className="mb-4 text-3xl font-extrabold text-foreground md:text-4xl">{t("docs.title")}</h2>
          <p className="mx-auto max-w-2xl text-muted-foreground">{t("docs.subtitle")}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {texts.map((d) => <Item key={d.key} d={d} />)}
        </div>
        <h3 className="mb-4 mt-10 text-lg font-bold text-foreground">{t("docs.group_forms")}</h3>
        <div className="grid gap-4 md:grid-cols-2">
          {forms.map((d) => <Item key={d.key} d={d} />)}
        </div>
      </div>
    </section>
  );
};

export default DocumentationSection;
