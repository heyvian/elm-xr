const e=document.querySelector("body"),t=document.querySelector(".js-info-panel-toggle"),s=document.querySelector(".js-info-panel"),i=document.querySelector(".js-device-support-blurb-supported"),o=document.querySelector(".js-device-support-blurb-not-supported"),r=document.querySelector(".js-start-webxr");function showNotSupportedBlurb(){i.classList.add("not-visible"),i.setAttribute("aria-hidden","true"),o.classList.add("is-visible"),o.setAttribute("aria-hidden","false"),r.textContent="Your device does not support AR",r.classList.add("is-disabled"),r.setAttribute("disabled","disabled")}navigator.xr.isSessionSupported("immersive-ar").then((function(e){e?function showSupportedBlurb(){i.classList.add("is-visible"),i.setAttribute("aria-hidden","false"),o.classList.add("not-visible"),o.setAttribute("aria-hidden","true")}():showNotSupportedBlurb()})).catch(showNotSupportedBlurb),t.addEventListener("click",(function(){!function togglePanel(){e.classList.contains("has-menu-open")?(e.classList.remove("has-menu-open"),s.setAttribute("aria-hidden","true"),t.setAttribute("aria-label","Open more info panel")):(e.classList.add("has-menu-open"),s.setAttribute("aria-hidden","false"),t.setAttribute("aria-label","Close info panel"))}()}));