$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$deployRoot = Join-Path $root 'deploy-output'
$appRoot = Join-Path $deployRoot 'app'
$publicRoot = Join-Path $deployRoot 'public'

if (Test-Path $deployRoot) {
    Remove-Item -LiteralPath $deployRoot -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $appRoot, $publicRoot | Out-Null

$excludedTopLevel = @(
    '.agents',
    '.editorconfig',
    '.env',
    '.env.example',
    '.env.testing',
    '.git',
    '.github',
    '.gitattributes',
    'deploy',
    'deploy-output',
    'docs',
    'node_modules',
    'package-lock.json',
    'package.json',
    'phpunit.xml',
    'public',
    'README.md',
    'scripts',
    'tests',
    'web'
)

Get-ChildItem -LiteralPath $root -Force |
    Where-Object { $excludedTopLevel -notcontains $_.Name } |
    ForEach-Object {
        Copy-Item -LiteralPath $_.FullName -Destination $appRoot -Recurse -Force
    }

Copy-Item -Path (Join-Path $root 'public\*') -Destination $publicRoot -Recurse -Force
Copy-Item -LiteralPath (Join-Path $root 'deploy\public-index.php') -Destination (Join-Path $publicRoot 'index.php') -Force

Write-Host "Prepared deployment package at $deployRoot"
