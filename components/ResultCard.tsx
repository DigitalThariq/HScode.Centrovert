import React, { useState } from 'react';
import { HSCodeResult, TargetRegion } from '../types';
import { ShieldCheck, AlertTriangle, FileText, Info, Download, Database, Bot, Copy, Check, FileCheck, Layers, BookOpen, ExternalLink, Globe } from 'lucide-react';
import { jsPDF } from "jspdf";

interface ResultCardProps {
  result: HSCodeResult;
  region: TargetRegion;
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

const officialPortals: Record<TargetRegion, { name: string; url: string }> = {
  [TargetRegion.SINGAPORE]: { name: "Singapore TradeNet", url: "https://www.tradenet.gov.sg/tradenet/portlets/search/searchHSCA/searchInitHSCA.do" },
  [TargetRegion.MALAYSIA]: { name: "JKDM HS Explorer", url: "http://mysstext.customs.gov.my/tariff/" },
  [TargetRegion.INDIA]: { name: "Indian Trade Portal", url: "https://www.indiantradeportal.in/" },
  [TargetRegion.UAE]: { name: "Dubai Customs Al Munasiq", url: "https://almunasiq.dubaicustoms.gov.ae/landing" },
  [TargetRegion.SAUDI_ARABIA]: { name: "ZATCA Tariff Search", url: "https://zatca.gov.sa/en/e-services/pages/customs-tariff.aspx" },
  [TargetRegion.QATAR]: { name: "Al Nadeeb Customs", url: "https://www.customs.gov.qa/" },
  [TargetRegion.OMAN]: { name: "Oman Customs", url: "https://www.customs.gov.om/" },
  [TargetRegion.BAHRAIN]: { name: "Bahrain Customs", url: "https://www.customs.gov.bh/" },
  [TargetRegion.KUWAIT]: { name: "Kuwait KGAC", url: "https://kgac.gov.kw/" },
  [TargetRegion.GLOBAL]: { name: "WCO Harmonized System", url: "https://www.wcoomd.org/" },
};

export const ResultCard: React.FC<ResultCardProps> = ({ result, region }) => {
  const [copied, setCopied] = useState(false);

  const getConfidenceDisplay = (score: number) => {
     return `${score}% Match`;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result.hsCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Corporate Navy Blue Header
    doc.setFillColor(26, 58, 82); // #1a3a52
    doc.rect(0, 0, pageWidth, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text("HScode.Centrovert", 14, 20);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Region: ${region}  |  Generated: ${new Date().toLocaleDateString()}`, 14, 32);

    let yPos = 55;

    // Electric Blue Accent Title
    doc.setTextColor(0, 102, 255); // #0066ff
    doc.setFontSize(10);
    doc.text("CLASSIFICATION RESULT", 14, yPos);
    yPos += 10;
    
    doc.setTextColor(26, 58, 82); // Navy
    doc.setFontSize(36);
    doc.setFont('helvetica', 'bold');
    doc.text(result.hsCode, 14, yPos);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139); // Slate
    doc.text(`Confidence: ${result.confidenceScore}%`, 14, yPos + 8);
    
    if (result.sourceReference) {
      doc.text(`Source: ${result.sourceReference}`, 14, yPos + 14);
      yPos += 6;
    }
    
    yPos += 25;

    const addSection = (title: string, content: string) => {
        doc.setTextColor(26, 58, 82); // Navy
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(title.toUpperCase(), 14, yPos);
        yPos += 6;
        doc.setTextColor(50, 50, 50);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        const splitText = doc.splitTextToSize(content, pageWidth - 28);
        doc.text(splitText, 14, yPos);
        yPos += (splitText.length * 5) + 10;
    };

    addSection("Product Name", result.productName);
    addSection("Description", result.description);
    addSection("Classification Reasoning", result.reasoning);

    yPos += 5;
    // Electric Blue Line
    doc.setDrawColor(0, 102, 255);
    doc.setLineWidth(0.5);
    doc.line(14, yPos, pageWidth-14, yPos);
    yPos += 12;
    
    doc.setTextColor(26, 58, 82);
    doc.setFont('helvetica', 'bold');
    doc.text(`DUTY RATE: ${result.dutyRate}`, 14, yPos);
    doc.text(`TAX / VAT: ${result.taxRate}`, 100, yPos);
    yPos += 12;
    doc.line(14, yPos, pageWidth-14, yPos);
    yPos += 15;

    if (result.restrictions.length > 0) {
        addSection("Restrictions & Requirements", result.restrictions.join(", "));
    }
    
    if (result.requiredDocuments.length > 0) {
        addSection("Required Documents", result.requiredDocuments.join(", "));
    }

    // Similar Items in PDF
    if (result.similarItems && result.similarItems.length > 0) {
      // Check for page break
      if (yPos > 240) {
        doc.addPage();
        yPos = 20;
      }
      doc.setTextColor(0, 102, 255);
      doc.setFont('helvetica', 'bold');
      doc.text("SIMILAR CLASSIFICATIONS", 14, yPos);
      yPos += 10;
      
      result.similarItems.forEach((item, index) => {
         if (yPos > 270) { doc.addPage(); yPos = 20; }
         doc.setTextColor(26, 58, 82);
         doc.setFontSize(10);
         doc.setFont('helvetica', 'bold');
         doc.text(`${index + 1}. ${item.name} (${item.hsCode})`, 14, yPos);
         yPos += 5;
         doc.setTextColor(50, 50, 50);
         doc.setFont('helvetica', 'normal');
         doc.text(item.reason, 14, yPos);
         yPos += 10;
      });
    }

    doc.save(`Centrovert_HS_${result.hsCode}.pdf`);
  };

  // Get country code for flag
  const countryCode = countryCodes[region];
  const officialPortal = officialPortals[region];

  return (
    <div className="w-full animate-fade-in-up">
      {/* Main Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl shadow-slate-200 dark:shadow-black border border-slate-200 dark:border-slate-800 overflow-hidden">
        
        {/* Header */}
        <div className="border-b border-slate-100 dark:border-slate-800 p-6 md:p-8 flex flex-col md:flex-row gap-6 justify-between items-start md:items-center bg-white dark:bg-slate-900 relative overflow-hidden">
          {/* Decorative Top Accent */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-navy to-electric"></div>
          
          <div className="space-y-2 z-10">
             <div className="flex items-center gap-3">
                {/* Region Badge with Animated Flag */}
                <div className="flex items-center gap-2 border border-blue-100 dark:border-slate-700 bg-blue-50 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                  {countryCode && countryCode !== 'un' && (
                    <img 
                      src={`https://flagcdn.com/w40/${countryCode}.png`} 
                      alt={region}
                      className="w-4 h-4 rounded-sm object-cover motion-safe:animate-slide-in-flag motion-safe:animate-flag-wave"
                    />
                  )}
                  <span className="text-xs font-bold tracking-widest text-electric uppercase">{region}</span>
                </div>

                {result.source === 'Live API' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-navy text-white text-[10px] font-bold uppercase tracking-wider">
                      <Database className="w-3 h-3" /> Official Data
                    </span>
                ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider border border-slate-200 dark:border-slate-700">
                      <Bot className="w-3 h-3" /> AI Analysis
                    </span>
                )}
             </div>
             <h3 className="text-2xl font-bold text-navy dark:text-white">{result.productName}</h3>
          </div>
          
