// === 1. Setup Larger Dimensions ===
const mapWidth = 800, mapHeight = 500;
const chartWidth = 800, chartHeight = 400;
const margin = {top: 20, right: 60, bottom: 40, left: 60};

let globalData = [];
let selectedCountry = null;

const svgMap = d3.select("#map").append("svg")
    .attr("width", mapWidth).attr("height", mapHeight);

const svgChart = d3.select("#line-chart").append("svg")
    .attr("width", chartWidth).attr("height", chartHeight)
    .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

const tooltip = d3.select("#tooltip");

Promise.all([
    d3.json("https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson"),
    d3.csv("./data/q2_data.csv", d => {
        return {
            Country: d.Country,
            ISO: d.ISO,
            Year: +d.Year,
            IWI: +d.IWI,
            Expenditure: +d.Expenditure
        }
    })
]).then(([worldGeo, csvData]) => {

    globalData = csvData;

    const avgExpByCountry = d3.rollup(globalData, v => d3.mean(v, d => d.Expenditure), d => d.ISO);

    // Using Blues scale to prevent errors
    const colorScale = d3.scaleSequential(d3.interpolateBlues)
        .domain([0, d3.max(avgExpByCountry.values())]);

    const projection = d3.geoNaturalEarth1().scale(150).translate([mapWidth / 2, mapHeight / 1.7]);
    const path = d3.geoPath().projection(projection);

    svgMap.selectAll("path")
        .data(worldGeo.features)
        .join("path")
        .attr("class", "country")
        .attr("d", path)
        .attr("fill", d => {
            const avgExp = avgExpByCountry.get(d.id);
            return avgExp ? colorScale(avgExp) : "#e0e0e0";
        })
        .on("mouseover", function(event, d) {
            const avgExp = avgExpByCountry.get(d.id);
            tooltip.classed("hidden", false)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY + 10) + "px")
                .html(`<strong>${d.properties.name}</strong><br>Avg Exp: ${avgExp ? avgExp.toFixed(2)+'%' : 'No Data'}`);
        })
        .on("mouseout", () => tooltip.classed("hidden", true))
        .on("click", function(event, d) {
            // == NEW VIEW TRANSITION LOGIC ==
            if (avgExpByCountry.has(d.id)) {
                selectedCountry = d.properties.name;

                // Hide Map, Show Chart
                d3.select("#map-view").style("display", "none");
                d3.select("#chart-view").style("display", "flex");

                d3.select("#chart-title").text(`Trend Analysis: ${selectedCountry}`);
                d3.select("#lag-slider").property("disabled", false);
                d3.select("#lag-slider").property("value", 0);
                d3.select("#lag-value").text("0");

                updateChart(d.id, 0);
            }
        });

}).catch(error => {
    console.error("Data loading error:", error);
});


// == BACK BUTTON INTERACTION ==
d3.select("#btn-back").on("click", () => {
    // Hide Chart, Show Map
    d3.select("#chart-view").style("display", "none");
    d3.select("#map-view").style("display", "flex");
});


function updateChart(countryISO, lagYears) {
    let countryData = globalData.filter(d => d.ISO === countryISO).sort((a, b) => a.Year - b.Year);

    svgChart.selectAll("*").remove();

    const width = chartWidth - margin.left - margin.right;
    const height = chartHeight - margin.top - margin.bottom;

    const xScale = d3.scaleLinear()
        .domain(d3.extent(countryData, d => d.Year))
        .range([0, width]);

    const yLeft = d3.scaleLinear()
        .domain([0, d3.max(countryData, d => d.Expenditure) * 1.2])
        .range([height, 0]);

    const yRight = d3.scaleLinear()
        .domain([d3.min(countryData, d => d.IWI) - 5, d3.max(countryData, d => d.IWI) + 5])
        .range([height, 0]);

    svgChart.append("g").attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(xScale).tickFormat(d3.format("d")))
        .selectAll("path").attr("class", "axis-path");

    svgChart.append("g")
        .call(d3.axisLeft(yLeft))
        .style("color", "#17becf")
        .selectAll("path").attr("class", "axis-path");

    svgChart.append("g").attr("transform", `translate(${width},0)`)
        .call(d3.axisRight(yRight))
        .style("color", "#e377c2")
        .selectAll("path").attr("class", "axis-path");

    const lineIWI = d3.line()
        .x(d => xScale(d.Year))
        .y(d => yRight(d.IWI));
    svgChart.append("path").datum(countryData).attr("class", "line-iwi").attr("d", lineIWI);

    const lineExp = d3.line()
        .x(d => xScale(d.Year + lagYears))
        .y(d => yLeft(d.Expenditure));
    svgChart.append("path").datum(countryData).attr("class", "line-exp").attr("d", lineExp);
}

d3.select("#lag-slider").on("input", function() {
    const lagValue = +this.value;
    d3.select("#lag-value").text(lagValue);

    const currentISO = globalData.find(d => d.Country === selectedCountry).ISO;
    updateChart(currentISO, lagValue);
});
