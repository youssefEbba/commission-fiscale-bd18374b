# one-shot rewrite helper for security/quality plan
from pathlib import Path
import re

front = Path(__file__).resolve().parents[1]
src = front / "src"

def sub_file(path: Path, pairs):
    text = path.read_text(encoding="utf-8")
    orig = text
    for a, b in pairs:
        text, n = re.subn(a, b, text, count=1, flags=re.S)
        if n == 0:
            text2, n2 = re.subn(a, b, text, flags=re.S)
            text, n = text2, n2
        print(path.name, "replaced" if n else "MISS", a[:40])
    if text != orig:
        path.write_text(text, encoding="utf-8")

# --- STATUT_COLORS replacements ---
color_jobs = [
    (src/"pages"/"Demandes.tsx", r"const STATUT_COLORS: Record<DemandeStatut, string> = \{.*?\};",
     "const STATUT_COLORS = DEMANDE_STATUT_COLORS;"),
    (src/"pages"/"DemandeDetail.tsx", r"const STATUT_COLORS: Record<DemandeStatut, string> = \{.*?\};",
     "const STATUT_COLORS = DEMANDE_STATUT_COLORS;"),
    (src/"pages"/"CorrectionDouaniere.tsx", r"const STATUT_COLORS: Record<string, string> = \{.*?\};",
     "const STATUT_COLORS = DEMANDE_STATUT_COLORS;"),
    (src/"pages"/"Utilisations.tsx", r"const STATUT_COLORS: Record<UtilisationStatut, string> = \{.*?\};",
     "const STATUT_COLORS = UTILISATION_STATUT_COLORS;"),
    (src/"pages"/"UtilisationDetail.tsx", r"const STATUT_COLORS: Record<UtilisationStatut, string> = \{.*?\};",
     "const STATUT_COLORS = UTILISATION_STATUT_COLORS;"),
    (src/"pages"/"DemandesMiseEnPlace.tsx", r"const STATUT_COLORS: Record<CertificatStatut, string> = \{.*?\};",
     "const STATUT_COLORS = CERTIFICAT_STATUT_COLORS;"),
    (src/"pages"/"MiseEnPlaceDetail.tsx", r"const STATUT_COLORS: Record<CertificatStatut, string> = \{.*?\};",
     "const STATUT_COLORS = CERTIFICAT_STATUT_COLORS;"),
    (src/"pages"/"Conventions.tsx", r"const STATUT_COLORS: Record<ConventionStatut \| \"ANNULEE\", string> = \{.*?\};",
     "const STATUT_COLORS = CONVENTION_STATUT_COLORS;"),
    (src/"pages"/"ConventionDetail.tsx", r"const STATUT_COLORS: Record<string, string> = \{.*?\};",
     "const STATUT_COLORS = CONVENTION_STATUT_COLORS;"),
    (src/"pages"/"Marches.tsx", r"const STATUT_COLORS: Record<StatutMarche, string> = \{.*?\};",
     "const STATUT_COLORS = MARCHE_STATUT_COLORS;"),
    (src/"pages"/"MarcheDetail.tsx", r"const STATUT_COLORS: Record<string, string> = \{.*?\};",
     "const STATUT_COLORS = MARCHE_STATUT_COLORS;"),
    (src/"pages"/"Transferts.tsx", r"const STATUT_COLORS: Record<StatutTransfert, string> = \{.*?\};",
     "const STATUT_COLORS = TRANSFERT_STATUT_COLORS;"),
    (src/"pages"/"TransfertDetail.tsx", r"const STATUT_COLORS: Record<StatutTransfert, string> = \{.*?\};",
     "const STATUT_COLORS = TRANSFERT_STATUT_COLORS;"),
    (src/"pages"/"SousTraitance.tsx", r"const STATUT_COLORS: Record<StatutSousTraitance, string> = \{.*?\};",
     "const STATUT_COLORS = SOUS_TRAITANCE_STATUT_COLORS;"),
    (src/"components"/"avenants"/"AvenantStatutBadge.tsx", r"const STATUT_COLORS: Record<StatutAvenant, string> = \{.*?\};",
     "const STATUT_COLORS = AVENANT_STATUT_COLORS;"),
]

