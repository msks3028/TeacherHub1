# --- Build stage ---
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

# --- Runtime stage: static files served by nginx, /api proxied to the backend ---
FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
# nginx's official entrypoint runs envsubst on every file in
# /etc/nginx/templates/*.template automatically before starting — set
# BACKEND_URL to wherever the backend container/service is reachable, e.g.:
#   docker run -e BACKEND_URL=http://backend:5000 ...
ENV BACKEND_URL=http://backend:5000
EXPOSE 80
