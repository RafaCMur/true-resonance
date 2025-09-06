import { A4_STANDARD_FREQUENCY } from "../shared/constants";
import { Frequency, GlobalState } from "../shared/types";
import { i18n } from "../i18n/i18n";

// Theme is pre-applied in public/theme-preload.js to avoid flash during first paint

// ======================== DOM ELEMENTS ========================
const elements = {
  // Control bar
  powerToggle: document.getElementById("powerToggle") as HTMLButtonElement,
  themeToggle: document.getElementById("themeToggle") as HTMLButtonElement,
  languageBtn: document.getElementById("languageBtn") as HTMLButtonElement,
  languageMenu: document.getElementById("languageMenu") as HTMLElement,
  settingsBtn: document.getElementById("settingsBtn") as HTMLButtonElement,

  // Layout
  disabledOverlay: document.getElementById("disabledOverlay") as HTMLElement,
  appContainer: document.querySelector(".app-container") as HTMLElement,

  // Controls
  enableToggle: document.getElementById(
    "enable-extension-toggle"
  ) as HTMLInputElement,
  resetButton: document.getElementById("reset-btn") as HTMLButtonElement,
  pitchModeBtn: document.getElementById("pitch-mode-btn") as HTMLButtonElement,
  rateModeBtn: document.getElementById("rate-mode-btn") as HTMLButtonElement,

  // Presets
  preset432: document.getElementById("pitch-432-btn") as HTMLButtonElement,
  preset528: document.getElementById("pitch-528-btn") as HTMLButtonElement,
};

// ======================== STATE ========================
let currentFrequency: Frequency = A4_STANDARD_FREQUENCY;

// ======================== CORE FUNCTIONS ========================
function sendPatch(patch: Partial<GlobalState>) {
  chrome.runtime.sendMessage({ action: "set", patch });
}

function updateUI(state: GlobalState) {
  const { enabled, mode, frequency } = state;

  // Update overlay and container
  elements.disabledOverlay?.classList.toggle("show", !enabled);
  elements.appContainer?.classList.toggle("disabled", !enabled);

  // Update toggles
  elements.powerToggle?.classList.toggle("active", enabled);
  if (elements.enableToggle) elements.enableToggle.checked = enabled;

  // Update mode buttons
  elements.rateModeBtn?.classList.toggle("active", mode === "rate");
  elements.pitchModeBtn?.classList.toggle("active", mode === "pitch");

  // Update frequency
  currentFrequency = frequency;
  elements.preset432?.classList.toggle("active", frequency === 432);
  elements.preset528?.classList.toggle("active", frequency === 528);
}

function updateLanguageUI() {
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.getAttribute("data-i18n");
    if (key) element.textContent = i18n.t(key);
  });
}

// ======================== THEME MANAGEMENT ========================
const themeManager = {
  updateButton(isDark: boolean) {
    elements.themeToggle?.classList.toggle("active", isDark);
    const icon = elements.themeToggle?.querySelector("img");
    if (icon) {
      icon.src = isDark ? "images/theme-dark.svg" : "images/theme-light.svg";
    }
  },

  init() {
    // Initialize button state immediately from DOM (theme-preload.js already applied it)
    const currentTheme =
      document.documentElement.getAttribute("data-theme") || "light";
    this.updateButton(currentTheme === "dark");

    // Sync with storage asynchronously
    chrome.storage.local.get(["theme"], (result) => {
      const theme = result.theme || "light";
      // Theme already applied by theme-preload.js, just sync localStorage and update button
      localStorage.setItem("theme", theme);
      this.updateButton(theme === "dark");
    });
  },

  toggle() {
    const isDark =
      document.documentElement.getAttribute("data-theme") === "dark";
    const newTheme = isDark ? "light" : "dark";

    document.documentElement.setAttribute("data-theme", newTheme);
    chrome.storage.local.set({ theme: newTheme });
    localStorage.setItem("theme", newTheme);
    this.updateButton(newTheme === "dark");
  },
};

