#!/bin/bash
# Script to deploy the Deepgram WebSocket Proxy Server to AWS App Runner

# Check if the AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "AWS CLI is not installed. Please install it first."
    echo "Visit: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
    exit 1
fi

# Check if jq is installed (for JSON parsing)
if ! command -v jq &> /dev/null; then
    echo "jq is not installed. Please install it first."
    echo "Run: apt-get install jq (Debian/Ubuntu) or brew install jq (macOS)"
    exit 1
fi

# Check if .env file exists and has the DEEPGRAM_API_KEY
if [ ! -f .env ]; then
    echo ".env file not found. Please create it with your DEEPGRAM_API_KEY."
    exit 1
fi

if ! grep -q "DEEPGRAM_API_KEY" .env; then
    echo "DEEPGRAM_API_KEY not found in .env file. Please add it."
    exit 1
fi

# Extract the DEEPGRAM_API_KEY from .env file
DEEPGRAM_API_KEY=$(grep "DEEPGRAM_API_KEY" .env | cut -d'=' -f2)

# Define the App Runner service name
SERVICE_NAME="deepgram-websocket-proxy"

echo "=================================================="
echo "Deploying Deepgram WebSocket Proxy to AWS App Runner"
echo "=================================================="

# Check if we're logged in to AWS
echo "Checking AWS authentication..."
aws sts get-caller-identity > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "Not authenticated with AWS. Please run 'aws configure' first."
    exit 1
fi

echo "AWS authentication verified."

# Check if the App Runner service already exists
echo "Checking if service already exists..."
SERVICE_ARN=$(aws apprunner list-services --query "ServiceSummaryList[?ServiceName=='$SERVICE_NAME'].ServiceArn" --output text)

if [ -n "$SERVICE_ARN" ]; then
    echo "Service $SERVICE_NAME already exists. Updating service..."
    
    # Update the service
    aws apprunner update-service \
        --service-arn "$SERVICE_ARN" \
        --source-configuration '{
            "CodeRepository": {
                "RepositoryUrl": "YOUR_REPOSITORY_URL",
                "SourceCodeVersion": {
                    "Type": "BRANCH",
                    "Value": "main"
                },
                "ConfigurationSource": "REPOSITORY"
            }
        }' \
        --environment-variables "DEEPGRAM_API_KEY=$DEEPGRAM_API_KEY,PORT=8000,LOG_LEVEL=INFO"

    echo "Service update initiated."
else
    echo "Service $SERVICE_NAME does not exist. Creating new service..."
    
    # Create a new service
    aws apprunner create-service \
        --service-name "$SERVICE_NAME" \
        --source-configuration '{
            "CodeRepository": {
                "RepositoryUrl": "YOUR_REPOSITORY_URL",
                "SourceCodeVersion": {
                    "Type": "BRANCH",
                    "Value": "main"
                },
                "ConfigurationSource": "REPOSITORY"
            }
        }' \
        --instance-configuration '{
            "Cpu": "1 vCPU",
            "Memory": "2 GB"
        }' \
        --environment-variables "DEEPGRAM_API_KEY=$DEEPGRAM_API_KEY,PORT=8000,LOG_LEVEL=INFO"

    echo "Service creation initiated."
fi

echo ""
echo "IMPORTANT: Replace 'YOUR_REPOSITORY_URL' in this script with your actual Git repository URL."
echo "You can also deploy through the AWS App Runner console by following the instructions in the README."
echo ""
echo "After deployment, update your React Native app with the App Runner service URL."

# Note: This script assumes you have appropriate AWS IAM permissions to create/update App Runner services