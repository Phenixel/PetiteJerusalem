FROM python:3.12-alpine

WORKDIR /app

COPY requirements.txt .

RUN pip install -r requirements.txt

COPY src/ .

COPY docker/entrypoint.py .

RUN chmod +x entrypoint.py

ENV DJANGO_PORT=8000

EXPOSE 8000

ENTRYPOINT [ "/app/entrypoint.py" ]
