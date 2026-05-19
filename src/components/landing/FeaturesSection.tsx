import { motion } from "framer-motion";
import { Activity, Zap, ShieldCheck, Bell, FolderOpen, ClipboardList } from "lucide-react";
import { useTranslation } from "react-i18next";

const FeaturesSection = () => {
  const { t } = useTranslation("landing");
  const features = [
    { icon: Activity, key: "realtime" },
    { icon: Zap, key: "fast" },
    { icon: ShieldCheck, key: "secure" },
    { icon: Bell, key: "notifications" },
    { icon: FolderOpen, key: "documents" },
    { icon: ClipboardList, key: "audit" },
  ];

  return (
    <section id="fonctionnalites" className="bg-secondary/40 py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-16 text-center">
          <span className="mb-3 inline-block text-xs font-bold uppercase tracking-widest text-primary">{t("features.kicker")}</span>
          <h2 className="text-3xl font-extrabold text-foreground md:text-4xl">{t("features.title")}</h2>
          <p className="mt-4 text-muted-foreground">{t("features.subtitle")}</p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <motion.div
              key={f.key}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="group rounded-2xl border border-border bg-card p-6 transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mb-2 text-base font-bold text-foreground">{t(`features.items.${f.key}.title`)}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{t(`features.items.${f.key}.desc`)}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
