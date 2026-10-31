#!/bin/sh
# Prüft Signaturen und Herkunft der installierten Pakete (npm audit signatures).
# Die Prüfung selbst bleibt unverändert streng: Sie muss bestehen, sonst schlägt dieser Schritt fehl.
#
# Warum Wiederholungen: Auf GitHub scheiterte die Prüfung zeitweise mit EMISSINGSIGNATUREKEY, ein neuer Lauf bestand; lokal ließ es
# sich nicht nachstellen. Vermutete Ursache: Die Registry liefert Attestierungen mit einem Jahr Cache-Gültigkeit, npm legt sie im
# lokalen Cache ab, und eine unvollständige Antwort würde jeder weitere Versuch wieder lesen. Darum wird der Cache vorher geleert.
# Scheitert es trotzdem, zeigt die Diagnose unten, was wirklich ankam.
# Eine manipulierte Signatur scheitert trotzdem bei jedem Versuch.
set -u

log=$(mktemp)
attempt=1
for wait in 20 40 0; do
  if npm audit signatures >"$log" 2>&1; then
    cat "$log"
    exit 0
  fi
  cat "$log"
  [ "$wait" -eq 0 ] && break
  echo "Versuch $attempt gescheitert, nächster Versuch ohne Cache in $wait s"
  rm -rf "$(npm config get cache)/_cacache"
  sleep "$wait"
  attempt=$((attempt + 1))
done

# Fürs Nachvollziehen: Was hat die Registry für das gemeldete Paket wirklich geliefert?
spec=$(sed -n 's/^npm error \(@\{0,1\}[^ ]*@[0-9][^ ]*\) has attestations.*/\1/p' "$log" | head -1)
if [ -n "$spec" ]; then
  url="https://registry.npmjs.org/-/npm/v1/attestations/$(printf '%s' "$spec" | sed 's#/#%2f#')"
  echo "Diagnose für $spec:"
  curl -sS -D - -o /tmp/attestations.json "$url" | grep -iE '^(HTTP|age|cf-ray|cf-cache-status)' || true
  node -e "
    const d = JSON.parse(require('fs').readFileSync('/tmp/attestations.json', 'utf8'));
    for (const a of d.attestations || []) console.log(a.predicateType, a.bundle?.dsseEnvelope?.signatures?.[0]?.keyid || '(keine keyid)');
  " || true
fi
exit 1
