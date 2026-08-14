using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace VPWebView2Poc;

internal static class Program
{
    [STAThread]
    static void Main()
    {
        ApplicationConfiguration.Initialize();
        Application.Run(new MainForm());
    }
}

internal sealed class MainForm : Form
{
    private readonly WebView2 web = new() { Dock = DockStyle.Fill };
    private readonly Label status = new() { AutoSize = true, ForeColor = Color.Gainsboro, Padding = new Padding(10, 9, 10, 0), Text = "Iniciando WebView2…" };
    private readonly Button game = Button("Jogo");
    private readonly Button proton = Button("Proton");
    private readonly Button checkIp = Button("Ver IP");
    private readonly Button devtools = Button("DevTools");
    private readonly Button reload = Button("Recarregar");
    private readonly string projectRoot = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", ".."));

    public MainForm()
    {
        Text = "VP Launcher Lab — WebView2 Conta 01";
        Width = 1400; Height = 900; BackColor = Color.FromArgb(10, 6, 5);
        var bar = new FlowLayoutPanel { Dock = DockStyle.Top, Height = 46, BackColor = Color.FromArgb(28, 18, 15), Padding = new Padding(7, 5, 7, 5) };
        bar.Controls.AddRange([game, proton, checkIp, devtools, reload, status]);
        Controls.Add(web); Controls.Add(bar);
        Shown += async (_, _) => await InitializeAsync();
    }

    private async Task InitializeAsync()
    {
        try
        {
            var profile = Path.Combine(projectRoot, "webview2-profiles", "conta-01");
            Directory.CreateDirectory(profile);
            var options = new CoreWebView2EnvironmentOptions { AreBrowserExtensionsEnabled = true };
            var environment = await CoreWebView2Environment.CreateAsync(null, profile, options);
            await web.EnsureCoreWebView2Async(environment);

            var protonPath = FindProtonExtension();
            var installed = await web.CoreWebView2.Profile.GetBrowserExtensionsAsync();
            if (!installed.Any(extension => extension.Name.Contains("Proton", StringComparison.OrdinalIgnoreCase)))
                await web.CoreWebView2.Profile.AddBrowserExtensionAsync(protonPath);
            installed = await web.CoreWebView2.Profile.GetBrowserExtensionsAsync();
            var protonExtension = installed.First(extension => extension.Name.Contains("Proton", StringComparison.OrdinalIgnoreCase));

            game.Click += (_, _) => web.CoreWebView2.Navigate("https://pokewg.com/play");
            proton.Click += (_, _) => web.CoreWebView2.Navigate($"chrome-extension://{protonExtension.Id}/popup.html");
            checkIp.Click += (_, _) => web.CoreWebView2.Navigate("https://api.ipify.org?format=json");
            devtools.Click += (_, _) => web.CoreWebView2.OpenDevToolsWindow();
            reload.Click += (_, _) => web.Reload();
            web.CoreWebView2.NavigationCompleted += (_, e) => status.Text = e.IsSuccess ? "Carregado" : $"Falha: {e.WebErrorStatus}";
            web.CoreWebView2.Navigate("https://pokewg.com/play");
            status.Text = "WebView2 real · compare Ver IP com o IP direto 179.108.91.149";
        }
        catch (Exception error)
        {
            status.Text = "Erro na inicialização";
            MessageBox.Show(error.ToString(), "VP WebView2 Lab", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    private string FindProtonExtension()
    {
        var root = Path.Combine(projectRoot, "launcher-profiles", "conta-01", "Default", "Extensions", "jplgfhpmjnbigmhklmmbgecoobifkmpa");
        var version = Directory.GetDirectories(root).OrderByDescending(path => path).FirstOrDefault();
        return version ?? throw new DirectoryNotFoundException("Extensão Proton não encontrada no perfil da Conta 01.");
    }

    private static Button Button(string text) => new() { Text = text, AutoSize = true, Height = 32, BackColor = Color.FromArgb(110, 25, 22), ForeColor = Color.White, FlatStyle = FlatStyle.Flat };
}
