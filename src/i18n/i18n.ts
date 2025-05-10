import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import ptBR from "./locales/pt-BR.json";

i18n
  .use(LanguageDetector) // Automatically detect user language
  .use(initReactI18next) // Bind i18n to React
  .init({
    resources: {
      "pt-BR": {
        translation: ptBR,
      },
    },
    fallbackLng: "pt-BR", // Default language
    interpolation: {
      escapeValue: false, // React already escapes values
    },
  });

export default i18n;