imports = {
    "Demandes.tsx": 'import { DEMANDE_STATUT_COLORS } from "@/lib/statutColors";\nimport { DEMANDE_ROLE_TRANSITIONS } from "@/lib/demandeTransitions";\n',
    "DemandeDetail.tsx": 'import { DEMANDE_STATUT_COLORS } from "@/lib/statutColors";\nimport { DEMANDE_ROLE_TRANSITIONS } from "@/lib/demandeTransitions";\n',
    "CorrectionDouaniere.tsx": 'import { DEMANDE_STATUT_COLORS } from "@/lib/statutColors";\n',
    "Utilisations.tsx": 'import { UTILISATION_STATUT_COLORS } from "@/lib/statutColors";\n',
    "UtilisationDetail.tsx": 'import { UTILISATION_STATUT_COLORS } from "@/lib/statutColors";\n',
    "DemandesMiseEnPlace.tsx": 'import { CERTIFICAT_STATUT_COLORS } from "@/lib/statutColors";\n',
    "MiseEnPlaceDetail.tsx": 'import { CERTIFICAT_STATUT_COLORS } from "@/lib/statutColors";\n',
    "Conventions.tsx": 'import { CONVENTION_STATUT_COLORS } from "@/lib/statutColors";\n',
    "ConventionDetail.tsx": 'import { CONVENTION_STATUT_COLORS } from "@/lib/statutColors";\n',
    "Marches.tsx": 'import { MARCHE_STATUT_COLORS } from "@/lib/statutColors";\n',
    "MarcheDetail.tsx": 'import { MARCHE_STATUT_COLORS } from "@/lib/statutColors";\n',
    "Transferts.tsx": 'import { TRANSFERT_STATUT_COLORS } from "@/lib/statutColors";\n',
    "TransfertDetail.tsx": 'import { TRANSFERT_STATUT_COLORS } from "@/lib/statutColors";\n',
    "SousTraitance.tsx": 'import { SOUS_TRAITANCE_STATUT_COLORS } from "@/lib/statutColors";\n',
    "AvenantStatutBadge.tsx": 'import { AVENANT_STATUT_COLORS } from "@/lib/statutColors";\n',
}

for path, pat, repl in color_jobs:
    t = path.read_text(encoding="utf-8")
    t2, n = re.subn(pat, repl, t, count=1, flags=re.S)
    imp = imports[path.name]
    if imp not in t2:
        t2 = imp + t2
    if n:
        path.write_text(t2, encoding="utf-8")
        print("colors", path.name, n)
    else:
        print("MISS colors", path.name)

# certificat dual maps
p = src/"pages"/"CertificatDetail.tsx"
t = p.read_text(encoding="utf-8")
t = re.sub(r"const STATUT_COLORS_CERT: Record<CertificatStatut, string> = \{.*?\};",
           "const STATUT_COLORS_CERT = CERTIFICAT_STATUT_COLORS;", t, count=1, flags=re.S)
t = re.sub(r"const STATUT_COLORS_UTIL: Record<UtilisationStatut, string> = \{.*?\};",
           "const STATUT_COLORS_UTIL = UTILISATION_STATUT_COLORS;", t, count=1, flags=re.S)
if "CERTIFICAT_STATUT_COLORS" not in t.split("const STATUT")[0]:
    t = 'import { CERTIFICAT_STATUT_COLORS, UTILISATION_STATUT_COLORS } from "@/lib/statutColors";\n' + t
p.write_text(t, encoding="utf-8")
print("CertificatDetail dual")

# ROLE_TRANSITIONS
for name in ["Demandes.tsx", "DemandeDetail.tsx"]:
    p = src/"pages"/name
    t = p.read_text(encoding="utf-8")
    t = re.sub(r"type Transition = \{.*?\};\s*", "", t, count=1, flags=re.S)
    t = re.sub(
        r"const ROLE_TRANSITIONS: Record<string, Transition\[]> = \{.*?\};\s*",
        "const ROLE_TRANSITIONS = DEMANDE_ROLE_TRANSITIONS;\n",
        t, count=1, flags=re.S)
    t = re.sub(
        r"const ALL_STATUTS: DemandeStatut\[] = \[\"RECUE\".*?\];\s*",
        "", t, count=1, flags=re.S)
    p.write_text(t, encoding="utf-8")
    print("transitions", name)

