
/** @module common/scale */

import d3 from 'd3';


const colorScales = [
  {
    name: "green",
    range: ['#778899', '#98fb98'],
    unknown: '#f0f0f0', type: "continuous"
  },
  {
    name: "blue",
    range: ['#778899', '#7fffd4'],
    unknown: '#f0f0f0', type: "continuous"
  },
  {
    name: "yellow",
    range: ['#778899', '#f0e68c'],
    unknown: '#f0f0f0', type: "continuous"
  },
  {
    name: "gray",
    range: ['#778899', '#cccccc'],
    unknown: '#f0f0f0', type: "continuous"
  },
  {
    name: "igreen",
    range: ['#98fb98', '#778899'],
    unknown: '#f0f0f0', type: "continuous"
  },
  {
    name: "iblue",
    range: ['#7fffd4', '#778899'],
    unknown: '#f0f0f0', type: "continuous"
  },
  {
    name: "iyellow",
    range: ['#f0e68c', '#778899'],
    unknown: '#f0f0f0', type: "continuous"
  },
  {
    name: "igray",
    range: ['#cccccc', '#778899'],
    unknown: '#f0f0f0', type: "continuous"
  },
  {
    name: "category10",
    range: ['#8dd3c7','#ffffb3','#bebada','#fb8072','#80b1d3','#fdb462',
      '#b3de69','#fccde5','#bc80bd','#ccebc5'],
    unknown: '#f0f0f0', type: "discrete"
  },
  {
    name: "cbsafe",
    range: ['#543005','#8c510a','#bf812d','#dfc27d','#f6e8c3','#c7eae5',
      '#80cdc1','#35978f','#01665e','#003c30'],
    unknown: '#f0f0f0', type: "discrete"
  }
];

const nodeSizeScales = [
  {
    name: "small",
    range: [5, 20],
    unknown: 1, type: "continuous"
  },
  {
    name: "medium",
    range: [15, 60],
    unknown: 1, type: "continuous"
  },
  {
    name: "large",
    range: [45, 180],
    unknown: 1, type: "continuous"
  },
  {
    name: "small, potency",
    range: [20, 5],
    unknown: 1, type: "continuous"
  },
  {
    name: "medium, potency",
    range: [60, 15],
    unknown: 1, type: "continuous"
  },
  {
    name: "large, potency",
    range: [180, 45],
    unknown: 1, type: "continuous"
  },
  {
    name: "small, counter",
    range: [5, 20],
    unknown: 20, type: "continuous"
  },
  {
    name: "medium, counter",
    range: [15, 60],
    unknown: 60, type: "continuous"
  },
  {
    name: "large, counter",
    range: [45, 180],
    unknown: 180, type: "continuous"
  }
];

const edgeWidthScales = [
  {
    name: "thin",
    range: [2, 10],
    unknown: 2, type: "continuous"
  },
  {
    name: "medium",
    range: [4, 20],
    unknown: 4, type: "continuous"
  },
  {
    name: "thick",
    range: [8, 40],
    unknown: 8, type: "continuous"
  },
  {
    name: "thin, inverse",
    range: [10, 2],
    unknown: 2, type: "continuous"
  },
  {
    name: "medium, inverse",
    range: [20, 4],
    unknown: 4, type: "continuous"
  },
  {
    name: "thick, inverse",
    range: [40, 8],
    unknown: 8, type: "continuous"
  }
];



function d3scalewrapper(d3func, params, unknown) {
  return d => {
    // Sanitize
    if (d === '' || typeof d === 'undefined' || d === null) {
      return unknown;  // invalid values
    }
    if (['linear', 'log'].includes(params.scale) && parseFloat(d) != d) {
      return unknown;  // texts
    }
    if (params.scale === 'log' && d <= 0) {
      return unknown;  // negative values in log scale
    }
    // Apply function
    const result = d3func(d);
    if (result === undefined) {
      console.warn(`Unexpected value: ${d}`);
      console.warn(params);
      return unknown;  // TODO: specify unexpected behavior
    }
    return result;
  };
};


