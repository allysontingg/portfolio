import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";

async function loadData() {
    const data = await d3.csv("loc.csv", (row) => ({
        ...row,
        line: Number(row.line), // or just +row.line
        depth: Number(row.depth),
        length: Number(row.length),
        date: new Date(row.date + "T00:00" + row.timezone),
        datetime: new Date(row.datetime),
    }));

    return data;
}

function processCommits(data) {
    data.sort((a, b) => a.datetime - b.datetime);
    return d3
        .groups(data, (d) => d.commit)
        .map(([commit, lines]) => {
            let first = lines[0];

            // We can use object destructuring to get these properties
            let { author, date, time, timezone, datetime } = first;

            let ret = {
                id: commit,
                url: "https://github.com/portfolio/commit/" + commit,
                author,
                date,
                time,
                timezone,
                datetime,
                // What other properties might be useful?
                dow: datetime.getDay(),
                hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
                totalLines: lines.length,
            };

            Object.defineProperty(ret, 'lines', {
                value: lines,
                enumerable: false,
                writable: false,
                configurable: false,
            });

            return ret;
        });
}

// console.log(commits);

function renderCommitInfo(data, filteredCommits) {
    // Create the dl element
    d3.select("#stats").selectAll("dl").remove();
    const dl = d3.select("#stats").append("dl").attr("class", "stats");

    // Number of files
    let files = d3.groups(data, (d) => d.file);
    dl.append("dt").text("Files");
    dl.append("dd").text(files.length);
    // cannot figure out how to differentiate between the files with duplicate names

    // Add total LOC
    dl.append("dt").html('Total <abbr title="Lines of code">LOC</abbr>');
    dl.append("dd").text(data.length);

    // Max Lines of Code
    let maxLines = d3.max(data, (d) => d.length);
    let maxLinesName = d3.max(data, (d) => d.file);
    dl.append("dt").html('Max <abbr title="Lines of code">LOC</abbr>');
    dl.append("dd").text(maxLines);

    // Add total commits
    dl.append("dt").text("Commits");
    dl.append("dd").text(filteredCommits.length);

    // Add more stats as needed...

    // DOW most work is done
    let maxDOW = d3.max(filteredCommits, (d) => d.dow);
    let maxDOWName = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
    ][maxDOW];
    dl.append("dt").text("DOW Most Work Done");
    dl.append("dd").text(maxDOWName);

    // time of day most work is done (morning, afternoon, evening, night)
    const workByPeriod = d3.rollups(
        data,
        (v) => v.length,
        (d) => new Date(d.datetime).toLocaleString("en", { dayPeriod: "short" }),
    );
    const maxPeriod = d3.greatest(workByPeriod, (d) => d[1])?.[0];
    dl.append("dt").text("TOD Most Work Done");
    dl.append("dd").text(maxPeriod);
}

// tooltip 

function renderTooltipContent(commit) {
    const link = document.getElementById('commit-link');
    const date = document.getElementById('commit-date');

    if (Object.keys(commit).length === 0) return;

    link.href = commit.url;
    link.textContent = commit.id;
    date.textContent = commit.datetime?.toLocaleString('en', {
        dateStyle: 'full',
    });
}

function updateTooltipVisibility(isVisible) {
    const tooltip = document.getElementById('commit-tooltip');
    tooltip.hidden = !isVisible;
}

function updateTooltipPosition(event) {
    const tooltip = document.getElementById('commit-tooltip');
    tooltip.style.left = `${event.clientX}px`;
    tooltip.style.top = `${event.clientY}px`;
}

// brushing 

function createBrushSelector(svg) {
    svg.call(d3.brush().on('start brush end', brushed));
    svg.selectAll('.dots, .overlay ~ *').raise();
}

function isCommitSelected(selection, commit) {
    if (!selection) {
        return false;
    }
    // TODO: return true if commit is within brushSelection
    // and false if not
    const [x0, x1] = selection.map((d) => d[0]);
    const [y0, y1] = selection.map((d) => d[1]);
    const x = xScale(commit.datetime);
    const y = yScale(commit.hourFrac);

    // Check if point is within selection bounds
    return x >= x0 &&
        x <= x1 &&
        y >= y0 &&
        y <= y1;
}

function renderSelectionCount(selection) {
    const selectedCommits = selection
        ? commits.filter((d) => isCommitSelected(selection, d))
        : [];

    const countElement = document.querySelector('#selection-count');
    countElement.textContent = `${selectedCommits.length || 'No'} commits selected`;

    return selectedCommits;
}

