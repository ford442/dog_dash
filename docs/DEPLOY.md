# Deployment

Dog Dash has two optional deploy helpers. **Neither stores credentials in the repository.** Set secrets via environment variables (or a local `.env` file that is gitignored).

## Contabo bundle deploy (`deploy.py`)

Uploads `dist/` as a zip to the Contabo storage manager API.

```bash
npm run build
export DEPLOY_TOKEN="your-deploy-token"
python deploy.py
```

| Variable | Required | Description |
|----------|----------|-------------|
| `DEPLOY_TOKEN` | Yes | API token issued by the storage manager |
| `DEPLOY_PROJECT_NAME` | No | Defaults to `dog-dash` |
| `DEPLOY_BUILD_DIR` | No | Defaults to `dist` |
| `DEPLOY_CONTABO_URL` | No | API base URL |
| `DEPLOY_FOLDER` | No | Remote folder override (defaults to project name) |

## Direct SFTP deploy (`scripts/deploy.py`)

Recursively uploads `dist/` over SFTP. Requires `paramiko` (`pip install paramiko`).

```bash
npm run build
export DEPLOY_HOST="example.com"
export DEPLOY_USER="deploy-user"
export DEPLOY_REMOTE_DIR="public_html/dog-dash"
export DEPLOY_PASSWORD="..."          # or DEPLOY_SSH_KEY_PATH=/path/to/key
python scripts/deploy.py
```

| Variable | Required | Description |
|----------|----------|-------------|
| `DEPLOY_HOST` | Yes | SFTP/SSH hostname |
| `DEPLOY_USER` | Yes | SSH username |
| `DEPLOY_REMOTE_DIR` | Yes | Target directory on the server |
| `DEPLOY_PASSWORD` | One of | SSH password (prompted if omitted in a TTY) |
| `DEPLOY_SSH_KEY_PATH` | One of | Path to a private key file |
| `DEPLOY_PORT` | No | Defaults to `22` |
| `DEPLOY_LOCAL_DIR` | No | Defaults to `dist` |

**Security:** Do not commit tokens, passwords, or host-specific usernames. Rotate any credentials that were previously committed to git history.
