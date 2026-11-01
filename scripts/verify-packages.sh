#!/bin/sh
# Prüft Signaturen und Herkunft der installierten Pakete (npm audit signatures).
# Die Prüfung selbst bleibt unverändert streng: Sie muss bestehen, sonst schlägt dieser Schritt fehl.
#
# Warum Wiederholungen: Auf GitHub scheitert die Prüfung zeitweise mit EMISSINGSIGNATUREKEY. Belegt am 2026-11-01: Ein CDN-Knoten
# der Registry lieferte für ein Paket aus dem Cache nur die Herkunfts-Attestierung ohne die Veröffentlichungs-Attestierung; ein
# anderer Knoten lieferte beide. Das liegt außerhalb dieses Projekts, darum hilft in dem Fall nur ein neuer CI-Lauf.
# Der lokale npm-Cache wird trotzdem geleert, damit eine schlechte Antwort nicht zwischen den Versuchen bestehen bleibt.
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
