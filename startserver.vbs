WScript.Sleep 30000

Set fso = CreateObject("Scripting.FileSystemObject")
Set WshShell = CreateObject("WScript.Shell")

projectPath = "D:\Misc\ProjectsHUB\studioflow"

If fso.FolderExists(projectPath) Then
    WshShell.CurrentDirectory = projectPath
    WshShell.Run "cmd /c npm run dev", 0, False
End If