# catch (e: any) on dense pages
for rel in ["pages/UtilisationDetail.tsx", "pages/DemandeDetail.tsx", "pages/Demandes.tsx"]:
    p = src/rel
    t = p.read_text(encoding="utf-8")
    t = t.replace("catch (e: any)", "catch (e: unknown)")
    t = t.replace("catch (e:any)", "catch (e: unknown)")
    # e.message -> formatApiErrorMessage(e) when used as description
    t = re.sub(r"\be\.message\b", "formatApiErrorMessage(e)", t)
    t = re.sub(r"\be\?\.message\b", "formatApiErrorMessage(e)", t)
    if "formatApiErrorMessage" not in t.split("from")[0] and 'formatApiErrorMessage' not in t[:800]:
        t = 'import { formatApiErrorMessage, isApiError } from "@/lib/api";\n' + t
    elif "isApiError" not in t and "e?.code" in t:
        t = t.replace("formatApiErrorMessage,", "formatApiErrorMessage, isApiError,")
    t = t.replace("e?.code", "(isApiError(e) ? e.code : undefined)")
    p.write_text(t, encoding="utf-8")
    print("catch", rel)

# pdf helpers
for rel, old_safe in [
    ("lib/adoptionLetterPdf.ts", True),
    ("lib/certificatSignaturePdf.ts", True),
    ("lib/liquidationPdf.ts", False),
]:
    p = src/rel
    t = p.read_text(encoding="utf-8")
    if "from \"@/lib/pdfText\"" not in t:
        t = 'import { pdfSafe, pdfFmtNombre, numberToFrenchWords } from "@/lib/pdfText";\n' + t
    t = re.sub(r"const safe = \(s: string\) =>\s*s\s*\.replace\([\s\S]*?hyphen.*?;\s*",
               "const safe = pdfSafe;\n", t, count=1)
    t = re.sub(r"const safe = \(s: string\) =>\s*s\s*\.replace\(/\[\\u00A0.*?;\s*",
               "const safe = pdfSafe;\n", t, count=1)
    t = re.sub(r"const fmt = \(v: any\) =>\s*v != null[\s\S]*?:\s*\"\";",
               "const fmt = (v: unknown) => pdfFmtNombre(v, 0);", t, count=1)
    t = re.sub(r"const fmt = \(v: any\) =>\s*v != null[\s\S]*?:\s*\"—\";",
               'const fmt = (v: unknown) => pdfFmtNombre(v, 2) || "—";', t, count=1)
    # remove local numberToFrenchWords in liquidation
    t = re.sub(
        r"// ---------- Nombre en lettres \(FR\) ----------[\s\S]*?function numberToFrenchWords\(n: number\): string \{[\s\S]*?\n\}\n\n",
        "", t, count=1)
    p.write_text(t, encoding="utf-8")
    print("pdf", rel)

# UtilisationDetail local numberToFrenchWords
p = src/"pages"/"UtilisationDetail.tsx"
t = p.read_text(encoding="utf-8")
if "montantOuguiyaEnLettres" not in t:
    t = 'import { montantOuguiyaEnLettres } from "@/lib/pdfText";\n' + t
t = re.sub(r"function _below1000[\s\S]*?function numberToFrenchWords\(n: number\): string \{[\s\S]*?return s;\n\}\n",
           "const numberToFrenchWords = montantOuguiyaEnLettres;\n", t, count=1)
# also remove _u _t arrays if left
t = re.sub(r"const _u = \[[\s\S]*?\];\s*const _t = \[[\s\S]*?\];\s*", "", t, count=1)
p.write_text(t, encoding="utf-8")
print("utilisation words")
print("done rewrites")
