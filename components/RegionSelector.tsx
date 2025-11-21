import React from 'react';
import { TargetRegion } from '../types';
import { MapPin, Globe, CheckCircle2, Info } from 'lucide-react';

interface RegionSelectorProps {
  selectedRegion: TargetRegion;
  onRegionChange: (region: TargetRegion) => void;
}

const countryCodes: Record<TargetRegion, string> = {
  [TargetRegion.SINGAPORE]: 'sg',
  [TargetRegion.MALAYSIA]: 'my',
  [TargetRegion.INDIA]: 'in',
  [TargetRegion.UAE]: 'ae',
  [TargetRegion.SAUDI_ARABIA]: 'sa',
  [TargetRegion.QATAR]: 'qa',
  [TargetRegion.OMAN]: 'om',
  [TargetRegion.BAHRAIN]: 'bh',
  [TargetRegion.KUWAIT]: 'kw',
  [TargetRegion.GLOBAL]: 'un',
};

const regionInsights: Record<TargetRegion, string> = {
  [TargetRegion.SINGAPORE]: "Major Transshipment Hub. Strict Strategic Goods Control & GST (9%).",
  [TargetRegion.MALAYSIA]: "Uses AHTN (ASEAN Harmonized). Check SIRIM/MAQIS & SST.",
  [TargetRegion.INDIA]: "ITC-HS System. Complex duties (BCD+SWS+IGST) & BIS standards.",
  [TargetRegion.UAE]: "GCC Common External Tariff. 5% VAT. Dubai Trade Portal.",
  [TargetRegion.SAUDI_ARABIA]: "ZATCA Integrated Tariff. Saber Platform required. 15% VAT.",
  [TargetRegion.QATAR]: "Al-Nadeeb System. Specific excise on health-damaging goods.",
  [TargetRegion.OMAN]: "Bayan Customs System. FTA benefits with USA & Singapore.",
  [TargetRegion.BAHRAIN]: "OFOQ System. Strategic hub for Northern Gulf access.",
  [TargetRegion.KUWAIT]: "Strict documentation legalization & KGAC regulations.",
  [TargetRegion.GLOBAL]: "Standard WCO 6-digit format for general international reference.",
};

export const RegionSelector: React.FC<RegionSelectorProps> = ({ selectedRegion, onRegionChange }) => {
  
  const getIconOrFlag = (region: TargetRegion) => {
    const code = countryCodes[region];
    if (code && code !== 'un') {
      return (
        // Removed grayscale to show original flag colors
        <div className="relative w-8 h-8 rounded-full overflow-hidden border-2 border-white dark:border-slate-700 shadow-sm">
          <img 
            src={`https://flagcdn.com/w80/${code}.png`} 
            alt={region}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      );
    }
    if (region === TargetRegion.GLOBAL) return <Globe className="w-6 h-6 text-electric" />;
    return <MapPin className="w-6 h-6 text-slate-400" />;
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-6">
        <label className="text-sm font-bold text-navy dark:text-white flex items-center gap-2">
          <Globe className="w-4 h-4 text-electric" />
          Target Market
        </label>
        <span className="text-xs text-electric font-bold bg-blue-50 dark:bg-slate-800 px-2 py-1 rounded-md border border-blue-100 dark:border-slate-700">
          {Object.keys(TargetRegion).length} Markets Available
        </span>
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {Object.values(TargetRegion).map((region) => {
            const isSelected = selectedRegion === region;
            return (
                <button
                    key={region}
                    onClick={() => onRegionChange(region)}
                    className={`
                    group relative flex flex-col items-start p-4 rounded-xl border transition-all duration-200 ease-out
                    ${
                        isSelected
                        ? 'bg-blue-50 dark:bg-slate-800/80 border-electric shadow-[0_0_0_1px_#0066ff] z-10'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }
                    `}
                >
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-3 w-48 p-3 bg-navy text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none z-50 text-center border border-slate-700 translate-y-2 group-hover:translate-y-0">
                      <p className="font-bold text-electric mb-1">{region}</p>
                      <p className="text-[10px] text-slate-300 leading-snug">{regionInsights[region]}</p>
                      {/* Tooltip Arrow */}
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-navy"></div>
                    </div>

                    <div className="flex justify-between w-full items-center mb-3 relative">
                        
                        <div className="relative">
                          {/* Distinct Cyan/Teal Ripple for Selected State */}
                          {isSelected && countryCodes[region] !== 'un' && (
                            <div className="animate-ripple pause-on-hover text-cyan-500 dark:text-cyan-400"></div>
                          )}
                          <div className={`relative z-10 transform transition-transform duration-300 group-hover:scale-110`}>
                             {getIconOrFlag(region)}
                          </div>
                        </div>

                        {isSelected && <CheckCircle2 className="w-5 h-5 text-electric animate-in fade-in zoom-in duration-300" />}
                    </div>
                    
                    <span className={`text-sm font-bold w-full text-left truncate ${isSelected ? 'text-electric' : 'text-slate-600 dark:text-slate-300'}`}>
                        {region}
                    </span>
                </button>
            );
        })}
      </div>
    </div>
  );
};
