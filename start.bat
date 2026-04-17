@echo off
chcp 65001 > nul
title 경제 뉴스 대시보드

echo.
echo  ============================================
echo   경제 뉴스 대시보드 시작
echo  ============================================
echo.

cd /d "%~dp0backend"

if not exist "node_modules" (
  echo  [1/2] 패키지 설치 중...
  call npm install
  echo.
)

echo  [2/2] 서버 시작...
echo.
echo  브라우저 자동 오픈: http://localhost:8000
echo  모바일 접속: 동일 Wi-Fi 환경에서 이 PC의 IP:8000
echo.
echo  종료하려면 Ctrl+C 를 누르세요.
echo.

:: 백그라운드에서 서버 먼저 실행
start /b node --experimental-sqlite server.js

:: 서버가 준비될 때까지 최대 15초 대기
echo  서버 준비 중...
set /a cnt=0
:wait_loop
timeout /t 1 /nobreak > nul
curl -s http://localhost:8000/api/status > nul 2>&1
if %errorlevel%==0 goto server_ready
set /a cnt+=1
if %cnt% lss 15 goto wait_loop

:server_ready
echo  서버 준비 완료!
start "" "http://localhost:8000"

:: 창 유지 (서버 로그 확인 가능)
echo.
echo  서버가 백그라운드에서 실행 중입니다.
echo  이 창을 닫으면 서버도 종료됩니다.
echo.
pause

pause
