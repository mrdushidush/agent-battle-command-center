FROM python:3.11-slim

WORKDIR /app

# Install system dependencies + Node.js 20 LTS + PHP 8.2 for multi-language task support
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    php-cli \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && npm install -g typescript tsx \
    && rm -rf /var/lib/apt/lists/*

# Install Go 1.22
RUN curl -fsSL https://go.dev/dl/go1.22.12.linux-amd64.tar.gz | tar -C /usr/local -xz
ENV PATH="/usr/local/go/bin:${PATH}"

# Copy requirements first for caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY src ./src
COPY pyproject.toml .
COPY test_tools.py .

# Create workspace directory and non-root user
RUN mkdir -p /app/workspace \
    && groupadd -g 1001 appgroup \
    && useradd -u 1001 -g appgroup -s /bin/bash -m appuser \
    && chown -R appuser:appgroup /app

ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

USER appuser
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
