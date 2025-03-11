 @echo off
echo Building and publishing Windows update...

:: Load environment variables from .env file
for /F "tokens=*" %%A in (.env) do (
    set %%A
)

:: Check if AWS credentials are set
if "%AWS_ACCESS_KEY_ID%"=="" (
    echo Error: AWS_ACCESS_KEY_ID is not set in .env file
    goto :error
)
if "%AWS_SECRET_ACCESS_KEY%"=="" (
    echo Error: AWS_SECRET_ACCESS_KEY is not set in .env file
    goto :error
)
if "%AWS_REGION%"=="" (
    echo Error: AWS_REGION is not set in .env file
    goto :error
)

echo AWS credentials loaded successfully

:: Run the publish command
call npm run publish-update-win

echo Done!
goto :end

:error
echo Failed to publish update
pause
exit /b 1

:end
pause