function scaleFunction(params, iqr, rangeType) {
  const rangeMap = {
    color: colorScales,
    size: nodeSizeScales,
    width: edgeWidthScales
  }
  const scale = rangeMap[rangeType].find(e => e.name === params.rangePreset);
  const range = scale.range;
  const unknown = scale.unknown;

  // extrapolate 0-100% range domain by IQR
  const domain = [];
  if (scale.hasOwnProperty("domain")) {
    domain.push(...params.domain);
  } else if (iqr !== undefined) {
    // asymmetric IQR fence
    if (params.scale === "linear") {
      const lf = (iqr[1] - iqr[0]) * 1.5;
      const uf = (iqr[2] - iqr[1]) * 1.5;
      domain.push(iqr[0] - lf, iqr[2] + uf);
    } else if (params.scale === "log") {
      const lf = (iqr[1] / iqr[0]) ** 1.5;
      const uf = (iqr[2] / iqr[1]) ** 1.5;
      domain.push(iqr[0] / lf, iqr[2] * uf);
    }
  }

  const scaleType = {
    constant: value => range[scale.type === "continuous" ? range.length - 1 : 0],
    linear: d3scalewrapper(d3.scaleLinear().domain(domain).range(range).clamp(true), params, unknown),
    log: d3scalewrapper(d3.scaleLog().domain(domain).range(range).clamp(true), params, unknown),
    categorical: d3scalewrapper(d3.scaleOrdinal().range(range), params, unknown)
  };

  return scaleType[params.hasOwnProperty("field") ? params.scale : "constant"];
}




function IQR(arr) {
  // caluculate IQR and return [Q1, median, Q3]
  // use min-max if numeric nodes count < 4 or Q1 == Q3
  const nums = arr.map(e => parseFloat(e)).filter(e => !isNaN(e));
  nums.sort((a, b) => a - b);
  const cnt = nums.length;
  if (cnt === 0) { return null; }
  const mcnt = Math.floor(cnt / 2);
  if (cnt < 4) { // use min-max
    const l = nums[0];
    const u = nums[cnt - 1];
    const m = cnt % 2 === 1 ? nums[mcnt] : (nums[mcnt - 1] + nums[mcnt]) / 2;
    return [l, m, u];
  }
  const qcnt = Math.floor(mcnt / 2);
  if (cnt % 2 === 1) {
    if (mcnt % 2 === 1) {
      return [nums[qcnt], nums[mcnt], nums[mcnt + qcnt + 1]];
    } else {
      const l = (nums[qcnt - 1] + nums[qcnt]) / 2;
      const u = (nums[mcnt + qcnt] + nums[mcnt + qcnt + 1]) / 2;
      return [l, nums[mcnt], u];
    }
  } else {
    const m = (nums[mcnt - 1] + nums[mcnt]) / 2;
    if (mcnt % 2 === 1) {
      return [nums[qcnt], m, nums[mcnt + qcnt]];
    } else {
      const l = (nums[qcnt - 1] + nums[qcnt]) / 2;
      const u = (nums[mcnt + qcnt - 1] + nums[mcnt + qcnt]) / 2;
      return [l, m, u];
    }
  }
}



// Default field patterns
const IMAGE_FIELD_PATTERN = new RegExp("(structure|image|svg)", "i");
const NUM_FIELD_PATTERN = new RegExp("(IC50|EC50|AC50|%|ratio|^mw$|logp|weight|dist)", "i");
const CAT_FIELD_PATTERN = new RegExp("(community|comm|class|category|cluster|group|type)", "i");

function fieldType(field, config) {
  if (config.imageFields.includes(field)) {
    return "image"
  } else if  (config.numericFields.includes(field)) {
    return "numeric"
  } else if  (config.categoricalFields.includes(field)) {
    return "categorical"
  } else if  (IMAGE_FIELD_PATTERN.test(field)) {
    return "image"
  } else if (NUM_FIELD_PATTERN.test(field))  {
    return "numeric"
  } else if (CAT_FIELD_PATTERN.test(field))  {
    return "categorical"
  }
}



function isD3Format(notation) {
  try {
    d3.format(notation);
  } catch (err) {
    return false;
  }
  return true;
}


export default {
  colorScales, nodeSizeScales, edgeWidthScales,
  scaleFunction, IQR, fieldType, isD3Format
};
