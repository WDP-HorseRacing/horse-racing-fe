FROM caddy:2-alpine

COPY docker/Caddyfile /etc/caddy/Caddyfile
COPY dist/ /srv/

EXPOSE 80
