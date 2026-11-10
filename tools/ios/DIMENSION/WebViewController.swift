import UIKit
import WebKit
import PhotosUI

final class WebViewController: UIViewController {
    private static let siteURL = URL(string: "https://dimension-mc-wvlzuyrjbqi.qoder.website/")!
    private static let siteHost = "dimension-mc-wvlzuyrjbqi.qoder.website"

    private var webView: WKWebView!
    private let refreshControl = UIRefreshControl()
    private var pickerCompletion: (([URL]?) -> Void)?
    private var showingOfflinePage = false

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 7 / 255, green: 8 / 255, blue: 11 / 255, alpha: 1)

        let configuration = WKWebViewConfiguration()
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        webView.isOpaque = false
        webView.backgroundColor = view.backgroundColor
        webView.scrollView.backgroundColor = view.backgroundColor
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.refreshControl = refreshControl
        webView.translatesAutoresizingMaskIntoConstraints = false

        refreshControl.tintColor = UIColor(red: 226 / 255, green: 180 / 255, blue: 95 / 255, alpha: 1)
        refreshControl.addTarget(self, action: #selector(reload), for: .valueChanged)

        view.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])

        self.webView = webView
        webView.load(URLRequest(url: Self.siteURL))
    }

    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }

    @objc private func reload() {
        showingOfflinePage = false
        if webView.url == nil {
            webView.load(URLRequest(url: Self.siteURL))
        } else {
            webView.reload()
        }
    }

    private func showOfflinePage() {
        guard !showingOfflinePage else { return }
        showingOfflinePage = true
        guard let file = Bundle.main.url(forResource: "offline", withExtension: "html") else {
            webView.load(URLRequest(url: Self.siteURL))
            return
        }
        webView.loadFileURL(file, allowingReadAccessTo: file.deletingLastPathComponent())
    }

    private func openExternally(_ url: URL) {
        UIApplication.shared.open(url)
    }

    private func isSiteURL(_ url: URL) -> Bool {
        guard let host = url.host else { return false }
        return host == Self.siteHost || host.hasSuffix(".qoder.website")
    }
}

extension WebViewController: WKNavigationDelegate {
    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.allow)
            return
        }

        if let scheme = url.scheme?.lowercased(), ["http", "https"].contains(scheme) {
            if isSiteURL(url) {
                decisionHandler(.allow)
            } else {
                decisionHandler(.cancel)
                openExternally(url)
            }
            return
        }

        if let scheme = url.scheme?.lowercased(),
           ["mailto", "tel", "sms", "itms-apps", "instagram", "kakaotalk"].contains(scheme) {
            decisionHandler(.cancel)
            openExternally(url)
            return
        }

        decisionHandler(.cancel)
        openExternally(url)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        refreshControl.endRefreshing()
        if let url = webView.url, url.scheme == "https" {
            showingOfflinePage = false
        }
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        refreshControl.endRefreshing()
        let nsError = error as NSError
        if nsError.code == NSURLErrorCancelled { return }
        showOfflinePage()
    }

    func webView(
        _ webView: WKWebView,
        didFailProvisionalNavigation navigation: WKNavigation!,
        withError error: Error
    ) {
        refreshControl.endRefreshing()
        let nsError = error as NSError
        if nsError.code == NSURLErrorCancelled { return }
        showOfflinePage()
    }
}

extension WebViewController: WKUIDelegate {
    func webView(
        _ webView: WKWebView,
        createWebViewWith configuration: WKWebViewConfiguration,
        for navigationAction: WKNavigationAction,
        windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        guard let url = navigationAction.request.url else { return nil }
        if isSiteURL(url) {
            webView.load(URLRequest(url: url))
        } else {
            openExternally(url)
        }
        return nil
    }

    func webView(
        _ webView: WKWebView,
        runOpenPanelWith parameters: WKOpenPanelParameters,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping ([URL]?) -> Void
    ) {
        pickerCompletion = completionHandler

        var config = PHPickerConfiguration(photoLibrary: .shared())
        config.filter = .images
        config.selectionLimit = parameters.allowsMultipleSelection ? 0 : 1
        config.preferredAssetRepresentationMode = .current

        let picker = PHPickerViewController(configuration: config)
        picker.delegate = self
        present(picker, animated: true)
    }
}

extension WebViewController: PHPickerViewControllerDelegate {
    func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
        picker.dismiss(animated: true)

        guard let completion = pickerCompletion else { return }
        pickerCompletion = nil

        guard !results.isEmpty else {
            completion(nil)
            return
        }

        let group = DispatchGroup()
        var urls: [URL] = []
        let lock = NSLock()
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("dimension-upload-\(UUID().uuidString)", isDirectory: true)
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)

        for result in results {
            let provider = result.itemProvider
            guard provider.canLoadObject(ofClass: UIImage.self) else { continue }

            group.enter()
            provider.loadObject(ofClass: UIImage.self) { object, error in
                defer { group.leave() }
                guard error == nil,
                      let image = object as? UIImage,
                      let data = image.jpegData(compressionQuality: 0.85) else { return }

                let destination = directory.appendingPathComponent("\(UUID().uuidString).jpg")
                do {
                    try data.write(to: destination, options: .atomic)
                    lock.lock()
                    urls.append(destination)
                    lock.unlock()
                } catch {
                    // Ignore a failed item; the remaining selection still uploads.
                }
            }
        }

        group.notify(queue: .main) {
            completion(urls.isEmpty ? nil : urls)
        }
    }
}
