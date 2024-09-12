FROM registry.access.redhat.com/ubi8/openjdk-17:1.20-2

ENV LANGUAGE='en_US:en'

USER root
ADD https://repo1.maven.org/maven2/org/jolokia/jolokia-agent-jvm/2.0.3/jolokia-agent-jvm-2.0.3-javaagent.jar /opt/jolokia/jolokia-javaagent.jar

RUN \
    chown default:default -R /opt/jolokia \
    && chmod -R go+r /opt/jolokia/jolokia-javaagent.jar

ENV JAVA_OPTS_APPEND="-javaagent:/opt/jolokia/jolokia-javaagent.jar=host=0.0.0.0,port=8778,protocol=https,useSslClientAuthentication=true,caCert=/var/run/secrets/kubernetes.io/serviceaccount/service-ca.crt"

# copy application bundle
COPY --chown=185 target/${{ values.component_id }}*.jar /deployments/bundle.jar

EXPOSE 8080
USER 185

ENV JAVA_APP_JAR="/deployments/bundle.jar"
