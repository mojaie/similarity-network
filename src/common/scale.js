
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
    unknown: 10, type: "continuous"
  },
  {
    name: "medium",
    range: [15, 60],
    unknown: 20, type: "continuous"
  },
  {
    name: "large",
    range: [45, 180],
    unknown: 40, type: "continuous"
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
    if (params.scale === "linear") {
      const ext = (iqr[1] - iqr[0]) / 2;
      domain.push(iqr[0] - ext, iqr[1] + ext);
    } else if (params.scale === "log") {
      const ext = Math.sqrt(iqr[1] / iqr[0]);
      domain.push(iqr[0] / ext, iqr[1] * ext);
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



const NUM_LIKE_THRESHOLD = 0.5;

function IQR(arr) {
  // caluculate IQR
  const nums = arr.filter(e => typeof e === "number");
  nums.sort((a, b) => a - b);
  const cnt = nums.length;
  if (cnt < 4 || cnt / arr.length < NUM_LIKE_THRESHOLD) {
    return null;  // not numeric field
  }
  const lowcnt = Math.floor(cnt / 2);
  const qcnt = Math.floor(lowcnt / 2);
  if (lowcnt % 2 === 1) {
    return [nums[qcnt], nums[nums.length - qcnt - 1]];
  } else {
    const l = (nums[qcnt - 1] + nums[qcnt]) / 2;
    const u = (nums[nums.length - qcnt - 1] + nums[nums.length - qcnt]) / 2;
    return [l, u];
  }
}



// Default field patterns
const IMAGE_FIELD_PATTERN = new RegExp("(structure|image|svg)", "i");
const NUM_FIELD_PATTERN = new RegExp("(IC50|EC50|AC50|%|ratio|^mw$|logp|weight)", "i");
const CAT_FIELD_PATTERN = new RegExp("(class|category|cluster|group|type)", "i");

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
