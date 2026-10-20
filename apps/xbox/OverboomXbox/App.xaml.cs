using Windows.ApplicationModel.Activation;
using Windows.UI.ViewManagement;
using Windows.UI.Xaml;
using Windows.UI.Xaml.Controls;

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