function renderLanguageBreakdown(selection) {
    const selectedCommits = selection
        ? commits.filter((d) => isCommitSelected(selection, d))
        : [];
    const container = document.getElementById('language-breakdown');

    if (selectedCommits.length === 0) {
        container.innerHTML = '';
        return;
    }
    const requiredCommits = selectedCommits.length ? selectedCommits : commits;
    const lines = requiredCommits.flatMap((d) => d.lines);

    // Use d3.rollup to count lines per language
    const breakdown = d3.rollup(
        lines,
        (v) => v.length,
        (d) => d.type,
    );

    // Update DOM with breakdown
    container.innerHTML = '';

    for (const [language, count] of breakdown) {
        const proportion = count / lines.length;
        const formatted = d3.format('.1~%')(proportion);

        container.innerHTML += `
              <dt>${language}</dt>
              <dd>${count} lines (${formatted})</dd>
          `;
    }
}

function brushed(event) {
    const selection = event.selection;
    d3.selectAll('circle').classed('selected', (d) =>
        isCommitSelected(selection, d),
    );
    renderSelectionCount(selection);
    renderLanguageBreakdown(selection);
}

let xScale, yScale;

// draw the scatter plot

function renderScatterPlot(data, filteredCommits) {
    const width = 1000;
    const height = 600;

    d3.select('svg').remove();

    const svg = d3
        .select("#chart")
        .append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .style("overflow", "visible");

    xScale = d3
        .scaleTime()
        .domain(d3.extent(filteredCommits, (d) => d.datetime))
        .range([0, width])
        .nice();
    yScale = d3.scaleLinear().domain([0, 24]).range([height, 0]);

    svg.selectAll('g').remove();
    const dots = svg.append("g").attr("class", "dots");

    const margin = { top: 10, right: 10, bottom: 30, left: 20 };
    const usableArea = {
        top: margin.top,
        right: width - margin.right,
        bottom: height - margin.bottom,
        left: margin.left,
        width: width - margin.left - margin.right,
        height: height - margin.top - margin.bottom,
    };

    // Update scales with new ranges
    xScale.range([usableArea.left, usableArea.right]);
    yScale.range([usableArea.bottom, usableArea.top]);

    //gridlines 
    const gridlines = svg
        .append('g')
        .attr('class', 'gridlines')
        .attr('transform', `translate(${usableArea.left}, 0)`);

    // Create gridlines as an axis with no labels and full-width ticks
    gridlines.call(d3.axisLeft(yScale).tickFormat('').tickSize(-usableArea.width));

    // style the gridlines
    gridlines.selectAll('line')
        .attr('stroke', '#ccc')
        .attr('stroke-width', 1)
        .attr('opacity', 0.5);

    // Create the axes
    const xAxis = d3.axisBottom(xScale);
    // const yAxis = d3.axisLeft(yScale);

    const yAxis = d3
        .axisLeft(yScale)
        .tickFormat((d) => String(d % 24).padStart(2, "0") + ":00");

    // Add X axis
    svg
        .append("g")
        .attr("transform", `translate(0, ${usableArea.bottom})`)
        .call(xAxis);

    // Add Y axis
    svg
        .append("g")
        .attr("transform", `translate(${usableArea.left}, 0)`)
        .call(yAxis);

    // scale dot size to number of edited lines
    const [minLines, maxLines] = d3.extent(filteredCommits, (d) => d.totalLines);
    const rScale = d3
        .scaleSqrt()
        .domain([minLines, maxLines])
        .range([5, 25]);

    // sorting commits by size before rendering
    const sortedCommits = d3.sort(filteredCommits, (d) => -d.totalLines);

    createBrushSelector(svg);

    dots.selectAll("circle").remove();
    dots
        .selectAll("circle")
        .data(sortedCommits)
        .join("circle")
        .attr("cx", (d) => xScale(d.datetime))
        .attr("cy", (d) => yScale(d.hourFrac))
        .attr("fill", "steelblue")
        .attr('r', (d) => rScale(d.totalLines))
        .style('fill-opacity', 0.7) // Add transparency for overlapping dots
        .on('mouseenter', (event, commit) => {
            d3.select(event.currentTarget).style('fill-opacity', 1);
            renderTooltipContent(commit);
            updateTooltipVisibility(true);
            updateTooltipPosition(event);
        })
        .on('mouseleave', (event) => {
            d3.select(event.currentTarget).style('fill-opacity', 0.7);
            updateTooltipVisibility(false);
        });
}

