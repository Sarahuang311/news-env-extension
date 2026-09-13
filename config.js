"use strict";
/*
    config.js
    Single source of truth for the backend server this extension talks to.
    Replace SERVER_URL below with your deployed backend before shipping,
    or with your local dev server (e.g. 'http://localhost:8000') while developing.
    NOTE: manifest.json's host match patterns (content_scripts, host_permissions)
    must be updated to match this value too, since manifest.json can't reference JS.
*/
const SERVER_URL = 'https://your-server-domain.example';
