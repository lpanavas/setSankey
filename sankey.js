const margin = { top: 10, right: 10, bottom: 10, left: 10 };
const width = 700 - margin.left - margin.right;
const height = 300 - margin.top - margin.bottom;

function nodeColor(name) {
  if (name.startsWith("TP")) {
    return "blue";
  } else if (name.startsWith("FP")) {
    return "red";
  } else if (name.startsWith("FN")) {
    return "green";
  }
}

function gradientID(sourceName, targetName) {
  return `gradient-${sourceName}-${targetName}`;
}

function createSankey(model1, model2, dictionary, threshold) {
  function calculateOverlap(model1, model2, dictionary, threshold) {
    let overlap = {
      TP_TP: {},
      FP_FP: {},
      FN_FN: {},
    };

    const fnCount = {
      [model1]: {},
      [model2]: {},
    };

    const modelAppearances = {
      [model1]: 0,
      [model2]: 0,
    };

    for (const key in dictionary) {
      const modelsInKey = key.split(",").filter((model) => model);

      if (modelsInKey.includes(model1) || modelsInKey.includes(model2)) {
        for (const model of [model1, model2]) {
          if (modelsInKey.includes(model)) {
            modelAppearances[model] += 1;
          }
        }

        const detections = dictionary[key];

        for (const detectionKey in detections) {
          const detection = detections[detectionKey];

          if (detection.FN) {
            for (const fn of detection.FN) {
              for (const model of [model1, model2]) {
                if (modelsInKey.includes(model)) {
                  fnCount[model][fn] = (fnCount[model][fn] || 0) + 1;
                }
              }
            }
          }
        }
      }

      if (modelsInKey.includes(model1) && modelsInKey.includes(model2)) {
        const detections = dictionary[key];

        for (const detectionKey in detections) {
          const detection = detections[detectionKey];

          for (const innerKey in detection) {
            const innerValue = detection[innerKey];
            if (innerValue.iouGT >= threshold) {
              overlap.TP_TP[key] = (overlap.TP_TP[key] || []).concat(
                innerValue
              );
            } else {
              overlap.FP_FP[key] = (overlap.FP_FP[key] || []).concat(
                innerValue
              );
            }
          }
        }
      }
    }

    for (const fn in fnCount[model1]) {
      if (
        fnCount[model1][fn] === modelAppearances[model1] &&
        !fnCount[model2][fn]
      ) {
        const fnKey = `${model1},${model2}`;
        overlap.FN_FN[fnKey] = (overlap.FN_FN[fnKey] || []).concat(fn);
      }
    }
    const uniqueFNs = {
      [model1]: [],
      [model2]: [],
    };

    for (const fn in fnCount[model1]) {
      console.log(fnCount[model1][fn]);
      console.log(modelAppearances[model1]);
      console.log(fnCount[model2][fn]);
      console.log("...");
      if (
        fnCount[model1][fn] === modelAppearances[model1] &&
        fnCount[model1][fn] != fnCount[model2][fn]
      ) {
        uniqueFNs[model1].push(fn);
      }
    }

    for (const fn in fnCount[model2]) {
      if (
        fnCount[model2][fn] === modelAppearances[model2] &&
        fnCount[model2][fn] != fnCount[model1][fn]
      ) {
        uniqueFNs[model2].push(fn);
      }
    }

    console.log("Unique False Negatives for", model1, ":", uniqueFNs[model1]);
    console.log("Unique False Negatives for", model2, ":", uniqueFNs[model2]);
    return overlap;
  }

  const overlap = calculateOverlap(model1, model2, dictionary, threshold);

  const updatedLinks = [
    {
      source: 0,
      target: 3,
      value: Object.keys(overlap.TP_TP).length,
      data: overlap.TP_TP,
    },
    {
      source: 1,
      target: 4,
      value: Object.keys(overlap.FP_FP).length,
      data: overlap.FP_FP,
    },
    // {
    //   source: 2,
    //   target: 5,
    //   value: Object.keys(overlap.FN_FN).length,
    //   data: overlap.FN_FN,
    // },
  ];

  const data = {
    nodes: [
      { name: "TP1" },
      { name: "FP1" },
      { name: "FN1" },
      { name: "TP2" },
      { name: "FP2" },
      { name: "FN2" },
    ],
    links: updatedLinks,
  };

  const svg = d3
    .select("#sankey")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const sankey = d3
    .sankey()
    .nodeWidth(15)
    .nodePadding(10)
    .size([width, height]);

  sankey(data);

  const linkGradients = svg
    .append("defs")
    .selectAll("linearGradient")
    .data(data.links)
    .join("linearGradient")
    .attr("id", (d) => gradientID(d.source.name, d.target.name))
    .attr("gradientUnits", "userSpaceOnUse")
    .attr("x1", (d) => d.source.x1)
    .attr("x2", (d) => d.target.x0);

  linkGradients
    .append("stop")
    .attr("offset", "0%")
    .attr("stop-color", (d) => nodeColor(d.source.name))
    .attr("stop-opacity", 0.5);

  linkGradients
    .append("stop")
    .attr("offset", "100%")
    .attr("stop-color", (d) => nodeColor(d.target.name))
    .attr("stop-opacity", 0.5);

  const links = svg
    .append("g")
    .selectAll(".link")
    .data(data.links)
    .join("path")
    .attr("class", "link")
    .attr("d", d3.sankeyLinkHorizontal())
    .attr("stroke", (d) => `url(#${gradientID(d.source.name, d.target.name)})`)
    .attr("stroke-width", (d) => d.width)
    .attr("fill", "none");

  links.on("click", (event, d) => {
    console.log(d.data);
  });

  const node = svg
    .append("g")
    .selectAll(".node")
    .data(data.nodes)
    .join("g")
    .attr("class", "node");

  node
    .append("rect")
    .attr("x", (d) => d.x0)
    .attr("y", (d) => d.y0)
    .attr("height", (d) => d.y1 - d.y0)
    .attr("width", (d) => d.x1 - d.x0)
    .attr("fill", (d) => nodeColor(d.name))
    .attr("opacity", 0.5);

  node
    .append("text")
    .attr("x", (d) => (d.x0 < width / 2 ? d.x1 + 6 : d.x0 - 6))
    .attr("y", (d) => (d.y1 + d.y0) / 2)
    .attr("dy", "0.35em")
    .attr("text-anchor", (d) => (d.x0 < width / 2 ? "start" : "end"))
    .text((d) => d.name);
}

export { createSankey };
