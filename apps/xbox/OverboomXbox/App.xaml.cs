using Windows.ApplicationModel.Activation;
using Windows.UI.ViewManagement;
using Windows.UI.Xaml;
using Windows.UI.Xaml.Controls;
using UnhandledExceptionEventArgs = Windows.UI.Xaml.UnhandledExceptionEventArgs;

namespace OverboomXbox
{
    /// <summary>App-Einstieg: Vollbild, kein Mauszeiger, eine Seite mit dem WebView2.</summary>
    sealed partial class App : Application
    {
        public App()
        {
            InitializeComponent();
            // Kein Mauszeiger auf der Xbox – das Spiel wird komplett per Controller bedient
            RequiresPointerMode = ApplicationRequiresPointerMode.WhenRequested;
            // Unbehandelte Fehler nicht als Absturz enden lassen, sondern anzeigen
            UnhandledException += OnUnhandled;
        }

        void OnUnhandled(object sender, UnhandledExceptionEventArgs e)
        {
            e.Handled = true;
            var seite = (Window.Current?.Content as Frame)?.Content as MainPage;
            seite?.ZeigeFehler("Fehler in der Xbox-Hülle:\n\n" + e.Message +
                "\n\nBitte ein Foto dieser Meldung schicken. Im Edge-Browser läuft das Spiel: hoai-droid.github.io/overboom");
        }

        protected override void OnLaunched(LaunchActivatedEventArgs e)
        {
            var view = ApplicationView.GetForCurrentView();
            // Ganze Bildfläche nutzen; die TV-sicheren Ränder setzt das Spiel selbst (CSS, 5 %)
            view.SetDesiredBoundsMode(ApplicationViewBoundsMode.UseCoreWindow);

            var frame = Window.Current.Content as Frame;
            if (frame == null)
            {
                frame = new Frame();
                Window.Current.Content = frame;
            }
            if (frame.Content == null) frame.Navigate(typeof(MainPage), e.Arguments);
            Window.Current.Activate();
            view.TryEnterFullScreenMode();
        }
    }
}
