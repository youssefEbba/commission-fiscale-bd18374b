import { motion } from "framer-motion";
import { ArrowRight, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";

const CTASection = () => (
  <section className="py-20 md:py-28">
    <div className="mx-auto max-w-7xl px-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="relative overflow-hidden rounded-3xl p-10 md:p-16 text-center"
        style={{ background: "var(--hero-gradient)" }}
      >
        {/* Pattern */}
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='1' fill-rule='evenodd'%3E%3Cpath d='M0 40L40 0H20L0 20M40 40V20L20 40'/%3E%3C/g%3E%3C/svg%3E\")" }} />

        <div className="relative">
          <h2 className="mb-4 text-3xl font-extrabold text-primary-foreground md:text-4xl">
            Prêt à simplifier vos démarches fiscales ?
          </h2>
          <p className="mb-3 text-lg font-semibold text-gold">Commencez dès maintenant</p>
          <p className="mx-auto mb-10 max-w-lg text-primary-foreground/70">
            Inscrivez-vous et suivez vos demandes de crédit d'impôt sur une plateforme sécurisée.
          </p>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button size="lg" className="bg-gold text-accent-foreground font-semibold text-base px-8 hover:bg-gold-light gap-2">
              Commencer maintenant <ArrowRight className="h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" className="border-primary-foreground/20 text-primary-foreground bg-transparent hover:bg-primary-foreground/10 font-semibold text-base px-8 gap-2">
              <Phone className="h-4 w-4" /> Nous contacter
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  </section>
);

export default CTASection;
