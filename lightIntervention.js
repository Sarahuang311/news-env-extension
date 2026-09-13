/* eslint-disable no-prototype-builtins */
/* eslint-disable no-undef */
// ^ Above are some defaults for eslinter for easier debugging, can be ignored.
/* 
    lightIntervention.js
    Content script that runs when injected into page based on server intervention endpoint response.
*/
"use strict";

/* 
    Light Intervention Injection Function:
    This function injects the light intervention HTML into a given page if called by the service worker.
    It creates a div with the relevant references to the CSS styles for the heavy intervention (see interventionStyles.css).
    This is only injected if there isn't already a Light Intervention tag on the page, and only if the
    LightInterventionCount key is present in the storage, which should be sent every time the server tells the extension to apply
    the heavy intervention. 
    See:
        https://developer.chrome.com/docs/extensions/reference/storage/
        https://developer.mozilla.org/en-US/docs/Web/API/Document/createElement
*/
function injectLightIntervention() {
    chrome.storage.local.get(['LightInterventionMessage'], items => {
        if ('LightInterventionMessage' in items && !document.getElementById('StudyExtLightIntervention')) {
            let bottomBanner = document.createElement('div');
            bottomBanner.id = 'StudyExtLightIntervention';
            let bottomBannerText = document.createElement('div');
            bottomBannerText.className = 'StudyExtInterventionText';
            bottomBannerText.textContent = items.LightInterventionMessage;


            let bottomDismiss = document.createElement('div');
            bottomDismiss.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" x="0px" y="0px" viewBox="0 0 512 512" style="&#10;    fill: whitesmoke;&#10;">
                                        <path d="M256,0C114.508,0,0,114.497,0,256c0,141.493,114.497,256,256,256c141.492,0,256-114.497,256-256    C512,114.507,397.503,0,256,0z M256,472c-119.384,0-216-96.607-216-216c0-119.385,96.607-216,216-216    c119.384,0,216,96.607,216,216C472,375.385,375.393,472,256,472z"/>
                                        <path d="M343.586,315.302L284.284,256l59.302-59.302c7.81-7.81,7.811-20.473,0.001-28.284c-7.812-7.811-20.475-7.81-28.284,0    L256,227.716l-59.303-59.302c-7.809-7.811-20.474-7.811-28.284,0c-7.81,7.811-7.81,20.474,0.001,28.284L227.716,256    l-59.302,59.302c-7.811,7.811-7.812,20.474-0.001,28.284c7.813,7.812,20.476,7.809,28.284,0L256,284.284l59.303,59.302    c7.808,7.81,20.473,7.811,28.284,0C351.398,335.775,351.397,323.112,343.586,315.302z"/>
                                        </svg>`;
            bottomDismiss.className = 'svg-dismiss';
            bottomDismiss.addEventListener('click', (e) => {
                document.querySelector('#StudyExtLightIntervention').remove();
                document.querySelector('#StudyExtLightInterventionSpacer').remove();
            });

            bottomBanner.appendChild(bottomBannerText);
            bottomBanner.append(bottomDismiss);
            document.body.appendChild(bottomBanner);

            let bottomSpacer = document.createElement('div');
            bottomSpacer.id = 'StudyExtLightInterventionSpacer';
            bottomSpacer.style.height = bottomBanner.offsetHeight;
            document.body.appendChild(bottomSpacer);
        }
    });
}

injectLightIntervention();