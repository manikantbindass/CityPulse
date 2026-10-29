# Requires installed Microsoft PowerPoint on Windows. Does not modify the source deck.
$ErrorActionPreference = 'Stop'
$deckPath = (Resolve-Path (Join-Path $PSScriptRoot '../docs/presentations/CityPulse-Project-Presentation.pptx')).Path
$previewPath = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../.build/deck-render'))
New-Item -ItemType Directory -Force -Path $previewPath | Out-Null
$powerPoint = $null
$presentation = $null
$ownedApplication = $false
try {
    $powerPoint = New-Object -ComObject PowerPoint.Application
    $ownedApplication = $powerPoint.Presentations.Count -eq 0
    $previousSecurity = $powerPoint.AutomationSecurity
    $presentationCount = $powerPoint.Presentations.Count
    $powerPoint.AutomationSecurity = 3
    $presentation = $powerPoint.Presentations.Open($deckPath, -1, 0, 0)
    Write-Output ('Opened in PowerPoint: ' + $presentation.Slides.Count + ' slides')
    $presentation.Export($previewPath, 'PNG', 1600, 900)
    $presentation.SaveAs((Join-Path $previewPath 'CityPulse-Presentation-Preview.pdf'), 32)
    Write-Output ('Rendered all slides: ' + $previewPath)
} finally {
    if ($presentation) { $presentation.Close(); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($presentation) }
    if ($powerPoint) {
        $powerPoint.AutomationSecurity = $previousSecurity
        if ($ownedApplication -and $powerPoint.Presentations.Count -eq 0) { $powerPoint.Quit() }
        [void][Runtime.InteropServices.Marshal]::ReleaseComObject($powerPoint)
    }
}
