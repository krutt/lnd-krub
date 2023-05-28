### Builder ###
FROM node:18-bullseye AS builder
COPY . /usr/src
WORKDIR /usr/src
### Fetch dependencies from lock file ###
RUN yarn --frozen-lockfile
### Build server ###
RUN yarn build
### Build cronjobs ###
# ENV NODE_ENV=production
# RUN yarn bundle:jobs
### Prune development dependencies from production image ###
RUN yarn --prod --ignore-scripts
### Runner ###
FROM node:18-bullseye-slim AS runner
LABEL maintainer="Sitt Guruvanich <aekasitt.g@siamintech.co.th>"
### Install cron ###
# RUN apt-get update && apt-get install -y cron
### Copy built files from builder image ###
WORKDIR /usr/src/
COPY --from=builder /usr/src/dist/ /usr/src
# COPY --from=builder /usr/src/cronjobs/ /usr/src/cronjobs/
COPY --from=builder /usr/src/node_modules/ /usr/local/lib/node_modules/
RUN npm config set prefix /usr/local/lib/node_modules/
### Create entrypoint shellscript and assign execution rights to it ###
ADD entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod 0744 /usr/local/bin/entrypoint.sh
### Expose port to run node server ###
EXPOSE 3000
ENTRYPOINT [ "entrypoint.sh" ]