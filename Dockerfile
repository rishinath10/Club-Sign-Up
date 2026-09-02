# Multi-stage build for Coolify.
#
# VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY must be set as BUILD-TIME
# variables in Coolify (not just runtime env vars) - Vite bakes them into
# the JS bundle when `npm run build` runs, so they have to be present
# during the build stage below, not after the container starts.

FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
