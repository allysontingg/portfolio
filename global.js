console.log('IT’S ALIVE!');

function $$(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}

// let navLinks = $$("nav a");

// let currentLink = navLinks.find(
//     (a) => a.host === location.host && a.pathname === location.pathname,
//   );

// if (currentLink) {
//     // or if (currentLink !== undefined)
//     currentLink.classList.add('current');
// }

// creating nav bar on each page 
let pages = [
    { url: '', title: 'Home' },
    { url: 'projects/', title: 'Projects' },
    // add the rest of your pages here
    { url: 'contact/', title: 'Contact' },
    { url: 'https://github.com/allysontingg', title: 'GitHub' },
    { url: 'resume/', title: 'Resume' },
];

let nav = document.createElement('nav');
document.body.prepend(nav);

const BASE_PATH = (location.hostname === "localhost" || location.hostname === "127.0.0.1") 
    ? "/" 
    : "/portfolio/";

for (let p of pages) {
    let url = p.url;
    let title = p.title;
    // next step: create link and add it to nav

    url = !url.startsWith('http') ? BASE_PATH + url : url;

    let a = document.createElement('a');
    a.href = url;
    a.textContent = title;
    nav.append(a);

    // add class="current" to current page link
    if (a.host === location.host && a.pathname === location.pathname) {
        a.classList.add('current');
    } 

    // add target="_blank" to external links - GitHub
    if (a.host !== location.host) {
        a.target = "_blank";
    }
  }

  //light dark mode switch 
document.body.insertAdjacentHTML(
    'afterbegin',
    `
      <label class="color-scheme">
          Theme:
          <select>
            <option value="light dark">Automatic</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
      </label>`,
  );

// actually setting mode to switch value 
const select = document.querySelector('.color-scheme select');

select.addEventListener('input', function (event) {
    console.log('color scheme changed to', event.target.value);
    document.documentElement.style.setProperty('color-scheme', event.target.value);

    localStorage.colorScheme = event.target.value
});

if ('colorScheme' in localStorage) {
    const savedScheme = localStorage.colorScheme;
    document.documentElement.style.setProperty('color-scheme', savedScheme);
    select.value = savedScheme;
} else {
    // Default to automatic if no preference saved
    document.documentElement.style.setProperty('color-scheme', 'light dark');
    select.value = 'light dark';
}

// fixing contact form - no + btwn words in body of email 
const contactForm = document.querySelector('form[action^="mailto:"]');

contactForm?.addEventListener('submit', function(event) {
  event.preventDefault();
  
  const data = new FormData(contactForm);
  let params = [];
  
  for (let [name, value] of data) {
    if (value.trim()) {
      params.push(`${name}=${encodeURIComponent(value)}`);
    }
    console.log(name, value);
  }
  
  let url = contactForm.action;
    if (params.length > 0) {
      url += '?' + params.join('&');
  }
  
  location.href = url;
});