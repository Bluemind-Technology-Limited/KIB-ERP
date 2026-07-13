import { useState } from 'react';
import { Layers, Plus, Database, AlertTriangle, Tag } from 'lucide-react';

interface BatchFormulationProps {
  searchQuery?: string;
}

export default function BatchFormulation({ searchQuery = '' }: BatchFormulationProps) {
  const [recipes] = useState([
    { id: '1', name: 'Curry Powder Premium Blend', sku: 'RC-SPC-CUR', description: 'Premium aromatic yellow curry seasoning formulation' },
    { id: '2', name: 'Barbecue Dry Rub Seasoning', sku: 'RC-SPC-BBQ', description: 'Smoky, sweet and hot barbecue seasoning rub' },
    { id: '3', name: 'Garam Masala Classic Spice Mix', sku: 'RC-SPC-GAR', description: 'Traditional warm Indian spice blending formulation' },
  ]);

  const [rawMaterials] = useState([
    { name: 'Turmeric Powder', sku: 'RM-SPC-TUR', stock: 12400, threshold: 5000, unit: 'kg' },
    { name: 'Ground Ginger', sku: 'RM-SPC-GIN', stock: 45000, threshold: 10000, unit: 'kg' },
    { name: 'Cayenne Pepper', sku: 'RM-SPC-CAY', stock: 8000, threshold: 15000, unit: 'kg' }, // Low stock!
    { name: 'Cardamom Extract', sku: 'RM-SPC-CAR', stock: 240, threshold: 100, unit: 'liters' },
  ]);

  const [selectedRecipe, setSelectedRecipe] = useState(recipes[0].id);
  const [targetQuantity, setTargetQuantity] = useState('5000');
  const [batches, setBatches] = useState<any[]>([
    { id: 'B-8812', number: 'BAT-2026-001', recipeName: 'Curry Powder Premium Blend', qty: 10000, status: 'COMPLETED' },
    { id: 'B-8813', number: 'BAT-2026-002', recipeName: 'Barbecue Dry Rub Seasoning', qty: 7500, status: 'PROCESSING' },
  ]);

  const filteredMaterials = rawMaterials.filter(m => 
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredBatches = batches.filter(b => 
    b.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.recipeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.status.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateBatch = (e: React.FormEvent) => {
    e.preventDefault();
    const recipe = recipes.find(r => r.id === selectedRecipe);
    if (!recipe) return;

    const newBatch = {
      id: `B-${Math.floor(Math.random() * 9000) + 1000}`,
      number: `BAT-2026-0${batches.length + 3}`,
      recipeName: recipe.name,
      qty: parseFloat(targetQuantity),
      status: 'SCHEDULED',
    };

    setBatches([newBatch, ...batches]);
  };

  return (
    <div className="space-y-6 text-[#171717]">
      <div>
        <h2 className="text-xl font-bold text-[#171717]">Production ERP &amp; Inventory</h2>
        <p className="text-xs text-[#737373]">Formulate and trigger production batches while reconciling raw material inventory.</p>
      </div>

      <div className="flex flex-col gap-6 w-full">
        
        {/* Row 1: Formulation Form Panel */}
        <div className="bg-white border border-[#E9E9E9] rounded-lg p-5">
          <h3 className="text-sm font-bold text-[#313131] flex items-center gap-2 mb-4">
            <Layers className="w-4 h-4 text-[#EA4335]" />
            Batch Formulation Calculator
          </h3>

          <form onSubmit={handleCreateBatch} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-[10px] font-semibold text-[#737373] uppercase tracking-wider mb-1.5">Select Recipe</label>
              <select
                value={selectedRecipe}
                onChange={(e) => setSelectedRecipe(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg py-2.5 px-3 text-xs text-[#171717] focus:outline-none focus:border-[#EA4335] cursor-pointer"
              >
                {recipes.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-[#737373] uppercase tracking-wider mb-1.5">Target Yield (kg)</label>
              <input
                type="number"
                value={targetQuantity}
                onChange={(e) => setTargetQuantity(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg py-2.5 px-3 text-xs text-[#171717] focus:outline-none focus:border-[#EA4335]"
              />
            </div>

            <button
              type="submit"
              className="btn-3d h-[38px] px-4 text-white text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-98 transition-transform cursor-pointer"
            >
              <Plus className="w-4 h-4 text-white" />
              <span>Trigger Batch</span>
            </button>
          </form>
        </div>

        {/* Row 2: Inventory Status Panel (Table representation) */}
        <div className="bg-white border border-[#E9E9E9] rounded-lg p-5">
          <h3 className="text-sm font-bold text-[#313131] flex items-center gap-2 mb-4">
            <Database className="w-4 h-4 text-[#EA4335]" />
            Raw Material Stocks
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F2F2F2] border-b border-[#E9E9E9] text-[#313131]">
                  <th className="py-3.5 px-4 font-semibold">Material Name</th>
                  <th className="py-3.5 px-3 font-semibold">SKU</th>
                  <th className="py-3.5 px-4 text-right font-semibold">Current Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E9E9E9]">
                {filteredMaterials.map((mat) => {
                  const isLow = mat.stock < mat.threshold;
                  return (
                    <tr key={mat.sku} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-4 flex items-center gap-2.5">
                        <Tag className="w-3.5 h-3.5 text-[#EA4335]" />
                        <span className="font-semibold text-[#313131]">{mat.name}</span>
                      </td>
                      <td className="py-4 px-3 text-[#737373] font-mono text-[10px]">{mat.sku}</td>
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className={`font-bold ${isLow ? 'text-[#EA4335]' : 'text-[#313131]'}`}>
                            {mat.stock.toLocaleString()} {mat.unit}
                          </span>
                          {isLow && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] text-[#EA4335] bg-[#EA4335]/10 px-1.5 py-0.5 rounded border border-[#EA4335]/25 font-semibold">
                              <AlertTriangle className="w-2.5 h-2.5" />
                              Reorder
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Row 3: Active Production Batches */}
        <div className="bg-white border border-[#E9E9E9] rounded-lg p-5">
          <h3 className="text-sm font-bold text-[#313131] mb-4">Live Production Runs</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F2F2F2] border-b border-[#E9E9E9] text-[#313131]">
                  <th className="py-3.5 px-4 font-semibold">Batch ID</th>
                  <th className="py-3.5 px-3 font-semibold">Recipe Name</th>
                  <th className="py-3.5 px-3 text-right font-semibold">Target Output</th>
                  <th className="py-3.5 px-4 text-right font-semibold">Run Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E9E9E9]">
                {filteredBatches.map((batch) => (
                  <tr key={batch.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-4 font-mono text-[#737373]">{batch.number}</td>
                    <td className="py-4 px-3 text-[#313131] font-semibold">{batch.recipeName}</td>
                    <td className="py-4 px-3 text-[#313131] text-right font-mono">{batch.qty.toLocaleString()} kg</td>
                    <td className="py-4 px-4 text-right">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold ${
                        batch.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-650 border border-emerald-555/20' :
                        batch.status === 'PROCESSING' ? 'bg-indigo-500/10 text-indigo-650 border border-indigo-555/20 animate-pulse' :
                        'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}>
                        {batch.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
