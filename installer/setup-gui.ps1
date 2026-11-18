# YeneCut AI - Modern Windows Setup Wizard (WPF GUI)
Add-Type -AssemblyName PresentationFramework, PresentationCore, WindowsBase

$ProjectRoot = (Resolve-Path "$PSScriptRoot\..").Path
$SourceDist = (Join-Path $ProjectRoot "apps\premiere-plugin\dist")

$xaml = @"
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="YeneCut AI — Premiere Pro Setup &amp; Diagnostics"
        Height="680" Width="720"
        WindowStartupLocation="CenterScreen"
        Background="#18181B" Foreground="#F4F4F5"
        FontFamily="Segoe UI" FontSize="13">
    <Window.Resources>
        <Style TargetType="Button">
            <Setter Property="Background" Value="#27272A"/>
            <Setter Property="Foreground" Value="#FAFAFA"/>
            <Setter Property="BorderThickness" Value="1"/>
            <Setter Property="BorderBrush" Value="#3F3F46"/>
            <Setter Property="Padding" Value="14,8"/>
            <Setter Property="FontWeight" Value="SemiBold"/>
            <Setter Property="Cursor" Value="Hand"/>
            <Setter Property="Template">
                <Setter.Value>
                    <ControlTemplate TargetType="Button">
                        <Border Background="{TemplateBinding Background}"
                                BorderBrush="{TemplateBinding BorderBrush}"
                                BorderThickness="{TemplateBinding BorderThickness}"
                                CornerRadius="6" Padding="{TemplateBinding Padding}">
                            <ContentPresenter HorizontalAlignment="Center" VerticalAlignment="Center"/>
                        </Border>
                    </ControlTemplate>
                </Setter.Value>
            </Setter>
        </Style>
    </Window.Resources>

    <Grid Margin="24">
        <Grid.RowDefinitions>
            <RowDefinition Height="Auto"/>
            <RowDefinition Height="Auto"/>
            <RowDefinition Height="*"/>
            <RowDefinition Height="Auto"/>
        </Grid.RowDefinitions>

        <!-- Header -->
        <Border Grid.Row="0" Background="#27272A" CornerRadius="8" Padding="18,14" Margin="0,0,0,16" BorderBrush="#3F3F46" BorderThickness="1">
            <Grid>
                <Grid.ColumnDefinitions>
                    <ColumnDefinition Width="*"/>
                    <ColumnDefinition Width="Auto"/>
                </Grid.ColumnDefinitions>
                <StackPanel Grid.Column="0">
                    <TextBlock Text="🎬 YeneCut AI Setup Wizard" FontSize="20" FontWeight="Bold" Foreground="#60A5FA"/>
                    <TextBlock Text="Amharic Auto-Captioning &amp; Smart Silence Detection for Adobe Premiere Pro" FontSize="12" Foreground="#A1A1AA" Margin="0,3,0,0"/>
                </StackPanel>
                <Border Grid.Column="1" Background="#065F46" CornerRadius="12" Padding="10,4" VerticalAlignment="Center">
                    <TextBlock Text="v0.1.0 Ready" Foreground="#6EE7B7" FontWeight="Bold" FontSize="11"/>
                </Border>
            </Grid>
        </Border>

        <!-- System Status Cards -->
        <Grid Grid.Row="1" Margin="0,0,0,16">
            <Grid.ColumnDefinitions>
                <ColumnDefinition Width="*"/>
                <ColumnDefinition Width="*"/>
                <ColumnDefinition Width="*"/>
            </Grid.ColumnDefinitions>

            <!-- Card 1: Premiere Pro -->
            <Border Grid.Column="0" Background="#27272A" CornerRadius="8" Padding="12" Margin="0,0,6,0" BorderBrush="#3F3F46" BorderThickness="1">
                <StackPanel>
                    <TextBlock Text="Premiere Pro" FontWeight="SemiBold" Foreground="#A1A1AA" FontSize="11"/>
                    <TextBlock x:Name="TxtPremiereStatus" Text="Scanning..." FontSize="13" FontWeight="Bold" Foreground="#F59E0B" Margin="0,4,0,2"/>
                    <TextBlock x:Name="TxtPremiereDetail" Text="Checking registry..." FontSize="10" Foreground="#71717A" TextTrimming="CharacterEllipsis"/>
                </StackPanel>
            </Border>

            <!-- Card 2: Plugin Status -->
            <Border Grid.Column="1" Background="#27272A" CornerRadius="8" Padding="12" Margin="3,0,3,0" BorderBrush="#3F3F46" BorderThickness="1">
                <StackPanel>
                    <TextBlock Text="UXP Plugin" FontWeight="SemiBold" Foreground="#A1A1AA" FontSize="11"/>
                    <TextBlock x:Name="TxtPluginStatus" Text="Checking..." FontSize="13" FontWeight="Bold" Foreground="#F59E0B" Margin="0,4,0,2"/>
                    <TextBlock x:Name="TxtPluginDetail" Text="Checking extensions..." FontSize="10" Foreground="#71717A" TextTrimming="CharacterEllipsis"/>
                </StackPanel>
            </Border>

            <!-- Card 3: Engine Status -->
            <Border Grid.Column="2" Background="#27272A" CornerRadius="8" Padding="12" Margin="6,0,0,0" BorderBrush="#3F3F46" BorderThickness="1">
                <StackPanel>
                    <TextBlock Text="AI Engine (8765)" FontWeight="SemiBold" Foreground="#A1A1AA" FontSize="11"/>
                    <TextBlock x:Name="TxtEngineStatus" Text="Checking..." FontSize="13" FontWeight="Bold" Foreground="#F59E0B" Margin="0,4,0,2"/>
                    <TextBlock x:Name="TxtEngineDetail" Text="Testing port 8765..." FontSize="10" Foreground="#71717A" TextTrimming="CharacterEllipsis"/>
                </StackPanel>
            </Border>
        </Grid>

        <!-- Log & Output Console -->
        <Border Grid.Row="2" Background="#111827" CornerRadius="8" Padding="14" Margin="0,0,0,16" BorderBrush="#374151" BorderThickness="1">
            <DockPanel>
                <TextBlock DockPanel.Dock="Top" Text="Installation &amp; Diagnostics Log:" FontWeight="SemiBold" Foreground="#9CA3AF" FontSize="12" Margin="0,0,0,8"/>
                <ScrollViewer x:Name="ScrollerLog" VerticalScrollBarVisibility="Auto">
                    <TextBox x:Name="TxtLog" Background="Transparent" Foreground="#D1D5DB" FontFamily="Consolas" FontSize="11"
                             BorderThickness="0" IsReadOnly="True" TextWrapping="Wrap"/>
                </ScrollViewer>
            </DockPanel>
        </Border>

        <!-- Action Controls -->
        <Grid Grid.Row="3">
            <Grid.ColumnDefinitions>
                <ColumnDefinition Width="Auto"/>
                <ColumnDefinition Width="*"/>
                <ColumnDefinition Width="Auto"/>
            </Grid.ColumnDefinitions>

            <StackPanel Grid.Column="0" Orientation="Horizontal">
                <Button x:Name="BtnInstall" Content="⚡ 1-Click Install Plugin" Background="#2563EB" BorderBrush="#3B82F6" Margin="0,0,8,0"/>
                <Button x:Name="BtnStartEngine" Content="▶ Start AI Engine" Margin="0,0,8,0"/>
                <Button x:Name="BtnStopEngine" Content="⏹ Stop Engine" Margin="0,0,8,0"/>
            </StackPanel>

            <StackPanel Grid.Column="2" Orientation="Horizontal">
                <Button x:Name="BtnCheckHealth" Content="🔄 Diagnostics" Margin="0,0,8,0"/>
                <Button x:Name="BtnLaunchCCX" Content="📦 Open .CCX" Margin="0,0,8,0"/>
                <Button x:Name="BtnClose" Content="Exit" Width="60"/>
            </StackPanel>
        </Grid>
    </Grid>
