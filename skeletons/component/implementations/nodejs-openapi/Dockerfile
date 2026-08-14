FROM registry.access.redhat.com/ubi9/nodejs-24:latest

WORKDIR /opt/app-root/src
COPY --chown=1001:0 package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --chown=1001:0 dist ./dist
COPY --chown=1001:0 contracts ./contracts

EXPOSE 8080
CMD ["npm", "start"]
