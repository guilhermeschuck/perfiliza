# Guia de Instalacao em Servidor - Perfiliza

Este documento descreve uma instalacao de producao simples e estavel para o sistema Perfiliza.

## 1) Arquitetura recomendada

- Frontend: Next.js (raiz do repositorio), exposto em `https://app.seudominio.com`
- Backend/API: Laravel (pasta `backend`), exposto em `https://api.seudominio.com`
- Banco: PostgreSQL
- Processo de fila (opcional, recomendado): `queue:work` para analises assincronas

Observacao importante: o frontend usa `LARAVEL_API_URL` para chamar o backend (arquivo `lib/backend-proxy.ts`).

## 2) Requisitos de servidor

Minimo sugerido:

- Ubuntu 22.04 ou 24.04 LTS
- 2 vCPU
- 4 GB RAM
- 30 GB SSD

Pacotes e runtimes:

- Node.js 20+ (recomendado 22 LTS)
- pnpm (via Corepack)
- PHP 8.2+
- Composer 2
- PostgreSQL 14+
- Nginx
- `poppler-utils` (usa `pdftotext` e `pdftoppm`)
- `tesseract-ocr`, `tesseract-ocr-por`, `tesseract-ocr-eng`

Extensoes PHP necessarias:

- `bcmath`, `ctype`, `curl`, `dom`, `fileinfo`, `mbstring`, `openssl`, `pdo`, `pdo_pgsql`, `tokenizer`, `xml`, `zip`, `iconv`

## 3) Instalacao de pacotes (Ubuntu)

```bash
sudo apt update
sudo apt install -y git curl unzip nginx postgresql postgresql-contrib \
  php php-cli php-fpm php-mbstring php-xml php-curl \
  php-bcmath php-pgsql php-zip php-intl \
  poppler-utils tesseract-ocr tesseract-ocr-por tesseract-ocr-eng

# Node + pnpm (Corepack)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo corepack enable
sudo corepack prepare pnpm@latest --activate

# Composer
cd /tmp
php -r "copy('https://getcomposer.org/installer', 'composer-setup.php');"
php composer-setup.php
sudo mv composer.phar /usr/local/bin/composer
```

## 4) Clonar projeto

```bash
sudo mkdir -p /var/www
sudo chown -R $USER:$USER /var/www
cd /var/www
git clone <URL_DO_REPOSITORIO> perfiliza
cd /var/www/perfiliza
```

## 5) Configurar banco PostgreSQL

```bash
sudo -u postgres psql
```

No prompt do PostgreSQL:

```sql
CREATE DATABASE perfiliza_backend;
CREATE USER perfiliza_user WITH ENCRYPTED PASSWORD 'trocar_esta_senha';
GRANT ALL PRIVILEGES ON DATABASE perfiliza_backend TO perfiliza_user;
\q
```

## 6) Configurar backend (Laravel)

```bash
cd /var/www/perfiliza/backend
cp .env.example .env
```

Edite `backend/.env` com os valores de producao:

```env
APP_NAME="Perfiliza Backend"
APP_ENV=production
APP_KEY=
APP_DEBUG=false
APP_URL=https://api.seudominio.com

DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=perfiliza_backend
DB_USERNAME=perfiliza_user
DB_PASSWORD=trocar_esta_senha

FILESYSTEM_DISK=public
SESSION_DRIVER=database
CACHE_STORE=database
QUEUE_CONNECTION=database

LOG_CHANNEL=stack
LOG_LEVEL=info

# Analise IA (opcional)
ANALYSIS_QUEUE_ENABLED=true
ANALYSIS_QUEUE_CONNECTION=database
ANALYSIS_QUEUE_NAME=analysis
ANALYSIS_AI_PROVIDER=mock
ANALYSIS_AI_MODEL=gpt-4.1-mini
# OPENAI_API_KEY=coloque_sua_chave_se_usar_provider_openai
```

Instalar dependencias e preparar app:

```bash
cd /var/www/perfiliza/backend
composer install --no-dev --optimize-autoloader
php artisan key:generate
php artisan migrate --force
php artisan db:seed --class=DemoStateSeeder --force
php artisan storage:link
php artisan config:cache
php artisan route:cache
```

Ajuste de permissoes:

