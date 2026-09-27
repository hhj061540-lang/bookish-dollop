# Stage 1: Get modern MongoDB binaries
FROM mongo:7.0 AS mongo_bin

# Stage 2: Target runtime container layer
FROM node:20-alpine

# Install system dependencies needed to execute database engine runtimes on Alpine
RUN apk add --no-cache libstdc++ gcompat icu-libs wget

# Copy MongoDB binaries from the first stage securely
COPY --from=mongo_bin /usr/bin/mongod /usr/bin/mongod

# Establish working directory tree framework
WORKDIR /usr/src/app

# Download the server script directly from your GitHub repository with the correct raw URL
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
