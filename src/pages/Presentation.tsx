import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { FileDown, Globe, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AppLang } from "@/i18n";
import emblem from "@/assets/mauritania-emblem.png";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.45, ease: "easeOut" as const },
  }),
};

export default function Presentation() {
  const { t, i18n } = useTranslation("presentation");
  const isAr = i18n.language.startsWith("ar");
  const dir = isAr ? "rtl" : "ltr";

  const changeLang = (lng: AppLang) => {
    i18n.changeLanguage(lng);
  };

  const objectives = t("objectives", { returnObjects: true }) as string[];
  const documents = t("documents", { returnObjects: true }) as Array<{
    title: string;
    description: string;
    link: string;
  }>;

  return (
    <div className="min-h-screen bg-[#f8faf9]" dir={dir}>
      {/* Official header — Republic */}
      <div className="bg-[#00A95C] text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <img
                src={emblem}
                alt="Emblème de la République Islamique de Mauritanie"
                className="h-12 w-auto object-contain"
              />
              <div className={cn("flex flex-col", isAr && "items-end text-right")}>
                <span className="text-sm sm:text-base font-bold leading-tight">
                  {isAr ? t("header.republic") : t("header.republic")}
                </span>
                <span className="text-[11px] sm:text-xs text-white/90 leading-tight">
                  {isAr ? "République Islamique de Mauritanie" : "الجمهورية الإسلامية الموريتانية"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Official header — Ministry */}
      <div className="bg-[#008C4D] text-white border-t border-white/20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between py-2.5">
            <div className={cn("flex flex-col", isAr && "items-end text-right")}>
              <span className="text-sm sm:text-base font-bold leading-tight">
                {isAr ? "وزارة المالية" : "Ministère des Finances"}
              </span>
              <span className="text-[11px] sm:text-xs text-white/90 leading-tight">
                {isAr ? "Ministère des Finances" : "وزارة المالية"}
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <span className="bg-[#FFD700] text-[#004d2a] text-[10px] font-extrabold px-2 py-0.5 uppercase tracking-wide">
                {t("header.siteLabel")}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Language switcher */}
      <div className="bg-white border-b border-[#00A95C]/20 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3">
          <div className={cn("flex items-center gap-2", isAr ? "justify-start" : "justify-end")}>
            <Globe className="h-4 w-4 text-[#00A95C]" />
            <span className="text-xs font-medium text-[#004d2a]">
              {isAr ? "اللغة :" : "Langue :"}
            </span>
            <div className="inline-flex rounded overflow-hidden border border-[#00A95C]">
              <button
                onClick={() => changeLang("fr")}
                className={cn(
                  "px-3 py-1 text-xs font-semibold transition-colors",
                  !isAr
                    ? "bg-[#00A95C] text-white"
                    : "bg-white text-[#00A95C] hover:bg-[#00A95C]/10"
                )}
              >
                {t("lang.fr")}
              </button>
              <button
                onClick={() => changeLang("ar")}
                className={cn(
                  "px-3 py-1 text-xs font-semibold transition-colors",
                  isAr
                    ? "bg-[#00A95C] text-white"
                    : "bg-white text-[#00A95C] hover:bg-[#00A95C]/10"
                )}
              >
                {t("lang.ar")}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Hero */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-gradient-to-br from-[#00A95C] to-[#006b3a] text-white"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-20 text-center">
          <h1
            className={cn(
              "text-2xl sm:text-3xl md:text-4xl font-extrabold leading-tight mb-4",
              isAr && "font-bold"
            )}
          >
            {t("hero.title")}
          </h1>
          <p className="text-base sm:text-lg text-white/90 max-w-3xl mx-auto mb-8">
            {t("hero.subtitle")}
          </p>
          <Button
            asChild
            size="lg"
            className="bg-[#FFD700] text-[#004d2a] hover:bg-[#e6c200] font-bold gap-2"
          >
            <a
              href={t("hero.downloadUrl")}
              target="_blank"
              rel="noopener noreferrer"
            >
              <FileDown className="h-5 w-5" />
              {t("hero.download")}
            </a>
          </Button>
        </div>
      </motion.section>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Objectives */}
          <motion.div
            custom={0}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            variants={fadeUp}
          >
            <Card className="h-full border-[#00A95C]/20 shadow-sm">
              <CardHeader
                className={cn(
                  "bg-[#00A95C] text-white py-4",
                  isAr ? "text-right" : "text-left"
                )}
              >
                <h2 className="text-lg font-bold">{t("sections.objectives")}</h2>
              </CardHeader>
              <CardContent className="p-6">
                <ul className="space-y-4">
                  {objectives.map((point, idx) => (
                    <li
                      key={idx}
                      className={cn(
                        "flex items-start gap-3 text-[15px] leading-relaxed text-foreground/90",
                        isAr && "flex-row-reverse text-right"
                      )}
                    >
                      <span className="text-[#D01C1F] text-lg leading-none mt-0.5 shrink-0">
                        ►
                      </span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </motion.div>

          {/* Documents */}
          <motion.div
            custom={1}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            variants={fadeUp}
            className="space-y-6"
          >
            <h2
              className={cn(
                "text-xl font-bold text-[#004d2a] border-b-2 border-[#00A95C] pb-2",
                isAr && "text-right"
              )}
            >
              {t("sections.documents")}
            </h2>
            {documents.map((doc, idx) => (
              <Card
                key={idx}
                className="border-[#00A95C]/20 shadow-sm overflow-hidden"
              >
                <CardHeader
                  className={cn(
                    "bg-[#f0fdf4] text-[#004d2a] py-3",
                    isAr ? "text-right" : "text-left"
                  )}
                >
                  <h3 className="text-base font-bold">{doc.title}</h3>
                </CardHeader>
                <CardContent className="p-5">
                  <p
                    className={cn(
                      "text-sm text-muted-foreground mb-4",
                      isAr && "text-right"
                    )}
                  >
                    {doc.description}
                  </p>
                  <a
                    href={t("hero.downloadUrl")}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "inline-flex items-center gap-2 text-sm font-semibold text-[#00A95C] hover:text-[#008C4D] hover:underline",
                      isAr && "flex-row-reverse"
                    )}
                  >
                    <ExternalLink className="h-4 w-4" />
                    {doc.link}
                  </a>
                </CardContent>
              </Card>
            ))}
          </motion.div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-[#004d2a] text-white py-6 mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-sm text-white/90">
            {t("footer.copyright", { year: new Date().getFullYear() })}
          </p>
        </div>
      </footer>
    </div>
  );
}
