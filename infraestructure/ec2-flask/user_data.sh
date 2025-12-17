#!/bin/bash
apt update -y
apt install -y docker.io
systemctl start docker
systemctl enable docker

# Clone seu repositório
git clone https://github.com/Sampa-USP/QuantumComputingBatalhaNaval.git /home/ubuntu/app
cd /home/ubuntu/app/app

# Build e run
docker build -t flask-app app
docker run -d -p 80:5000 flask-app