</Window>
"@

$reader = [System.Xml.XmlReader]::Create([System.IO.StringReader]::new($xaml))
$window = [System.Windows.Markup.XamlReader]::Load($reader)

# Controls
$txtPremiereStatus = $window.FindName("TxtPremiereStatus")
$txtPremiereDetail = $window.FindName("TxtPremiereDetail")
$txtPluginStatus = $window.FindName("TxtPluginStatus")
$txtPluginDetail = $window.FindName("TxtPluginDetail")
$txtEngineStatus = $window.FindName("TxtEngineStatus")
$txtEngineDetail = $window.FindName("TxtEngineDetail")
$txtLog = $window.FindName("TxtLog")
$scrollerLog = $window.FindName("ScrollerLog")

$btnInstall = $window.FindName("BtnInstall")
$btnStartEngine = $window.FindName("BtnStartEngine")
$btnStopEngine = $window.FindName("BtnStopEngine")
$btnCheckHealth = $window.FindName("BtnCheckHealth")
$btnLaunchCCX = $window.FindName("BtnLaunchCCX")
$btnClose = $window.FindName("BtnClose")

function Log-Message([string]$msg) {
    $time = (Get-Date).ToString("HH:mm:ss")
    $txtLog.AppendText("[$time] $msg`r`n")
    $scrollerLog.ScrollToEnd()
}

