MAINTAINER=@fansipan.technology
ARG VERSION=latest
FROM demo_base:${VERSION}

ARG VERSION=latest

# store container version
RUN echo "genieacs ${VERSION}" >> /etc/container-version

# RUN apt-get update && apt-get install -y git apt-transport-https apt-utils supervisor curl npm
RUN apt-get update && apt-get install -y git apt-transport-https apt-utils supervisor curl

RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash
ENV NODE_VERSION=16.20.0
ENV NVM_DIR=/opt/admin/.nvm
# RUN . /opt/admin/.bashrc
RUN . "$NVM_DIR/nvm.sh" && nvm install ${NODE_VERSION}
RUN . "$NVM_DIR/nvm.sh" && nvm use v${NODE_VERSION}
RUN . "$NVM_DIR/nvm.sh" && nvm alias default v${NODE_VERSION}
ENV PATH="${NVM_DIR}/versions/node/v${NODE_VERSION}/bin/:${PATH}"

RUN mkdir -p /var/log/supervisor

# install genieacs xmpp from github
WORKDIR /opt
ARG GENIEACS_VERSION=fsp-xmpp
RUN git clone https://github.com/fansipantek/genieacs.git && \
    git -C genieacs checkout $GENIEACS_VERSION
RUN for file in `grep -ri 'document.title' ./genieacs/ui | awk '{print $1}'`; \
    do \
    sed -ri 's|(^.*document.title.*)GenieACS|\1 ACS|g' "${file%%:}"; \
    done
RUN for file in `grep -ri 'logo.svg' ./genieacs/ui | awk '{print $1}'`; \
    do \
    sed -ri 's|logo.svg|logo.png|g' "${file%%:}"; \
    done    
#RUN cd genieacs && npm install && npm install --save redis && npm run build
RUN cd genieacs && npm install && npm run build
COPY inserts/public/* genieacs/dist/public/

# RUN mkdir -p /opt/apps/genieacs/ext
# COPY inserts/ext/* /opt/apps/genieacs/ext/
# RUN chown -R admin:admin /opt/apps/genieacs

RUN mkdir -p /opt/genieacs/ext
COPY inserts/ext/* /opt/genieacs/ext/
RUN chown -R admin:admin /opt/genieacs/ext
RUN chmod -R +x /opt/genieacs/ext/*

# link the config to /opt/genieacs/config
# COPY inserts/config.json /opt/genieacs/dist/config/config.json
# COPY inserts/genieacs.env /opt/genieacs/genieacs.env

#RUN chown admin:admin /opt/genieacs/genieacs.env
#RUN chmod 600 /opt/genieacs/genieacs.env

RUN mkdir /var/log/genieacs
RUN chown admin:admin /var/log/genieacs

# cwmp, nbi, fs, and UI interface
EXPOSE 7547 7557 7567 3000 55592

# GenieACS services are run through supervisord
COPY inserts/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

COPY inserts/docker-entrypoint.d/* /docker-entrypoint.d/
ENTRYPOINT ["docker-entrypoint.sh"]
