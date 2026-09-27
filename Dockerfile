# Use a lightweight node image with alpine
FROM node:20-alpine

# Install MongoDB community server binaries directly inside the container instance
RUN echo "http://dl-cdn.alpinelinux.org/alpine/v3.9/main" >> /etc/apk/repositories && \
    echo "http://dl-cdn.alpinelinux.org/alpine/v3.9/community" >> /etc/apk/repositories && \
    apk update && \
    apk add --no-cache mongodb

# Establish working directory tree framework
WORKDIR /usr/src/app

# Download the server script directly from your GitHub repository
RUN wget https://raw.githubusercontent.com/hhj061540-lang/bookish-dollop/refs/heads/main/server.js -O server.js

# Initialize package.json and install required production dependencies
RUN npm init -y && \
    npm install express mongoose dotenv

# Create the dedicated persistent database storage volume mount path
RUN mkdir -p /data/db

# Expose internal interface ports (Express engine layer and MongoDB port)
EXPOSE 3000
EXPOSE 21017

# Set default environment variables (can be overridden via docker run)
ENV MONGO_URL=mongodb://127.0.0.1:21017/vcc_db

# Execute background daemon initialization sequence alongside server node engine
CMD ["sh", "-c", "mongod --fork --logpath /var/log/mongodb.log --dbpath /data/db --bind_ip 127.0.0.1 --port 21017 && node server.js"]
