@echo off
set JAVA_HOME=C:\Program Files\JetBrains\PyCharm Community Edition 2024.2.4\jbr
set PATH=%JAVA_HOME%\bin;%PATH%
cd android
call gradlew signingReport
