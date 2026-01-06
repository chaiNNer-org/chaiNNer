import electronLog from 'electron-log/renderer';
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createI18n } from 'vue-i18n';
import { LEVEL_NAME, log } from '../common/log';
import App from './App.vue';
import './styles/main.css';

// Import English locale as default
import enLocale from '../common/locales/en.json';

electronLog.transports.ipc.level = 'info';
electronLog.transports.console.level = 'debug';
log.addTransport({
    log: ({ level, message, additional }) => {
        electronLog[LEVEL_NAME[level]](message, ...additional);
    },
});

// Create i18n instance
const i18n = createI18n({
    legacy: false,
    locale: 'en',
    fallbackLocale: 'en',
    messages: {
        en: enLocale,
    },
});

// Create Pinia store
const pinia = createPinia();

// Create and mount Vue app
const app = createApp(App);
app.use(pinia);
app.use(i18n);
app.mount('#root');
