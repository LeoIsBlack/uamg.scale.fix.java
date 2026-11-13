rem @echo off
rem ������ ����� ������� � ����
rem ����� ������: WRITE 1 "������ ���� � csv-�����"
rem ������: ScalesCommunications.exe WRITE 1 "C:\Temp\products.csv"

rem ���������� ����� ���������� �� ����� ���-MF
rem ����� ������: READ 8 0 
rem ������: ScalesCommunications.exe READ 8 0
rem /min

rem check if program is already running
rem tasklist /FI "IMAGENAME eq ScalesCommunications.exe" 2>NUL | find /I /N "ScalesCommunications.exe">NUL
rem if "%ERRORLEVEL%"=="0" goto end
rem :end
taskkill /F /IM ScalesCommunications.exe
start /WAIT /min ScalesCommunications.exe WRITE 1 "Products.csv"
exit