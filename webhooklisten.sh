#!/usr/bin/env bash

while true; do
  # Lanzamos el túnel inverso. 
  # -o ExitOnForwardFailure=yes evita quedarse colgado si no puede abrir el puerto.
  ssh -o ServerAliveInterval=30 \
      -o ServerAliveCountMax=3 \
      -o ExitOnForwardFailure=yes \
      -N \
      -R 6000:localhost:5001 ubuntu@46.105.31.243

  echo "Túnel caído $(date), reintentando en 10s…" >&2
  sleep 10
done