FROM python:3.12-slim
WORKDIR /app
RUN useradd --uid 10002 --create-home citypulse
COPY scripts/data_pipeline.py scripts/data_pipeline.py
COPY services/ingestion services/ingestion
COPY data data
RUN mkdir -p /app/.data && chown citypulse:citypulse /app/.data
USER citypulse
ENTRYPOINT ["python", "scripts/data_pipeline.py"]
CMD ["--help"]
