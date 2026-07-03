# Run official AgentDoG AgenticXAI pipeline (Windows)
# Requires: pip install torch transformers accelerate
# Set $ModelId to a local path or HuggingFace model id

param(
    [string]$ModelId = "AI45Research/AgentDoG-Qwen3-4B",
    [string]$Sample = "finance.json"
)

$Root = Split-Path -Parent $PSScriptRoot
$XaiDir = Join-Path (Split-Path -Parent $Root) "AgentDoG\AgenticXAI"

if (-not (Test-Path $XaiDir)) {
    Write-Error "AgentDoG repo not found at $XaiDir. Run: git clone https://github.com/AI45Lab/AgentDoG.git"
    exit 1
}

$Results = Join-Path $XaiDir "results"
New-Item -ItemType Directory -Force -Path $Results | Out-Null

Push-Location $XaiDir
try {
    Write-Host "=== Step 1: Trajectory-level attribution ===" -ForegroundColor Cyan
    python component_attri.py --model_id $ModelId --data_dir ./samples --output_dir ./results

    $CaseTag = [System.IO.Path]::GetFileNameWithoutExtension($Sample)
    $ModelName = ($ModelId -replace '\\', '/' -split '/')[-1]
    $AttrFile = "results/${CaseTag}_${ModelName}_attr_trajectory.json"
    $TrajFile = "samples/$Sample"
    $SentOut = "results/${CaseTag}_${ModelName}_attr_sentence.json"
    $HtmlOut = "results/${CaseTag}_${ModelName}_all_attr_heatmap.html"

    Write-Host "=== Step 2: Sentence-level attribution ===" -ForegroundColor Cyan
    python sentence_attri.py `
        --model_id $ModelId `
        --attr_file $AttrFile `
        --traj_file $TrajFile `
        --output_file $SentOut `
        --top_k 3

    Write-Host "=== Step 3: HTML visualization ===" -ForegroundColor Cyan
    python case_plot_html.py `
        --traj_attr_file $AttrFile `
        --original_traj_file $TrajFile `
        --sent_attr_file $SentOut `
        --output_file $HtmlOut

    Write-Host "Done. Open $HtmlOut in browser." -ForegroundColor Green
}
finally {
    Pop-Location
}
