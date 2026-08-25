FROM php:8.2-apache

# Instala dependencias do sistema e extensões PHP necessarias (SQLite PDO)
RUN apt-get update && apt-get install -y \
    libsqlite3-dev \
    sqlite3 \
    && docker-php-ext-install pdo pdo_sqlite \
    && rm -rf /var/lib/apt/lists/*

# Ativa o mod_rewrite do Apache para possiveis URLs amigaveis
RUN a2enmod rewrite

# Cria o diretorio para o banco de dados SQLite fora do DocumentRoot para maior seguranca
RUN mkdir -p /var/www/db && chown -R www-data:www-data /var/www/db

RUN echo "ServerName localhost" >> /etc/apache2/apache2.conf

WORKDIR /var/www/html
