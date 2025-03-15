#!/bin/bash

# This script publishes updates to S3
# It loads credentials from the .env file in the project root

# Determine which Mac architectures to build based on arguments
BUILD_MAC_X64=false
BUILD_MAC_ARM64=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --x64)
      BUILD_MAC_X64=true
      shift
      ;;
    --arm64)
      BUILD_MAC_ARM64=true
      shift
      ;;
    --all)
      BUILD_MAC_X64=true
      BUILD_MAC_ARM64=true
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [--x64] [--arm64] [--all]"
      exit 1
      ;;
  esac
done

# If no architecture specified, build all
if [ "$BUILD_MAC_X64" = false ] && [ "$BUILD_MAC_ARM64" = false ]; then
  BUILD_MAC_X64=true
  BUILD_MAC_ARM64=true
fi

# Load environment variables from .env file
echo "Loading credentials from .env file..."
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
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

# Build and publish for specified Mac architectures
if [ "$BUILD_MAC_X64" = true ]; then
  echo "Building and publishing for macOS x64..."
  npm run publish-update-mac-x64
fi

if [ "$BUILD_MAC_ARM64" = true ]; then
  echo "Building and publishing for macOS arm64..."
  npm run publish-update-mac-arm64
fi

echo "Publishing complete!" 