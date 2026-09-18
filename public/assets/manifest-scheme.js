// Android Chrome bakes the manifest theme_color into the installed app as its status bar color,
// while the status bar icons follow the phone's system dark mode. Link the manifest that matches
// the system scheme so the app is installed with a readable status bar.
(function () {
  try {
    var mq = matchMedia("(prefers-color-scheme: dark)");
    var sync = function () {
      var link = document.querySelector("link[rel='manifest']");
      if (link) link.setAttribute("href", mq.matches ? "/manifest-dark.webmanifest" : "/manifest.webmanifest");
    };
    sync();
    mq.addEventListener("change", sync);
  } catch (e) {}
})();
