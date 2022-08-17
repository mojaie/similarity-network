
/** @module common/scale */

import d3 from 'd3';


const scales = {
  color: {
    default: {
      range: ['#7fffd4'],
      unknown: '#7fffd4'
    },
    monogray: {
      range: ['#cccccc'],
      unknown: '#cccccc'
    },
    blue: {
      range: ['#778899', '#7fffd4'],
      unknown: '#f0f0f0'
    },
    green: {
      range: ['#778899', '#98fb98'],
      unknown: '#f0f0f0'
    },
    yellow: {
      range: ['#778899', '#f0e68c'],
      unknown: '#f0f0f0'
    },
    category10: {
      range: ['#8dd3c7','#ffffb3','#bebada','#fb8072','#80b1d3','#fdb462',
        '#b3de69','#fccde5','#bc80bd','#ccebc5'],
      unknown: '#f0f0f0'
    },
    cbsafe: {
      range: ['#543005','#8c510a','#bf812d','#dfc27d','#f6e8c3','#c7eae5',
        '#80cdc1','#35978f','#01665e','#003c30'],
      unknown: '#f0f0f0'
    }
  },
  nodeSize: {
    small: {
      range: [10, 40],
      unknown: 10
    },
    medium: {
      range: [20, 80],
      unknown: 20
    },
    large: {
      range: [40, 160],
      unknown: 40
    }
  },
  edgeWidth: {
    thin: {
      range: [2, 10],
      unknown: 10
    },
    medium: {
      range: [4, 20],
      unknown: 20
    },
    thick: {
      range: [8, 40],
      unknown: 40
    }
  }
};

const colorScales = Object.keys(scales.color)
  .map(e => {
    const rcd = scales.color[e];
    rcd.key = e;
    return rcd;
  });

const nodeSizeScales = Object.keys(scales.nodeSize)
  .map(e => {
    const rcd = scales.nodeSize[e];
    rcd.key = e;
    return rcd;
  });

const edgeWidthScales = Object.keys(scales.edgeWidth)
  .map(e => {
    const rcd = scales.edgeWidth[e];
    rcd.key = e;
    return rcd;
  });

const types = {
  linear: {name: 'Linear', func: d3.scaleLinear},
  log: {name: 'Log', func: d3.scaleLog}
  // {key: 'quantize', name: 'Quantize', func: d3.scaleQuantize},
  // {key: 'ordinal', name: 'Ordinal', func: d3.scaleOrdinal}
};


function scaleFunction(params, rangeType) {
  const scale = scales[rangeType][params.rangePreset];
  const range = scale.range;
  const unknown = scale.unknown;

  let domain = null;
  if (range.length === 3) {
    const mid = (parseFloat(params.domain[0]) + parseFloat(params.domain[1])) / 2;
    domain = [params.domain[0], mid, params.domain[1]];
  } else {
    domain = params.domain;
  }
  // Build
  let scaleFunc = types[params.scale].func();
  scaleFunc = scaleFunc.domain(domain);
  scaleFunc = scaleFunc.range(range);
  if (['linear', 'log'].includes(params.scale)) {
    scaleFunc = scaleFunc.clamp(true);
  }

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
    const result = scaleFunc(d);
    if (result === undefined) {
      return unknown;  // TODO: specify unexpected behavior
    }
    return result;
  };
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
  scales, colorScales, nodeSizeScales, edgeWidthScales, types, scaleFunction, isD3Format
};
