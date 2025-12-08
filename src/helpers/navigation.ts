export const initNavigation = (): void => {
  const menuToggle = document.querySelector<HTMLButtonElement>("#menu-toggle");
  const navigation = document.querySelector<HTMLElement>("#primary-navigation");

  if (!menuToggle || !navigation) {
    return;
  }

  const toggleMenu = (): void => {
    const isExpanded = menuToggle.getAttribute("aria-expanded") === "true";
    const nextState = !isExpanded;

    menuToggle.setAttribute("aria-expanded", String(nextState));
    navigation.classList.toggle("is-open", nextState);
  };

  menuToggle.addEventListener("click", toggleMenu);

  navigation
    .querySelectorAll<HTMLAnchorElement>('a[href^="#"]')
    .forEach((link) => {
      link.addEventListener("click", () => {
        if (menuToggle.getAttribute("aria-expanded") === "true") {
          menuToggle.setAttribute("aria-expanded", "false");
          navigation.classList.remove("is-open");
        }
      });
    });
};


