@echo off
echo ========================================
echo OSRM Map Data Setup
echo ========================================
echo.
echo This will download and process map data for routing.
echo Region: Monaco (small test map - ~1MB download)
echo Processing time: ~2-5 minutes
echo.
echo Press Ctrl+C to cancel, or
pause

cd /d "%~dp0"

REM Create directory
if not exist "osrm-data" mkdir osrm-data

echo.
echo [1/4] Downloading Monaco map data...
curl -L -o osrm-data\monaco-latest.osm.pbf http://download.geofabrik.de/europe/monaco-latest.osm.pbf

if not exist "osrm-data\monaco-latest.osm.pbf" (
    echo ERROR: Download failed
    pause
    exit /b 1
)

echo.
echo [2/4] Extracting road network...
docker run --rm -v "%cd%\osrm-data:/data" osrm/osrm-backend:latest osrm-extract -p /opt/car.lua /data/monaco-latest.osm.pbf

echo.
echo [3/4] Partitioning graph...
docker run --rm -v "%cd%\osrm-data:/data" osrm/osrm-backend:latest osrm-partition /data/monaco-latest.osrm

echo.
echo [4/4] Customizing weights...
docker run --rm -v "%cd%\osrm-data:/data" osrm/osrm-backend:latest osrm-customize /data/monaco-latest.osrm

echo.
echo Renaming files to map.osrm...
cd osrm-data
for %%F in (monaco-latest.osrm*) do (
    set "oldname=%%F"
    set "newname=!oldname:monaco-latest=map!"
    if exist "!newname!" del "!newname!"
    ren "%%F" "!newname!" 2>nul
)
cd ..

echo.
echo ========================================
echo SUCCESS! Map data is ready.
echo ========================================
echo.
echo Directory: osrm-data\
echo.
echo Next: Restart the routing service
echo   docker compose restart routing-service
echo.
echo Test routing at:
echo   http://localhost:8080/route/v1/driving/7.4174,43.7311;7.4246,43.7373
echo.
pause
