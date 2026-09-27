# Stage 1: Get modern MongoDB binaries
FROM mongo:7.0 AS mongo_bin

# Stage 2: Target runtime container layer using Debian-slim (fully compatible with MongoDB binaries and libcurl)
FROM node:20-slim

# Install system dependencies including curl and wget required by MongoDB and setup
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    curl \
    ca-certificates \
    libcurl4 \
    libgssapi-krb5-2 \
    libldap-2.5-0 \
    libsasl2-2 \
    libsnmp40 \
    && rm -rf /var/lib/apt/lists/*

# Copy MongoDB binaries from the first stage securely
COPY --from=mongo_bin /usr/bin/mongod /usr/bin/mongod

# Establish working directory tree framework
WORKDIR /usr/src/app

# Download the server script directly from your GitHub repository
RUN wget https://raw.githubusercontent.com/hhj061540-lang/bookish-dollop/refs/heads/main/server.js -O server.js

# Initialize package.json and install explicitly compatible versions for Mongoose/Express/Dotenv
RUN npm init -y && \
    npm install express@^4.19.2 mongoose@^8.3.1 dotenv@^16.4.5

# Create the dedicated persistent database storage volume mount path
RUN mkdir -p /data/db

# Expose internal interface ports
EXPOSE 3000

# Set default environment variables
ENV PORT=3000
ENV MONGO_URL=mongodb://127.0.0.1:21017/vcc_db

# Execute background daemon initialization sequence alongside server node engine
CMD ["sh", "-c", "mongod --fork --logpath /var/log/mongodb.log --dbpath /data/db --bind_ip 127.0.0.1 --port 21017 && node server.js"]
