# Domus deployment

Every push to `main` runs `.github/workflows/deploy-domus.yml`. GitHub builds the
static site for `https://people.arcada.fi/~bergenwb/` and syncs `dist/` to the
Domus `html` directory over SFTP. The TypeScript publisher runs with Bun and connects to
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
files, then writes `html/deployment.json` with the commit SHA. It never lists,
changes or removes the top-level directories in `EXTERNAL_SITES`, which other
repositories publish (currently `html/whack-a-mole`, from
`it-26-sv/whac-a-mole-bergenwb`), and refuses a build that contains one. It checks that
the public URL serves that SHA. A successful GitHub push alone does not confirm
deployment; check the Actions run and the public site. To retry without a new
commit, use the workflow's **Run workflow** button on `main`.

## Whac-A-Mole

`.github/workflows/deploy-whack-a-mole.yml` publishes
[it-26-sv/whac-a-mole-bergenwb](https://github.com/it-26-sv/whac-a-mole-bergenwb) to
`https://people.arcada.fi/~bergenwb/whack-a-mole/`. It only runs on request: use its
**Run workflow** button, or

```sh
gh workflow run deploy-whack-a-mole.yml -R BenBwall/personal-site -f ref=main
```

`ref` is the branch, tag or commit of the game to deploy. The build job checks the game
out, runs `npm ci --ignore-scripts` and `vite build --base /~bergenwb/whack-a-mole/`, and
hands `dist/` to the deploy job, which runs `scripts/deploy-whack-a-mole.ts` in the `domus`
environment with the same Arcada secrets as the site.

The publisher only reads and changes `html/whack-a-mole`, through the first host that
works. That directory must hold `.whack-a-mole-deploy-target` with the content of
`.github/whack-a-mole-deploy-target`. The first run creates the directory with the marker
when it doesn't exist yet; a directory without the right marker is never changed. It
uploads the build (`index.html` last), removes stale files, writes
`html/whack-a-mole/deployment.json` with the game's commit SHA, and checks that the public
URL serves it. The site's own publisher skips `html/whack-a-mole` (`EXTERNAL_SITES`), so
the two deployments never touch each other's files.

The game's repository belongs to the course organization, which doesn't allow a token
limited to it, so the workflow builds from a private mirror,
[BenBwall/whac-a-mole-bergenwb](https://github.com/BenBwall/whac-a-mole-bergenwb). The
game's local clone has both repositories as push URLs of `origin`, so every `git push`
updates both; to set that up in another clone:

```sh
git remote set-url --add --push origin git@github.com:it-26-sv/whac-a-mole-bergenwb.git
git remote set-url --add --push origin git@github.com:BenBwall/whac-a-mole-bergenwb.git
```

The build job reads the mirror with a read-only deploy key that only has access to it.
Its private half is the **repository secret** `WHACK_A_MOLE_DEPLOY_KEY` (not a `domus`
environment secret); the public half is the mirror's deploy key "personal-site
deploy-whack-a-mole workflow". To replace it, create a new key pair, add the public key as
a read-only deploy key of the mirror, store the private key in the secret, and delete the
old deploy key.
