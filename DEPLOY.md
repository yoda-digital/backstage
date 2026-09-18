# Deploy DevPane Developer Portal

## On your production server

### 1. Create a project directory

```bash
mkdir -p /opt/devpane && cd /opt/devpane
```

### 2. Download the deployment files

```bash
curl -sL https://raw.githubusercontent.com/yoda-digital/backstage/main/docker-compose.yaml -o docker-compose.yaml
curl -sL https://raw.githubusercontent.com/yoda-digital/backstage/main/.env.example -o .env
```

### 3. Edit .env with your values

```bash
nano .env
```

Required values:

```
POSTGRES_PASSWORD=<generate a strong random password>
CLOUDFLARE_TUNNEL_TOKEN=eyJhIjoiNWI3ZWM4Zjg4OT...  (from Cloudflare)
PORTAL_BASE_URL=https://ai.esemplagov.tech
BACKEND_BASE_URL=https://ai.esemplagov.tech
```

### 4. Login to GitHub Container Registry

```bash
echo "YOUR_GITHUB_TOKEN" | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

### 5. Start

```bash
docker compose up -d
```

### 6. Verify

```bash
docker compose ps          # all 3 services should be "Up"
docker compose logs -f     # watch for errors
curl https://ai.esemplagov.tech  # should return the portal
```

## Updating

```bash
docker compose pull
docker compose up -d
```

## Logs

```bash
docker compose logs backstage    # app logs
docker compose logs postgres     # database logs
docker compose logs cloudflared  # tunnel logs
```

## Backup database

```bash
docker compose exec postgres pg_dump -U backstage backstage > backup.sql
```
