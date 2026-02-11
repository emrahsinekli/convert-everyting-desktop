import React, { useState, useCallback } from 'react';
import './UnitConverterPanel.css';

const unitCategories = {
  length: {
    name: 'Length',
    icon: '📏',
    baseUnit: 'meter',
    units: {
      meter: { name: 'Meter', symbol: 'm', factor: 1 },
      kilometer: { name: 'Kilometer', symbol: 'km', factor: 1000 },
      centimeter: { name: 'Centimeter', symbol: 'cm', factor: 0.01 },
      millimeter: { name: 'Millimeter', symbol: 'mm', factor: 0.001 },
      mile: { name: 'Mile', symbol: 'mi', factor: 1609.344 },
      yard: { name: 'Yard', symbol: 'yd', factor: 0.9144 },
      foot: { name: 'Foot', symbol: 'ft', factor: 0.3048 },
      inch: { name: 'Inch', symbol: 'in', factor: 0.0254 }
    }
  },
  weight: {
    name: 'Weight',
    icon: '⚖️',
    baseUnit: 'kilogram',
    units: {
      kilogram: { name: 'Kilogram', symbol: 'kg', factor: 1 },
      gram: { name: 'Gram', symbol: 'g', factor: 0.001 },
      milligram: { name: 'Milligram', symbol: 'mg', factor: 0.000001 },
      pound: { name: 'Pound', symbol: 'lb', factor: 0.453592 },
      ounce: { name: 'Ounce', symbol: 'oz', factor: 0.0283495 },
      ton: { name: 'Metric Ton', symbol: 't', factor: 1000 }
    }
  },
  temperature: {
    name: 'Temperature',
    icon: '🌡️',
    baseUnit: 'celsius',
    special: true,
    units: {
      celsius: { name: 'Celsius', symbol: '°C', factor: 1 },
      fahrenheit: { name: 'Fahrenheit', symbol: '°F', factor: 1 },
      kelvin: { name: 'Kelvin', symbol: 'K', factor: 1 }
    }
  },
  area: {
    name: 'Area',
    icon: '📐',
    baseUnit: 'squareMeter',
    units: {
      squareMeter: { name: 'Square Meter', symbol: 'm²', factor: 1 },
      squareKilometer: { name: 'Square Kilometer', symbol: 'km²', factor: 1000000 },
      squareFoot: { name: 'Square Foot', symbol: 'ft²', factor: 0.092903 },
      acre: { name: 'Acre', symbol: 'ac', factor: 4046.86 },
      hectare: { name: 'Hectare', symbol: 'ha', factor: 10000 }
    }
  },
  volume: {
    name: 'Volume',
    icon: '🧊',
    baseUnit: 'liter',
    units: {
      liter: { name: 'Liter', symbol: 'L', factor: 1 },
      milliliter: { name: 'Milliliter', symbol: 'mL', factor: 0.001 },
      cubicMeter: { name: 'Cubic Meter', symbol: 'm³', factor: 1000 },
      gallon: { name: 'Gallon (US)', symbol: 'gal', factor: 3.78541 },
      quart: { name: 'Quart', symbol: 'qt', factor: 0.946353 },
      cup: { name: 'Cup', symbol: 'cup', factor: 0.236588 }
    }
  },
  speed: {
    name: 'Speed',
    icon: '🚀',
    baseUnit: 'meterPerSecond',
    units: {
      meterPerSecond: { name: 'Meter/Second', symbol: 'm/s', factor: 1 },
      kilometerPerHour: { name: 'Kilometer/Hour', symbol: 'km/h', factor: 0.277778 },
      milePerHour: { name: 'Mile/Hour', symbol: 'mph', factor: 0.44704 },
      knot: { name: 'Knot', symbol: 'kn', factor: 0.514444 }
    }
  },
  time: {
    name: 'Time',
    icon: '⏱️',
    baseUnit: 'second',
    units: {
      second: { name: 'Second', symbol: 's', factor: 1 },
      minute: { name: 'Minute', symbol: 'min', factor: 60 },
      hour: { name: 'Hour', symbol: 'h', factor: 3600 },
      day: { name: 'Day', symbol: 'd', factor: 86400 },
      week: { name: 'Week', symbol: 'wk', factor: 604800 }
    }
  },
  data: {
    name: 'Data',
    icon: '💾',
    baseUnit: 'byte',
    units: {
      byte: { name: 'Byte', symbol: 'B', factor: 1 },
      kilobyte: { name: 'Kilobyte', symbol: 'KB', factor: 1024 },
      megabyte: { name: 'Megabyte', symbol: 'MB', factor: 1048576 },
      gigabyte: { name: 'Gigabyte', symbol: 'GB', factor: 1073741824 },
      terabyte: { name: 'Terabyte', symbol: 'TB', factor: 1099511627776 }
    }
  }
};

const convertTemperature = (value, fromUnit, toUnit) => {
  let celsius;
  switch (fromUnit) {
    case 'celsius': celsius = value; break;
    case 'fahrenheit': celsius = (value - 32) * 5 / 9; break;
    case 'kelvin': celsius = value - 273.15; break;
    default: celsius = value;
  }
  switch (toUnit) {
    case 'celsius': return celsius;
    case 'fahrenheit': return (celsius * 9 / 5) + 32;
    case 'kelvin': return celsius + 273.15;
    default: return celsius;
  }
};

