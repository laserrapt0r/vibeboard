# vibeboard on Kubernetes

Prefer Helm? See the [Helm chart](../helm/README.md).

Kustomize manifests for vibeboard, PostgreSQL and ClamAV, tested with `kustomize build` and schema validation against
Kubernetes 1.33. They haven't been run on a live cluster yet, so try them in a test namespace first.

## Before you start

- **One replica only.** Live board state, rate limits and sign-in tickets are kept in the memory of one process. Don't
  scale the Deployment or add an autoscaler. Rollouts use `Recreate`, so an update means a short interruption; clients
  reconnect by themselves.
- **No published image.** Build vibeboard and push it to your registry.
- **Resources.** ClamAV needs about 1.5 GB of memory. The cluster needs a default StorageClass.

## Install

```bash
# 1. Build and push the image
docker build -t registry.example.org/vibeboard:4.5.0 .
docker push registry.example.org/vibeboard:4.5.0

# 2. Adapt: image in kustomization.yaml, PUBLIC_URL in configmap.yaml, host names in ingress.yaml

# 3. Create the namespace and Secret
kubectl apply -f deploy/kubernetes/namespace.yaml
kubectl -n vibeboard create secret generic vibeboard-secrets \
  --from-literal=postgres-password="$(openssl rand -base64 32)" \
  --from-literal=admin-email=admin@example.org \
  --from-literal=admin-password="$(openssl rand -base64 24)"

# 4. Deploy
kubectl apply -k deploy/kubernetes
kubectl -n vibeboard rollout status deployment/vibeboard
```

TLS needs the Secret `vibeboard-tls`, for example from cert-manager. The first ClamAV start takes several minutes while
signatures download; uploads wait for the scanner until then.

## Ingress

Live updates use Server-Sent Events, so the proxy must not buffer responses and must keep idle connections open.
`ingress.yaml` is generic and carries the annotations for ingress-nginx. Traefik needs none. Uncomment `ingressClassName`
if your cluster has no default class. For the Gateway API use `optional/httproute.yaml` instead.

`TRUST_PROXY=1` assumes exactly one proxy in front of the app. Add one for each additional hop, for example a load
balancer that sets `X-Forwarded-For`.

## Sign-in methods

Configure Keycloak, LDAP and Kerberos in the administration; see [docs/authentication.md](../../docs/authentication.md).
For Kerberos, `optional/kerberos-patch.yaml` mounts the keytab and `krb5.conf`. If Keycloak or LDAP are in the cluster,
the policies in `networkpolicy.yaml` don't restrict the app's outgoing traffic.

## Backups

The app writes a database dump to the `vibeboard-backups` volume before each upgrade. That doesn't replace regular
backups: schedule `pg_dump` or use your platform's volume snapshots.

## Upgrade

Push the new image, update `newTag` and run `kubectl apply -k deploy/kubernetes`. Migrations run automatically at startup.
