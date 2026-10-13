# ============================================================
# YOURS ~ home — static site image
#
# Two stages. The app is built once, at image-build time, and the
# final image carries only nginx plus the built files. Nothing runs
# node at runtime, so the container idles at a few MB of RAM.
# ============================================================

# ---- build -------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

# deps first, so this layer caches across source edits
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- serve -------------------------------------------------
FROM nginx:1.27-alpine

# our server block replaces the stock default
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

# lets dokploy tell "serving" apart from "started"
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1
