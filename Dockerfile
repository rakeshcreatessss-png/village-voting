FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    libx11-6 \
    libglib2.0-0 \
    libgl1 \
    build-essential \
    cmake \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .

RUN pip install -r requirements.txt

COPY . .

CMD ["sh", "-c", "uvicorn api.index:app --host 0.0.0.0 --port ${PORT:-8080}"]
