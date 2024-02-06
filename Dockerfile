FROM node:18-buster
LABEL maintainer="vo.nguyen@fansipan.technology"

RUN apt-get update && apt-get install -y sudo supervisor git
RUN mkdir -p /var/log/supervisor
RUN mkdir -p /opt/genieacs
COPY ./bin /opt/genieacs/bin
COPY ./build /opt/genieacs/build
COPY ./lib /opt/genieacs/lib
COPY ./public /opt/genieacs/public
COPY ./ui /opt/genieacs/ui
COPY ./package.json /opt/genieacs/package.json
COPY ./npm-shrinkwrap.json /opt/genieacs/npm-shrinkwrap.json
COPY ./tsconfig.json /opt/genieacs/tsconfig.json
COPY ./ava.config.js /opt/genieacs/ava.config.js
COPY ./config/ext /opt/genieacs/ext

WORKDIR /opt/genieacs
RUN npm install
RUN npm run build

COPY ./config /opt/genieacs/dist/config
COPY ./supervisord.conf /etc/supervisor/conf.d/supervisord.conf

RUN chmod -R +x /opt/genieacs/ext/*
RUN mkdir -p /var/log/genieacs
RUN chown 777 /var/log/genieacs
WORKDIR /var/log/genieacs

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]