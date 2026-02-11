import { motion } from "framer-motion";
import { Activity, Zap, ShieldCheck, Bell, FolderOpen, ClipboardList } from "lucide-react";

const features = [
  { icon: Activity, title: "Suivi en temps réel", desc: "Suivez l'état de vos demandes à chaque étape du workflow." },
  { icon: Zap, title: "Traitement rapide", desc: "Circuits de validation optimisés pour réduire les délais." },
  { icon: ShieldCheck, title: "Sécurité renforcée", desc: "Accès sécurisé et gestion des rôles (DGD, DGI, DGB, Trésor…)." },
  { icon: Bell, title: "Notifications", desc: "Recevez des notifications sur les validations, rejets et mises à jour." },
  { icon: FolderOpen, title: "Gestion des documents", desc: "Déposez, consultez et téléchargez les pièces justificatives." },
  { icon: ClipboardList, title: "Audit & traçabilité", desc: "Historique des actions et traçabilité complète des opérations." },
];

const FeaturesSection = () => (
  <section id="fonctionnalites" className="bg-secondary/40 py-20 md:py-28">
    <div className="mx-auto max-w-7xl px-6">
      <div className="mb-16 text-center">
        <span className="mb-3 inline-block text-xs font-bold uppercase tracking-widest text-primary">Fonctionnalités</span>
        <h2 className="text-3xl font-extrabold text-foreground md:text-4xl">Une plateforme moderne et performante</h2>
        <p className="mt-4 text-muted-foreground">Des outils pensés pour réduire les délais, améliorer la transparence et sécuriser vos opérations.</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: i * 0.08 }}
            className="group rounded-2xl border border-border bg-card p-6 transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              <f.icon className="h-5 w-5" />
            </div>
            <h3 className="mb-2 text-base font-bold text-foreground">{f.title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default FeaturesSection;
