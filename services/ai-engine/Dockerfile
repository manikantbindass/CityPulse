FROM python:3.12-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 MODEL_REGISTRY_DIR=/app/models AI_STORAGE_DIR=/app/var
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 && rm -rf /var/lib/apt/lists/* && useradd --create-home --uid 10001 citypulse
COPY services/ai-engine/pyproject.toml ./
COPY services/ai-engine/citypulse_ai ./citypulse_ai
COPY services/ai-engine/requirements.lock ./requirements.lock
RUN pip install --no-cache-dir -r requirements.lock && pip install --no-cache-dir --no-deps .
COPY scripts/train_models.py ./scripts/train_models.py
COPY data/sample/ml/daily-segments.json ./data/sample/ml/daily-segments.json
RUN python scripts/train_models.py --data data/sample/ml/daily-segments.json --out models && mkdir -p /app/var && chown -R citypulse:citypulse /app/var
USER citypulse
EXPOSE 8000
CMD ["uvicorn", "citypulse_ai.main:app", "--host", "0.0.0.0", "--port", "8000", "--limit-concurrency", "32", "--timeout-keep-alive", "5"]