// full data and commits lists
let data = await loadData();
let commits = processCommits(data);

//lab 8
let commitProgress = 100;
let filteredCommits = [];
let filteredData = [];

let timeScale = d3.scaleTime(
    [d3.min(commits, (d) => d.datetime), d3.max(commits, (d) => d.datetime)],
    [0, 100],
);
let commitMaxTime = timeScale.invert(commitProgress);

function updateFilteredCommitsAndData() {
    commitMaxTime = timeScale.invert(commitProgress);
    filteredCommits = commits.filter((d) => d.datetime <= commitMaxTime);
    // keep data if its commit is in filteredCommits
    filteredData = data.filter((d) => {
        return filteredCommits.some((commit) => commit.id === d.commit);
    });
}

// const selectedTime = d3.select('#selectedTime');
// selectedTime.textContent = timeScale.invert(commitProgress).toLocaleString();

let fileTypeColors = d3.scaleOrdinal(d3.schemeTableau10);

function updateFileVisualization() {
    // Process files data from filtered commits
    let lines = filteredCommits.flatMap((d) => d.lines);
    let files = d3
        .groups(lines, (d) => d.file)
        .map(([name, lines]) => {
            return {
                name,
                lines,
                totalLines: lines.length
            };
        })
        .sort((a, b) => b.totalLines - a.totalLines); // Sort by size descending

    // Select container and clear existing content
    d3.select('.files').selectAll('div').remove();

    // Create new elements
    let filesContainer = d3.select('.files')
        .selectAll('div')
        .data(files)
        .enter()
        .append('div');

    // Add filename
    filesContainer.append('dt')
        .html(d => `
            <code>${d.name}</code>
            <small>${d.totalLines} lines</small>
        `);

    // Add line count
    filesContainer.append('dd')
        .selectAll('div')
        .data(d => d.lines)
        .join('div')
        .attr('class', 'line')
        .style('background', d => fileTypeColors(d.type))
    // .text(d => `${d.totalLines.toLocaleString()} lines`);
}

// Function to update the display based on slider value
function updateDisplay() {
    commitProgress = document.getElementById('commit-slider').value;
    let commitMaxTime = timeScale.invert(commitProgress);

    // Update the time display
    document.getElementById('time-display').textContent =
        commitMaxTime.toLocaleString(undefined, {
            dateStyle: "long",
            timeStyle: "short"
        });
    updateFilteredCommitsAndData();
    renderScatterPlot(filteredData, filteredCommits);
    renderCommitInfo(filteredData, filteredCommits);
    updateFileVisualization();
}

function renderItems(startIndex) {
    itemsContainer.selectAll('div').remove();
    const endIndex = Math.min(startIndex + VISIBLE_COUNT, commits.length);
    let newCommitSlice = commits.slice(startIndex, endIndex);
    renderScatterPlot(filteredData, newCommitSlice);

    itemsContainer.selectAll('div')
        .data(newCommitSlice)
        .enter()
        .append('div')
        // TODO: what should we include here? (read the next step)
        .html((d, i) => generateCommitNarrative(d, startIndex + i))
        .style('position', 'absolute')
        .style('top', (_, idx) => `${idx * ITEM_HEIGHT}px`)
}

function renderFileItems(startIndex) {
    fileItemsContainer.selectAll('div').remove();
    const endIndex = Math.min(startIndex + FILE_VISIBLE_COUNT, commits.length);
    const newCommitSlice = commits.slice(startIndex, endIndex);

    updateFileVisualization();
    displayCommitFiles(newCommitSlice);

    fileItemsContainer.selectAll('div')
        .data(newCommitSlice)
        .enter()
        .append('div')
        .attr('class', 'file-item')
        .html((d, i) => generateFileNarrative(d, startIndex + i))
        .style('position', 'absolute')
        .style('top', (_, idx) => `${idx * ITEM_HEIGHT}px`);
}

function generateFileNarrative(commit, index) {
    return `
      <p class="file-narrative">
        On ${commit.datetime.toLocaleString("en", { dateStyle: "full", timeStyle: "short" })},
        I worked on ${d3.rollups(commit.lines, D => D.length, d => d.file).length} files.
        ${index === 0 ? 'These files formed the foundation of my project.' : ''}
      </p>
    `;
}


