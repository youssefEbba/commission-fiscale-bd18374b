import { motion } from "framer-motion";
import { ArrowRight, FileCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const stats = [
  { value: "2 500+", label: "Demandes traitées" },
  { value: "48h", label: "Délai moyen" },
  { value: "100%", label: "Sécurisé" },
];

const HeroSection = () => (
  <section className="relative overflow-hidden pt-24 pb-16 md:pt-32 md:pb-24" style={{ background: "var(--hero-gradient)" }}>
    {/* Pattern overlay */}
    <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />

    <div className="relative mx-auto max-w-7xl px-6">
      <div className="flex flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-4 py-1.5"
        >
          <FileCheck className="h-4 w-4 text-gold" />
          <span className="text-xs font-semibold text-gold tracking-wide">Plateforme officielle — Commission Fiscale</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-4 text-4xl font-extrabold leading-tight text-primary-foreground md:text-6xl md:leading-tight"
        >
          Gestion des Crédits
          <br />
          <span className="text-gradient-gold">d'Impôt</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-10 max-w-2xl text-lg text-primary-foreground/70 md:text-xl"
        >
          Simplifiez vos démarches de crédit d'impôt et suivez vos demandes en temps réel. Une plateforme moderne, rapide et sécurisée.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-col gap-4 sm:flex-row"
        >
          <Button size="lg" className="bg-gold text-accent-foreground font-semibold text-base px-8 hover:bg-gold-light gap-2" asChild>
            <Link to="/register">Soumettre une demande <ArrowRight className="h-4 w-4" /></Link>
          </Button>
          <Button size="lg" variant="outline" className="border-primary-foreground/20 text-primary-foreground bg-transparent hover:bg-primary-foreground/10 font-semibold text-base px-8" asChild>
            <Link to="/login">Suivre mon dossier</Link>
          </Button>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5 }}
          className="mt-16 grid w-full max-w-xl grid-cols-3 gap-6"
        >
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-3xl font-extrabold text-gold md:text-4xl">{s.value}</div>
              <div className="mt-1 text-xs font-medium uppercase tracking-wider text-primary-foreground/50">{s.label}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </div>

    {/* Bottom curve */}
    <div className="absolute bottom-0 left-0 right-0">
      <svg viewBox="0 0 1440 60" className="w-full fill-background">
        <path d="M0,60 L0,20 Q720,0 1440,20 L1440,60 Z" />
      </svg>
    </div>
  </section>
);

export default HeroSection;
