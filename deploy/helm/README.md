# vibeboard Helm chart

Installs vibeboard with PostgreSQL and ClamAV; Gotenberg, Kerberos and external services are optional. The chart passes
`helm lint` and schema validation against Kubernetes 1.33, but it hasn't been installed on a live cluster yet, so try it in a
test namespace first.

## Before you start

- **One replica only.** Live board state, rate limits and sign-in tickets are kept in the memory of one process, so the chart
  has no replica setting and rejects `replicaCount` above 1. Updates use `Recreate`: expect a short interruption; clients reconnect.
- **No published image.** Build vibeboard and push it to your registry.
- **Resources.** ClamAV needs about 1.5 GB of memory. Set `clamav.enabled=false` on small clusters; uploads then stay blocked until
  an administrator allows them.

## Install

```bash
docker build -t registry.example.org/vibeboard:4.5.0 .
docker push registry.example.org/vibeboard:4.5.0

kubectl create namespace vibeboard
kubectl -n vibeboard create secret generic vibeboard-secrets \
  --from-literal=postgres-password="$(openssl rand -base64 32)" \
  --from-literal=admin-email=admin@example.org \
  --from-literal=admin-password="$(openssl rand -base64 24)"

helm install board deploy/helm/vibeboard -n vibeboard --wait --timeout 15m \
  --set image.repository=registry.example.org/vibeboard \
  --set publicUrl=https://board.example.org \
  --set auth.existingSecret=vibeboard-secrets \
  --set ingress.enabled=true --set ingress.host=board.example.org

helm test board -n vibeboard
```

TLS needs the Secret named in `ingress.tls.secretName`, for example from cert-manager. `--wait` matters for `helm test`: the
test fails while the app is still starting, and the first ClamAV start takes several minutes.

Without `auth.existingSecret`, the chart creates a Secret with a random database password. It survives upgrades and
`helm uninstall`, as the database volume does. Remove the Secret and the volume together, or neither. GitOps tools such as Argo CD
render templates without cluster access and would create a new password each time, so use `auth.existingSecret` there. An external
database always needs `auth.postgresPassword` or `auth.existingSecret`.

## Common settings

| Value | Purpose |
|---|---|
| `publicUrl` | Required. Public address without a trailing slash |
| `image.repository`, `image.tag`, `image.digest` | Your image; a digest takes precedence |
| `trustProxy` | Proxies in front of the app, default 1 |
| `auth.existingSecret` | Secret with `postgres-password`, optionally `admin-email`, `admin-password` |
| `ingress.*` or `httpRoute.*` | Access from outside |
| `postgres.enabled=false`, `postgres.external.host` | Your own PostgreSQL |
| `clamav.enabled=false`, `clamav.external.host` | No scanner, or your own |
| `gotenberg.enabled=true` | Review Office files on the board |
| `kerberos.enabled=true`, `kerberos.keytabSecret`, `kerberos.configMap` | Kerberos single sign-on |
| `networkPolicy.enabled` | Only the app reaches database and scanner |

All settings are described in `values.yaml`.

## Ingress

Live updates use Server-Sent Events, so the proxy must not buffer responses and must keep idle connections open. Traefik needs no
changes. For ingress-nginx:

```yaml
ingress:
  className: nginx
  annotations:
    nginx.ingress.kubernetes.io/proxy-buffering: "off"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "3600"
    nginx.ingress.kubernetes.io/proxy-body-size: "40m"
    nginx.ingress.kubernetes.io/proxy-buffer-size: "64k"
```

The namespace isn't part of the chart. To enforce Pod Security Standards, label it `baseline`: ClamAV's image starts as root.

## Upgrades and removal

`helm upgrade` restarts the app, and migrations run automatically. `postgres.size` and `postgres.storageClass` can't be changed
afterwards. `helm rollback` to an older app version fails at startup, because the database is already newer: restore the backup
written before the upgrade instead. `helm uninstall` removes the app but keeps the Secret, the database volume and the backup volume,
so delete those yourself if you really want to. Schedule regular database backups: the dump written before an
upgrade doesn't replace them.

Don't change the major version of `postgres.image.tag` on an existing database: PostgreSQL can't read a data directory of an older
major version.