function generateCommitNarrative(commit, index) {
    const fileCount = new Set(commit.lines.map(line => line.file)).size;
    if (index === 0) {
        return `
            <p class="commit-narrative">
                On ${commit.datetime.toLocaleString("en", { dateStyle: "full", timeStyle: "short" })}, 
                I made my first commit.
                I edited ${commit.totalLines} lines across ${fileCount} files.
                This was the beginning of my journey.
            </p>
        `;
    }
    if (index === 1) {
        return `
            <p class="commit-narrative">
                On ${commit.datetime.toLocaleString("en", { dateStyle: "full", timeStyle: "short" })}, 
                I made my second commit.
                I edited ${commit.totalLines} lines across ${fileCount} files.
                My webpage has started to come together.
            </p>
        `;
    }
    if (index === 2) {
        return `
            <p class="commit-narrative">
                On ${commit.datetime.toLocaleString("en", { dateStyle: "full", timeStyle: "short" })}, 
                I made my third commit.
                I edited ${commit.totalLines} lines across ${fileCount} files.
                My webpage is starting to look good.
            </p>
        `;
    }
    if (index === 3) {
        return `
            <p class="commit-narrative">
                On ${commit.datetime.toLocaleString("en", { dateStyle: "full", timeStyle: "short" })}, 
                I made my fourth commit.
                I edited ${commit.totalLines} lines across ${fileCount} files.
                My webpage is starting to look great.
            </p>
        `;
    }
    if (index === 4) {
        return `
            <p class="commit-narrative">
                On ${commit.datetime.toLocaleString("en", { dateStyle: "full", timeStyle: "short" })}, 
                I made my fifth commit.
                I edited ${commit.totalLines} lines across ${fileCount} files.
                My webpage is starting to look amazing.
            </p>
        `;
    }
    if (index === 5) {
        return `
            <p class="commit-narrative">
                On ${commit.datetime.toLocaleString("en", { dateStyle: "full", timeStyle: "short" })}, 
                I made my sixth commit.
                I edited ${commit.totalLines} lines across ${fileCount} files.
                My webpage is starting to look awesome.
            </p>
        `;
    }
    if (index === 6) {
        return `
            <p class="commit-narrative">
                On ${commit.datetime.toLocaleString("en", { dateStyle: "full", timeStyle: "short" })}, 
                I made my seventh commit.
                I edited ${commit.totalLines} lines across ${fileCount} files.
                My webpage is starting to look incredible.
            </p>
        `;
    }
    if (index === 7) {
        return `
            <p class="commit-narrative">
                On ${commit.datetime.toLocaleString("en", { dateStyle: "full", timeStyle: "short" })}, 
                I made my eighth commit.
                I edited ${commit.totalLines} lines across ${fileCount} files.
                My webpage is starting to look fantastic.
            </p>
        `;
    }
    if (index === 8) {
        return `
            <p class="commit-narrative">
                On ${commit.datetime.toLocaleString("en", { dateStyle: "full", timeStyle: "short" })}, 
                I made my ninth commit.
                I edited ${commit.totalLines} lines across ${fileCount} files.
                My webpage is starting to look phenomenal.
            </p>
        `;
    }
    if (index === 9) {
        return `
            <p class="commit-narrative">
                On ${commit.datetime.toLocaleString("en", { dateStyle: "full", timeStyle: "short" })}, 
                I made my tenth commit.
                I edited ${commit.totalLines} lines across ${fileCount} files.
                My webpage is starting to look extraordinary.
            </p>
        `;
    }
    if (index === 10) {
        return `
            <p class="commit-narrative">
                On ${commit.datetime.toLocaleString("en", { dateStyle: "full", timeStyle: "short" })}, 
                I made my eleventh commit.
                I edited ${commit.totalLines} lines across ${fileCount} files.
                My webpage is starting to look remarkable.
            </p>
        `;
    }
    if (index === 11) {
        return `
            <p class="commit-narrative">
                On ${commit.datetime.toLocaleString("en", { dateStyle: "full", timeStyle: "short" })}, 
                I made my twelfth commit.
                I edited ${commit.totalLines} lines across ${fileCount} files.
                My webpage is starting to look stunning.
            </p>
        `;
    }
    if (index === 12) {
        return `
            <p class="commit-narrative">
                On ${commit.datetime.toLocaleString("en", { dateStyle: "full", timeStyle: "short" })}, 
                I made my thirteenth commit.
                I edited ${commit.totalLines} lines across ${fileCount} files.
                My webpage is now breathtaking.
            </p>
        `;
    } else {return `
        <p class="commit-narrative">
            On ${commit.datetime.toLocaleString("en", { dateStyle: "full", timeStyle: "short" })}, 
            I made a glorious commit.
            I edited ${commit.totalLines} lines across ${fileCount} files.
            Then I looked over all I had made, and I saw that it was very good.
        </p>
    `;}
    
}

