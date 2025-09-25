#!/bin/bash

echo "�� Iniciando despliegue completo de Photography Web..."

# Cambiar permisos para git
echo "📁 Cambiando permisos para git..."
sudo chown -R ubuntu:ubuntu /var/www/html/photography-web

# Hacer git pull
echo "📥 Actualizando código desde GitHub..."
cd /var/www/html/photography-web
git pull

# Backend: Instalar dependencias
echo "📦 Instalando dependencias del backend..."
cd /var/www/html/photography-web/server
npm install

# Backend: Reiniciar PM2
echo "🔄 Reiniciando backend..."
sudo pm2 restart photography-web

# Frontend: Instalar dependencias
echo "�� Instalando dependencias del frontend..."
cd /var/www/html/photography-web/Front
npm install

# Frontend: Construir proyecto
echo "🔨 Construyendo frontend..."
npm run build

# Cambiar permisos para Apache
echo "�� Configurando permisos para Apache..."
sudo chown -R www-data:www-data /var/www/html/photography-web/Front

# Recargar Apache
echo "�� Recargando Apache..."
sudo systemctl reload apache2

echo "✅ ¡Despliegue completo finalizado!"
echo "�� Frontend: https://victodorushots.com"
echo "🔧 Backend: http://localhost:5001"
echo "�� PM2 Status:"
sudo pm2 status
