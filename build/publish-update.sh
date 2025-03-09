#!/bin/bash

# Load Apple signing credentials
export APPLE_ID="losnoth@hotmail.com" 
export APPLE_APP_SPECIFIC_PASSWORD="jzhx-qzvl-heex-dpnp" 
export APPLE_TEAM_ID="K7GGZ8W679" 
export CSC_LINK="~/certificate.p12" 
export CSC_KEY_PASSWORD="1234Poiu?" 

# Load AWS credentials for S3 publishing
# Option 1: Set credentials directly in this script (not recommended for security)
# export AWS_ACCESS_KEY_ID="your-access-key"
# export AWS_SECRET_ACCESS_KEY="your-secret-key"

# Option 2: Use AWS CLI profile (recommended)
# export AWS_PROFILE="your-profile-name"

# Make sure you have the correct region set
export AWS_REGION="ca-central-1"  # Should match your immcopilot bucket's region

# Increment version (optional)
# npm version patch

# Build and publish
npm run publish-update 