import React, { useState } from 'react';

// Simple test component to isolate the recursion issue
export function SankeyTest() {
  const [selectedPeriod, setSelectedPeriod] = useState('all');
  const periods = ['all', '2024-01', '2024-02', '2024-03'];
  
  console.log('SankeyTest render - selectedPeriod:', selectedPeriod);
  
  return (
    <div className="p-4">
      <h2 className="text-lg font-bold mb-4">Simple Period Test</h2>
      <div className="flex gap-2 mb-4">
        {periods.map(period => (
          <button
            key={period}
            onClick={() => {
              console.log('Button clicked:', period, 'current:', selectedPeriod);
              setSelectedPeriod(period);
            }}
            className={`px-4 py-2 rounded text-sm ${
              selectedPeriod === period 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            {period === 'all' ? 'All Period' : period}
          </button>
        ))}
      </div>
      <p>Current period: {selectedPeriod}</p>
    </div>
  );
}