import { dictionaries } from './dictionaries.js';

export class I18n {
  constructor(defaultLanguage = 'es') {
    this.lang = defaultLanguage;
  }

  setLanguage(lang) {
    if (dictionaries[lang]) {
      this.lang = lang;
    }
  }

  t(key) {
    return dictionaries[this.lang]?.[key] || dictionaries.en[key] || key;
  }
}
