# ZIO Monitor de Sites | ZIO Website Monitor 🚀

[pt-BR] **ZIO Monitor de Sites** é um painel moderno, leve e altamente performático para observabilidade e monitoramento de disponibilidade (uptime) e latência de websites, APIs e serviços em tempo real. Desenvolvido com frontend responsivo e dinâmico (Vanilla JS, CSS3, Chart.js) e backend PHP de alta velocidade alimentado por banco de dados SQLite.

[en] **ZIO Website Monitor** is a modern, lightweight, and high-performance dashboard for real-time observability and uptime/latency monitoring of websites, APIs, and services. Built with a dynamic responsive frontend (Vanilla JS, CSS3, Chart.js) and a fast PHP backend powered by SQLite database.

---

## 🌐 Idiomas / Languages
- [Português (PT-BR)](#-português-pt-br)
- [English (EN)](#-english-en)

---

# 🇧🇷 Português (PT-BR)

## ✨ Recursos do Sistema

- ⚡ **Monitoramento de Latência e Uptime em Tempo Real**: Checagens automáticas via cURL com captura de tempo de resposta em milissegundos e código de status HTTP.
- 🏷️ **Categorização Múltipla de Sites**: Organize seus sites em múltiplas categorias (ex: `Produção`, `E-commerce`, `APIs`, `Clientes`).
- 🔀 **Ordenação e Filtro Avançado**:
  - Filtre sites por categoria específica.
  - Ordene por **Maior Latência Primeiro**, **Menor Latência Primeiro**, **Nome (A-Z)** ou **Offline Primeiro**.
- 📊 **Gráficos de Histórico Interativos**: Gráficos individuais por domínio com histórico de latência das últimas checagens alimentados por Chart.js.
- 🔔 **Alertas Sonoros Inteligentes**: Notificação auditiva imediata ao detectar queda de site, com opção de **silenciar alertas individualmente** por domínio ou mutar globalmente.
- 📁 **Importação em Lote (.TXT)**: Importe dezenas de URLs arrastando um arquivo `.txt` ou colando uma lista de links.
- 🔄 **Checagem Imediata ("Verificar Agora")**: Dispare checagens sob demanda a qualquer momento com um clique.
- ✏️ **Gerenciamento Completo (CRUD)**: Cadastre, edite (nome, URL, intervalo e categorias) e remova monitores facilmente.
- 🎨 **Interface Dark Mode Premium**: Design responsivo em 2 colunas, glassmorphism e animações suaves sem dependência de frameworks pesados.

---

## 🛠️ Requisitos do Sistema

- **PHP** >= 8.0 com extensões `pdo_sqlite` e `curl` ativas.
- **SQLite3** habilitado.
- *(Opcional)* **Docker** e **Docker Compose** para execução simplificada em containers.

---

## 💻 Passo a Passo para Instalação em Localhost

### Opção 1: Usando Docker Compose (Recomendado)

1. Clone o repositório ou navegue até a pasta do projeto:
   ```bash
   cd /caminho/para/monitor-de-sites
   ```

2. Suba o container Docker:
   ```bash
   docker-compose up -d --build
   ```

3. Acesse a aplicação no seu navegador:
   ```text
   http://localhost:8181
   ```

---

### Opção 2: Servidor Embutido do PHP (Sem Docker)

1. Certifique-se de que o PHP 8.x e a extensão SQLite estão instalados:
   ```bash
   php -m | grep sqlite
   ```

2. Crie a pasta do banco de dados na raiz do projeto (caso não exista):
   ```bash
   mkdir -p db
   chmod 777 db
   ```

3. Inicie o servidor embutido a partir do diretório `src`:
   ```bash
   php -S localhost:8181 -t src
   ```

4. Acesse no navegador:
   ```text
   http://localhost:8181
   ```

---

## ☁️ Passo a Passo para Implantação em VPS (Produção)

### Método A: Usando Docker + Nginx Reverse Proxy (Recomendado para VPS Ubuntu/Debian)

1. Conecte-se à sua VPS via SSH:
   ```bash
   ssh usuario@ip-da-sua-vps
   ```

2. Instale o Docker e Docker Compose na VPS (se necessário):
   ```bash
   sudo apt update && sudo apt install -y docker.io docker-compose git
   ```

3. Clone o projeto e entre na pasta:
   ```bash
   git clone https://github.com/seu-usuario/monitor-de-sites.git
   cd monitor-de-sites
   ```

4. Inicie o container em segundo plano:
   ```bash
   docker-compose up -d --build
   ```

5. Configuração do Nginx como Proxy Reverso (porta 80 -> 8181):
   Crie o arquivo `/etc/nginx/sites-available/monitor.conf`:
   ```nginx
   server {
       server_name monitor.seudominio.com;

       location / {
           proxy_pass http://127.0.0.1:8181;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```

6. Ative o site e gere certificado SSL gratuito com Certbot:
   ```bash
   sudo ln -s /etc/nginx/sites-available/monitor.conf /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   sudo certbot --nginx -d monitor.seudominio.com
   ```

---

### Método B: Instalação Nativa com Apache / Nginx na VPS

1. Instale os pacotes necessários:
   ```bash
   sudo apt update
   sudo apt install -y apache2 php libapache2-mod-php php-sqlite3 php-curl sqlite3
   ```

2. Copie os arquivos do projeto para o DocumentRoot do webserver:
   ```bash
   sudo mkdir -p /var/www/html/monitor
   sudo cp -r src/* /var/www/html/monitor/
   sudo mkdir -p /var/www/db
   ```

3. Ajuste as permissões para o usuário do servidor web (`www-data`):
   ```bash
   sudo chown -R www-data:www-data /var/www/html/monitor
   sudo chown -R www-data:www-data /var/www/db
   sudo chmod -R 775 /var/www/db
   ```

4. Acesse no navegador:
   ```text
   http://ip-da-vps/monitor ou https://monitor.seudominio.com
   ```

---

## 📁 Estrutura de Arquivos

```text
monitor-de-sites/
├── Dockerfile             # Configuração da imagem Docker (PHP 8.2 + Apache + SQLite)
├── docker-compose.yml     # Orquestração do serviço e volumes
├── db/                    # Diretório persistente do banco de dados SQLite (monitors.db)
└── src/                   # Código fonte da aplicação
    ├── index.html         # Interface do painel de controle
    ├── api.php            # API REST backend em PHP
    └── assets/
        ├── app.js         # Lógica JavaScript, gráficos e interações
        └── style.css      # Estilização CSS3 (Design System Dark)
```

---

## 📡 Referência da API REST (`api.php`)

| Endpoint | Método | Descrição |
| :--- | :--- | :--- |
| `?action=list_monitors` | `GET` | Retorna todos os monitores com status e última latência. |
| `?action=create_monitor` | `POST` | Cria um novo monitor (`name`, `url`, `check_interval`, `categories`). |
| `?action=update_monitor` | `POST` | Atualiza dados de um monitor (`id`, `name`, `url`, `check_interval`, `categories`). |
| `?action=delete_monitor&id=X` | `POST`/`DELETE` | Exclui o monitor com ID X. |
| `?action=toggle_mute&id=X` | `POST` | Alterna o silenciamento de alertas para o monitor X. |
| `?action=check_monitor&id=X` | `GET` | Executa uma checagem sob demanda do monitor X. |
| `?action=get_logs&id=X` | `GET` | Retorna os últimos registros de latência do monitor X para o gráfico. |
| `?action=get_stats` | `GET` | Retorna métricas globais (Total, Online, Offline, Latência Média). |

---

# 🇬🇧 English (EN)

## ✨ Features

- ⚡ **Real-Time Uptime & Latency Monitoring**: Automatic checks via cURL capturing response time in milliseconds and HTTP status code.
- 🏷️ **Multi-Category Tagging**: Organize websites into multiple categories (e.g., `Production`, `E-commerce`, `APIs`, `Clients`).
- 🔀 **Advanced Sorting & Filtering**:
  - Filter sites by specific categories.
  - Sort by **Highest Latency First**, **Lowest Latency First**, **Name (A-Z)**, or **Offline First**.
- 📊 **Interactive Historical Charts**: Individual domain charts displaying response time history powered by Chart.js.
- 🔔 **Smart Sound Alerts**: Instant audio notification when a website drops offline, with option to **mute alerts per domain** or globally.
- 📁 **Batch File Import (.TXT)**: Import dozens of URLs by dragging a `.txt` file or pasting a list of links.
- 🔄 **On-Demand Check ("Check Now")**: Trigger instant checks for any domain with one click.
- ✏️ **Full Management (CRUD)**: Easily add, edit (Name, URL, Check Interval, Categories), and remove monitors.
- 🎨 **Premium Dark Mode UI**: 2-column responsive layout, glassmorphism, and smooth micro-animations built without heavy frontend frameworks.

---

## 🛠️ System Requirements

- **PHP** >= 8.0 with `pdo_sqlite` and `curl` extensions enabled.
- **SQLite3** enabled.
- *(Optional)* **Docker** and **Docker Compose** for containerized setup.

---

## 💻 Localhost Installation Guide

### Option 1: Using Docker Compose (Recommended)

1. Clone repository or navigate to project directory:
   ```bash
   cd /path/to/monitor-de-sites
   ```

2. Build and start Docker container:
   ```bash
   docker-compose up -d --build
   ```

3. Open in your browser:
   ```text
   http://localhost:8181
   ```

---

### Option 2: Native PHP Built-in Server (Without Docker)

1. Verify PHP 8.x and SQLite extension:
   ```bash
   php -m | grep sqlite
   ```

2. Create database directory in root directory:
   ```bash
   mkdir -p db
   chmod 777 db
   ```

3. Start PHP built-in server from `src`:
   ```bash
   php -S localhost:8181 -t src
   ```

4. Open in your browser:
   ```text
   http://localhost:8181
   ```

---

## ☁️ VPS Deployment Guide (Production)

### Method A: Docker + Nginx Reverse Proxy (Recommended for Ubuntu/Debian VPS)

1. Connect to your VPS via SSH:
   ```bash
   ssh user@vps-ip-address
   ```

2. Install Docker & Docker Compose:
   ```bash
   sudo apt update && sudo apt install -y docker.io docker-compose git
   ```

3. Clone project repository:
   ```bash
   git clone https://github.com/your-user/monitor-de-sites.git
   cd monitor-de-sites
   ```

4. Launch container:
   ```bash
   docker-compose up -d --build
   ```

5. Configure Nginx Reverse Proxy (`/etc/nginx/sites-available/monitor.conf`):
   ```nginx
   server {
       server_name monitor.yourdomain.com;

       location / {
           proxy_pass http://127.0.0.1:8181;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```

6. Enable site & SSL certificate via Certbot:
   ```bash
   sudo ln -s /etc/nginx/sites-available/monitor.conf /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   sudo certbot --nginx -d monitor.yourdomain.com
   ```

---

## 📄 License
MIT License. Developed for real-time observability and reliability.
