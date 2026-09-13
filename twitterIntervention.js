"use strict";

/*
    twitterIntervention.js
    Content script that runs when injected into page based on server intervention endpoint response.
*/

function injectTwitterIntervention() {
    chrome.storage.local.get(['TwitterInterventionMessage', 'TwitterInterventionType'], items => {
        let algorithmicFeed = items.TwitterInterventionType == "for you" ? true : false
        let mutationObserver = new MutationObserver((mutations) => {
            for (let mutEntry of mutations) {
                if (location.href != "https://twitter.com/home") {
                    return
                }
                let node = mutEntry.target
                if (node.getAttribute("href") == "/home" && node.getAttribute("role") == "tab" && node.textContent == "For you") {
                    if (algorithmicFeed && node.getAttribute("aria-selected") == "false") {
                        node.click();
                    }
                } else if (node.getAttribute("href") == "/home" && node.getAttribute("role") == "tab" && node.textContent == "Following") {
                    if (!algorithmicFeed && node.getAttribute("aria-selected") == "false") {
                        node.click();
                    }
                } else if (node.hasAttribute('data-testid') && node.getAttribute('data-testid') == 'ScrollSnap-List' && !node.hidden) {
                    node.hidden = true;
                    node.style.display = 'none';
                }
            }
        })

        let mutationOptions = {
            childList: true,
            subtree: true,
            attributes: true
        };
        mutationObserver.observe(document.body, mutationOptions);
    })
}

injectTwitterIntervention();