          <button 
              onClick={handleDownloadPDF}
              className="flex items-center gap-2 bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 text-navy dark:text-white border border-slate-200 dark:border-slate-700 text-xs font-bold px-5 py-3 rounded-lg transition-all shadow-sm uppercase tracking-wide group"
          >
              <Download className="w-4 h-4 text-electric group-hover:scale-110 transition-transform" />
              Export PDF
          </button>
        </div>

        <div className="grid md:grid-cols-12 gap-0">
          
          {/* Left: Code & Key Data */}
          <div className="md:col-span-4 bg-slate-50 dark:bg-slate-950/50 border-r border-slate-100 dark:border-slate-800 p-8 text-navy dark:text-white">
             <div className="sticky top-6">
                 <label className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-2 block">HS Classification Code</label>
                 <div className="flex items-center gap-4 mb-8 group cursor-pointer" onClick={handleCopy}>
                     <h2 className="text-5xl font-black tracking-tighter text-navy dark:text-white">
                        {result.hsCode}
                     </h2>
                     <div className="p-2 rounded-full bg-white dark:bg-slate-800 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity text-electric">
                        {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                     </div>
                 </div>

                 <div className="space-y-6">
                    <div>
                        <div className="flex justify-between text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase">
                            <span>Confidence Score</span>
                            <span className="text-electric">{getConfidenceDisplay(result.confidenceScore)}</span>
                        </div>
                        <div className="h-2 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-electric shadow-[0_0_10px_#0066ff] transition-all duration-1000 ease-out"
                                style={{ width: `${result.confidenceScore}%` }}
                            />
                        </div>
                    </div>

                    {/* Source Citation Display & Official Link */}
                    {result.sourceReference && (
                       <div className="flex flex-col gap-2 mt-2 p-3 bg-blue-50 dark:bg-slate-800 rounded-lg border border-blue-100 dark:border-slate-700">
                           <div className="flex items-start gap-2">
                             <BookOpen className="w-4 h-4 text-electric shrink-0 mt-0.5" />
                             <div>
                                <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                                    Verified Against:
                                </span>
                                <span className="text-xs font-semibold text-navy dark:text-white leading-tight block">
                                    {result.sourceReference}
                                </span>
                             </div>
                           </div>
                           
                           {officialPortal && (
                             <a 
                                href={officialPortal.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="mt-2 flex items-center justify-center gap-2 w-full py-2 bg-emerald-100 dark:bg-emerald-900/30 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800 rounded text-xs text-emerald-700 dark:text-emerald-400 transition-colors shadow-sm group/btn"
                             >
                                <Globe className="w-3 h-3 shrink-0" />
                                <span className="truncate">Verify on <strong className="font-bold">{officialPortal.name}</strong></span>
                                <ExternalLink className="w-3 h-3 ml-auto shrink-0 opacity-70 group-hover/btn:opacity-100" />
                             </a>
                           )}
                       </div>
                    )}

                    <div className="grid grid-cols-1 gap-3">
                        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
                            <span className="block text-slate-400 text-[10px] font-bold uppercase mb-1">Import Duty</span>
                            <span className="text-2xl font-bold text-navy dark:text-white">{result.dutyRate}</span>
                        </div>
                        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
                            <span className="block text-slate-400 text-[10px] font-bold uppercase mb-1">VAT / Taxes</span>
                            <span className="text-2xl font-bold text-navy dark:text-white">{result.taxRate}</span>
                        </div>
                    </div>
                 </div>
             </div>
          </div>

          {/* Right: Context & Details */}
          <div className="md:col-span-8 p-8 space-y-10 bg-white dark:bg-slate-900">
            
            <div>
                <h4 className="text-xs font-bold text-electric uppercase tracking-widest mb-4 flex items-center gap-2">
                    Official Description
                </h4>
                <div className="text-sm md:text-base text-slate-800 dark:text-slate-200 leading-relaxed font-medium font-mono bg-blue-50/50 dark:bg-slate-800/50 p-6 rounded-xl border border-blue-100 dark:border-slate-800">
                    {result.description}
                </div>
            </div>

            <div>
                 <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    Analysis Reasoning
                </h4>
                <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                    {result.reasoning}
                </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-8 pt-6 border-t border-slate-100 dark:border-slate-800">
                <div>
                     <h4 className="text-xs font-bold text-navy dark:text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-500" /> Restrictions
                    </h4>
                    {result.restrictions.length > 0 ? (
                         <ul className="space-y-3">
                            {result.restrictions.map((item, i) => (
                                <li key={i} className="flex items-start gap-3 text-xs text-slate-600 dark:text-slate-400">
                                    <span className="w-1.5 h-1.5 rounded-full bg-electric mt-1.5 shrink-0 shadow-[0_0_5px_#0066ff] animate-pulse"></span>
                                    {item}
                                </li>
                            ))}
                         </ul>
                    ) : (
                        <p className="text-xs text-slate-400">No restrictions detected.</p>
                    )}
                </div>

                <div>
                    <h4 className="text-xs font-bold text-navy dark:text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-500" /> Documentation
                    </h4>
                    <div className="flex flex-col gap-2">
                        {result.requiredDocuments.map((doc, i) => (
                            <span key={i} className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                <FileCheck className="w-3 h-3 text-electric" /> {doc}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            {/* Similar Items Section */}
            {result.similarItems && result.similarItems.length > 0 && (
              <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                 <h4 className="text-xs font-bold text-navy dark:text-white uppercase tracking-widest mb-6 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-electric" /> Similar Classifications
                </h4>
                <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800/50">
                      <tr>
                        <th className="px-4 py-3 font-semibold text-navy dark:text-white text-xs uppercase tracking-wider">Product</th>
                        <th className="px-4 py-3 font-semibold text-navy dark:text-white text-xs uppercase tracking-wider">HS Code</th>
                        <th className="px-4 py-3 font-semibold text-navy dark:text-white text-xs uppercase tracking-wider">Similarity</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {result.similarItems.map((item, index) => (
                        <tr key={index} className="hover:bg-blue-50/30 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-200">{item.name}</td>
                          <td className="px-4 py-3 font-mono text-electric font-bold">{item.hsCode}</td>
                          <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">{item.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
      
      <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-400 font-medium">
        <Info className="w-3 h-3" />
        <span>AI Generated. Always verify on the official {region} Customs portal.</span>
      </div>
    </div>
  );
};