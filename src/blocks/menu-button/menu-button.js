import ready from "../../js/utils/documentReady.js";

ready(function () {
  // mobile menu
  const menuTrigger = document.querySelector(".menu-button");
  const menuDarker = document.querySelector(".page__darker");
  [menuTrigger, menuDarker].forEach((item) => {
    item.addEventListener("click", function () {
      let bodyState = document.body.getAttribute("data-state");
      bodyState === "mobile-menu"
        ? (document.body.dataset.state = "")
        : (document.body.dataset.state = "mobile-menu");
    });
  });
});
