FROM python:3.8

WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application files
COPY elevenlabs_app.py .
COPY .env* ./

# Make port available to the outside world
EXPOSE 8001

# Command to run the application
CMD python3 -m uvicorn elevenlabs_app:app --host 0.0.0.0 --port 8001