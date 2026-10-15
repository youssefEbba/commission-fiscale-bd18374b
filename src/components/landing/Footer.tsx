import { MapPin, Mail, Phone } from "lucide-react";
import logo from "@/assets/logo.svg";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { parametrePublicApi, type ParametresPublics } from "@/lib/api";

const Footer = () => {
  const { t } = useTranslation("landing");
  const year = new Date().getFullYear();
  // Coordonnées lues depuis le paramétrage public — aucune valeur de repli : en cas d'échec le bloc est masqué.
  const [contact, setContact] = useState<ParametresPublics | null>(null);
  useEffect(() => {
    let alive = true;
    parametrePublicApi.get().then((p) => { if (alive) setContact(p && typeof p === "object" ? p : null); }).catch(() => { if (alive) setContact(null); });
    return () => { alive = false; };
  }, []);
  const adresse = contact?.["contact.adresse"];
  const email = contact?.["contact.email"];
  const telephone = contact?.["contact.telephone"];
  const hasContact = Boolean(adresse || email || telephone);

  const productLinks = [
    { label: t("footer.links.features"), href: "#fonctionnalites" },
    { label: t("footer.links.process"), href: "#processus" },
    { label: t("footer.links.documentation"), href: "#documentation" },
    { label: t("footer.links.login"), href: "/login" },
  ];
  const resourceLinks = [
    { label: t("footer.links.help"), href: "#" },
    { label: t("footer.links.security"), href: "#" },
    { label: t("footer.links.faq"), href: "#" },
  ];

  return (
    <footer id="contact" className="border-t-2 border-gold bg-dark-green text-primary-foreground">
      <div className="mx-auto max-w-7xl px-6 py-14">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-1">
            <div className="mb-4 flex items-center gap-2">
              <img src={logo} alt={t("footer.tagline")} className="h-7 w-7" />
              <span className="text-sm font-bold">Commission Fiscale</span>
            </div>
            <p className="text-xs leading-relaxed text-primary-foreground/60">
              {t("footer.tagline")}
              <br />
              {t("footer.ministry")}
            </p>
          </div>

          <div>
            <h4 className="mb-4 text-xs font-bold uppercase tracking-wider text-gold">{t("footer.section_product")}</h4>
            <ul className="space-y-2">
              {productLinks.map((l) => (
                <li key={l.label}>
                  <a href={l.href} className="text-sm text-primary-foreground/60 transition-colors hover:text-primary-foreground">{l.label}</a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-4 text-xs font-bold uppercase tracking-wider text-gold">{t("footer.section_resources")}</h4>
            <ul className="space-y-2">
              {resourceLinks.map((l) => (
                <li key={l.label}>
                  <a href={l.href} className="text-sm text-primary-foreground/60 transition-colors hover:text-primary-foreground">{l.label}</a>
                </li>
              ))}
            </ul>
          </div>

          {hasContact && (
          <div>
            <h4 className="mb-4 text-xs font-bold uppercase tracking-wider text-gold">{t("footer.section_contact")}</h4>
            <ul className="space-y-3">
              {adresse && (
                <li className="flex items-start gap-2 text-sm text-primary-foreground/60">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold/60" /> {adresse}
                </li>
              )}
              {email && (
                <li className="flex items-start gap-2 text-sm text-primary-foreground/60">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-gold/60" /> <a href={`mailto:${email}`} className="hover:text-primary-foreground">{email}</a>
                </li>
              )}
              {telephone && (
                <li className="flex items-start gap-2 text-sm text-primary-foreground/60">
                  <Phone className="mt-0.5 h-4 w-4 shrink-0 text-gold/60" /> <span dir="ltr">{telephone}</span>
                </li>
              )}
            </ul>
          </div>
          )}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-primary-foreground/10 pt-8 md:flex-row">
          <p className="text-xs text-primary-foreground/40">{t("footer.rights", { year })}</p>
          <p className="text-xs text-primary-foreground/30">{t("footer.version", { version: "1.0.0" })}</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
