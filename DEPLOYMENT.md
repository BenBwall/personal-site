# Domus deployment

Every push to `main` runs `.github/workflows/deploy-domus.yml`. GitHub builds the
static site for `https://people.arcada.fi/~bergenwb/` and syncs `dist/` to the
Domus `html` directory over SFTP. The JavaScript publisher connects to
`penti.arcada.fi`, `xena.arcada.fi`, and `gabrielle.arcada.fi`. It verifies the
target marker at `/home/b/bergenwb/html/.personal-site-deploy-target` on each
host and proves that their writes are visible through the same directory before
dividing file transfers among them. Available hosts that pass both checks are
used concurrently; one verified host is enough to deploy. The marker must match
`.github/domus-deploy-target` before any upload. The existing
`html/.htaccess` and marker are kept. The previous site has a one-time backup
at `H:\.personal-site-pre-ci-backup` before the first CI deployment.

The workflow uses the `domus` GitHub environment. Restrict that environment to
`main` and set these **environment secrets** in the repository's GitHub settings:

| Secret            | Value                                          |
| ----------------- | ---------------------------------------------- |
| `ARCADA_USERNAME` | Arcada username without `@arcada.fi` or `sad\` |
| `ARCADA_PASSWORD` | Password for that account                      |

Do not commit credentials. The account needs SFTP write access to the public
`html` directory through at least one of those hosts. These secrets give the workflow
the account's broader Arcada access, so a dedicated account limited to this
directory is preferable when Arcada can provide one.

`.github/domus_known_hosts` pins the SSH host keys observed on 2026-09-23.
If a host rotates its key, confirm the new fingerprint with Arcada IT
before updating this file.

The publisher preserves `.htaccess` and the target marker, removes stale site
files, then writes `html/deployment.json` with the commit SHA. It checks that
the public URL serves that SHA. A successful GitHub push alone does not confirm
deployment; check the Actions run and the public site. To retry without a new
commit, use the workflow's **Run workflow** button on `main`.
