using System;
using System.IO;
using System.Threading.Tasks;
using Microsoft.Web.WebView2.Core;
using Windows.ApplicationModel;
using Windows.Data.Json;
using Windows.Storage;
using Windows.System;
using Windows.UI.Core;
using Windows.UI.Xaml;
using Windows.UI.Xaml.Controls;

namespace OverboomXbox
{
    /// <summary>
    /// Hülle um das Web-Spiel. Nachrichten (JSON) zwischen Hülle und Spiel:
    ///   Hülle → Spiel: { t: "zurueck" } (B-Taste), { t: "speicher", knapp: true }, { t: "bild", name, pfad }
    ///   Spiel → Hülle: { t: "beenden" }, { t: "bild", name, daten }
    /// Gegenstück im Web-Code: packages/platform/src/xbox.ts
    /// </summary>
    public sealed partial class MainPage : Page
    {
        /// <summary>virtueller Host für den mitgelieferten Web-Build (https → Service Worker, IndexedDB usw.)</summary>
        const string Host = "overboom.local";

        public MainPage()
        {
            InitializeComponent();
            Loaded += OnLoaded;
        }

        async void OnLoaded(object sender, RoutedEventArgs e)
        {
            // B-Taste / System-Zurück abfangen: die App schließt sich nie von selbst,
            // sondern gibt „Zurück" ans Spiel weiter (Beenden nur über das Titelmenü)
            SystemNavigationManager.GetForCurrentView().BackRequested += OnBackRequested;
            MemoryManager.AppMemoryUsageIncreased += OnMemoryIncreased;

            try
            {
                await Web.EnsureCoreWebView2Async();
            }
            catch (Exception ex)
            {
                ZeigeFehler("WebView2 konnte nicht gestartet werden.\n\n" + ex.Message +
                    "\n\nBitte die Xbox aktualisieren (Einstellungen → System → Updates)." +
                    "\nIm Edge-Browser läuft das Spiel auch: hoai-droid.github.io/overboom");
                return;
            }
            if (Web.CoreWebView2 == null)
            {
                ZeigeFehler("WebView2 ist nicht verfügbar. Bitte die Xbox aktualisieren.");
                return;
            }
            var core = Web.CoreWebView2;
            var ordner = Path.Combine(Package.Current.InstalledLocation.Path, "Web");
            core.SetVirtualHostNameToFolderMapping(Host, ordner, CoreWebView2HostResourceAccessKind.Allow);
            core.Settings.AreDefaultContextMenusEnabled = false;
            core.Settings.IsZoomControlEnabled = false;
            core.Settings.IsStatusBarEnabled = false;
            // Remote-Debugging über edge://inspect (siehe docs/xbox.md)
            core.Settings.AreDevToolsEnabled = true;
            // Plattform-Flag fürs Spiel, bevor irgendein Skript läuft
            await core.AddScriptToExecuteOnDocumentCreatedAsync("globalThis.__OVERBOOM_XBOX__ = true;");
            core.WebMessageReceived += OnWebMessage;
            core.NavigationCompleted += (s, a) =>
            {
                if (!a.IsSuccess) ZeigeFehler("Spiel konnte nicht geladen werden (" + a.WebErrorStatus + ").");
                Web.Focus(FocusState.Programmatic);
            };
            core.Navigate("https://" + Host + "/index.html");
            Web.Focus(FocusState.Programmatic);
        }

        /// <summary>Fehler sichtbar machen statt die App zu schließen (auch aus App.UnhandledException)</summary>
        public void ZeigeFehler(string text)
        {
            Fehler.Text = text;
            Fehler.Visibility = Visibility.Visible;
            // Das WebView bleibt sonst über dem Text liegen
            Web.Visibility = Visibility.Collapsed;
        }

        void OnBackRequested(object sender, BackRequestedEventArgs e)
        {
            e.Handled = true;
            Senden("{\"t\":\"zurueck\"}");
        }

        void OnMemoryIncreased(object sender, object e)
        {
            var stufe = MemoryManager.AppMemoryUsageLevel;
            if (stufe != AppMemoryUsageLevel.High && stufe != AppMemoryUsageLevel.OverLimit) return;
            _ = Dispatcher.RunAsync(CoreDispatcherPriority.Normal, () => Senden("{\"t\":\"speicher\",\"knapp\":true}"));
        }

        void Senden(string json)
        {
            try { Web.CoreWebView2?.PostWebMessageAsJson(json); } catch (Exception) { /* WebView noch nicht bereit */ }
        }

        async void OnWebMessage(CoreWebView2 sender, CoreWebView2WebMessageReceivedEventArgs args)
        {
            JsonObject msg;
            if (!JsonObject.TryParse(args.WebMessageAsJson, out msg)) return;
            var t = msg.GetNamedString("t", "");
            if (t == "beenden")
            {
                Application.Current.Exit();
            }
            else if (t == "bild")
            {
                var name = Path.GetFileName(msg.GetNamedString("name", "overboom.png"));
                var pfad = await BildSpeichern(name, msg.GetNamedString("daten", ""));
                var antwort = new JsonObject();
                antwort["t"] = JsonValue.CreateStringValue("bild");
                antwort["name"] = JsonValue.CreateStringValue(name);
                antwort["pfad"] = JsonValue.CreateStringValue(pfad);
                Senden(antwort.Stringify());
            }
        }

        /// <summary>Sammelkarte als PNG in „Bilder\OVERBOOM" speichern; Rückgabe: Anzeigepfad oder leer</summary>
        static async Task<string> BildSpeichern(string name, string daten)
        {
            try
            {
                var bytes = Convert.FromBase64String(daten);
                var ordner = await KnownFolders.PicturesLibrary.CreateFolderAsync("OVERBOOM", CreationCollisionOption.OpenIfExists);
                var datei = await ordner.CreateFileAsync(name, CreationCollisionOption.ReplaceExisting);
                await FileIO.WriteBytesAsync(datei, bytes);
                return "Bilder\\OVERBOOM\\" + name;
            }
            catch (Exception)
            {
                return "";
            }
        }
    }
}
