; MacDrop NSIS Installer Hooks
; Adds/removes Windows Firewall rules during install/uninstall

!macro CUSTOM_INSTALL_AFTER_INSTALL
  ; Add firewall rules for MacDrop networking
  nsExec::ExecToLog 'netsh advfirewall firewall add rule name="MacDrop TCP" dir=in action=allow protocol=TCP localport=52520,8384 description="Allow MacDrop HTTP API (local network file transfer)" profile=private,public enable=yes'
  nsExec::ExecToLog 'netsh advfirewall firewall add rule name="MacDrop UDP" dir=in action=allow protocol=UDP localport=8385 description="Allow MacDrop UDP peer discovery" profile=private,public enable=yes'
!macroend

!macro CUSTOM_UNINSTALL_BEFORE_UNINSTALL
  ; Remove firewall rules on uninstall
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="MacDrop TCP"'
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="MacDrop UDP"'
!macroend