function UnitConverterPanel() {
  const [category, setCategory] = useState('length');
  const [fromUnit, setFromUnit] = useState('meter');
  const [toUnit, setToUnit] = useState('foot');
  const [fromValue, setFromValue] = useState('1');
  const [toValue, setToValue] = useState('3.28084');

  const currentCategory = unitCategories[category];
  const units = currentCategory?.units || {};

  const convert = useCallback((value, from, to, cat) => {
    if (value === '' || isNaN(parseFloat(value))) return '';
    const numValue = parseFloat(value);
    const catData = unitCategories[cat];
    if (!catData?.units?.[from] || !catData?.units?.[to]) return '';

    let result;
    if (catData.special) {
      result = convertTemperature(numValue, from, to);
    } else {
      result = (numValue * catData.units[from].factor) / catData.units[to].factor;
    }

    if (Math.abs(result) < 0.0001 && result !== 0) {
      return result.toExponential(4);
    } else if (Math.abs(result) >= 1000000) {
      return result.toExponential(4);
    }
    return parseFloat(result.toFixed(6)).toString();
  }, []);

  const handleCategoryChange = (newCat) => {
    const unitKeys = Object.keys(unitCategories[newCat].units);
    setCategory(newCat);
    setFromUnit(unitKeys[0]);
    setToUnit(unitKeys[1] || unitKeys[0]);
    setFromValue('1');
    setToValue(convert('1', unitKeys[0], unitKeys[1] || unitKeys[0], newCat));
  };

  const handleFromChange = (value) => {
    setFromValue(value);
    setToValue(convert(value, fromUnit, toUnit, category));
  };

  const handleToChange = (value) => {
    setToValue(value);
    setFromValue(convert(value, toUnit, fromUnit, category));
  };

  const handleFromUnitChange = (unit) => {
    setFromUnit(unit);
    setToValue(convert(fromValue, unit, toUnit, category));
  };

  const handleToUnitChange = (unit) => {
    setToUnit(unit);
    setToValue(convert(fromValue, fromUnit, unit, category));
  };

  const swapUnits = () => {
    const tempUnit = fromUnit;
    const tempValue = fromValue;
    setFromUnit(toUnit);
    setToUnit(tempUnit);
    setFromValue(toValue);
    setToValue(tempValue);
  };

  const copyResult = () => {
    navigator.clipboard.writeText(toValue);
  };

  return (
    <div className="unit-converter-panel">
      <div className="panel-header">
        <h2>Unit Converter</h2>
        <p>Convert between different units of measurement</p>
      </div>

      {/* Category Tabs */}
      <div className="category-grid">
        {Object.entries(unitCategories).map(([key, cat]) => (
          <button
            key={key}
            className={`category-btn ${category === key ? 'active' : ''}`}
            onClick={() => handleCategoryChange(key)}
          >
            <span className="cat-icon">{cat.icon}</span>
            <span className="cat-name">{cat.name}</span>
          </button>
        ))}
      </div>

      {/* Converter */}
      <div className="converter-box">
        {/* From */}
        <div className="convert-group">
          <div className="group-label">From</div>
          <select
            value={fromUnit}
            onChange={(e) => handleFromUnitChange(e.target.value)}
            className="unit-dropdown"
          >
            {Object.entries(units).map(([key, unit]) => (
              <option key={key} value={key}>{unit.name} ({unit.symbol})</option>
            ))}
          </select>
          <div className="input-row">
            <input
              type="number"
              value={fromValue}
              onChange={(e) => handleFromChange(e.target.value)}
              className="value-field"
              placeholder="0"
            />
            <span className="unit-symbol">{units[fromUnit]?.symbol}</span>
          </div>
        </div>

        {/* Swap */}
        <button className="swap-btn" onClick={swapUnits} title="Swap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M7 16V4M7 4L3 8M7 4L11 8M17 8V20M17 20L21 16M17 20L13 16" />
          </svg>
        </button>

        {/* To */}
        <div className="convert-group">
          <div className="group-label">To</div>
          <select
            value={toUnit}
            onChange={(e) => handleToUnitChange(e.target.value)}
            className="unit-dropdown"
          >
            {Object.entries(units).map(([key, unit]) => (
              <option key={key} value={key}>{unit.name} ({unit.symbol})</option>
            ))}
          </select>
          <div className="input-row">
            <input
              type="number"
              value={toValue}
              onChange={(e) => handleToChange(e.target.value)}
              className="value-field result-field"
              placeholder="0"
            />
            <span className="unit-symbol">{units[toUnit]?.symbol}</span>
            <button className="copy-btn" onClick={copyResult} title="Copy">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Formula */}
      <div className="formula-box">
        <span className="formula-text">
          {fromValue || '1'} {units[fromUnit]?.symbol} = {toValue || '0'} {units[toUnit]?.symbol}
        </span>
      </div>
    </div>
  );
}

export default UnitConverterPanel;
