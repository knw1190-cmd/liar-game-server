# Dockerfile for Liar Game Server
FROM node:18-alpine

WORKDIR /usr/src/app

# Install dependencies first for better caching
COPY package*.json ./
RUN npm install

# Copy source files
COPY . .

# Expose port
EXPOSE 3001

# Command to run the application
CMD ["npm", "start"]

# For development with nodemon
# CMD ["npm", "run", "dev"]