FROM node:12

# Set up directory for the server
RUN mkdir /app/
WORKDIR /app/

# Copy front end pacakge.json and install
RUN mkdir front-end
WORKDIR /app/front-end/
COPY package*.json /app/front-end/
RUN npm install

# Copy server pacakge.json and install
WORKDIR /app/
COPY package.json /app/
COPY package-lock.json /app/
RUN npm install

# Build front end
COPY front-end/ /app/front-end/
WORKDIR /app/front-end/
RUN npm run-script build

WORKDIR /app/
COPY server.js /app/
COPY probe.js /app/
COPY constants.js /app/
COPY notification.js /app/
COPY database.js /app/
COPY api.js /app/
COPY app.js /app/
COPY utils.js /app/
COPY docker-entrypoint.sh /app/
RUN chmod +x /app/docker-entrypoint.sh
COPY templates /app/templates

# Expose both HTTP and HTTPS ports
EXPOSE 80
EXPOSE 443

# Start the server
ENTRYPOINT ["/app/docker-entrypoint.sh"]
