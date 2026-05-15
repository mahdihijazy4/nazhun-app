@echo off
if not exist "C:\Users\T.D\.android" mkdir "C:\Users\T.D\.android"
"C:\Program Files\JetBrains\PyCharm Community Edition 2024.2.4\jbr\bin\keytool.exe" -genkey -v -keystore "C:\Users\T.D\.android\debug.keystore" -storepass android -alias androiddebugkey -keypass android -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Android Debug,O=Android,C=US"
