#!/usr/bin/env bash
# Déploie les migrations vers le projet Supabase distant du pilote — jamais la
# configuration (auth, SMS, numéros de test) : elle se règle depuis le tableau
# de bord, à la main, une fois pour toutes (voir docs/deploiement-pilote.md).
#
#   ./scripts/deployer-pilote.sh <ref-du-projet>
#
# Sans argument, utilise le projet déjà lié (`supabase link`).
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -n "${1:-}" ]; then
  echo "Liaison au projet $1…"
  npx supabase link --project-ref "$1"
fi

echo
echo "Migrations locales pas encore sur le projet distant :"
npx supabase db push --linked --dry-run

echo
read -r -p "Appliquer ces migrations sur le projet DISTANT ? (taper « oui ») " reponse
if [ "$reponse" != "oui" ]; then
  echo "Annulé."
  exit 1
fi

# --include-seed est volontairement absent : supabase/seed.sql ne contient que
# des comptes et des prix d'exemple, à ne jamais écrire sur le projet du pilote.
npx supabase db push --linked

echo
echo "Fait. Rappels (voir docs/deploiement-pilote.md pour le détail) :"
echo "  - NE JAMAIS lancer « supabase config push » (publierait les numéros de test et le fournisseur SMS factice)."
echo "  - Vérifier / régler à la main dans le tableau de bord : fournisseur SMS réel, délai OTP 60 s, [auth.sms.test_otp] absent côté distant."
echo "  - Renseigner les vraies bornes plausibles (table bornes_plausibles) et les vrais facteurs de conversion (conversions_unites)."