function displayCommitFiles() {
    const lines = filteredCommits.flatMap((d) => d.lines);
    let fileTypeColors = d3.scaleOrdinal(d3.schemeTableau10);
    let files = d3
        .groups(lines, (d) => d.file)
        .map(([name, lines]) => {
            return { name, lines };
        });
    files = d3.sort(files, (d) => -d.lines.length);
    d3.select('.files').selectAll('div').remove();
    let filesContainer = d3
        .select('.files')
        .selectAll('div')
        .data(files)
        .enter()
        .append('div');
    filesContainer
        .append('dt')
        .html(
            (d) => `<code>${d.name}</code><small>${d.lines.length} lines</small>`,
        );
    filesContainer
        .append('dd')
        .selectAll('div')
        .data((d) => d.lines)
        .enter()
        .append('div')
        .attr('class', 'line')
        .style('background', (d) => fileTypeColors(d.type));
}

// Initialize the display
// renderScatterPlot(data, commits);
updateDisplay();
// displayCommitFiles();
renderCommitInfo(data, commits);
// renderScatterPlot(data, commits);


// Add event listener to the slider
document.getElementById('commit-slider').addEventListener('input', updateDisplay);

// scrolly

let NUM_ITEMS = commits.length; // Ideally, let this value be the length of your commit history
let ITEM_HEIGHT = 100; // Feel free to change
let VISIBLE_COUNT = 10; // Feel free to change as well
let totalHeight = (NUM_ITEMS - 1) * ITEM_HEIGHT;
const scrollContainer = d3.select('#scroll-container');
const spacer = d3.select('#spacer');
spacer.style('height', `${totalHeight}px`);
const itemsContainer = d3.select('#items-container');
scrollContainer.on('scroll', () => {
    const scrollTop = scrollContainer.property('scrollTop');
    let startIndex = Math.floor(scrollTop / ITEM_HEIGHT);
    startIndex = Math.max(
        0,
        Math.min(startIndex, commits.length - VISIBLE_COUNT),
    );
    renderItems(startIndex);
});

let FILE_VISIBLE_COUNT = 5;
const fileScrollContainer = d3.select('#file-scroll-container');
const fileSpacer = d3.select('#file-spacer');
const fileItemsContainer = d3.select('#file-items-container');
fileScrollContainer.on('scroll', () => {
    const scrollTop = fileScrollContainer.property('scrollTop');
    let startIndex = Math.floor(scrollTop / ITEM_HEIGHT);
    startIndex = Math.max(
        0,
        Math.min(startIndex, commits.length - FILE_VISIBLE_COUNT),
    );
    renderFileItems(startIndex);
});

function initVisualization() {
    // Set up time scale
    timeScale = d3.scaleTime()
        .domain([d3.min(commits, d => d.datetime), d3.max(commits, d => d.datetime)])
        .range([0, 100]);

    // Initialize scrolly containers
    const totalHeight = (NUM_ITEMS - 1) * ITEM_HEIGHT;
    spacer.style('height', `${totalHeight}px`);
    fileSpacer.style('height', `${totalHeight}px`);

    // Set up scroll handlers
    scrollContainer.on('scroll', () => {
        const scrollTop = scrollContainer.property('scrollTop');
        let startIndex = Math.floor(scrollTop / ITEM_HEIGHT);
        startIndex = Math.max(0, Math.min(startIndex, commits.length - VISIBLE_COUNT));
        renderItems(startIndex);
    });
    fileScrollContainer.on('scroll', () => {
        const scrollTop = fileScrollContainer.property('scrollTop');
        let startIndex = Math.floor(scrollTop / ITEM_HEIGHT);
        startIndex = Math.max(0, Math.min(startIndex, commits.length - FILE_VISIBLE_COUNT));
        renderFileItems(startIndex);
    });
    renderItems(0);
    renderFileItems(0);
    updateScatterPlot(data, commits);
    displayCommitFiles(commits);
    updateFileVisualization();
}

document.addEventListener('DOMContentLoaded', () => {
    // Load your commit data here
    // commits = await loadCommitData();
    initVisualization();
});