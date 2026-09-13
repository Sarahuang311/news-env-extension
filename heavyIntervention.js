/* eslint-disable no-prototype-builtins */
/* eslint-disable no-undef */
// ^ Above are some defaults for eslinter for easier debugging, can be ignored.
/* 
    heavyIntervention.js
    Content script that runs when injected into page based on server intervention endpoint response.
*/
"use strict";

/*
    Heavy Intervention Injection Function:
    This function injects the heavy intervention HTML into a given page if called by the service worker.
    It creates a div with the relevant references to the CSS styles for the heavy intervention (see interventionStyles.css).
    This is only injected if there isn't already a Heavy Intervention tag on the page, and only if the
    HeavyInterventionCount key is present in the storage, which should be sent every time the server tells the extension to apply
    the heavy intervention. 
    See:
        https://developer.chrome.com/docs/extensions/reference/storage/
        https://developer.mozilla.org/en-US/docs/Web/API/Document/createElement
*/
function injectHeavyIntervention() {
    chrome.storage.local.get(['HeavyInterventionMessage'], items => {
        if ('HeavyInterventionMessage' in items && !document.getElementById('StudyExtHeavyIntervention')) {
            let banner = document.createElement('div');
            banner.addEventListener('click', e => {
                e.stopPropagation();
                e.preventDefault();
            });
            banner.id = 'StudyExtHeavyIntervention';
            let bannerText = document.createElement('div');
            bannerText.className = 'StudyExtInterventionText';
            bannerText.textContent = items.HeavyInterventionMessage;
            banner.appendChild(bannerText);
            document.body.appendChild(banner);
        }
    });
}

injectHeavyIntervention();