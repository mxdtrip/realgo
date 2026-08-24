# syntax=docker/dockerfile:1

FROM python:3.12-slim

WORKDIR /seeds

COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install \
    --progress-bar off \
    --retries 10 \
    --timeout 120 \
    -r requirements.txt