```bash
sudo chown -R www-data:www-data /var/www/perfiliza/backend/storage /var/www/perfiliza/backend/bootstrap/cache
sudo chmod -R 775 /var/www/perfiliza/backend/storage /var/www/perfiliza/backend/bootstrap/cache
```

## 7) Configurar frontend (Next.js)

Crie o arquivo de ambiente na raiz:

```bash
cd /var/www/perfiliza
cat > .env << 'EOF'
LARAVEL_API_URL=https://api.seudominio.com
EOF
```

Instale e gere build:

```bash
cd /var/www/perfiliza
pnpm install --frozen-lockfile
pnpm build
```

## 8) Services (systemd)

### 8.1 Frontend service

Crie `/etc/systemd/system/perfiliza-frontend.service`:

```ini
[Unit]
Description=Perfiliza Frontend (Next.js)
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/var/www/perfiliza
Environment=NODE_ENV=production
ExecStart=/usr/bin/node /var/www/perfiliza/node_modules/next/dist/bin/next start --port 3000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Ative:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now perfiliza-frontend
sudo systemctl status perfiliza-frontend
```

### 8.2 Queue worker (somente se `ANALYSIS_QUEUE_ENABLED=true`)

Crie `/etc/systemd/system/perfiliza-queue.service`:

```ini
[Unit]
Description=Perfiliza Laravel Queue Worker
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/var/www/perfiliza/backend
ExecStart=/usr/bin/php artisan queue:work --queue=analysis,default --sleep=3 --tries=3 --max-time=3600
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Ative:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now perfiliza-queue
sudo systemctl status perfiliza-queue
```

## 9) Nginx

### 9.1 Frontend (`app.seudominio.com`)

Crie `/etc/nginx/sites-available/perfiliza-app`:

```nginx
server {
    listen 80;
    server_name app.seudominio.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### 9.2 API (`api.seudominio.com`)

Crie `/etc/nginx/sites-available/perfiliza-api`:

```nginx
server {
    listen 80;
    server_name api.seudominio.com;
    root /var/www/perfiliza/backend/public;
    index index.php;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/run/php/php8.2-fpm.sock; # ajuste para sua versao, ex.: php8.3-fpm.sock
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
    }

    location ~ /\. {
        deny all;
    }
}
```

Ativar e recarregar:

```bash
sudo ln -s /etc/nginx/sites-available/perfiliza-app /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/perfiliza-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

TLS (recomendado):

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d app.seudominio.com -d api.seudominio.com
```

## 10) Checklist de validacao

```bash
# API direta
curl -I https://api.seudominio.com/api/bootstrap

# Frontend
curl -I https://app.seudominio.com

# API via frontend (proxy interno do Next)
curl -I https://app.seudominio.com/api/bootstrap
```

Validar tambem:

- `sudo systemctl status perfiliza-frontend`
- `sudo systemctl status php8.2-fpm` (ou `php8.3-fpm`, conforme sua versao)
- `sudo systemctl status nginx`
- se fila ativa: `sudo systemctl status perfiliza-queue`
- logs backend: `/var/www/perfiliza/backend/storage/logs/laravel.log`

## 11) Atualizacao de versao (deploy)

```bash
cd /var/www/perfiliza
git pull

# frontend
pnpm install --frozen-lockfile
pnpm build
sudo systemctl restart perfiliza-frontend

# backend
cd /var/www/perfiliza/backend
composer install --no-dev --optimize-autoloader
php artisan migrate --force
php artisan config:cache
php artisan route:cache
sudo systemctl restart php8.2-fpm # ou php8.3-fpm

# se usar fila
sudo systemctl restart perfiliza-queue
```

## 12) Problemas comuns

- `502 Bad Gateway` no app: `perfiliza-frontend` parado ou falha no build.
- `500` na API: conferir `backend/.env`, permissoes de `storage/` e `bootstrap/cache/`.
- Falha de analise de curriculo PDF/DOCX:
  - confirmar `poppler-utils`, `tesseract-ocr`, `tesseract-ocr-por`, `tesseract-ocr-eng`.
  - confirmar extensao PHP `zip` (DOCX usa `ZipArchive`).
- URLs de arquivo quebradas (`/storage/...`):
  - conferir `APP_URL` do backend e `php artisan storage:link`.
- Analise IA nao usa OpenAI:
  - definir `ANALYSIS_AI_PROVIDER=openai` e `OPENAI_API_KEY`.
