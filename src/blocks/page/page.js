import ready from "../../js/utils/documentReady.js";
import Headroom from "headroom.js";

ready(function () {
  // grab an element
  let pageHeader = document.querySelector(".page__header");
  // construct an instance of Headroom, passing the element
  const headroom = new Headroom(pageHeader, {
    offset: 200,
    tolerance: 15,
  });
  headroom.init();
});
