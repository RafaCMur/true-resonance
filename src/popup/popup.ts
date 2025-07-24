import { A4_STANDARD_FREQUENCY } from "../shared/constants";
import { Frequency, GlobalState } from "../shared/types";
import { i18n } from "../i18n/i18n";

/* ------------------------ VARIABLES --------------------------- */

// Top Control Bar Elements
const powerToggle = document.getElementById("powerToggle") as HTMLButtonElement;
const themeToggle = document.getElementById("themeToggle") as HTMLButtonElement;
const languageBtn = document.getElementById("languageBtn") as HTMLButtonElement;
const languageMenu = document.getElementById("languageMenu") as HTMLElement;
const settingsBtn = document.getElementById("settingsBtn") as HTMLButtonElement;

// Legacy toggle (keeping for compatibility)
const enableToggle = document.getElementById(
  "enable-extension-toggle"
) as HTMLInputElement;

const resetButton = document.getElementById("reset-btn") as HTMLButtonElement;
const pitchModeBtn = document.getElementById(
  "pitch-mode-btn"
) as HTMLButtonElement;
const rateModeBtn = document.getElementById(
  "rate-mode-btn"
) as HTMLButtonElement;

let _currentFrequency: Frequency = A4_STANDARD_FREQUENCY;

const presetButtons: Record<432 | 528, HTMLButtonElement | null> = {
  432: document.getElementById("pitch-432-btn") as HTMLButtonElement,
  528: document.getElementById("pitch-528-btn") as HTMLButtonElement,
};

/* ------------------------ FUNCTIONS --------------------------- */

/**
 * Sends a patch to the background script
 * @param patch The patch is an object only with the properties to update
 */
function sendPatch(patch: Partial<GlobalState>) {
  chrome.runtime.sendMessage({ action: "set", patch });
}

/** Highlights the button that matches the current frequency */
function highlightButton(freq: Frequency): void {
  Object.entries(presetButtons).forEach(([hz, btn]) => {
    if (btn) btn.classList.toggle("active", Number(hz) === freq);
  });
}

function paintUI(state?: GlobalState) {
  if (!state) return;

  // Update power toggle
  if (powerToggle) {
    powerToggle.classList.toggle("active", state.enabled);
  }

  // Update legacy toggle if it exists
  if (enableToggle) {
    enableToggle.checked = state.enabled;
  }

  if (state.mode === "rate") {
    rateModeBtn.classList.add("active");
    pitchModeBtn.classList.remove("active");
  } else {
    pitchModeBtn.classList.add("active");
    rateModeBtn.classList.remove("active");
  }

  _currentFrequency = state.frequency;
  highlightButton(state.frequency);
}

/* ------------------------ EXECUTION --------------------------- */

chrome.storage.local.get("state", ({ state }) => paintUI(state));

chrome.storage.onChanged.addListener(({ state, theme, language }) => {
  if (state?.newValue) paintUI(state.newValue as GlobalState);

  // Handle theme changes
  if (theme?.newValue) {
    document.documentElement.setAttribute("data-theme", theme.newValue);
    if (themeToggle) {
      const updateThemeButton = (isDark: boolean) => {
        themeToggle.classList.toggle("active", isDark);
        const icon = themeToggle.querySelector("img");
        if (icon) {
          icon.src = isDark
            ? "images/theme-dark.svg"
            : "images/theme-light.svg";
        }
      };
      updateThemeButton(theme.newValue === "dark");
    }
  }

  // Handle language changes
  if (language?.newValue) {
    i18n.loadLanguage(language.newValue).then(() => {
      updateUI();
      // Update language button
      if (languageBtn) {
        languageBtn.textContent = language.newValue.toUpperCase();
      }
    });
  }
});

// Top Control Bar Event Listeners

// Power toggle
if (powerToggle) {
  powerToggle.addEventListener("click", () => {
    const isEnabled = powerToggle.classList.contains("active");
    if (isEnabled) {
      sendPatch({ enabled: false });
    } else {
      sendPatch({ enabled: true, frequency: _currentFrequency });
    }
  });
}

