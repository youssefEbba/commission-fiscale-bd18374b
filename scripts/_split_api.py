from pathlib import Path

root = Path(__file__).resolve().parents[1] / "src" / "lib"
text = (root / "api.ts").read_text(encoding="utf-8")
lines = text.splitlines(True)

def chunk(a, b):
    return "".join(lines[a-1:b])

client_header = """import i18next from "i18next";
import { API_BASE } from "../apiConfig";
import { parseApiErrorBody, displayErrorText } from "../apiErrorText";
import { endSession, clearStoredSession } from "../session";

"""

# original lines 1-155 include those imports - keep as-is but fix relative paths when moving to api/
client = chunk(1, 155)
client = client.replace('from "./apiConfig"', 'from "../apiConfig"')
client = client.replace('from "./apiErrorText"', 'from "../apiErrorText"')
client = client.replace('from "./session"', 'from "../session"')
client = client.replace('from "./correctionMontants"', 'from "../correctionMontants"')

outdir = root / "api"
outdir.mkdir(exist_ok=True)

files = {
    "client.ts": client,
    "auth.ts": 'import { apiFetch } from "./client";\n' + chunk(157, 300),
    "entites.ts": 'import { apiFetch, normalizeDocs } from "./client";\n' + chunk(301, 742),
    "demandes.ts": 'import { apiFetch, normalizeDocs } from "./client";\nimport { buildCorrectionDecisionBody, type CorrectionMontants } from "../correctionMontants";\n' + chunk(743, 1168),
    "marches.ts": 'import { apiFetch, normalizeDocs } from "./client";\n' + chunk(1169, 1469),
    "certificats.ts": 'import { apiFetch, normalizeDocs } from "./client";\nimport { buildCorrectionDecisionBody, type CorrectionMontants } from "../correctionMontants";\n' + chunk(1470, 1909),
    "utilisations.ts": 'import { apiFetch, normalizeDocs } from "./client";\n' + chunk(1910, 2122),
    "admin.ts": 'import { apiFetch } from "./client";\n' + chunk(2123, 2185),
    "notifications.ts": 'import { apiFetch } from "./client";\n' + chunk(2186, 2313),
    "referentiels.ts": 'import { apiFetch } from "./client";\n' + chunk(2314, 2502),
    "mouvements.ts": 'import { apiFetch, normalizeDocs } from "./client";\n' + chunk(2503, 3170),
    "reporting.ts": 'import { apiFetch } from "./client";\n' + chunk(3171, 3661),
    "parametres.ts": 'import { apiFetch } from "./client";\n' + chunk(3662, len(lines)),
}

# normalizeDocs is in demandes section originally line 938 - NOT in client.
# Move normalizeDocs into client by extracting it from demandes chunk if needed.

norm_src = None
for i, line in enumerate(lines, 1):
    if line.startswith("export const normalizeDocs"):
        # include following continuation lines until semicolon end of arrow
        j = i
        buf = []
        while j <= len(lines):
            buf.append(lines[j-1])
            if lines[j-1].strip().endswith(";") and j > i:
                break
            if lines[j-1].strip().endswith(";") and "normalizeDocs" in lines[j-1]:
                break
            j += 1
        norm_src = "".join(buf)
        print("normalizeDocs lines", i, j)
        break

if norm_src:
    files["client.ts"] = files["client.ts"].rstrip() + "\n\n" + norm_src
    files["demandes.ts"] = files["demandes.ts"].replace(norm_src, "")

barrel = """export * from "./api/client";
export * from "./api/auth";
export * from "./api/entites";
export * from "./api/demandes";
export * from "./api/marches";
export * from "./api/certificats";
export * from "./api/utilisations";
export * from "./api/admin";
export * from "./api/notifications";
export * from "./api/referentiels";
export * from "./api/mouvements";
export * from "./api/reporting";
export * from "./api/parametres";
"""

for name, content in files.items():
    (outdir / name).write_text(content, encoding="utf-8")
    print("wrote", name, "chars", len(content))

(root / "api.ts").write_text(barrel, encoding="utf-8")
print("barrel ok")
