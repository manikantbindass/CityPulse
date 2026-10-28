FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY services/api/pom.xml pom.xml
RUN mvn -B dependency:go-offline
COPY services/api/src src
RUN mvn -B verify

FROM eclipse-temurin:21-jre-alpine
RUN addgroup -S citypulse && adduser -S citypulse -G citypulse && apk add --no-cache curl
WORKDIR /app
COPY --from=build /app/target/citypulse-api-0.1.0-SNAPSHOT.jar app.jar
USER citypulse
EXPOSE 8080
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75.0", "-jar", "app.jar"]
