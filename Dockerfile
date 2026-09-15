# Use Python slim as base
FROM python:3.10-slim

# Install system dependencies (Node.js, OpenCV requirements, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    ffmpeg \
    && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Install Python dependencies first
COPY python_backend/requirements.txt ./python_backend/
RUN pip install --no-cache-dir -r python_backend/requirements.txt

# Install Node dependencies
COPY server/package*.json ./server/
RUN cd server && npm install

# Copy all application code
COPY python_backend/ ./python_backend/
COPY server/ ./server/

# Copy startup script
COPY start.sh ./
RUN sed -i 's/\r$//' start.sh && chmod +x start.sh

# Expose Node.js port (Render/Railway will route traffic here)
EXPOSE 5000

# Start both Node and Python
CMD ["./start.sh"]
