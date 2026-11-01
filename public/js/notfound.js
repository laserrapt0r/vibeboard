// Seite für unbekannte Adressen. Der Text steht auf Deutsch im HTML und wird hier übersetzt.
import { T } from './i18n.js';
import { loadPref } from './util.js';

if (loadPref('settings', {}).dark) document.body.classList.add('dark');
const card = document.getElementById('notfound');
const [title, text, link] = card.children;
title.textContent = T('Seite nicht gefunden');
text.textContent = T('Diese Adresse gibt es nicht.');
link.textContent = T('Zur Übersicht');
document.title = T('Seite nicht gefunden') + T(' – vibeboard');