// Theme toggle
if (themeToggle) {
  // Initialize theme
  const initTheme = () => {
    chrome.storage.local.get(["theme"], (result) => {
      const theme = result.theme || "light";
      document.documentElement.setAttribute("data-theme", theme);
      updateThemeButton(theme === "dark");
    });
  };

  const updateThemeButton = (isDark: boolean) => {
    themeToggle.classList.toggle("active", isDark);
    const icon = themeToggle.querySelector("img");
    if (icon) {
      icon.src = isDark ? "images/theme-dark.svg" : "images/theme-light.svg";
    }
  };

  const toggleTheme = () => {
    const isDark =
      document.documentElement.getAttribute("data-theme") === "dark";
    const newTheme = isDark ? "light" : "dark";

    document.documentElement.setAttribute("data-theme", newTheme);
    chrome.storage.local.set({ theme: newTheme });
    updateThemeButton(newTheme === "dark");
  };

  initTheme();
  themeToggle.addEventListener("click", toggleTheme);
}

// Language dropdown
if (languageBtn && languageMenu) {
  languageBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    languageMenu.classList.toggle("show");
  });

  // Close dropdown when clicking outside
  document.addEventListener("click", () => {
    languageMenu.classList.remove("show");
  });

  // Language selection
  const languageItems = languageMenu.querySelectorAll(".dropdown-item");
  languageItems.forEach((item) => {
    item.addEventListener("click", async (e) => {
      e.stopPropagation();
      const lang = (item as HTMLElement).dataset.lang;

      if (lang) {
        // Update active state
        languageItems.forEach((i) => i.classList.remove("active"));
        item.classList.add("active");

        // Update button text
        languageBtn.textContent = lang.toUpperCase();

        // Close dropdown
        languageMenu.classList.remove("show");

        // Change language
        chrome.storage.local.set({ language: lang });
        await i18n.loadLanguage(lang);
        updateUI();
      }
    });
  });
}

// Settings button
if (settingsBtn) {
  settingsBtn.addEventListener("click", () => {
    // Settings logic will be implemented later
    console.log("Settings clicked");
    settingsBtn.classList.toggle("active");
  });
}

// Legacy enable/disable toggle (keeping for compatibility)
if (enableToggle) {
  enableToggle.addEventListener("change", () => {
    if (enableToggle.checked) {
      sendPatch({ enabled: true, frequency: _currentFrequency });
    } else {
      sendPatch({ enabled: false });
    }
  });
}

// Preset buttons (432 Hz and 528 Hz)
Object.entries(presetButtons).forEach(([hz, btn]) => {
  if (!btn) return;

  btn.addEventListener("click", () => {
    const freq = Number(hz) as Frequency;
    _currentFrequency = freq;
    sendPatch({ frequency: freq });
  });
});

// Reset button → back to 440 Hz
resetButton.addEventListener("click", () =>
  sendPatch({ frequency: A4_STANDARD_FREQUENCY })
);

// Mode buttons
rateModeBtn.addEventListener("click", () => sendPatch({ mode: "rate" }));
pitchModeBtn.addEventListener("click", () => sendPatch({ mode: "pitch" }));

/* ------------------------ I18N --------------------------- */

// Function to update UI with current language
function updateUI() {
  const elements = document.querySelectorAll("[data-i18n]");
  elements.forEach((element) => {
    const key = element.getAttribute("data-i18n");
    if (key) {
      element.textContent = i18n.t(key);
    }
  });
}

// Initialize language system
async function initLanguage() {
  chrome.storage.local.get(["language"], async (result) => {
    const currentLang = result.language || "en";
    await i18n.loadLanguage(currentLang);
    updateUI();

    // Update language button text
    if (languageBtn) {
      languageBtn.textContent = currentLang.toUpperCase();
    }

    // Update language dropdown to show current selection
    const languageItems = languageMenu?.querySelectorAll(".dropdown-item");
    languageItems?.forEach((item) => {
      const lang = (item as HTMLElement).dataset.lang;
      item.classList.toggle("active", lang === currentLang);
    });
  });
}

// Initialize everything
initLanguage();

export {}; // This is to prevent the file from being a module and isolates the variables (errors from typescript)
