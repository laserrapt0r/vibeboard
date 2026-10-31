# Sign-in methods

vibeboard always has local accounts. Keycloak, SAML, LDAP/Active Directory and Kerberos are optional and off by default.
Configure them under **Administration → Sign-in**. Save first, then use the test button of each method.

## Which methods can be active?

Several at once. That allows a gradual migration, and a failed sign-in service locks nobody out of administration.

| Setting | Meaning |
|---|---|
| **Sign-in with a local password** | *All local accounts*, or *Administrators only*. Local sign-in can never be switched off completely: administrators keep an emergency access. "Administrators only" also closes registration and requires an enabled external method and an active admin with a local password. |
| **On the first external sign-in** | Create and activate the account, create it pending approval, or create nothing. |
| **Validity of external sessions** | Default 7 days. Accounts disabled in the directory lose access after this time at the latest. |
| **Redirect the sign-in page** | Skips the page and goes straight to Keycloak or Kerberos. `/login?local=1` stays reachable. |

### How accounts are matched

1. A known external identity signs in to its account.
2. Otherwise an account with the same e-mail address is linked.
3. Otherwise a new account is created, depending on the setting above. Pending invitations for the address are redeemed.

**Administrator accounts are never linked automatically**, because a directory entry could otherwise take over admin
rights. To link one, open user management, choose *Approve for external sign-in*, and sign in externally once.

Name and address follow the directory on every sign-in. The role follows it only for accounts without a local password,
so a local emergency administrator can't lose access through a group change. The last administrator is never demoted.

An existing account whose address was never confirmed is treated as not owned: on linking, its password is removed, so
whoever registered it can't get in.

Purely external accounts have no password: password change and reset and address change are not available. They can set
up vibeboard's two-factor sign-in; only an administrator can reset it. An account with two-factor sign-in is asked for
the code after every method, including Keycloak and Kerberos.

"Administration only with two-factor sign-in" applies to everyone, including LDAP sign-ins, because LDAP checks only a
password. Purely external accounts signed in with Keycloak, SAML or Kerberos are exempt: enforce a second factor there.

With an external method enabled, the last active administrator with a local password can't be disabled, demoted or deleted.

## Keycloak (OpenID Connect)

Create a client in your realm:

- **Client authentication:** on (confidential client). **Standard flow:** on.
- **Valid redirect URI:** `https://board.example.org/api/auth/oidc/callback`
- **Valid post logout redirect URI:** `https://board.example.org/login*`

In vibeboard enter the issuer (`https://sso.example.org/realms/company`), client ID and secret. The server must be able
to reach the issuer's public address. If Keycloak uses a private CA, set `NODE_EXTRA_CA_CERTS` for the app.

Roles are read from the ID token and from Keycloak's access token (`realm_access`, `resource_access`), plus the `roles`
and `groups` claims. Groups appear only if you add a group membership mapper in Keycloak.

Addresses must be marked as verified in Keycloak. Otherwise sign-in is refused, because an unverified address could
take over someone else's account or invitations. Enable the matching option only if nobody can change their own address.

Any other OpenID Connect provider should work the same way, but only Keycloak has been tested.

## LDAP and Active Directory

The fields are preset for Active Directory:

| Field | Default |
|---|---|
| Permanent identifier | `objectGUID` |
| Username | `sAMAccountName` |
| E-mail address | `mail` |
| Display name | `displayName` |
| Groups | `memberOf` |
| Search filter | people, without disabled accounts, by `sAMAccountName`, `userPrincipalName` or `mail` |

You need a server address (`ldaps://dc.example.org:636`), a read-only service account and the base DN. People sign in in
the normal form with their username, UPN or e-mail address.

Connections are always encrypted: `ldaps://` or StartTLS. Plain `ldap://` is accepted only for localhost. Paste a private
CA as PEM. Groups are full DNs, for example `CN=vibeboard-admins,OU=Groups,DC=example,DC=org`. Nested groups are an option
and work with Active Directory only.

