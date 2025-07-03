!macro customInstall
  !insertmacro MUI_HEADER_TEXT "IDE Toolbox" "Autostart setup"
  nsDialogs::Create 1018
  Pop $R0
  ${If} $R0 == error
    Abort
  ${EndIf}
  ${NSD_CreateCheckbox} 0u 0u 100% 12u "Add IDE Toolbox to Windows startup"
  Pop $R1
  ${NSD_SetState} $R1 1
  GetDlgItem $R3 $HWNDPARENT 1
  EnableWindow $R3 1
  nsDialogs::Show
  Pop $R1
  StrCpy $R2 $R1
!macroend

!macro customInstallFiles
  ${If} $R2 == 1
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "IDE Toolbox" "$INSTDIR\\IDE Toolbox.exe"
  ${Else}
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "IDE Toolbox"
  ${EndIf}
!macroend

!macro customUnInstall
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "IDE Toolbox"
!macroend 