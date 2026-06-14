# Use the official Microsoft Playwright image that contains Node.js, Python, and all browser dependencies preinstalled
FROM mcr.microsoft.com/playwright:v1.45.0-jammy

# Install pip and venv for python packages
RUN apt-get update && apt-get install -y python3-pip python3-venv && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package configuration
COPY package*.json ./

# Install Node dependencies
RUN npm ci

# Copy Python requirements
COPY requirements.txt ./

# Install Python requirements inside virtual environment
RUN python3 -m venv venv && ./venv/bin/pip install -r requirements.txt

# Copy all application files
COPY . .

# Build Next.js application
RUN npm run build

# Expose the default port (Render will override the port using the PORT env var)
EXPOSE 3000

# Start Next.js server
CMD ["npm", "run", "start"]