For OpenLDAP, adapt the filter, for example `(&(objectClass=inetOrgPerson)(|(uid={login})(mail={login})))`, and set the
attributes to `entryUUID`, `uid`, `mail`, `cn` and `memberOf`.

Failed attempts are limited to 10 in 15 minutes per directory entry. Keep your domain's lockout threshold above that.

## SAML 2.0

Register vibeboard with your identity provider using the metadata at `https://board.example.org/api/auth/saml/metadata`.
The assertion consumer URL is `https://board.example.org/api/auth/saml/acs`, the entity ID defaults to the public address.

Enter the provider's sign-in URL (HTTP redirect binding) and signing certificate. Assertions must be signed. Set the names
of the attributes for address, name and groups; they default to `email`, `displayName` and `groups`.

Keycloak sends roles in the attribute `Role` by default, and it applies only one role list mapper. Enter `Role` as the group
attribute, or remove the default `role_list` scope from the client before adding your own mapper.

The browser binding needs HTTPS. Tested with Keycloak as identity provider.

## SCIM 2.0

SCIM lets your identity provider create, change and disable accounts.

1. Enable SCIM under *Administration → Sign-in* and generate a token. It is shown once.
2. In the identity provider use the base URL `https://board.example.org/scim/v2` and the token as bearer token. `userName`
   must be the e-mail address.

`DELETE` disables an account instead of removing it, so boards stay. Sessions end at once. Groups are not transferred, and
the last local administrator can't be disabled, and SCIM can't change a local administrator's address. Accounts get their rights through the group mapping of a sign-in method.

Tested against the SCIM protocol directly, including the spelling Microsoft Entra ID uses, but not against Entra or Okta.

## Kerberos single sign-on

vibeboard handles SPNEGO itself, so it works behind any proxy that forwards the `Authorization` header. The Docker image
includes the library. Without Docker, install the optional npm package `kerberos` with the MIT Kerberos headers.

1. Create a service account and a keytab on a domain controller:
   ```
   ktpass /princ HTTP/board.example.org@EXAMPLE.ORG /mapuser vibeboard-svc@EXAMPLE.ORG ^
     /crypto AES256-SHA1 /ptype KRB5_NT_PRINCIPAL /pass * /out krb5.keytab
   ```
2. Make `krb5.keytab` and a `krb5.conf` available to the app, and set `KRB5_KTNAME`. With Docker Compose, use a
   `docker-compose.override.yml`:
   ```yaml
   services:
     app:
       environment:
         KRB5_KTNAME: /etc/vibeboard/krb5.keytab
       volumes:
         - ./kerberos/krb5.keytab:/etc/vibeboard/krb5.keytab:ro
         - ./kerberos/krb5.conf:/etc/krb5.conf:ro
   ```
   The file must be readable by user 1000 (`node`) in the container.
3. Enter the realm in the administration. The service principal defaults to the host of the public address.
4. Let browsers use Kerberos for this address: on Windows add it to the *Local intranet* zone (group policy), in Firefox
   set `network.negotiate-auth.trusted-uris`.

The browser must use the same host name as the service principal, not an IP address or an alias. Windows falls back to
NTLM otherwise, which vibeboard doesn't accept: people then land on the sign-in page.

With LDAP enabled, address, name and groups come from the directory and Kerberos signs in to the same identity as LDAP.
Without LDAP you must enter an e-mail domain. The address is then `<user>@<domain>` and must really be that person's
mailbox, because accounts and invitations are matched by it. Groups are not available.

Tickets from accounts with many groups can be large. vibeboard accepts headers up to 64 KB, but your proxy has its own
limit: `LimitRequestFieldSize` for Apache, `large_client_header_buffers` for nginx.

As an alternative, Keycloak can handle Kerberos itself. vibeboard then needs only the Keycloak connection.
