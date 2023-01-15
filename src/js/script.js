import ready from "../js/utils/documentReady.js";
import getScrollSize from "../js/utils/getScrollSize.js";

ready(function () {
  console.log("DOM героически построен!");
  // Добавление кастомного свойства с системной шириной скролла
  document.documentElement.style.setProperty("--css-scroll-size", `${getScrollSize()}px`);
});

// import $ from "jquery"; // Перед использованием установить как зависимость
// $(function () {
//   console.log("jQuery героически сработал!");
// });
