import { motion } from "framer-motion";
import { Upload, Search, CheckCircle2, FileOutput } from "lucide-react";
import { useTranslation } from "react-i18next";

const ProcessSection = () => {
  const { t } = useTranslation("landing");
  const steps = [
    { num: "01", key: "submission", icon: Upload },
    { num: "02", key: "verification", icon: Search },
    { num: "03", key: "validation", icon: CheckCircle2 },
    { num: "04", key: "emission", icon: FileOutput },
  ];

  return (
    <section id="processus" className="py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-16 text-center">
          <span className="mb-3 inline-block text-xs font-bold uppercase tracking-widest text-primary">{t("process.kicker")}</span>
          <h2 className="text-3xl font-extrabold text-foreground md:text-4xl">{t("process.title")}</h2>
          <p className="mt-4 text-muted-foreground">{t("process.subtitle")}</p>
        </div>

        <div className="grid gap-8 md:grid-cols-4">
          {steps.map((s, i) => (
            <motion.div
              key={s.num}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="group relative rounded-2xl border border-border bg-card p-6 text-center transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
            >
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <s.icon className="h-6 w-6" />
              </div>
              <span className="mb-2 block text-xs font-bold text-gold">{s.num}</span>
              <h3 className="mb-2 text-lg font-bold text-foreground">{t(`process.steps.${s.key}.title`)}</h3>
              <p className="text-sm text-muted-foreground">{t(`process.steps.${s.key}.desc`)}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProcessSection;
