(function () {
    /* eslint-disable no-prototype-builtins */
    /* eslint-disable no-undef */
    // ^ Above are some defaults for eslinter for easier debugging, can be ignored.
    "use strict";




    /*
        DEBUG PARAMETERS
        NOTE: Also present in service_worker.js. These values are set directly from the values that are present in that file,
        refer to it if there are any changes / flags that need to be edited.
        Note: These are just some simple flags / helper functions in debugging. Feel free to change / remove, etc.
        ALSO, here are some helpful reference pages for some stuff that was helpful during development:
            Template Literals - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals
            CORS Policy - https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
            Checking Browser Compatibility - https://caniuse.com/
            Chrome Developer Home - https://developer.chrome.com/docs/extensions/
            Manifest v3 - https://developer.chrome.com/docs/extensions/mv3/intro/
    */
    // For Debugging, should be changed in released extension. Base URL to point to the server.
    // Wrap in typeof to avoid double declaration error
    if (typeof SERVER_URL === 'undefined') {
        var SERVER_URL = false;
    }

    // For Debugging, should be false for production release error printing.
    if (typeof PRINT_DEBUG === 'undefined') {
        var PRINT_DEBUG = true;
    }

    // Log wrapper for debugging
    // Note: pass in item as the text to print, and ln for line number, default ? if not passed
    function log(item) {
        if (PRINT_DEBUG) {
            console.log(item);
        }
    }

    // Function that sets all of the flags for the debug parameters based on their setting in the service worker.
    // Relevant Docs: https://developer.chrome.com/docs/extensions/mv3/messaging/
    function setDebug() {
        chrome.runtime.sendMessage({getDebugParams: true}, resp => {
            SERVER_URL = resp.SERVER_URL;
            PRINT_DEBUG = resp.PRINT_DEBUG;
            log('Setting Debug Values!');
            log({SERVER_URL: SERVER_URL, PRINT_DEBUG: PRINT_DEBUG});
        });
    }




    /*
        URL RECORD MANAGEMENT FUNCTIONS
    */
    // ParticipantId value cached
    if (typeof ParticipantId === 'undefined') {
        var ParticipantId = false;
    }

    // TabRecord value cached
    if (typeof TabRecord === 'undefined') {
        var TabRecord = false;
    }

    // TabId value cached
    if (typeof TabId === 'undefined') {
        var TabId = false;
    }

    // Now, if message sent, set those values
    chrome.runtime.onMessage.addListener((message, sender, send_response) => {
        ParticipantId = message.ParticipantId;
        TabRecord = message.TabRecord;
        log('Setting Participant and TabRecord values!');
    });

    // post function (send to server):
    // NOTE: Also found in service_worker.js, see for more information.
    // Wrapper function for doing POST fetch requests and retrieving JSON.
    // Relevant Docs:   https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch
    function post(endpoint, data, callback_func) {
        data.ParticipantId = ParticipantId;
        data.recordId = TabRecord.recordId;
        log(data);
        fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        }).then(r => {
            if (!r.ok) {
                log('Error in POST');
                log(r);
                throw new Error('Network response failed');
            }
            else {
                return r.json();
            }
        }).then(res => {
            log('Response data:');
            log(res);
            if (callback_func) {
                callback_func(res);
            }
        }).catch(err => {
            log('ERROR');
            log(err);
        });
    }


    function postNewURL(entry) {
        log(entry);
        let record = {
            isIntersecting: entry.isIntersecting,
            currentWebPage: location.href,
            referrerWebPage: document.referrer
        };
        // Feature detection: If the entries do have the true visibility field and aren't truly visible, ignore them
        // If they do have it but still show that it's not available, just be careful and indicate so. Some websites have broken versions of this implemented,
        // and right now this is a chrome specific feature.
        if ('isVisible' in entry) {
            record.isVisible = entry.isVisible;
            record.trackVisibilityAvailable = true;
        }
        // Otherwise, we will set isVisible to false alongside setting whether true visibility is available to false.
        // Regardless, we'll still send the record though, since if true visibility isn't available but the intersect
        // callback has been called, this means that the item must intersect with the current viewport.
        else {
            record.isVisible = false;
            record.trackVisibilityAvailable = false;
        }
        // Now finally, just record what type of tag the element is, an 'a' anchor tag, or an iFrame tag, and add the link
        // information from the tag (both from the shorthand getAttribute) to the fully path expanded .href element (both for 'a' tags).
        // If this is an iframe, then only the src tag will be available, and this is recorded instead.
        if (entry.target.tagName == 'A') {
            record.tagName = 'a';
            record.fullUrl = entry.target.href;
            record.baseUrl = entry.target.getAttribute('href');
        }
        else if (entry.target.tagName == 'IFRAME') {
            record.tagName = 'iframe';
            record.fullUrl = entry.target.src;
            record.baseUrl = entry.target.getAttribute('src');
        }
        // Set new endpoint, post the request, and ignore this element from now on in the observer.
        let endpoint = `${SERVER_URL}/extension/collect-links/`;
        post(endpoint, record);
    }

    function debugTimer(diff) {
        const elapsedSeconds = diff / 1000;
        const sec = Math.floor(elapsedSeconds % 60);
        const min = Math.floor(elapsedSeconds / 60);
        log(`${min}:${sec.toString().padStart(2, "0")}`);
    }

    function postUpdateIntersectionTime(entry) {
        const lastStarted = entry.target.getAttribute("last-view-started");
        const currentTime = performance.now();
        
        if (lastStarted) {
            const diff = currentTime - lastStarted;
            // debugTimer(diff);
            let record = {
                intersectDuration: diff
            };
            if (entry.target.tagName == 'A') {
                record.fullUrl = entry.target.href;
            }
            else if (entry.target.tagName == 'IFRAME') {
                record.fullUrl = entry.target.src;
            }
            let endpoint = `${SERVER_URL}/extension/collect-visible-link-duration/`;
            post(endpoint, record);
        }
    }


    /*
        DOM Link Collectors
    */
    /*
        Inject DOM Indicator Function:
        This function injects a div into the webpage with the ID #StudyExtLinkCollecterIsInjected which serves
        as an indicator as to whether the content script is already running on the page. This is important because
        sometimes because of how certain pages load, a script may be injected twice into the same webpage and Javascript
        runtime. It returns true if it was able to inject, and false if it was not able to inject. The only times this will
        fail is if somehow the document body is not yet defined when the script was injected, in which case the script should wait.
        For reference, see:
            https://developer.mozilla.org/en-US/docs/Web/API/Document/createElement
            https://developer.mozilla.org/en-US/docs/Web/API/Element/append
    */
    function injectDOMIndicator() {
        let injectionElem = document.createElement('div');
        injectionElem.id = 'StudyExtLinkCollecterIsInjected';
        injectionElem.hidden = true;
        if (document.body) {
            document.body.append(injectionElem);
            return true;
        }
        else {
            return false;
        }
    }

    /*
        Is Script Injected Function:
        This function matches the above inject DOM Indicator function, and checks whether the indicator element,
        a div tag with the ID #StudyExtLinkCollecterIsInjected is already present on the page, returning true or false.
        See:
            https://developer.mozilla.org/en-US/docs/Web/API/Document/getElementById
    */
    function isScriptInjected() {
        if (document.getElementById('StudyExtLinkCollecterIsInjected')) {
            return true;
        }
        else {
            return false;
        }
    }

    /*
        Intersect Callback Function:
        This function is called every time that an element scrolls into the viewport, and processes a list of the elements that just scrolled in.
        For each of these elements, we check whether they are truly visible, a feature only available in IntersectionObserver API v2, or if they
        just intersect. It then takes this information, alongside whether the tags are 'a' anchor tags or iFrames, and posts it all to the backend.
        Note that IntersectionObserver v2 seems to be mostly Chrome and Chrome derivative only, but should be supported on all browsers that support
        extension manifest v3, so we should be good to go with that.
        For more information, see:
            https://developer.mozilla.org/en-US/docs/Web/API/IntersectionObserver
            https://developer.mozilla.org/en-US/docs/Web/API/IntersectionObserver/IntersectionObserver
            https://web.dev/intersectionobserver-v2/
            https://stackoverflow.com/questions/15439853/get-local-href-value-from-anchor-a-tag
            https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API
    */
    function intersectCallback(entries, observer) {
        // Loop over all the intersecting elements in last callback
        for (let entry of entries) {
            // For any that are intersecting, begin setting up a record
            if (entry.isIntersecting) {
                if (entry.intersectionRatio >= 0.75) {
                    // https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API/Timing_element_visibility
                        if (!entry.target.hasAttribute("last-view-started")) {
                            // first time ever seeing this URL.
                            entry.target.setAttribute("last-view-started", entry.time);
                            entry.target.classList.add('studyExtElementIsVisible');
                            postNewURL(entry)
                        } else {
                            if (!entry.target.classList.contains('studyExtElementIsVisible')) {
                                // re-entry from exit from viewport.
                                entry.target.setAttribute("last-view-started", entry.time);
                                entry.target.classList.add('studyExtElementIsVisible');
                            }
                        }
                    }
                } else {
                    if (entry.intersectionRatio === 0.0 && entry.target.hasAttribute("last-view-started")) {
                        // leaves the viewport.
                        entry.target.classList.remove('studyExtElementIsVisible');
                        postUpdateIntersectionTime(entry);
                    }
                }
            }
        }
    

    /*
        Initialize Intersection Observer Function:
        This function initializes the intersection observer, by setting the basic options available in the API
        (root: null to track the viewport, threshold 1.0 so elements are completely visible, delay 300 ms to avoid too many calls, trackVisibility for true visibility in API v2).
        It then returns this object to the main function.
        For reference, see:
            https://web.dev/intersectionobserver-v2/
            https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API
            https://developer.mozilla.org/en-US/docs/Web/API/IntersectionObserver/IntersectionObserver
     */
    function initIntersectObserver() {
        let intersectOptions = {
            root: null,
            threshold: [0.0, 0.75],
            trackVisibility: true,
            delay: 300,
        };
        let intersectObserver = new IntersectionObserver(intersectCallback, intersectOptions);
        return intersectObserver;
    }

    /*
        Is Valid Link Function:
        This function is super simple, and checks whether a passed in string seems to be a valid path or link.
        For our purposes, valid links either redirect to a different page on the same server and start with '/', begin with
        'www.', or instead start with 'http' for the protocol (includes https://).
    */
    function isValidLink(link) {
        if (!link) {
            // Undefined check
            return false;
        }
        else if (link.startsWith('/')) {
            return true;
        }
        else if (link.startsWith('www.')) {
            return true;
        }
        else if (link.startsWith('http')) {
            return true;
        }
        else {
            return false;
        }
    }

    /*
        Add Observed Elements Function:
        Given an intersection observer object, an array of all of the elements that have been observed and are being tracked,
        and a target element, this function will check the target element and any children it has to see if they are or contain
        any 'a' anchor tags or iFrame elements. If they do contain any of these elements, and have not yet been tracked or observed,
        it will add them to the list of observed elements and observe them.
        For more information, see:
            https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/push
            https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/includes
            https://developer.mozilla.org/en-US/docs/Web/API/Element/getElementsByTagName
            https://developer.mozilla.org/en-US/docs/Web/API/NodeList
    */
    function addObservedElems(intersectObserver, observedElems, targetElem = document) {
        // By default, this function will check the whole DOM unless otherwise specified
        // Check if target element itself is a link
        if (targetElem.tagName == 'A' && isValidLink(targetElem.getAttribute('href')) && !observedElems.includes(targetElem)) {
            observedElems.push(targetElem);
            intersectObserver.observe(targetElem);
        }
        // Check if target element is an iframe
        else if (targetElem.tagName == 'IFRAME' && isValidLink(targetElem.src) && !observedElems.includes(targetElem)) {
            observedElems.push(targetElem);
            intersectObserver.observe(targetElem);
        }
        else {
            // Check all the children of the target element that are links, if any, and add them if they have not been observed
            let childLinks = targetElem.getElementsByTagName('a');
            for (let link of childLinks) {
                if (isValidLink(link.getAttribute('href')) && !observedElems.includes(link)) {
                    observedElems.push(link);
                    intersectObserver.observe(link);
                }
            }
            // Check all the children of the target element that are iframes, if any, and add them if they have not been observed
            let childFrames = targetElem.getElementsByTagName('iframe');
            for (let iframe of childFrames) {
                if (isValidLink(iframe.src) && !observedElems.includes(iframe)) {
                    observedElems.push(iframe);
                    intersectObserver.observe(iframe);
                }
            }
        }
    }

    /*
        Get Mutation Callback Function:
        This function returns the callback function that is called every time that the page mutates. In this context, a mutation is any
        change in the elements of the webpage, which could mean that there were elements removed, elements added, or even elements that had
        their attributes modified from when they were first added to the DOM. This function wraps returning the callback function so that
        way the intersection observer and the array of previously observed elements can be accessed still. Every time it is called, it
        then itself calls the addObservedElems function on the elements that have mutated to scoop up any new links or iframes that might
        have been added or modified since the last time they were observed.
        For more information, see:
            https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver
            https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver/MutationObserver
            https://www.sitepoint.com/javascript-decorators-what-they-are/
    */
    function getMutationCallback(intersectObserver, observedElems) {
        let callbackFunc = function(mutRecords) {
            for (let mutEntry of mutRecords) {
                addObservedElems(intersectObserver, observedElems, mutEntry.targetElem);
            }
        }
        return callbackFunc;
    }

    /*
        Initialize Mutation Observer Function:
        This function initializes the mutation observer object, by first receiving the mutation callback function generated by the getMutationCallback
        decorator / function generator. It then itself initializes the new mutation observer, and returns this object.
        For more information, see:
            https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver
            https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver/MutationObserver
    */
    function initMutationObserver(intersectObserver, observedElems) {
        let callbackFunc = getMutationCallback(intersectObserver, observedElems);
        let mutationObserver = new MutationObserver(callbackFunc);
        return mutationObserver;
    }

    /*
        Run Observer Function:
        This function is responsible for running all of the different helper functions in order to
        1) check if the content script has already been injected / run on this page
        2) if it hasn't injecting the indicator into the DOM so that way another injection can't run / duplicate data
        3) set the debug parameters
        4) create the intersection observer object to track element visibility
        5) create the observed elements array to track the elements that have already been tracked by the intersection observer
        6) finally initialize the mutation observer to track any changes that happen to the DOM, and register the callback to note them as they happen and respond accordingly.
        For more information, see each of the functions above, and the reference for the options for MutationObserver:
            https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver
            https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver/MutationObserver
    */
    function runObserver() {
        if (!isScriptInjected()) {
            let status = injectDOMIndicator();
            if (status) {
                setDebug();
                let intersectObserver = initIntersectObserver();
                let observedElems = [];
                addObservedElems(intersectObserver, observedElems);
                let mutationObserver = initMutationObserver(intersectObserver, observedElems);
                let mutationOptions = {
                    childList: true,
                    subtree: true,
                    attributes: true
                };
                mutationObserver.observe(document.body, mutationOptions);
            }
        }
    }




    /*
        SCRIPT EXECUTION ONLOAD:
        This final snippet actually runs the observer super function when the page has finished loading (if it hasn't already).
    */
    if (document.readyState == 'complete') {
        runObserver();
    }
    else {
        document.addEventListener('load', () => {
            runObserver();
        });
    }
})();