@echo off
REM OSRM Quick Setup for Windows
REM Downloads Monaco (small test region) and processes it

echo ========================================
echo OSRM Map Data Setup - Monaco Test Map
echo ========================================
echo.

REM Create directory
if not exist "osrm-data" mkdir osrm-data
cd osrm-data

REM Download small test map (Monaco - only ~1MB)
echo Downloading Monaco test map (~1MB)...
curl -L -o monaco-latest.osm.pbf http://download.geofabrik.de/europe/monaco-latest.osm.pbf
echo Downloaded!
echo.

REM Extract
echo Step 1/3: Extracting road network...
docker run --rm -v "%cd%:/data" osrm/osrm-backend:latest osrm-extract -p /opt/car.lua /data/monaco-latest.osm.pbf
echo.

REM Partition
echo Step 2/3: Partitioning graph...
docker run --rm -v "%cd%:/data" osrm/osrm-backend:latest osrm-partition /data/monaco-latest.osrm
echo.

REM Customize
echo Step 3/3: Customizing weights...
docker run --rm -v "%cd%:/data" osrm/osrm-backend:latest osrm-customize /data/monaco-latest.osrm
echo.

REM Rename to map.osrm (expected by docker-compose)
echo Renaming files to map.osrm...
for %%F in (monaco-latest.osrm*) do (
    set "filename=%%F"
    setlocal enabledelayedexpansion
    set "newname=!filename:monaco-latest=map!"
    ren "%%F" "!newname!"
    endlocal
)
echo.

cd ..

echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo Map data is ready in: osrm-data/
echo.
echo Next step: Restart routing service
echo   docker compose restart routing-service
echo.
echo Test with:
echo   http://localhost:5000/route/v1/driving/7.4174,43.7311;7.4246,43.7373
echo.
pause
