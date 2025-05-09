import { fetchJSON, renderProjects } from "../global.js";
const projects = await fetchJSON("../lib/projects.json");
const projectsContainer = document.querySelector(".projects");
renderProjects(projects, projectsContainer, "h2");

import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";

// pie chart timeeee
let arcGenerator = d3.arc().innerRadius(0).outerRadius(50);

let selectedIndex = -1;
let selectedYear = -1;
let query = "";

function getFilteredProjects() {
  let filtered = projects;

  // Apply search filter
  if (query) {
    filtered = filtered.filter((project) =>
      Object.values(project).join(" ").toLowerCase().includes(query),
    );
  }

  // Apply year filter
  if (selectedIndex !== -1) {
    filtered = filtered.filter(
      (p) => p.year.toString() === selectedYear.toString(),
    );
  }

  return filtered;
}

function renderPieChart(projectsGiven) {
  let newRolledData = d3.rollups(
    projectsGiven,
    (v) => v.length,
    (d) => d.year,
  );
  let newData = newRolledData.map(([year, count]) => {
    return { value: count, label: year };
  });

  let newSliceGenerator = d3.pie().value((d) => d.value);
  let newArcData = newSliceGenerator(newData);
  let newArcs = newArcData.map((d) => arcGenerator(d));
  let colors = d3.scaleOrdinal(d3.schemePastel2);

  let newSVG = d3.select("svg");
  newSVG.selectAll("path").remove();

  let newLegend = d3.select(".legend");
  newLegend.selectAll("li").remove();

  // function updateSelection() {
  //     // Update paths
  //     newSVG.selectAll('path')
  //         .attr('class', (d, i) => i === selectedIndex ? 'selected' : '');

  //     // Update legend items
  //     newLegend.selectAll('.legend-item')
  //         .classed('selected', (d, i) => i === selectedIndex);
  // }

  newArcs.forEach((arc, idx) => {
    newSVG
      .append("path")
      .attr("d", arc)
      .attr("fill", colors(idx))
      .on("click", () => {
        selectedIndex = selectedIndex === idx ? -1 : idx;
        if (selectedIndex !== -1) {
          selectedYear =
            selectedYear === newData[selectedIndex].label
              ? -1
              : newData[selectedIndex].label;
        }
        const filteredProjects = getFilteredProjects();

        // if (selectedIndex === -1) {
        //     renderProjects(filteredProjects, projectsContainer, 'h2');
        // } else {
        //     // TODO: filter projects and project them onto webpage
        //     // Hint: `.label` might be useful
        //     let toRender = projects.filter(p => p.year === newData[selectedIndex].label);
        //     renderProjects(toRender, projectsContainer, 'h2');
        // }
        renderProjects(filteredProjects, projectsContainer, "h2");

        newSVG.selectAll("path").attr("class", (_, idx) =>
          // TODO: filter idx to find correct pie slice and apply CSS from above
          idx === selectedIndex ? "selected" : "",
        );
      });
  });

  // let legend = d3.select('.legend');
  newData.forEach((d, idx) => {
    newLegend
      .append("li")
      .attr("style", `--color:${colors(idx)}`) // set the style attribute while passing in parameters
      .attr("class", (_, idx) =>
        // TODO: filter idx to find correct legend and apply CSS from above
        idx === selectedIndex ? "legend-item selected" : "legend-item",
      )
      .html(`<span class="swatch"></span> ${d.label} <em>(${d.value})</em>`); // set the inner html of <li>
  });
}
// initial render
renderPieChart(projects);

let searchInput = document.querySelector(".searchBar");

searchInput.addEventListener("input", (event) => {
  // update query value
  query = event.target.value;
  // filter projects
  // let filteredProjects = projects.filter((project) => {
  //   let values = Object.values(project).join('\n').toLowerCase();
  //   return values.includes(query.toLowerCase());
  // });

  const filteredProjects = getFilteredProjects();

  // render filtered projects
  renderProjects(filteredProjects, projectsContainer, "h2");
  renderPieChart(filteredProjects);
});
