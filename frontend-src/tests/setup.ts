// happy-dom 20 deliberately omits blocking browser dialogs. Home Assistant's
// WebView provides them; install a harmless default so individual tests can
// spy/mock the API exactly as they do in a browser.
if (typeof window.confirm !== "function") {
  window.confirm = () => false;
}
