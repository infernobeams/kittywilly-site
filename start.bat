@echo off
echo Starting Insanity Dashboard Services...

echo Starting Express Server (Port 3000)...
start "Express Server" cmd /k "node server.js"

:: Optional services:
:: - PHP-CGI (Port 9000) is only required if you use Nginx fastcgi_pass. Express executes bundled php-cgi.exe directly.
:: start "PHP-CGI" cmd /k "php\php-cgi.exe -b 127.0.0.1:9000"

echo.
echo Core website is running on http://localhost:3000
echo (Dashboard, Profiles, Login Proxy, and APIs are all active)
echo.
pause
