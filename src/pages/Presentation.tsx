import { motion } from "framer-motion";
import {
  FileEdit, TrendingUp, FolderOpen, Users, FilePlus, FileCheck,
  CheckCircle2, ArrowRight, Shield, ArrowLeftRight, Handshake, FlaskConical
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
  tag?: string;
}

const SECTIONS: Section[] = [
  {
    icon: FolderOpen,
    title: "1. La GED (Gestion Électronique des Documents)",
    color: "from-cyan-600 to-cyan-800",
    points: [
      "Configuration dynamique des exigences par processus",
      "Séparation claire : Cordon Douanier vs TVA Intérieure",
      "Documents obligatoires paramétrables par type d'opération",
      "Upload obligatoire avant toute soumission de demande",
    ],
  },
  {
    icon: FilePlus,
    title: "2. Demande de Mise en Place CI",
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
    title: "3. Demande d'Utilisation CI",
    color: "from-sky-600 to-sky-800",
    points: [
      "Deux flux distincts : Douanier (DGD → DGTCP) et TVA Intérieure (DGTCP seul)",
      "Documents GED obligatoires avant soumission",
      "Débit automatique du solde du certificat après validation",
      "Traçabilité complète de chaque utilisation",
    ],
  },
  {
    icon: FileEdit,
    title: "4. Correction Douanière & Chatbot IA",
    color: "from-teal-600 to-teal-800",
    points: [
      "Workflow en 2 phases : Phase 1 (DQE vs Offre Financière) puis Phase 2 (DQE corrigé vs Offre Fiscale)",
      "Chatbot intelligent intégré avec analyse automatique des documents (PDF/Excel)",
      "Extraction automatique des données via IA (Gemini + Anthropic)",
      "Export des documents corrigés (DQE standard, Offre Fiscale) au format Excel",
      "Historique des échanges et traçabilité complète des corrections",
    ],
  },
  {
    icon: TrendingUp,
    title: "5. Simulation Entreprise",
    color: "from-orange-600 to-orange-800",
    points: [
      "Simulation autonome par entreprise sans passer par le workflow complet de correction",
      "Upload du DQE et de l'offre fiscale avec extraction et structuration automatiques",
      "Génération de l'offre fiscale corrigée en un clic via les modèles IA",
      "Téléchargement de l'offre corrigée au format Excel directement depuis l'espace simulation",
      "Persistance des résultats : consultation et re-téléchargement à tout moment",
    ],
  },
  {
    icon: Shield,
    title: "6. Extraction & Indexation Intelligente",
    color: "from-fuchsia-600 to-fuchsia-800",
    points: [
      "Extraction automatique du contenu des documents PDF et Excel via API IA",
      "Filtrage intelligent des types de documents supportés (DQE, DAO, Offre Fiscale/Financière)",
      "Limitation automatique à 30 pages pour les documents volumineux",
      "Stockage structuré des extractions par session de correction ou simulation",
    ],
  },
  {
    icon: Users,
    title: "7. Les Délégués (UPM / UEP)",
    color: "from-amber-600 to-amber-800",
    points: [
      "Accès identique à l'Autorité Contractante sur leur périmètre",
      "Filtrage automatique par marchés affectés",
      "Visibilité sur les conventions, demandes et certificats liés",
      "Séparation des rôles UPM et UEP avec périmètres distincts",
    ],
    tag: "À tester",
  },
  {
    icon: ArrowLeftRight,
    title: "8. Transfert de Crédit d'Impôt",
    color: "from-indigo-600 to-indigo-800",
    points: [
      "Transfert partiel ou total du solde d'un certificat vers un autre bénéficiaire",
      "Workflow de validation : AC → DGTCP → Président",
      "Vérification automatique du solde disponible avant transfert",
      "Historique complet des transferts avec traçabilité des montants",
    ],
    tag: "À tester",
  },
  {
    icon: Handshake,
    title: "9. Sous-traitance",
    color: "from-rose-600 to-rose-800",
    points: [
      "Association directe entre entreprise titulaire et sous-traitante",
      "Upload obligatoire du contrat de sous-traitance et lettre de volumes",
      "Autorisation par la DGTCP activant les droits d'utilisation pour le sous-traitant",
      "Visibilité des certificats sous-traités avec badge distinctif dans l'espace du sous-traitant",
    ],
    tag: "À tester",
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
              {section.tag && (
                <span className="ml-auto text-xs font-bold uppercase tracking-wider bg-yellow-400/90 text-yellow-950 px-3 py-1 rounded-full">
                  {section.tag}
                </span>
              )}
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
