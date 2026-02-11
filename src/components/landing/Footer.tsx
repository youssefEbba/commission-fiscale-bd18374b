import { Shield, MapPin, Mail, Phone } from "lucide-react";

const Footer = () => (
  <footer id="contact" className="border-t border-border bg-dark-green text-primary-foreground">
    <div className="mx-auto max-w-7xl px-6 py-14">
      <div className="grid gap-10 md:grid-cols-4">
        {/* Brand */}
        <div className="md:col-span-1">
          <div className="mb-4 flex items-center gap-2">
            <Shield className="h-6 w-6 text-gold" />
            <span className="text-sm font-bold">Commission Fiscale</span>
          </div>
          <p className="text-xs leading-relaxed text-primary-foreground/60">
            Système de Gestion des Crédits d'Impôt
            <br />
            Ministère des Finances — République Islamique de Mauritanie
          </p>
        </div>

        {/* Produit */}
        <div>
          <h4 className="mb-4 text-xs font-bold uppercase tracking-wider text-gold">Produit</h4>
          <ul className="space-y-2">
            {["Fonctionnalités", "Processus", "Connexion"].map((l) => (
              <li key={l}>
                <a href="#" className="text-sm text-primary-foreground/60 transition-colors hover:text-primary-foreground">{l}</a>
              </li>
            ))}
          </ul>
        </div>

        {/* Ressources */}
        <div>
          <h4 className="mb-4 text-xs font-bold uppercase tracking-wider text-gold">Ressources</h4>
          <ul className="space-y-2">
            {["Centre d'aide", "Politique de sécurité", "FAQ"].map((l) => (
              <li key={l}>
                <a href="#" className="text-sm text-primary-foreground/60 transition-colors hover:text-primary-foreground">{l}</a>
              </li>
            ))}
          </ul>
        </div>

        {/* Contact */}
        <div>
          <h4 className="mb-4 text-xs font-bold uppercase tracking-wider text-gold">Contact</h4>
          <ul className="space-y-3">
            <li className="flex items-start gap-2 text-sm text-primary-foreground/60">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold/60" /> Nouakchott, Mauritanie
            </li>
            <li className="flex items-start gap-2 text-sm text-primary-foreground/60">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-gold/60" /> contact@commissionfiscale.mr
            </li>
            <li className="flex items-start gap-2 text-sm text-primary-foreground/60">
              <Phone className="mt-0.5 h-4 w-4 shrink-0 text-gold/60" /> +222 00 00 00 00
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-primary-foreground/10 pt-8 md:flex-row">
        <p className="text-xs text-primary-foreground/40">© 2026 Commission Fiscale — Tous droits réservés</p>
        <p className="text-xs text-primary-foreground/30">Version: 1.0.0</p>
      </div>
    </div>
  </footer>
);

export default Footer;
