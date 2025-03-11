#!/bin/bash

# This script publishes updates to S3
# It loads credentials from the .env file in the project root

# Load environment variables from .env file
if [ -f ".env" ]; then
  echo "Loading credentials from .env file..."
  export $(grep -v '^#' .env | xargs)
else
  echo "Error: .env file not found in the project root."
  echo "Please create a .env file with the required credentials."
  exit 1
fi

# Check if required environment variables are set
if [ -z "$APPLE_ID" ] || [ -z "$APPLE_APP_SPECIFIC_PASSWORD" ] || [ -z "$APPLE_TEAM_ID" ] || 
   [ -z "$CSC_LINK" ] || [ -z "$CSC_KEY_PASSWORD" ]; then
  echo "Error: Required environment variables for Apple signing are not set in .env file."
  echo "Please add APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID, CSC_LINK, and CSC_KEY_PASSWORD to your .env file."
  exit 1
fi

if [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ] || [ -z "$AWS_REGION" ]; then
  echo "Error: Required environment variables for AWS are not set in .env file."
  echo "Please add AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_REGION to your .env file."
  exit 1
fi

echo "Building and publishing update..."
npm run publish-update 