function Refresh-Status {
    Log-Message "Scanning environment..."

    # Check Premiere Pro
    $premFound = $false
    $premPaths = @(
        "C:\Program Files\Adobe\Adobe Premiere Pro 2025\Adobe Premiere Pro.exe",
        "C:\Program Files\Adobe\Adobe Premiere Pro 2024\Adobe Premiere Pro.exe"
    )
    foreach ($p in $premPaths) {
        if (Test-Path $p) {
            $premFound = $true
            $txtPremiereStatus.Text = "Detected"
            $txtPremiereStatus.Foreground = [System.Windows.Media.Brushes]::LightGreen
            $txtPremiereDetail.Text = (Split-Path (Split-Path $p -Parent) -Leaf)
            Log-Message "Found Adobe Premiere Pro at: $p"
            break
        }
    }
    if (-not $premFound) {
        $txtPremiereStatus.Text = "Not Detected"
        $txtPremiereStatus.Foreground = [System.Windows.Media.Brushes]::Yellow
        $txtPremiereDetail.Text = "No standard 2024/2025 install path"
        Log-Message "Note: Premiere Pro executable not found in default paths."
    }

    # Check UXP Plugin in extensions
    $uxpDest = "$env:APPDATA\Adobe\UXP\Plugins\External\com.yenecut.ai\manifest.json"
    $uxpDest2 = "$env:APPDATA\Adobe\UXP\Extensions\com.yenecut.ai\manifest.json"
    if ((Test-Path $uxpDest) -or (Test-Path $uxpDest2)) {
        $txtPluginStatus.Text = "Installed"
        $txtPluginStatus.Foreground = [System.Windows.Media.Brushes]::LightGreen
        $txtPluginDetail.Text = "v0.1.0 registered in UXP"
        Log-Message "UXP Plugin is installed in user extensions folder."
    } else {
        $txtPluginStatus.Text = "Not Installed"
        $txtPluginStatus.Foreground = [System.Windows.Media.Brushes]::Orange
        $txtPluginDetail.Text = "Click '1-Click Install' to deploy"
        Log-Message "UXP Plugin has not yet been copied to user extensions."
    }

    # Check AI Engine Health
    try {
        $res = Invoke-RestMethod -Uri "http://127.0.0.1:8765/health" -Method Get -TimeoutSec 2 -ErrorAction Stop
        $txtEngineStatus.Text = "Online (OK)"
        $txtEngineStatus.Foreground = [System.Windows.Media.Brushes]::LightGreen
        $txtEngineDetail.Text = "Faster-Whisper: $($res.faster_whisper_available)"
        Log-Message "AI Engine is active on http://127.0.0.1:8765 (Whisper: $($res.faster_whisper_available), Device: $($res.device))"
    } catch {
        $txtEngineStatus.Text = "Offline"
        $txtEngineStatus.Foreground = [System.Windows.Media.Brushes]::Salmon
        $txtEngineDetail.Text = "Click 'Start AI Engine'"
        Log-Message "AI Engine is currently offline (port 8765 not responding)."
    }
}

$btnInstall.Add_Click({
    Log-Message "Starting 1-Click Install..."
    try {
        & powershell.exe -ExecutionPolicy Bypass -File "$PSScriptRoot\install-core.ps1"
        Log-Message "1-Click Install completed successfully!"
        Refresh-Status
    } catch {
        Log-Message "Error during installation: $_"
    }
})

$btnStartEngine.Add_Click({
    Log-Message "Starting AI Engine..."
    try {
        $script = "$ProjectRoot\scripts\windows\start-ai-engine.ps1"
        Start-Process powershell.exe -ArgumentList "-ExecutionPolicy Bypass -File `"$script`"" -WindowStyle Minimized
        Log-Message "Launched AI Engine in background. Checking connectivity..."
        Start-Sleep -Seconds 2
        Refresh-Status
    } catch {
        Log-Message "Error starting AI Engine: $_"
    }
})

$btnStopEngine.Add_Click({
    Log-Message "Stopping AI Engine processes..."
    try {
        Get-Process | Where-Object { $_.CommandLine -like "*uvicorn app.main:app*" } | Stop-Process -Force -ErrorAction SilentlyContinue
        Log-Message "Engine stopped."
        Refresh-Status
    } catch {
        Log-Message "Error stopping engine: $_"
    }
})

$btnCheckHealth.Add_Click({
    Refresh-Status
})

$btnLaunchCCX.Add_Click({
    $ccx = "$ProjectRoot\YeneCut-AI.ccx"
    if (Test-Path $ccx) {
        Log-Message "Opening $ccx with Adobe Creative Cloud..."
        Start-Process $ccx
    } else {
        Log-Message "Error: $ccx not found. Run build script first."
    }
})

$btnClose.Add_Click({
    $window.Close()
})

$window.Add_ContentRendered({
    Refresh-Status
})

[void]$window.ShowDialog()
