FROM node:20-bullseye

# Install complete set of build tools and system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    make \
    g++ \
    pkg-config \
    autoconf \
    automake \
    libtool \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    libpixman-1-dev \
    libvips-dev \
    ffmpeg \
    imagemagick \
    webp \
    libreoffice \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with flags to handle potential conflicts and save RAM
RUN npm install --legacy-peer-deps --no-audit --no-fund

# Copy the rest of the application
COPY . .

# Expose the port (Koyeb usually uses 8000)
EXPOSE 8000

# Start the application
CMD ["node", "index.js"]
