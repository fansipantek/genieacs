FROM node:18-buster
LABEL maintainer="vo.nguyen@fansipan.technology"

RUN apt-get update && apt-get install -y sudo supervisor git
RUN mkdir -p /var/log/supervisor
RUN mkdir -p /opt/genieacs
COPY ./dist/bin /opt/genieacs/bin
COPY ./dist/public /opt/genieacs/public
COPY ./*.json /opt/genieacs
COPY ./config /opt/genieacs/config
COPY ./config/ext /opt/genieacs/ext

WORKDIR /opt/genieacs
RUN npm install

COPY ./supervisord.conf /etc/supervisor/conf.d/supervisord.conf

RUN chmod -R +x /opt/genieacs/ext/*
RUN mkdir -p /var/log/genieacs
RUN chown 777 /var/log/genieacs
WORKDIR /var/log/genieacs

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]