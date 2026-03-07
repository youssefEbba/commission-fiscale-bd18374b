import { motion } from "framer-motion";
import {
  FileEdit, TrendingUp, FolderOpen, Bot, Users, FilePlus, FileCheck,
  CheckCircle2, ArrowRight, Shield
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.12, duration: 0.5, ease: "easeOut" as const }
  })
};

interface Section {
  icon: React.ElementType;
  title: string;
  color: string;
  points: string[];
}

const SECTIONS: Section[] = [
  {
    icon: FileEdit,
    title: "1. Les Modifications",
    color: "from-emerald-600 to-emerald-800",
    points: [
      "Corrections douanières avec workflow structuré",
      "Validation multi-acteurs : AC → DGI → DGTCP → Président",
      "Suivi des statuts en temps réel (En attente, Validé, Rejeté)",
      "Historique complet des actions dans les logs d'audit",
    ],
  },
  {
    icon: TrendingUp,
    title: "2. Les Améliorations",
    color: "from-teal-600 to-teal-800",
    points: [
      "Taux de change récupéré automatiquement via API",
      "Bailleurs en référentiel avec ajout inline si inexistant",
      "Devises proposées en liste avec création dynamique",
      "Fusion automatique des fichiers de convention",
      "Calcul automatique du montant en MRU",
    ],
  },
  {
    icon: FolderOpen,
    title: "3. La GED (Gestion Électronique des Documents)",
    color: "from-cyan-600 to-cyan-800",
    points: [
      "Configuration dynamique des exigences par processus",
      "Séparation claire : Cordon Douanier vs TVA Intérieure",
      "Documents obligatoires paramétrables par type d'opération",
      "Upload obligatoire avant toute soumission de demande",
    ],
  },
  {
    icon: Bot,
    title: "4. L'Assistant IA",
    color: "from-violet-600 to-violet-800",
    points: [
      "Chatbot intégré pour assistance contextuelle",
      "Connecté via API dédiée (temps réel)",
      "Aide à la navigation et compréhension des procédures",
      "Réponses adaptées au contexte de la demande en cours",
    ],
  },
  {
    icon: Users,
    title: "5. Les Délégués (UPM / UEP)",
    color: "from-amber-600 to-amber-800",
    points: [
      "Accès identique à l'Autorité Contractante sur leur périmètre",
      "Filtrage automatique par marchés affectés",
      "Visibilité sur les conventions, demandes et certificats liés",
      "Séparation des rôles UPM et UEP avec périmètres distincts",
    ],
  },
  {
    icon: FilePlus,
    title: "6. Demande de Mise en Place CI",
    color: "from-green-600 to-green-800",
    points: [
      "Workflow complet : AC → DGI → DGTCP → Président",
      "Saisie des montants Cordon Douanier et TVA Intérieure",
      "Génération automatique du certificat d'incentives en PDF",
      "Ouverture automatique des soldes après validation",
    ],
  },
  {
    icon: FileCheck,
    title: "7. Demande d'Utilisation CI",
    color: "from-sky-600 to-sky-800",
    points: [
      "Deux flux distincts : Douanier (DGD → DGTCP) et TVA Intérieure (DGTCP seul)",
      "Documents GED obligatoires avant soumission",
      "Débit automatique du solde du certificat après validation",
      "Traçabilité complète de chaque utilisation",
    ],
  },
];

const Presentation = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[hsl(160,50%,6%)] via-[hsl(153,40%,10%)] to-[hsl(160,50%,6%)]">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[hsl(160,50%,6%)]/80 border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center gap-4">
          <Shield className="h-8 w-8 text-[hsl(var(--accent))]" />
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Commission Fiscale
            </h1>
            <p className="text-xs text-white/50">Présentation des fonctionnalités</p>
          </div>
        </div>
      </header>

      {/* Hero */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-6xl mx-auto px-6 pt-20 pb-16 text-center"
      >
        <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-4">
          Système de Gestion des{" "}
          <span className="text-[hsl(var(--accent))]">Incentives Fiscaux</span>
        </h2>
        <p className="text-lg text-white/60 max-w-2xl mx-auto">
          Vue d'ensemble des modules, améliorations et workflows implémentés dans la plateforme.
        </p>
      </motion.section>

      {/* Sections */}
      <div className="max-w-6xl mx-auto px-6 pb-24 space-y-8">
        {SECTIONS.map((section, i) => (
          <motion.div
            key={section.title}
            custom={i}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            variants={fadeUp}
            className="rounded-2xl overflow-hidden bg-white/[0.04] border border-white/10 hover:border-white/20 transition-colors"
          >
            <div className={`bg-gradient-to-r ${section.color} px-8 py-5 flex items-center gap-4`}>
              <section.icon className="h-7 w-7 text-white/90" />
              <h3 className="text-xl font-bold text-white">{section.title}</h3>
            </div>
            <ul className="px-8 py-6 space-y-3">
              {section.points.map((point) => (
                <li key={point} className="flex items-start gap-3 text-white/80">
                  <CheckCircle2 className="h-5 w-5 text-[hsl(var(--accent))] mt-0.5 shrink-0" />
                  <span className="text-[15px] leading-relaxed">{point}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        ))}
      </div>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 text-center text-white/30 text-sm">
        Commission Fiscale — {new Date().getFullYear()} — Présentation confidentielle
      </footer>
    </div>
  );
};

export default Presentation;
