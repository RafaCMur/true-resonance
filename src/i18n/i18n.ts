class I18n {
  private translations: Record<string, string> = {};
  private currentLang = 'en';

  async loadLanguage(lang: string): Promise<void> {
    try {
      const response = await fetch(`i18n/locales/${lang}.json`);
      if (!response.ok) {
        throw new Error(`Failed to load language: ${lang}`);
      }
      this.translations = await response.json();
      this.currentLang = lang;
    } catch (error) {
      console.error('Error loading language:', error);
      // Fallback to English if other language fails
      if (lang !== 'en') {
        await this.loadLanguage('en');
      }
    }
  }

  t(key: string): string {
    return this.translations[key] || key;
  }

  getCurrentLanguage(): string {
    return this.currentLang;
  }
}

export const i18n = new I18n();