// ======================== LANGUAGE MANAGEMENT ========================
const languageManager = {
  async init() {
    const result = await new Promise<{ language?: string }>((resolve) => {
      chrome.storage.local.get(["language"], (data) => resolve(data));
    });

    const currentLang = result.language || "en";
    await i18n.loadLanguage(currentLang);
    updateLanguageUI();

    if (elements.languageBtn) {
      elements.languageBtn.textContent = currentLang.toUpperCase();
    }

    // Update dropdown selection
    elements.languageMenu
      ?.querySelectorAll(".dropdown-item")
      .forEach((item) => {
        const lang = (item as HTMLElement).dataset.lang;
        item.classList.toggle("active", lang === currentLang);
      });
  },

  async change(lang: string) {
    chrome.storage.local.set({ language: lang });
    await i18n.loadLanguage(lang);
    updateLanguageUI();

    if (elements.languageBtn) {
      elements.languageBtn.textContent = lang.toUpperCase();
    }
  },
};

// ======================== STORAGE LISTENERS ========================
chrome.storage.local.get("state", ({ state }) => {
  if (state) updateUI(state);
});

chrome.storage.onChanged.addListener(({ state, theme, language }) => {
  if (state?.newValue) updateUI(state.newValue as GlobalState);

  if (theme?.newValue) {
    document.documentElement.setAttribute("data-theme", theme.newValue);
    localStorage.setItem("theme", theme.newValue);
    themeManager.updateButton(theme.newValue === "dark");
  }

  if (language?.newValue) {
    languageManager.change(language.newValue);
  }
});

// ======================== EVENT LISTENERS ========================
// Power toggle
elements.powerToggle?.addEventListener("click", () => {
  const isEnabled = elements.powerToggle.classList.contains("active");
  sendPatch(
    isEnabled
      ? { enabled: false }
      : { enabled: true, frequency: currentFrequency }
  );
});

// Theme toggle
elements.themeToggle?.addEventListener("click", () => themeManager.toggle());

// Language dropdown
if (elements.languageBtn && elements.languageMenu) {
  elements.languageBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    elements.languageMenu.classList.toggle("show");
  });

  document.addEventListener("click", () => {
    elements.languageMenu.classList.remove("show");
  });

  elements.languageMenu.querySelectorAll(".dropdown-item").forEach((item) => {
    item.addEventListener("click", async (e) => {
      e.stopPropagation();
      const lang = (item as HTMLElement).dataset.lang;

      if (lang) {
        // Update UI
        elements.languageMenu
          .querySelectorAll(".dropdown-item")
          .forEach((i) => i.classList.remove("active"));
        item.classList.add("active");
        elements.languageMenu.classList.remove("show");

        // Change language
        await languageManager.change(lang);
      }
    });
  });
}

// Settings button
elements.settingsBtn?.addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("about.html") });
});

// Legacy toggle (compatibility)
elements.enableToggle?.addEventListener("change", () => {
  const patch = elements.enableToggle.checked
    ? { enabled: true, frequency: currentFrequency }
    : { enabled: false };
  sendPatch(patch);
});

// Frequency controls
elements.preset432?.addEventListener("click", () => {
  currentFrequency = 432;
  sendPatch({ frequency: 432 });
});

elements.preset528?.addEventListener("click", () => {
  currentFrequency = 528;
  sendPatch({ frequency: 528 });
});

elements.resetButton?.addEventListener("click", () => {
  sendPatch({ frequency: A4_STANDARD_FREQUENCY });
});

// Mode buttons
elements.rateModeBtn?.addEventListener("click", () =>
  sendPatch({ mode: "rate" })
);
elements.pitchModeBtn?.addEventListener("click", () =>
  sendPatch({ mode: "pitch" })
);

// ======================== INITIALIZATION ========================
(async function init() {
  themeManager.init();
  await languageManager.init();
})();

export {}; // This is to prevent the file from being a module and isolates the variables (errors from typescript)
