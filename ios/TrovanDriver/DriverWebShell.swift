import SwiftUI
import WebKit

struct DriverWebShell: View {
    @State private var reloadToken = UUID()
    @State private var loadError: String?
    @State private var activeURLIndex = 0

    private let driverURLs = Self.makeDriverURLs()

    var body: some View {
        ZStack {
            if driverURLs.isEmpty {
                DriverShellMessage(
                    message: "Trovan Driver requires a configured HTTPS TROVAN_DRIVER_URL."
                )
            } else {
                DriverWebView(
                    url: driverURLs[activeURLIndex],
                    reloadToken: reloadToken,
                    loadError: $loadError,
                    activeURLIndex: $activeURLIndex,
                    urlCount: driverURLs.count
                )
            }

            if let loadError {
                DriverShellMessage(message: loadError) {
                    self.loadError = nil
                    activeURLIndex = 0
                    reloadToken = UUID()
                }
            }
        }
        .background(Color(red: 0.06, green: 0.05, blue: 0.04))
    }

    private static func makeDriverURLs() -> [URL] {
        let configuredURL = ProcessInfo.processInfo.environment["TROVAN_DRIVER_URL"]
        let candidates = [configuredURL].compactMap { value -> String? in
            guard let value, !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
                return nil
            }
            guard let url = URL(string: value), url.scheme?.lowercased() == "https" else {
                return nil
            }
            return value
        }

        var seen = Set<String>()
        return candidates.compactMap { rawValue in
            guard seen.insert(rawValue).inserted else {
                return nil
            }
            return URL(string: rawValue)
        }
    }
}

private struct DriverShellMessage: View {
    let message: String
    var retry: (() -> Void)?

    var body: some View {
        VStack(spacing: 16) {
            Text("Trovan Driver")
                .font(.title2.weight(.semibold))
            Text(message)
                .font(.callout)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            if let retry {
                Button("Retry", action: retry)
                    .buttonStyle(.borderedProminent)
            }
        }
        .padding(24)
        .frame(maxWidth: 340)
        .background(.regularMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .padding()
    }
}

struct DriverWebView: UIViewRepresentable {
    private static let requestTimeout: TimeInterval = 8

    let url: URL
    let reloadToken: UUID
    @Binding var loadError: String?
    @Binding var activeURLIndex: Int
    let urlCount: Int

    func makeCoordinator() -> Coordinator {
        Coordinator(loadError: $loadError, activeURLIndex: $activeURLIndex, urlCount: urlCount)
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.allowsInlineMediaPlayback = true
        configuration.websiteDataStore = .default()

        let preferences = WKWebpagePreferences()
        preferences.allowsContentJavaScript = true
        configuration.defaultWebpagePreferences = preferences

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.keyboardDismissMode = .interactive
        context.coordinator.lastURL = url
        webView.load(URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: Self.requestTimeout))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        guard context.coordinator.lastReloadToken != reloadToken || context.coordinator.lastURL != url else {
            return
        }
        context.coordinator.lastReloadToken = reloadToken
        context.coordinator.lastURL = url
        webView.load(URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: Self.requestTimeout))
    }

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        var lastReloadToken: UUID?
        var lastURL: URL?
        private var loadError: Binding<String?>
        private var activeURLIndex: Binding<Int>
        private let urlCount: Int

        init(loadError: Binding<String?>, activeURLIndex: Binding<Int>, urlCount: Int) {
            self.loadError = loadError
            self.activeURLIndex = activeURLIndex
            self.urlCount = urlCount
        }

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            loadError.wrappedValue = nil
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            if activeURLIndex.wrappedValue + 1 < urlCount {
                activeURLIndex.wrappedValue += 1
                return
            }

            loadError.wrappedValue = "Trovan Driver could not reach the configured HTTPS workspace. \(error.localizedDescription)"
        }

        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.allow)
                return
            }

            if navigationAction.targetFrame == nil {
                webView.load(URLRequest(url: url))
                decisionHandler(.cancel)
                return
            }

            if shouldOpenOutsideApp(url) {
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
                return
            }

            if shouldForceDriverHome(url) {
                if let driverURL = driverHomeURL(from: url) {
                    webView.load(URLRequest(url: driverURL))
                }
                decisionHandler(.cancel)
                return
            }

            decisionHandler(.allow)
        }

        private func shouldOpenOutsideApp(_ url: URL) -> Bool {
            guard let scheme = url.scheme?.lowercased() else {
                return false
            }
            if ["tel", "sms", "mailto", "maps"].contains(scheme) {
                return true
            }
            if scheme == "https", url.host?.contains("maps.apple.com") == true {
                return true
            }
            if ["http", "https"].contains(scheme) {
                let host = url.host?.lowercased() ?? ""
                if host.contains("maps.google.") || host == "google.com" || host == "www.google.com" {
                    return url.path.lowercased().contains("/maps") || url.query?.lowercased().contains("q=") == true
                }
            }
            return false
        }

        private func shouldForceDriverHome(_ url: URL) -> Bool {
            guard let scheme = url.scheme?.lowercased(), ["http", "https"].contains(scheme) else {
                return false
            }
            guard isKnownDriverHost(url) else {
                return false
            }
            return !url.path.hasPrefix("/driver")
        }

        private func driverHomeURL(from url: URL) -> URL? {
            var components = URLComponents(url: url, resolvingAgainstBaseURL: false)
            components?.path = "/driver"
            components?.query = nil
            components?.fragment = nil
            return components?.url
        }

        private func isKnownDriverHost(_ url: URL) -> Bool {
            let host = url.host?.lowercased() ?? ""
            let activeHost = lastURL?.host?.lowercased()
            return activeHost == host
        }
    }
}
