import { motion } from "framer-motion";
import { Upload, Search, CheckCircle2, FileOutput } from "lucide-react";

const steps = [
  { num: "01", title: "Soumission", desc: "Créez votre dossier et déposez les pièces nécessaires en ligne.", icon: Upload },
  { num: "02", title: "Vérification", desc: "Les services vérifient la conformité et la complétude des informations.", icon: Search },
  { num: "03", title: "Validation", desc: "La Commission valide et notifie la décision avec traçabilité.", icon: CheckCircle2 },
  { num: "04", title: "Émission", desc: "Le certificat est émis et mis à disposition dans votre espace.", icon: FileOutput },
];

const ProcessSection = () => (
  <section id="processus" className="py-20 md:py-28">
    <div className="mx-auto max-w-7xl px-6">
      <div className="mb-16 text-center">
        <span className="mb-3 inline-block text-xs font-bold uppercase tracking-widest text-primary">Processus simple</span>
        <h2 className="text-3xl font-extrabold text-foreground md:text-4xl">Comment ça fonctionne ?</h2>
        <p className="mt-4 text-muted-foreground">Un processus en 4 étapes pour soumettre et suivre votre demande de crédit d'impôt.</p>
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
            <h3 className="mb-2 text-lg font-bold text-foreground">{s.title}</h3>
            <p className="text-sm text-muted-foreground">{s.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default ProcessSection;
