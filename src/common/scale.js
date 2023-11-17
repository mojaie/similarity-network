
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
    name: "5-20px",
    range: [5, 20],
    unknown: 1, type: "continuous"
  },
  {
    name: "10-40px",
    range: [10, 40],
    unknown: 1, type: "continuous"
  },
  {
    name: "15-60px",
    range: [15, 60],
    unknown: 1, type: "continuous"
  },
  {
    name: "20-80px",
    range: [20, 80],
    unknown: 1, type: "continuous"
  },
  {
    name: "30-120px",
    range: [30, 120],
    unknown: 1, type: "continuous"
  },
  {
    name: "40-160px",
    range: [40, 160],
    unknown: 1, type: "continuous"
  }
];

const edgeWidthScales = [
  {
    name: "2-10px",
    range: [2, 10],
    unknown: 2, type: "continuous"
  },
  {
    name: "4-20px",
    range: [4, 20],
    unknown: 4, type: "continuous"
  },
  {
    name: "8-40px",
    range: [8, 40],
    unknown: 8, type: "continuous"
  }
];



function d3scalewrapper(d3func, isNumeric, unknown) {
  return d => {
    // Sanitize
    if (d === '' || typeof d === 'undefined' || d === null) {
      return unknown;  // invalid values
    }
    if (isNumeric && parseFloat(d) != d) {
      return unknown;  // texts
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

function oldD3scalewrapper(d3func, params, unknown) {
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

function scaleFunction(rangeType, appr) {
  const rangeMap = {
    color: colorScales,
    size: nodeSizeScales,
    width: edgeWidthScales
  };
  const isNumeric = appr.hasOwnProperty("domain"); // scale.fieldType(appr.field, config) == "numeric";
  let range, unknown;
  if (appr.hasOwnProperty("range")) {
    // custom range
    const defaultUnk = { color: '#f0f0f0', size: 1, width: 2};
    range = appr.range;
    unknown = appr.unknown || defaultUnk[rangeType];
  } else {
    const preset = rangeMap[rangeType].find(e => e.name === appr.rangePreset);
    range = preset.range;
    unknown = preset.unknown;
  }
  const d3f = isNumeric ? d3.scaleLinear().domain(appr.domain).range(range).clamp(true)
    : d3.scaleOrdinal().range(range);
  return d3scalewrapper(d3f, isNumeric, unknown);
}


function oldScaleFunction(params, iqr, rangeType) {  // deprecated
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



/*
fixed value range

suggest range
0-100 (min-max)
25-75 (IQR)

use d3.quantile
*/

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
const IMAGE_FIELD_PATTERN = new RegExp("(structure|image|svg|^i_)", "i");
const NUM_FIELD_PATTERN = new RegExp(
  "(IC50|EC50|AC50|%|ratio|^mw$|logp|weight|dist|score|value|^n_)", "i");
const CAT_FIELD_PATTERN = new RegExp(
  "(community|comm|class|category|cluster|group|type|label|flag|^is_|^has_|^c_)", "i");

function fieldType(prefixed, config) {
  const field = prefixed.substring(5)  // e.g. node.field -> field
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

function IQRAsymFence(values, f=1.5) {
  // asymmetric IQR fence
  const med = d3.quantile(values, 0.5);
  const p25 = d3.quantile(values, 0.25);
  const p75 = d3.quantile(values, 0.75);
  const low = p25 - (med - p25) * f;
  const high = p75 + (p75 - med) * f;
  return [Math.round(low * 100) / 100, Math.round(high * 100) / 100];  // digits=2
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
  scaleFunction, fieldType, IQRAsymFence, isD3Format
};
